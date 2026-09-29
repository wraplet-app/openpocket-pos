/**
 * Minimal, deterministic CSV encode/decode (RFC-4180-ish): handles quoted
 * fields containing commas, quotes and newlines. Framework-free and tested.
 */

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a CSV string from a header row and body rows. */
export function toCsv(headers: string[], rows: readonly Cell[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCell).join(','));
  return lines.join('\n');
}

/** Parse CSV text into rows of string cells. Tolerates \n or \r\n and quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); rows.push(row); row = []; };

  while (i < n) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { endCell(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { endRow(); i++; continue; }
    cell += c; i++;
  }
  // flush trailing cell/row unless the input ended exactly on a newline
  if (cell.length > 0 || row.length > 0) endRow();
  // drop a single trailing empty row from a final newline
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}
