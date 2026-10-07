# Deployment and live activation

## Current release

A Vercel-hosted prototype with an explicit fictional demonstration. Live collection is deliberately disabled until Supabase is provisioned. No existing database was modified and no subscription upgraded. Public access is subject to approval because Vercel automatically enabled deployment sign-in protection.

## Free-plan provisioning blocker

The connected Supabase Free account already has two active projects. The free-project limit applies across all organizations in which the owner/admin participates. Paused projects do not count. Choose an existing project to pause through its dashboard, or use an institution-owned Supabase account with an available free slot. Do not pause an unrelated app without its owner's instruction. Creating another organization alone does not add slots.

Once a slot is available, confirm the target organization and a zero-cost free project before creation. Use the nearest available free region (Mumbai if available). No credit card, Pro trial, paid add-on, SMS or transactional email service is required. Supabase free projects may pause with inactivity. Vercel Hobby is intended for personal, non-commercial use; review plan eligibility before institutional adoption.

## Database and staff

1. Apply the SQL in `supabase/migrations/` once to the dedicated project.
2. Create staff Auth users in the Supabase dashboard. Use confirmed email/password accounts; invite email delivery is not needed. Disable public signup.
3. Insert each verified Auth user UUID into `public.portal_staff` with `coordinator` or `principal`. Do not derive roles from editable user metadata.
4. Check Supabase advisors and verify anon/authenticated cannot read any portal table or invoke the RPCs. Only server service_role may call them.
5. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and legacy JWT `SUPABASE_SERVICE_ROLE_KEY` directly in Vercel project environment settings for production. Never paste secret keys into chat or commit them. The legacy service-role JWT is required by this API's Bearer authentication. Pull into a gitignored local env only when locally testing against the same authorized dedicated project.
6. Redeploy and confirm `GET /api/portal` returns `configured: true`. The response exposes no keys. Unconfigured mutations return 503.
7. Test a fictional batch through the real API before entering participant data. Confirm role controls, code printing, simultaneous submissions using two browser contexts, closed-batch rejection and threshold protection.

## Operational readiness

Before real feedback: confirm naming/branding, shuffled-slip distribution, administrators, retention and log policies with the principal. Disable request body logging, analytics and replay; do not expose staff database credentials. Create a deletion/export process and test restore. Free-plan backups are not equivalent to a verified restoration process. Review anonymous comments before institutional sharing.

## Local checks

`npm ci`, `npm test`, `npm run build`.
`npm run preview` serves the built prototype at localhost:3000. It does not load `.env` automatically; configure the process environment explicitly only for authorized live tests. PGlite tests run real embedded Postgres SQL without external accounts. They verify schema, roles, RPC privileges, eligibility transactions and thresholds. Live hosted concurrency and institution usability remain separate pilot gates.

## Staff and participant flows

Staff logins expire in at most one hour and are stored only in HttpOnly SameSite Strict cookies. Enter a full random access code and batch ID on the home page. Codes are not participant accounts. The demonstration does not persist across reload or synchronise across devices. Real live data persists in Supabase. Never collect real names or answers in demonstration mode.

## Limits of version 1

Batch details, questionnaire and assignments are immutable after creation; corrections require a new unopened draft. Slips are issued once; lost slips cannot be replaced without risking duplicates. End-of-batch manual opening and closure, not automatic date cutoff. Eight fixed criteria. No QR image in this release; slips provide a web address and batch ID. No automatic retention deletion, named completion tracking, attendance, certificates, LMS or native mobile app.
