# QA record — 7 October 2026

Story: coordinator creates a training batch and shuffled slips; participant enters a private code, reviews and submits anonymous instructor feedback; principal receives protected aggregate results after closure.

## Automated checks

Eight Node tests pass, including an embedded Postgres integration scenario:

- Invalid, missing and out-of-range ratings are rejected; all-N/A produces no numerical mean.
- Per-criterion applicable count, N/A counts, distribution and equal-weight overall formula match known samples.
- Summary CSV escapes spreadsheet formula prefixes and quotation marks.
- API reports configuration without secrets; unconfigured mutations fail closed; cross-origin requests and unsupported methods are rejected.
- 100-participant/multiple-instructor creation; principal denied create/roster/moderation.
- No direct anon table/RPC access; RLS enabled on all eight tables.
- Slips issue once; open requires issuance; invalid codes and incorrect instructors rejected.
- Repeated queued submissions redeem once; same code may evaluate the second instructor.
- Reports unavailable while open; fewer than five responses withheld; comments can be hidden without changing ratings.
- Closed batches reject entry/submission and cannot reopen.
- Anonymous response schema has no name, code/hash, participant/redemption ID or precise timestamp.

## Pending hosted checks

No Supabase project provisioned due to the free-project quota. No real participant records collected. Hosted Auth/RPC integration, real parallel transaction contention, provider advisors, operational log retention, restoration and institutional usability require the dedicated project and a pilot. PGlite serialises requests; queued retry tests are not a substitute for multi-connection concurrency verification.

## Browser checks

Chromium automated review passed at desktop 1440 px and mobile 390 px:

- Participant entry, N/A selection, comment entry, review, editing with preserved answers, confirmed submission and remaining instructors.
- Shared-device session clears the code; no localStorage or sessionStorage is used.
- Report threshold suppression, comment moderation and principal-only controls.
- Create and review a 100-name/two-instructor batch, print 100 slips, open and close evaluation.
- No horizontal overflow on mobile home or questionnaire; no JavaScript page errors.
- Desktop home, mobile questionnaire and report screenshots inspected for readable layout.
  The browser ran fictional demo data. This does not claim a live Supabase end-to-end test.
