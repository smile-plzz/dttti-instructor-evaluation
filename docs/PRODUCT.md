# DTTTI Instructor Evaluation Portal

Implementation specification — 7 October 2026

## Purpose

Formal English-only, accessible instructor feedback for 20–100 participants per course or seminar. No prior paper form exists. Standard questionnaire v1: clarity, subject knowledge, delivery, practical relevance, presentation/materials, participation/questions, respect/support, and time management. Each has a required 1–5 or Not applicable selection; two comments are optional. No default rating.

## Workflows

Coordinator: sign in → create batch (course, dates, NSDA level, pasted roster, instructors/topics) → preview questionnaire → issue shuffled unassigned codes once → print slips → open → close → reports. Principal: aggregate dashboard and closed-batch reports; no roster or editing access. Participants: enter batch ID and code → choose instructor → rate → review → submit → remaining instructors → clear shared-device session.

## Privacy and eligibility

Roster never links to access codes. Codes use 128-bit randomness and SHA-256 hashes. Print slips are shown once, held only in browser memory, and must be distributed shuffled without a name register. One redemption per code and instructor, with a transaction and unique constraint. Anonymous answers contain no code, participant ID, redemption ID, precise submission time or persistent client identifier. Numerical results and comments are suppressed until closure and five responses per instructor. Not applicable is excluded from means; overall is the equal-weight mean of criterion means. Coordinator can hide identifying comments with a moderation audit entry; ratings remain unchanged.

Practical anonymity has limits: free text, network logs, database WAL and operational timing can support inference. No analytics/session replay, no answers or codes in URLs/logs; POST for credentials and evaluations; no participant storage. Infrastructure administrators remain privileged. Retention policy and log settings require institutional review before real collection. Initial proposed retention: remove rosters/codes 90 days after closure, aggregate reports 12 months; this is a policy proposal, not an automated job.

## Architecture

Dependency-free responsive HTML/CSS/JS frontend; Vercel Node 24 API; Supabase Auth for staff and Postgres for records. Service key is server-only. HttpOnly SameSite=Strict cookies, origin checks, input validation, locked batch transitions, and RLS on all tables with no direct public table grants. Privileged RPCs are SECURITY INVOKER, callable only by service_role. Server verifies Auth identity and staff role on every protected operation. Principal APIs cannot retrieve roster. No participant account, paid email/SMS, AI, native app or paid add-on.

## Release modes

Live mode requires all Supabase environment variables. Unconfigured APIs fail closed with 503. A separately selected demonstration mode runs fictional data in browser memory, is prominently labelled, and resets on reload. It never silently substitutes for real submissions. Public deployment can be reviewed in demo mode while provisioning is blocked. Do not enter real names or feedback in the demo.

## Current deployment constraint

The connected Supabase Free organization has two active projects: BetweenUs V1 and Mutual Maybe. Both existing projects are unrelated and must remain untouched. Supabase's two-project allowance applies across owner/admin organizations; opening another organization alone does not solve this. User must select an existing project to pause themselves, or supply an institution-owned free account/project. Never upgrade or require a card. Vercel Hobby can host the personal prototype; review Hobby's personal/non-commercial terms with the institution before adopting it for official operations.

## Acceptance

100-name setup; multiple instructors; no-login participant entry; keyboard/mobile form; review before submit; server acknowledgement; atomic duplicate rejection including concurrent requests; closed/invalid credentials rejected; no name/code in answers; five-response threshold; N/A calculation; principal permissions; shared-device clearing; CSV formula escaping; printable codes and reports. Browser prototype checks plus API unit tests and Postgres integration tests are recorded in QA.md. An institutional usability pilot and live provider verification remain required before real collection.
