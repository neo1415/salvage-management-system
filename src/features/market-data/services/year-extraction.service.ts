/**
 * Year Extraction Service
 * 
 * Extracts 4-digit years from listing titles using regex patterns.
 * Validates years are within acceptable range (1980 to current year + 1).
 * 
 * Requirements: 2.1, 2.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

/**
 * Extract year from listing title
 * Returns null if no valid year found
 * 
 * Regex pattern matches years from 1980-2099
 * If multiple years present, extracts first occurrence
 */
export function extractYear(title: string): number | null {
  if (!title || typeof title !== 'string') {
    return null;
  }

  // Match 4-digit years: 1980-1999 or 2000-2099
  const yearPattern = /\b(19[89]\d|20[0-9]\d)\b/;
  const match = title.match(yearPattern);

  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);

  // Validate year is within acceptable range
  if (!isValidYear(year)) {
    return null;
  }

  return year;
}

/**
 * Validate year is within acceptable range
 * Range: 1980 to (current year + 1)
 * 
 * Allows current year + 1 to handle upcoming model years
 */
export function isValidYear(year: number): boolean {
  if (!year || typeof year !== 'number' || isNaN(year)) {
    return false;
  }

  const currentYear = new Date().getFullYear();
  const minYear = 1980;
  const maxYear = currentYear + 1;

  return year >= minYear && year <= maxYear;
}
