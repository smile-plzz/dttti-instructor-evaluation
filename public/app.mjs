import { QUESTIONS, csvCell } from "./domain.mjs";
import { createDemo } from "./demo.mjs";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let demo = null,
  configured = false,
  role = null,
  events = [],
  participant = null,
  credential = null,
  current = null,
  draft = null,
  report = null,
  pendingBatch = null,
  busy = false;
const labels = ["Very poor", "Poor", "Fair", "Good", "Excellent"];
const button = (label, action, cls = "secondary", data = "") =>
  `<button type="button" class="${cls}" data-action="${action}" ${data}>${label}</button>`;
const field = (label, name, placeholder = "", type = "text", extra = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" placeholder="${placeholder}" ${extra}></label>`;
async function request(action, body = {}) {
  if (demo) return demo(action, body);
  const res = await fetch("/api/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || "The request failed. Try again.");
  return d;
}
function error(e) {
  $("#notice").hidden = false;
  $("#notice").innerHTML =
    `${button("×", "dismiss", "secondary")}<span>${esc(e.message || e)}</span>`;
  $("#notice").focus();
}
function render(html) {
  $("#main").innerHTML = html;
  $("#main").focus({ preventScroll: true });
  window.scrollTo(0, 0);
  $("#banner").innerHTML = demo
    ? `<div class="demo-banner"><span><strong>Demonstration</strong> · Fictional data only. Reload resets all changes.</span>${button("Exit demo", "exit-demo", "secondary")}</div>`
    : "";
}
function home() {
  participant = credential = current = draft = report = null;
  render(
    `<section class="hero"><div><div class="eyebrow">A better learning experience</div><h1>Your experience.<br>Better teaching.</h1><p>Help strengthen the quality of training at DTTTI. Share thoughtful, confidential feedback on your instructors.</p><p class="intro">No account needed. No name attached to your answers.<br>About 2–3 minutes per instructor.</p></div><div class="card entry-card"><div class="eyebrow">For participants</div><h2>Begin your evaluation</h2><p class="small-text">Use the batch ID and private access code on your printed slip.</p><form id="entry">${field("Batch ID", "reference", demo ? "DTTTI001" : "e.g. A12B34C5", "text", 'required maxlength="8" autocomplete="off" class="code"')}${field("Private access code", "code", demo ? "DEMO-2026" : "Enter the code from your slip", "text", 'required maxlength="40" autocomplete="off" class="code"')}<button class="full" type="submit">Continue to evaluation <span aria-hidden="true">→</span></button></form><div class="help-block">Need a slip? Please contact your training coordinator.</div></div></section><section class="grid"><div class="feature"><div class="number">01 / CONFIDENTIAL</div><h3>Your name stays separate</h3><p>Access slips are distributed at random. Your roster entry is never attached to your answers.</p></div><div class="feature"><div class="number">02 / STRAIGHTFORWARD</div><h3>Eight clear criteria</h3><p>Rate your experience from Very poor to Excellent, or choose Not applicable.</p></div><div class="feature"><div class="number">03 / USEFUL</div><h3>Feedback that informs</h3><p>Combined reports help the institute improve teaching and future training.</p></div></section><section class="row help-block no-print"><div>${button("Staff sign in", "login", "link")}</div><div>${demo ? button("Open staff dashboard", "dashboard", "secondary") : button("Explore demonstration", "demo", "secondary")}</div></section>${!configured && !demo ? '<p class="small-text">Live collection is being configured. Explore the demonstration to review the participant and staff workflows.</p>' : ""}`,
  );
}
function login() {
  render(
    `<div class="very-narrow"><div class="eyebrow">Institute administration</div><h1>Staff sign in</h1><p>For authorised coordinators and principal reporting access.</p><div class="card"><form id="login">${field("Email address", "email", "", "email", 'required autocomplete="username"')}${field("Password", "password", "", "password", 'required autocomplete="current-password"')}<button type="submit" class="full">Sign in</button></form></div><div class="actions">${button("Back to participant entry", "home", "link")}</div><p class="help-block">Accounts are created by the project administrator. There is no public staff registration.</p></div>`,
  );
}
async function dashboard() {
  const d = await request("dashboard");
  role = d.role;
  events = d.events;
  participant = credential = current = draft = null;
  const active = events.filter((e) => e.status === "open"),
    closed = events.filter((e) => e.status === "closed");
  render(
    `<div class="row topline"><div><div class="eyebrow">${role === "principal" ? "Principal reporting" : "Training administration"}</div><h1>Evaluation overview</h1><p>Manage training feedback with clarity and confidence.</p></div><div class="actions">${role === "coordinator" ? button("+ Create batch", "create", "") : ""}${button("Sign out", "logout", "secondary")}</div></div>${demo ? `<div class="tabs no-print">${button("Coordinator view", "coordinator", role === "coordinator" ? "active" : "secondary")}${button("Principal view", "principal", role === "principal" ? "active" : "secondary")}${button("Participant view", "home", "secondary")}</div>` : ""}<div class="grid stats"><div class="card"><small>OPEN EVALUATIONS</small><div class="value">${active.length}</div><small>Currently accepting feedback</small></div><div class="card"><small>RESPONSES RECEIVED</small><div class="value">${events.reduce((a, e) => a + e.responses, 0)}</div><small>Across all instructor evaluations</small></div><div class="card"><small>CLOSED BATCHES</small><div class="value">${closed.length}</div><small>Ready for protected reporting</small></div></div><div class="row section-heading"><h2>Training batches</h2><span class="small-text">${events.length} ${events.length === 1 ? "batch" : "batches"}</span></div>${events.length ? `<div class="grid two">${events.map((e) => `<article class="card batch"><div class="row"><div class="eyebrow">BATCH ${esc(e.reference)}</div><span class="pill ${e.status}">${e.status === "draft" ? "Draft" : e.status === "open" ? "Evaluation open" : "Closed"}</span></div><h3>${esc(e.title)}</h3><p class="meta">${esc(e.label)}<br>${esc(e.start)} – ${esc(e.end)}${e.level ? " · " + esc(e.level) : ""}</p><div class="row small-text"><span>${e.eligible} participants · ${e.instructors} instructors</span><strong>${e.responses}/${e.eligible * e.instructors} responses</strong></div><div class="actions">${role === "coordinator" ? button("Manage batch", "manage", "secondary", `data-id="${e.id}"`) : ""}${e.status === "closed" ? button("View report", "report", "", `data-id="${e.id}"`) : '<span class="small-text">Results available after closure</span>'}</div></article>`).join("")}</div>` : '<div class="card empty"><h3>No batches yet</h3><p>Create the first training batch to begin.</p></div>'}<div class="callout section-heading"><strong>Privacy by design.</strong> Reports unlock only after closure and five responses per instructor. Completion is tracked in aggregate, never by participant name.</div>`,
  );
}
function create() {
  pendingBatch = null;
  render(
    `<div class="narrow"><div class="eyebrow">Training administration / New batch</div><h1>Create a training batch</h1><p>Enter the course, participants and instructors. Review everything before creating the draft.</p><form id="create"><section class="card stack"><h2>1. Course & batch</h2>${field("Course or seminar name", "title", "e.g. Competency-Based Training & Assessment", "text", 'required maxlength="180"')}${field("Batch or event label", "label", "e.g. October 2026 · Batch 04", "text", 'required maxlength="100"')}<div class="split">${field("Start date", "start", "", "date", "required")}${field("End date", "end", "", "date", "required")}</div>${field("NSDA level (optional)", "level", "e.g. Level 4", "text", 'maxlength="80"')}</section><section class="card section-heading"><h2>2. Participants</h2><p class="small-text">Enter one name per line, up to 100 participants. Names form a private roster and are never attached to access slips or answers.</p><label class="field"><span>Participant names</span><textarea name="participants" rows="7" required maxlength="15100" placeholder="Ayesha Begum&#10;Rahim Uddin&#10;…"></textarea></label><p id="roster-count" class="small-text" aria-live="polite">0 participants entered</p></section><section class="card"><h2>3. Instructors</h2><p class="small-text">Each participant may evaluate every instructor listed here.</p><div id="instructor-fields">${instructorFields(1)}</div>${button("+ Add another instructor", "add-instructor", "secondary")}</section><section class="card section-heading"><h2>4. Standard questionnaire</h2><p class="small-text">Version 1 · Eight criteria · No preselected answers · Optional comments</p><ol class="privacy-list">${QUESTIONS.map((q) => `<li>${q[0]}</li>`).join("")}</ol><p class="small-text">Scale: 1 Very poor · 2 Poor · 3 Fair · 4 Good · 5 Excellent · Not applicable.</p></section><div class="actions"><button type="submit">Review batch →</button>${button("Cancel", "dashboard", "secondary")}</div></form></div>`,
  );
}
function instructorFields(n) {
  return `<div class="instructor-edit">${field("Instructor " + n + " — full name", "instructor", "Full name", "text", 'required maxlength="150"')}${field("Session or topic (optional)", "topic", "Session or topic", "text", 'maxlength="150"')}${n > 1 ? button("Remove instructor", "remove-instructor", "link") : ""}</div>`;
}
function createReview() {
  const d = pendingBatch;
  $("#create").hidden = true;
  const box = document.createElement("section");
  box.id = "batch-review";
  box.className = "card section-heading";
  box.innerHTML = `<div class="eyebrow">Review before creating</div><h2>${esc(d.title)}</h2><p>${esc(d.label)} · ${esc(d.start)} – ${esc(d.end)}${d.level ? " · " + esc(d.level) : ""}</p><p><strong>${d.participants.length} participants</strong> and <strong>${d.instructors.length} instructors</strong></p><ul class="privacy-list">${d.instructors.map((t) => `<li>${esc(t.name)}${t.topic ? " — " + esc(t.topic) : ""}</li>`).join("")}</ul><p class="small-text">Roster entries and instructor assignments are fixed after creation. For corrections, leave the draft unopened and create a corrected batch.</p><div class="actions">${button("Create draft batch", "confirm-create", "")}${button("Back to edit", "edit-create", "secondary")}</div>`;
  $(".narrow").append(box);
  box.scrollIntoView({ behavior: "instant" });
}
function manage(id) {
  const e = events.find((e) => e.id === id);
  render(
    `<div class="narrow"><div class="eyebrow">Batch ${esc(e.reference)} / ${e.status}</div><h1>${esc(e.title)}</h1><p>${esc(e.label)} · ${e.eligible} participants · ${e.instructors} instructors</p><section class="card"><h2>Evaluation checklist</h2><ol class="privacy-list"><li>Review the private roster and standard questionnaire.</li><li>Generate the access slips and print them immediately.</li><li>Shuffle slips and distribute one to each participant. Keep no name-to-code register.</li><li>Open evaluation, then close it when participants have finished.</li></ol><div class="actions">${button("View private roster", "roster", "secondary", `data-id="${id}"`)}${e.status === "draft" && !e.codesIssued ? button("Generate access slips", "codes", "", `data-id="${id}"`) : ""}${e.status === "draft" && e.codesIssued ? button("Open evaluation", "open", "", `data-id="${id}"`) : ""}${e.status === "open" ? button("Close evaluation", "confirm-close", "danger", `data-id="${id}"`) : ""}${e.status === "closed" ? button("View report", "report", "", `data-id="${id}"`) : ""}</div>${e.codesIssued && e.status === "draft" ? '<p class="small-text help-block">Access slips have been issued. They cannot be retrieved again. Ensure they were printed before opening.</p>' : ""}</section><div class="callout section-heading">Participant entry: <strong>${esc(location.origin)}</strong><br>Batch ID: <strong>${esc(e.reference)}</strong><br>The private code is on each individual slip.</div><div class="actions">${button("Back to dashboard", "dashboard", "secondary")}</div></div>`,
  );
}
function slips(e, codes) {
  render(
    `<div class="no-print"><div class="eyebrow">Batch ${esc(e.reference)} / Access slips</div><h1>Print, shuffle, distribute.</h1><div class="callout warning"><strong>Print these ${codes.length} slips now.</strong> Codes are shown once and cannot be retrieved after you leave this page. Never record which named participant receives which code.</div><div class="actions">${button("Print access slips", "print", "")}${button("I have printed these slips", "printed", "secondary", `data-id="${e.id}"`)}</div></div><div class="slips">${codes.map((c) => `<article class="slip"><strong>DTTTI · Instructor Evaluation</strong><p>${esc(e.title)} — ${esc(e.label)}</p><p>Open: ${esc(location.origin)}</p><p>Batch ID: <strong>${esc(e.reference)}</strong></p><div class="slip-code">${esc(c.match(/.{1,8}/g).join("-"))}</div><p>Private access code · Keep this slip until you finish.</p><p>No account required. Do not put your name in comments.</p></article>`).join("")}</div>`,
  );
}
function instructors(message = "") {
  current = draft = null;
  render(
    `<div class="narrow"><div class="eyebrow">Participant evaluation / ${esc(participant.reference)}</div><h1>${message ? "Thank you for your feedback." : "Choose your instructor"}</h1><p>${esc(participant.title)} · ${esc(participant.label)}</p>${message ? `<div class="callout">${esc(message)}</div>` : ""}<div class="callout section-heading"><strong>Your name is not attached to your answers.</strong><p>Do not include names or identifying details in comments. Results are combined and shown only after evaluation closes with five or more responses per instructor. Free text and operational logs can still reveal identity.</p></div><div class="stack">${participant.instructors.map((t) => `<article class="card row"><div><h3>${esc(t.name)}</h3><p class="small-text">${esc(t.topic || "Instructor")}</p></div>${t.completed ? '<span class="pill open">✓ Submitted</span>' : button("Evaluate instructor →", "evaluate", "", `data-id="${t.id}"`)}</article>`).join("")}</div><div class="actions">${button(participant.instructors.every((t) => t.completed) ? "Finish & clear this device" : "End session & clear this device", "end-session", "secondary")}</div><p class="small-text help-block">Sharing a tablet? End the session before the next participant begins. Your answers and access code are held only in this page’s memory.</p></div>`,
  );
}
function questionnaire() {
  draft ??= { ratings: Array(8).fill(undefined), good: "", improve: "" };
  render(
    `<div class="narrow"><div class="eyebrow">Participant evaluation</div><h1>${esc(current.name)}</h1><p>${esc(current.topic)} · ${esc(participant.title)}</p><div class="row"><span class="step">STEP 1 OF 2 · YOUR EXPERIENCE</span><span id="answer-progress" class="small-text" aria-live="polite">${draft.ratings.filter((v) => v !== undefined).length}/8 rated</span></div><p class="small-text section-heading">Choose one answer for each criterion. Use Not applicable if you cannot judge.</p><form id="questionnaire">${QUESTIONS.map((q, i) => `<fieldset class="card rating-card"><legend>${i + 1}. ${q[0]}</legend><p class="question">${q[1]}</p><div class="rating-options">${[1, 2, 3, 4, 5, null].map((v, j) => `<label class="rating-option"><input type="radio" name="q${i}" value="${v === null ? "na" : v}" required ${draft.ratings[i] === v ? "checked" : ""}><strong>${v === null ? "N/A" : v}</strong><span>${v === null ? "Not applicable" : labels[j]}</span></label>`).join("")}</div></fieldset>`).join("")}<div class="card"><h2>Anything to add?</h2><p class="small-text">Optional. Please avoid names, contact details or information that could identify you or another person.</p><label class="field"><span>What worked well?</span><textarea name="good" maxlength="1000" rows="3">${esc(draft.good)}</textarea></label><label class="field"><span>What should improve?</span><textarea name="improve" maxlength="1000" rows="3">${esc(draft.improve)}</textarea></label></div><div class="actions"><button type="submit">Review your answers →</button>${button("Back to instructors", "back-instructors", "secondary")}</div></form></div>`,
  );
}
function review() {
  render(
    `<div class="narrow"><div class="eyebrow">Step 2 of 2 / Review</div><h1>Review your evaluation</h1><p>${esc(current.name)} · ${esc(participant.title)}</p><div class="card"><ul class="review-list">${QUESTIONS.map((q, i) => `<li><span>${q[0]}</span><strong>${draft.ratings[i] === null ? "Not applicable" : draft.ratings[i] + " — " + labels[draft.ratings[i] - 1]}</strong></li>`).join("")}</ul><div class="help-block"><strong>What worked well?</strong><p class="break-word">${esc(draft.good || "No comment")}</p><strong>What should improve?</strong><p class="break-word">${esc(draft.improve || "No comment")}</p></div></div><div class="callout section-heading">Submitting finalises this instructor’s evaluation. Please check your answers and remove identifying details from comments.</div><div class="actions">${button("Submit evaluation", "submit-evaluation", "")}${button("Back to edit", "edit-evaluation", "secondary")}</div><p class="small-text">Your answers are confirmed only after the server accepts them. If the connection fails, you can retry from this screen.</p></div>`,
  );
}
async function showReport(id) {
  report = await request("report", { data: { id } });
  const r = report;
  render(
    `<div class="no-print row topline"><div class="eyebrow">Principal reporting / Closed batch</div><div class="actions">${button("Print report", "print", "")}${button("Download summary CSV", "csv", "secondary")}${button("Back to dashboard", "dashboard", "secondary")}</div></div><header class="report-header"><h1>Instructor evaluation report</h1><h2>${esc(r.title)}</h2><p>${esc(r.label)} · ${esc(r.start)} – ${esc(r.end)}<br>Batch ${esc(r.reference)} · Questionnaire v${r.version} · ${r.eligible} eligible participants</p></header><div class="callout no-print"><strong>Reading these results.</strong> N/A ratings are excluded. Overall is the equal-weight mean of applicable criterion means. Results and comments require at least five responses. These reflect participant experience, not independent certification of competence.</div>${r.instructors
      .map((t) => {
        if (!t.summary)
          return `<section class="card section-heading"><h2>${esc(t.name)}</h2><div class="callout warning">${t.count} responses received. Results and comments are withheld until at least five responses are available.</div></section>`;
        const s = t.summary;
        return `<section class="card section-heading"><h2>${esc(t.name)}</h2><p class="small-text">${esc(t.topic)}</p><div class="report-summary"><div><small>RESPONSES</small><div class="value">${s.count}/${r.eligible}</div></div><div><small>COMPLETION</small><div class="value">${Math.round((s.count / r.eligible) * 100)}%</div></div><div><small>OVERALL MEAN</small><div class="value">${s.overall?.toFixed(2) ?? "N/A"}<small> / 5</small></div></div></div><div class="table-wrap"><table class="report-table"><thead><tr><th scope="col">Criterion</th><th scope="col">Mean / 5</th><th scope="col">Applicable</th><th scope="col">N/A</th><th scope="col">Distribution: 1 · 2 · 3 · 4 · 5</th></tr></thead><tbody>${s.criteria.map((c) => `<tr><th scope="row">${c.title}</th><td><strong>${c.mean?.toFixed(2) ?? "N/A"}</strong></td><td>${c.count}</td><td>${c.na}</td><td class="distribution">${c.distribution.join(" · ")}</td></tr>`).join("")}</tbody></table></div><h3 class="section-heading">Participant comments</h3>${t.comments.map((x) => `<div class="comment">${x.good ? `<small>WHAT WORKED WELL</small><p>${esc(x.good)}</p>` : ""}${x.improve ? `<small>WHAT SHOULD IMPROVE</small><p>${esc(x.improve)}</p>` : ""}${role === "coordinator" ? button("Hide identifying or inappropriate comment", "hide", "link small no-print", `data-id="${r.id || id}" data-response="${x.id}"`) : ""}</div>`).join("") || '<p class="small-text">No visible comments.</p>'}</section>`;
      })
      .join(
        "",
      )}<p class="small-text">Privacy policy: names and access codes are excluded. Avoid comparisons between different courses and small samples.</p>`,
  );
}
function downloadCSV() {
  const records = [
    ["DTTTI instructor evaluation", report.title, report.label],
    [
      "Instructor",
      "Responses",
      "Eligible",
      "Criterion",
      "Mean / 5",
      "Applicable",
      "Not applicable",
      "1",
      "2",
      "3",
      "4",
      "5",
    ],
  ];
  for (const t of report.instructors) {
    if (!t.summary) {
      records.push([
        t.name,
        t.count,
        report.eligible,
        "Withheld: fewer than five responses",
      ]);
      continue;
    }
    for (const c of t.summary.criteria)
      records.push([
        t.name,
        t.count,
        report.eligible,
        c.title,
        c.mean?.toFixed(2) ?? "N/A",
        c.count,
        c.na,
        ...c.distribution,
      ]);
  }
  const blob = new Blob(
    ["\uFEFF" + records.map((row) => row.map(csvCell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "DTTTI-" + report.reference + "-summary.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function act(a, target) {
  const id = target.dataset.id;
  if (a === "dismiss") {
    $("#notice").hidden = true;
    return;
  }
  if (a === "home" || a === "end-session") return home();
  if (a === "demo") {
    demo = createDemo();
    home();
    $("#entry [name=reference]").value = "DTTTI001";
    $("#entry [name=code]").value = "DEMO-2026";
    return;
  }
  if (a === "exit-demo") {
    demo = null;
    role = null;
    return home();
  }
  if (a === "login") return demo ? dashboard() : login();
  if (a === "dashboard") return dashboard();
  if (a === "coordinator" || a === "principal") {
    await request("role", { role: a });
    return dashboard();
  }
  if (a === "logout") {
    await request("logout");
    role = null;
    return home();
  }
  if (a === "create") return create();
  if (a === "add-instructor") {
    const n = $$("#instructor-fields .instructor-edit").length;
    if (n >= 20) throw new Error("Maximum 20 instructors.");
    $("#instructor-fields").insertAdjacentHTML(
      "beforeend",
      instructorFields(n + 1),
    );
    return;
  }
  if (a === "remove-instructor") {
    target.closest(".instructor-edit").remove();
    return;
  }
  if (a === "edit-create") {
    $("#batch-review").remove();
    $("#create").hidden = false;
    pendingBatch = null;
    return;
  }
  if (a === "confirm-create") {
    await request("create", { data: pendingBatch });
    pendingBatch = null;
    return dashboard();
  }
  if (a === "manage") return manage(id);
  if (a === "roster") {
    const d = await request("roster", { data: { id } });
    const box = document.createElement("section");
    box.className = "card section-heading";
    box.innerHTML =
      '<h2>Private participant roster</h2><ol class="privacy-list">' +
      d.names.map((n) => "<li>" + esc(n) + "</li>").join("") +
      "</ol>";
    $(".narrow").append(box);
    return;
  }
  if (a === "codes") {
    const e = events.find((e) => e.id === id);
    const d = await request("codes", { data: { id, count: e.eligible } });
    e.codesIssued = true;
    return slips(e, d.codes);
  }
  if (a === "printed") return manage(id);
  if (a === "open") {
    await request("transition", { data: { id, status: "open" } });
    return dashboard();
  }
  if (a === "confirm-close") {
    target.closest(".actions").innerHTML =
      `<div class="callout warning"><p>Closing ends collection permanently. Participants cannot submit after closure.</p><div class="actions">${button("Confirm closure", "close", "danger", `data-id="${id}"`)}${button("Cancel", "manage", "secondary", `data-id="${id}"`)}</div></div>`;
    return;
  }
  if (a === "close") {
    await request("transition", { data: { id, status: "closed" } });
    return dashboard();
  }
  if (a === "print") return window.print();
  if (a === "report") return showReport(id);
  if (a === "csv") return downloadCSV();
  if (a === "hide") {
    await request("hide", { data: { id, response: target.dataset.response } });
    return showReport(id);
  }
  if (a === "evaluate") {
    current = participant.instructors.find((t) => t.id === id);
    draft = null;
    return questionnaire();
  }
  if (a === "back-instructors") return instructors();
  if (a === "edit-evaluation") return questionnaire();
  if (a === "submit-evaluation") {
    const result = await request("submit", {
      ...credential,
      instructor: current.id,
      ...draft,
    });
    participant.instructors.find((t) => t.id === current.id).completed = true;
    return instructors(
      result.alreadySubmitted
        ? "This instructor’s evaluation was already received."
        : "Your evaluation has been received. Thank you.",
    );
  }
}
const $$ = (s) => Array.from(document.querySelectorAll(s));
async function guarded(fn) {
  if (busy) return;
  busy = true;
  const buttons = $$("button");
  buttons.forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    error(e);
  } finally {
    busy = false;
    buttons.forEach((b) => {
      if (b.isConnected) b.disabled = false;
    });
  }
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (t) guarded(() => act(t.dataset.action, t));
});
document.addEventListener("input", (e) => {
  if (e.target.name === "participants") {
    const count = e.target.value.split(/\r?\n/).filter((v) => v.trim()).length;
    $("#roster-count").textContent = count + " participants entered";
  }
  if (e.target.name?.startsWith("q") && $("#questionnaire")) {
    const done = $$("#questionnaire input:checked").length;
    $("#answer-progress").textContent = done + "/8 rated";
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  guarded(async () => {
    const f = new FormData(form);
    if (form.id === "entry") {
      credential = {
        reference: String(f.get("reference")).trim().toUpperCase(),
        code: String(f.get("code")).trim().toUpperCase(),
      };
      participant = await request("enter", credential);
      instructors();
    }
    if (form.id === "login") {
      await request("login", {
        email: f.get("email"),
        password: f.get("password"),
      });
      form.reset();
      await dashboard();
    }
    if (form.id === "create") {
      const participants = String(f.get("participants"))
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter(Boolean);
      if (
        participants.length < 1 ||
        participants.length > 100 ||
        new Set(participants.map((p) => p.toLowerCase())).size !==
          participants.length
      )
        throw new Error(
          "Enter 1–100 distinct participant names. Add an identifier for people sharing a name.",
        );
      if (f.get("start") > f.get("end"))
        throw new Error("End date must be on or after start date.");
      pendingBatch = {
        title: f.get("title"),
        label: f.get("label"),
        start: f.get("start"),
        end: f.get("end"),
        level: f.get("level"),
        participants,
        instructors: f
          .getAll("instructor")
          .map((name, i) => ({ name, topic: f.getAll("topic")[i] })),
      };
      createReview();
    }
    if (form.id === "questionnaire") {
      draft = {
        ratings: QUESTIONS.map((_, i) =>
          f.get("q" + i) === "na" ? null : Number(f.get("q" + i)),
        ),
        good: String(f.get("good")).trim(),
        improve: String(f.get("improve")).trim(),
      };
      review();
    }
  });
});
try {
  configured = (await (await fetch("/api/portal")).json()).configured;
} catch {}
home();
