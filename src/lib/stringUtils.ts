import { stripSalutation } from './legacyCleanup';
/**
 * String Utility Functions for Data Normalization
 */

/**
 * Normalizes any string (e.g., client or lead name) to consistent Title Case format.
 * Handles names, honorifics, hyphenated names, and legal entity acronyms (e.g. "Sdn Bhd", "LLP").
 *
 * Examples:
 *   "DATIN ROHANI AHMAD" -> "Datin Rohani Ahmad"
 *   "syahmi bin hassan" -> "Syahmi Bin Hassan"
 *   "ACME SDN BHD" -> "Acme Sdn Bhd"
 */
function toTitleCase(str: string): string {
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
/** Title Case, without a courtesy salutation in front (Mr, Ms, Encik, Puan … — firm rule). */
export function normalizeClientName(name: string): string {
  return toTitleCase(stripSalutation(name));
}
