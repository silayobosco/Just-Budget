/**
 * Format a Date as a local calendar date string (YYYY-MM-DD).
 * Avoids `toISOString().slice(0, 10)` which converts to UTC and can shift dates
 * around midnight in non-UTC timezones (e.g. UTC+3 Africa/Dar_es_Salaam).
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add `days` to a YYYY-MM-DD local date string and return YYYY-MM-DD.
 */
export function addLocalDays(baseDateStr: string, days: number): string {
  const d = new Date(`${baseDateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

/**
 * Add `years` to a YYYY-MM-DD local date string and return YYYY-MM-DD.
 */
export function addLocalYears(baseDateStr: string, years: number): string {
  const d = new Date(`${baseDateStr}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return formatLocalDate(d);
}
