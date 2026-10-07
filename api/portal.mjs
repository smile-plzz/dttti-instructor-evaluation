import { createHash, randomBytes } from "node:crypto";
import { validRatings, summarize } from "../lib/domain.mjs";
const config = () => ({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_PUBLISHABLE_KEY,
  secret: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
function fault(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
async function sb(
  path,
  body,
  { token, publicKey = false, method = "POST" } = {},
) {
  const c = config();
  const key = publicKey ? c.key : c.secret;
  const r = await fetch(c.url + path, {
    method,
    headers: {
      apikey: key,
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : { Authorization: `Bearer ${key}` }),
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await r.json().catch(() => null);
  if (!r.ok)
    throw fault(
      "The request could not be completed. Check your details and try again.",
      r.status === 401 ? 401 : 400,
    );
  return result;
}
const rpc = (name, p) => sb("/rest/v1/rpc/" + name, p);
async function staff(req) {
  const raw = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("dttti_session="))
    ?.slice(14);
  if (!raw) throw fault("Please sign in again.", 401);
  let token;
  try {
    token = decodeURIComponent(raw);
  } catch {
    throw fault("Please sign in again.", 401);
  }
  const user = await sb("/auth/v1/user", undefined, {
    token,
    publicKey: true,
    method: "GET",
  });
  if (!user?.id) throw fault("Please sign in again.", 401);
  return user.id;
}
function bounded(v, max, required = false) {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw fault("Please complete the required fields.");
  return v.trim();
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let status = 200,
    output;
  try {
    const c = config();
    const ready = Boolean(c.url && c.key && c.secret);
    if (req.method === "GET") {
      output = { configured: ready };
    } else if (req.method !== "POST") {
      throw fault("Method not allowed.", 405);
    } else {
      const origin = req.headers.origin;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      if (!origin || new URL(origin).host !== host)
        throw fault("Request origin rejected.", 403);
      if (
        !String(req.headers["content-type"] || "").startsWith(
          "application/json",
        )
      )
        throw fault("JSON request required.", 415);
      if (!ready)
        throw fault(
          "Live collection is not configured. Use the fictional demonstration.",
          503,
        );
      let b = req.body;
      if (typeof b === "string") {
        if (Buffer.byteLength(b) > 65536)
          throw fault("Request too large.", 413);
        b = JSON.parse(b);
      }
      if (!b || Buffer.byteLength(JSON.stringify(b)) > 65536)
        throw fault("Request too large.", 413);
      const action = b.action;
      if (action === "login") {
        const email = bounded(b.email, 254, true),
          password = b.password;
        if (typeof password !== "string" || !password || password.length > 256)
          throw fault("Enter your password.");
        const auth = await sb(
          "/auth/v1/token?grant_type=password",
          { email, password },
          { publicKey: true },
        );
        await rpc("portal_admin", {
          p_actor: auth.user.id,
          p_action: "dashboard",
          p_data: {},
        });
        res.setHeader(
          "Set-Cookie",
          `dttti_session=${encodeURIComponent(auth.access_token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.min(auth.expires_in || 3600, 3600)}${origin.startsWith("https:") ? "; Secure" : ""}`,
        );
        output = { ok: true };
      } else if (action === "logout") {
        res.setHeader(
          "Set-Cookie",
          "dttti_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0; Secure",
        );
        output = { ok: true };
      } else if (action === "enter" || action === "submit") {
        const reference = bounded(b.reference, 8, true).toUpperCase();
        const code = bounded(b.code, 40, true)
          .toUpperCase()
          .replaceAll("-", "")
          .replaceAll(" ", "");
        if (!/^[A-F0-9]{32}$/.test(code) || !/^[A-F0-9]{8}$/.test(reference))
          throw fault("Invalid batch ID or access code.");
        const hash = createHash("sha256").update(code).digest("hex");
        if (action === "enter")
          output = await rpc("portal_enter", {
            p_reference: reference,
            p_hash: hash,
          });
        else {
          if (
            !validRatings(b.ratings) ||
            !/^[0-9a-f-]{36}$/.test(b.instructor || "")
          )
            throw fault("Select a rating for every criterion.");
          output = await rpc("portal_submit", {
            p_reference: reference,
            p_hash: hash,
            p_instructor: b.instructor,
            p_ratings: b.ratings,
            p_good: bounded(b.good, 1000),
            p_improve: bounded(b.improve, 1000),
          });
        }
      } else {
        const actor = await staff(req);
        let data = b.data || {};
        if (action === "create") {
          data = {
            title: bounded(data.title, 180, true),
            label: bounded(data.label, 100, true),
            level: bounded(data.level || "", 80),
            start: bounded(data.start, 10, true),
            end: bounded(data.end, 10, true),
            participants: data.participants,
            instructors: data.instructors,
          };
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(data.start) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(data.end) ||
            data.start > data.end ||
            !Array.isArray(data.participants) ||
            data.participants.length < 1 ||
            data.participants.length > 100 ||
            !Array.isArray(data.instructors) ||
            data.instructors.length < 1 ||
            data.instructors.length > 20
          )
            throw fault(
              "Check dates, participants (1–100) and instructors (1–20).",
            );
          data.participants = data.participants.map((v) =>
            bounded(v, 150, true),
          );
          data.instructors = data.instructors.map((v) => ({
            name: bounded(v.name, 150, true),
            topic: bounded(v.topic || "", 150),
          }));
        }
        if (action === "codes") {
          const n = Number(data.count);
          if (!Number.isInteger(n) || n < 1 || n > 100)
            throw fault("Invalid slip count.");
          const codes = Array.from({ length: n }, () =>
            randomBytes(16).toString("hex").toUpperCase(),
          );
          output = await rpc("portal_admin", {
            p_actor: actor,
            p_action: action,
            p_data: {
              ...data,
              hashes: codes.map((v) =>
                createHash("sha256").update(v).digest("hex"),
              ),
            },
          });
          output = { ...output, codes };
        } else {
          if (
            ![
              "dashboard",
              "create",
              "transition",
              "report",
              "roster",
              "hide",
            ].includes(action)
          )
            throw fault("Unknown operation.");
          output = await rpc("portal_admin", {
            p_actor: actor,
            p_action: action,
            p_data: data,
          });
        }
      }
    }
  } catch (e) {
    status = e.status || 400;
    output = {
      error: e.status
        ? e.message
        : "The request could not be completed. Please try again.",
    };
  }
  if (output?.instructors && output?.version) {
    output.instructors = output.instructors.map((t) => {
      const { rows, ...rest } = t;
      return {
        ...rest,
        summary: rows ? summarize(rows) : null,
        comments: rows
          ? rows
              .filter((r) => r.good || r.improve)
              .map((r) => ({ id: r.id, good: r.good, improve: r.improve }))
          : [],
      };
    });
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(output));
}
