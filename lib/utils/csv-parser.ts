import Papa from "papaparse";

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parsea texto CSV con header. Normaliza los nombres de columna a
 * minúsculas/trim e ignora líneas vacías. Los valores se devuelven como
 * strings (la validación de tipos/fechas la hace el schema después).
 */
export function parseCSV(text: string): ParsedCSV {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
    transform: (value) => value.trim(),
  });

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  };
}
