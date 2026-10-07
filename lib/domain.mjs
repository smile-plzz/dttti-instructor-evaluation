export const QUESTIONS = [
  ["Clarity of explanation", "Was the topic explained clearly?"],
  ["Subject knowledge", "Did the instructor demonstrate good knowledge?"],
  ["Delivery method", "Did the teaching approach help you understand?"],
  [
    "Practical relevance",
    "Were examples or demonstrations useful to your work?",
  ],
  [
    "Presentation and materials",
    "Were slides, handouts or demonstrations clear?",
  ],
  [
    "Participation and questions",
    "Did the instructor encourage questions and respond helpfully?",
  ],
  [
    "Respect and support",
    "Did the instructor treat participants respectfully?",
  ],
  ["Time management", "Was the session time used effectively?"],
];
export function validRatings(r) {
  return (
    Array.isArray(r) &&
    r.length === 8 &&
    r.every((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5))
  );
}
export function summarize(rows) {
  const criteria = QUESTIONS.map((q, i) => {
    const values = rows.map((r) => r.ratings[i]).filter((v) => v !== null);
    return {
      title: q[0],
      count: values.length,
      mean: values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
      distribution: [1, 2, 3, 4, 5].map(
        (v) => values.filter((x) => x === v).length,
      ),
      na: rows.length - values.length,
    };
  });
  const means = criteria.map((c) => c.mean).filter((v) => v !== null);
  return {
    count: rows.length,
    overall: means.length
      ? means.reduce((a, b) => a + b, 0) / means.length
      : null,
    criteria,
  };
}
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
