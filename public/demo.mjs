import { summarize } from "./domain.mjs";
const uid = () => crypto.randomUUID();
export function createDemo() {
  const active = {
    id: uid(),
    reference: "DTTTI001",
    title: "Competency-Based Training & Assessment",
    label: "October 2026 · Batch 04",
    level: "NSDA Level 4",
    start: "2026-10-05",
    end: "2026-10-09",
    status: "open",
    codesIssued: true,
    eligible: 30,
  };
  const closed = {
    id: uid(),
    reference: "DTTTI002",
    title: "Teaching Methods & Classroom Practice",
    label: "September 2026 · Batch 03",
    level: "",
    start: "2026-09-21",
    end: "2026-09-25",
    status: "closed",
    codesIssued: true,
    eligible: 25,
  };
  const teachers = [
    {
      id: uid(),
      name: "Amina Rahman",
      topic: "Assessment practice",
      event: active.id,
    },
    {
      id: uid(),
      name: "Farhan Ahmed",
      topic: "Instructional delivery",
      event: active.id,
    },
    {
      id: uid(),
      name: "Nadia Hasan",
      topic: "Teaching methods",
      event: closed.id,
    },
    {
      id: uid(),
      name: "Kamal Hossain",
      topic: "Classroom practice",
      event: closed.id,
    },
  ];
  const events = [active, closed],
    rows = [],
    codes = new Map([[active.id, new Set(["DEMO2026"])]]),
    used = new Set();
  let role = "coordinator";
  for (let i = 0; i < 6; i++)
    rows.push({
      id: uid(),
      event: closed.id,
      instructor: teachers[2].id,
      ratings: [4, 5, 4, i === 0 ? null : 4, 5, 4, 5, 4],
      good:
        i === 0
          ? "The practical examples made the sessions easy to follow."
          : "",
      improve: i === 1 ? "Allow more time for group exercises." : "",
    });
  for (let i = 0; i < 4; i++)
    rows.push({
      id: uid(),
      event: closed.id,
      instructor: teachers[3].id,
      ratings: [4, 4, 4, 4, 4, 4, 4, 4],
      good: "",
      improve: "",
    });
  for (let i = 0; i < 18; i++)
    rows.push({
      id: uid(),
      event: active.id,
      instructor: teachers[i % 2].id,
      ratings: [4, 4, 4, 5, 4, 4, 4, 5],
      good: "",
      improve: "",
    });
  const denied = () => {
    throw new Error("Coordinator access required.");
  };
  return async (action, b = {}) => {
    const data = b.data || {};
    const e = events.find((e) => e.id === data.id);
    if (action === "role") {
      role = b.role;
      return {};
    }
    if (action === "dashboard")
      return {
        role,
        events: events.map((e) => ({
          ...e,
          instructors: teachers.filter((t) => t.event === e.id).length,
          responses: rows.filter((r) => r.event === e.id).length,
        })),
      };
    if (action === "create") {
      if (role !== "coordinator") denied();
      if (
        data.participants.length < 1 ||
        data.participants.length > 100 ||
        data.start > data.end
      )
        throw new Error("Check participant count and dates.");
      const e = {
        ...data,
        id: uid(),
        reference: Math.random().toString(16).slice(2, 10).toUpperCase(),
        status: "draft",
        codesIssued: false,
        eligible: data.participants.length,
      };
      events.unshift(e);
      data.instructors.forEach((t) =>
        teachers.push({ ...t, id: uid(), event: e.id }),
      );
      return { id: e.id };
    }
    if (action === "codes") {
      if (role !== "coordinator") denied();
      if (!e || e.status !== "draft" || e.codesIssued)
        throw new Error("Slips have already been issued.");
      const list = Array.from({ length: e.eligible }, () => {
        const a = new Uint8Array(16);
        crypto.getRandomValues(a);
        return Array.from(a, (v) => v.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();
      });
      codes.set(e.id, new Set(list));
      e.codesIssued = true;
      return { codes: list, reference: e.reference };
    }
    if (action === "transition") {
      if (role !== "coordinator") denied();
      if (
        !e ||
        !(
          (e.status === "draft" && data.status === "open" && e.codesIssued) ||
          (e.status === "open" && data.status === "closed")
        )
      )
        throw new Error("Invalid batch transition.");
      e.status = data.status;
      return {};
    }
    if (action === "roster") {
      if (role !== "coordinator") denied();
      return {
        names:
          e.participants ||
          Array.from(
            { length: e.eligible },
            (_, i) => "Sample Participant " + (i + 1),
          ),
      };
    }
    if (action === "report") {
      if (e?.status !== "closed")
        throw new Error("Close evaluation before viewing results.");
      return {
        ...e,
        version: 1,
        instructors: teachers
          .filter((t) => t.event === e.id)
          .map((t) => {
            const r = rows.filter((r) => r.instructor === t.id);
            return {
              ...t,
              count: r.length,
              summary: r.length >= 5 ? summarize(r) : null,
              comments:
                r.length >= 5
                  ? r
                      .filter((x) => !x.hidden && (x.good || x.improve))
                      .map((x) => ({
                        id: x.id,
                        good: x.good,
                        improve: x.improve,
                      }))
                  : [],
            };
          }),
      };
    }
    if (action === "hide") {
      if (role !== "coordinator") denied();
      rows.find((r) => r.id === data.response).hidden = true;
      return {};
    }
    if (action === "enter" || action === "submit") {
      const event = events.find((e) => e.reference === b.reference);
      const code = b.code.toUpperCase().replaceAll("-", "").replaceAll(" ", "");
      if (!event || event.status !== "open" || !codes.get(event.id)?.has(code))
        throw new Error(
          "Invalid batch ID or access code, or evaluation is closed.",
        );
      if (action === "enter")
        return {
          ...event,
          instructors: teachers
            .filter((t) => t.event === event.id)
            .map((t) => ({
              ...t,
              completed: used.has(event.id + code + t.id),
            })),
        };
      const t = teachers.find(
        (t) => t.event === event.id && t.id === b.instructor,
      );
      if (!t) throw new Error("Instructor unavailable.");
      const key = event.id + code + t.id;
      if (used.has(key)) return { ok: true, alreadySubmitted: true };
      used.add(key);
      rows.push({
        id: uid(),
        event: event.id,
        instructor: t.id,
        ratings: b.ratings,
        good: b.good,
        improve: b.improve,
      });
      return { ok: true };
    }
    if (action === "logout") return {};
    throw new Error("Unknown operation.");
  };
}
