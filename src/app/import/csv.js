function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export function parseCsv(text) {
  const s = stripBom(String(text ?? ""));
  const rows = [];

  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }

    if (ch === "\r") {
      // Ignore CR in CRLF.
      continue;
    }

    field += ch;
  }

  row.push(field);
  rows.push(row);

  // Trim trailing empty rows.
  while (rows.length && rows[rows.length - 1].every((c) => String(c ?? "").trim() === "")) rows.pop();

  return rows;
}

export function rowsToObjects(rows) {
  const r = Array.isArray(rows) ? rows : [];
  if (r.length === 0) return { headers: [], records: [] };

  const headers = (r[0] ?? []).map((h) => String(h ?? "").trim());
  const headerKeys = headers.map((h) => h.toLowerCase());

  const records = [];
  for (let i = 1; i < r.length; i++) {
    const cells = r[i] ?? [];
    const obj = {};
    for (let j = 0; j < headerKeys.length; j++) {
      const k = headerKeys[j];
      if (!k) continue;
      obj[k] = cells[j] != null ? String(cells[j]) : "";
    }
    // Skip completely empty rows.
    const hasAny = Object.values(obj).some((v) => String(v ?? "").trim() !== "");
    if (hasAny) records.push(obj);
  }

  return { headers, records };
}

