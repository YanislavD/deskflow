// Zeichen, mit denen Excel/LibreOffice eine Zelle als FORMEL liest. Steht so etwas am Anfang
// eines Textes (z. B. ein Ticket-Titel "=HYPERLINK(...)"), könnte ein Angreifer beim Öffnen der
// Datei Code ausführen lassen ("CSV-Injection"). Ein vorangestelltes ' macht daraus normalen Text.
const FORMULA_START = /^[=+\-@\t\r]/

// Deutsche Excel-Versionen erwarten ";" als Trenner und für Umlaute ein BOM (Byte Order Mark,
// Zeichen U+FEFF) am Dateianfang, sonst erscheinen "Ã¼" statt "ü".
const BOM = String.fromCharCode(0xfeff)
const CRLF = String.fromCharCode(13, 10)

function toCell(value: string) {
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  // Zellen mit Trennzeichen, Anführungszeichen oder Zeilenumbruch müssen in "…" stehen
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Baut den CSV-Text aus einer Tabelle (Zeilen von Zellen). */
export function toCsv(rows: string[][]) {
  return BOM + rows.map((row) => row.map(toCell).join(';')).join(CRLF) + CRLF
}

/** Löst im Browser den Download einer Textdatei aus. */
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
