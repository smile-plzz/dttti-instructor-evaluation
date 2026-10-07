import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
test("Postgres privacy, roles, eligibility and report thresholds", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);`,
  );
  const files = (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  ).filter((f) => f.endsWith(".sql"));
  for (const f of files)
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + f, import.meta.url),
        "utf8",
      ),
    );
  const coordinator = "00000000-0000-4000-8000-000000000001",
    principal = "00000000-0000-4000-8000-000000000002";
  await db.exec(
    `insert into auth.users values('${coordinator}'),('${principal}');insert into public.portal_staff values('${coordinator}','coordinator'),('${principal}','principal');`,
  );
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from public.portal_roster"));
  await assert.rejects(
    db.query("select public.portal_enter('ABCDEF12','bad')"),
  );
  await db.exec("reset role;set role service_role");
  const admin = async (actor, action, data = {}) =>
    (
      await db.query("select public.portal_admin($1,$2,$3) as v", [
        actor,
        action,
        JSON.stringify(data),
      ])
    ).rows[0].v;
  await assert.rejects(admin(principal, "create", { title: "No permission" }));
  const data = {
    title: "Test course",
    label: "Batch A",
    level: "",
    start: "2026-10-01",
    end: "2026-10-07",
    participants: Array.from({ length: 100 }, (_, i) => "Participant " + i),
    instructors: [
      { name: "Teacher One", topic: "Methods" },
      { name: "Teacher Two", topic: "Practice" },
    ],
  };
  const e = await admin(coordinator, "create", data);
  const dashboard = await admin(principal, "dashboard");
  assert.equal(dashboard.events[0].eligible, 100);
  assert.equal(dashboard.events[0].instructors, 2);
  assert.ok(!JSON.stringify(dashboard).includes("Participant 0"));
  await assert.rejects(admin(principal, "roster", { id: e.id }));
  await assert.rejects(admin(principal, "report", { id: e.id }));
  await assert.rejects(
    admin(coordinator, "transition", { id: e.id, status: "open" }),
  );
  const hashes = Array.from({ length: 100 }, (_, i) =>
    i.toString(16).padStart(64, "0"),
  );
  await admin(coordinator, "codes", { id: e.id, hashes });
  await assert.rejects(admin(coordinator, "codes", { id: e.id, hashes }));
  await admin(coordinator, "transition", { id: e.id, status: "open" });
  const reference = dashboard.events[0].reference;
  const enter = async (hash) =>
    (
      await db.query("select public.portal_enter($1,$2) as v", [
        reference,
        hash,
      ])
    ).rows[0].v;
  await assert.rejects(enter("bad"));
  const entered = await enter(hashes[0]);
  const instructor = entered.instructors[0].id,
    other = entered.instructors[1].id;
  const submit = async (hash, id = instructor, ratings = Array(8).fill(4)) =>
    (
      await db.query("select public.portal_submit($1,$2,$3,$4,$5,$6) as v", [
        reference,
        hash,
        id,
        JSON.stringify(ratings),
        "Helpful examples",
        "",
      ])
    ).rows[0].v;
  await assert.rejects(submit(hashes[0], instructor, [0, 4, 4, 4, 4, 4, 4, 4]));
  await assert.rejects(submit("bad"));
  await assert.rejects(
    submit(hashes[0], "00000000-0000-4000-8000-000000000099"),
  );
  const repeat = await Promise.all([submit(hashes[0]), submit(hashes[0])]);
  assert.equal(repeat.filter((r) => r.alreadySubmitted).length, 1);
  assert.equal(
    (await db.query("select count(*)::int as n from public.portal_responses"))
      .rows[0].n,
    1,
  );
  await submit(hashes[0], other);
  for (let i = 1; i < 5; i++) await submit(hashes[i]);
  assert.equal(
    (await enter(hashes[0])).instructors.find((t) => t.id === instructor)
      .completed,
    true,
  );
  await assert.rejects(admin(principal, "report", { id: e.id }));
  await admin(coordinator, "transition", { id: e.id, status: "closed" });
  await assert.rejects(submit(hashes[6]));
  await assert.rejects(enter(hashes[6]));
  await assert.rejects(
    admin(coordinator, "transition", { id: e.id, status: "open" }),
  );
  const report = await admin(principal, "report", { id: e.id });
  assert.equal(
    report.instructors.find((t) => t.id === instructor).rows.length,
    5,
  );
  assert.equal(report.instructors.find((t) => t.id === other).rows, null);
  const response = report.instructors.find((t) => t.id === instructor).rows[0];
  await assert.rejects(
    admin(principal, "hide", { id: e.id, response: response.id }),
  );
  await admin(coordinator, "hide", { id: e.id, response: response.id });
  const hidden = await admin(coordinator, "report", { id: e.id });
  assert.equal(
    hidden.instructors
      .find((t) => t.id === instructor)
      .rows.find((r) => r.id === response.id).good,
    "",
  );
  const columns = (
    await db.query(
      "select column_name from information_schema.columns where table_name='portal_responses'",
    )
  ).rows.map((r) => r.column_name);
  for (const forbidden of [
    "hash",
    "code",
    "participant_id",
    "redemption_id",
    "created_at",
  ])
    assert.ok(!columns.includes(forbidden));
  const all = (
    await db.query(
      "select tablename,rowsecurity from pg_tables where schemaname='public' and tablename like 'portal_%'",
    )
  ).rows;
  assert.equal(all.length, 8);
  assert.ok(all.every((t) => t.rowsecurity));
  await db.close();
});
