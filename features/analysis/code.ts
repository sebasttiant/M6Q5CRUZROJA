export function formatAnalysisCode(sequence: number, year: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) throw new Error("El consecutivo debe estar entre 1 y 9999.");
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new Error("El año no es válido.");
  return `M6Q5-${String(sequence).padStart(4, "0")}-${year}`;
}
