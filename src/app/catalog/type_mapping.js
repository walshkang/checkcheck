const SUBJECT_TO_TYPE = [
  ["Fiction", "Fiction"],
  ["Literary fiction", "Fiction"],
  ["Speculative fiction", "Fiction"],
  ["Science fiction", "Fiction"],
  ["Fantasy", "Fiction"],
  ["Novel", "Fiction"],
  ["Short stories", "Short Stories"],
  ["Collected stories", "Short Stories"],
  ["Nonfiction", "Nonfiction"],
  ["Essays", "Essay"],
  ["Essay", "Essay"],
  ["Criticism", "Essay"],
  ["Biography", "Memoir"],
  ["Autobiography", "Memoir"],
  ["Memoir", "Memoir"],
  ["Poetry", "Poetry"],
  ["Poems", "Poetry"],
  ["Verse", "Poetry"]
];

function normalizeSubject(s) {
  return String(s || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function mapSubjectsToTypeSuggested(rawSubjects) {
  const subjects = Array.isArray(rawSubjects) ? rawSubjects : [];
  const normalized = new Set(subjects.map(normalizeSubject).filter(Boolean));
  if (normalized.size === 0) return null;

  for (const [subject, type] of SUBJECT_TO_TYPE) {
    if (normalized.has(normalizeSubject(subject))) return type;
  }
  return null;
}
