/**
 * String Utility Functions for Data Normalization
 */

/**
 * Derives a URL/mention-safe username from a display name, e.g. "Amer Haiqal" -> "amerhaiqal".
 */
export function slugifyUsername(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join('');
}

/**
 * Returns a user's explicit username if set, otherwise derives one from their name.
 */
export function getUsername(user: { name: string; username?: string }): string {
  return (user.username || slugifyUsername(user.name)).replace(/[^a-z0-9]/gi, '');
}

/**
 * Normalizes any string (e.g., client or lead name) to consistent Title Case format.
 * Handles names, honorifics, hyphenated names, and legal entity acronyms (e.g. "Sdn Bhd", "LLP").
 *
 * Examples:
 *   "DATIN ROHANI AHMAD" -> "Datin Rohani Ahmad"
 *   "syahmi bin hassan" -> "Syahmi Bin Hassan"
 *   "ACME SDN BHD" -> "Acme Sdn Bhd"
 */
export function toTitleCase(str: string): string {
  if (!str) return '';

  const trimmed = str.trim().replace(/\s+/g, ' ');

  const specialAcronyms: Record<string, string> = {
    'sdn': 'Sdn',
    'bhd': 'Bhd',
    'llp': 'LLP',
    'plt': 'PLT',
    'inc': 'Inc',
    'ltd': 'Ltd',
    'corp': 'Corp',
    'co': 'Co',
    'nric': 'NRIC',
    'ssm': 'SSM',
    'roc': 'ROC',
    'rob': 'ROB',
  };

  return trimmed
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (specialAcronyms[lower]) {
        return specialAcronyms[lower];
      }
      if (word.includes('-')) {
        return word
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Pipeline helper to enforce normalized Title Case casing for Client names across the dashboard.
 */
export function normalizeClientName(name: string): string {
  return toTitleCase(name);
}
