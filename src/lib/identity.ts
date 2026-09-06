import { User } from '../types';

/**
 * Identity resolution for "is this mine?" checks.
 *
 * The data model stores the same person three different ways:
 *   Task.assignedTo        — display name in types.ts, partner code in initialData
 *   Deadline.partner/lawyer — partner code ('SH' | 'AH' | 'ZA')
 *   TimeEntry.feeEarner    — display name
 *   Expense.claimant       — display name
 *
 * Until those settle on a single userId, resolve a user to every token that
 * could legitimately refer to them and match against the set.
 *
 * Migration path: give each of the fields above a `…UserId` sibling, populate it
 * on write, then replace isMine() with a plain `x.assignedUserId === user.id`.
 */

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export const identityTokens = (user?: Partial<User> | null): Set<string> => {
  if (!user) return new Set();
  const name = String(user.name ?? '');
  const words = name.split(/\s+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join('');

  return new Set(
    [
      name,
      user.username,
      user.email,
      String(user.email ?? '').split('@')[0],
      user.id,
      initials,
      // 'Syafiqah Hamizad' -> 'SH'; also allow first-name-only records
      words[0],
      user.staffProfile?.staffId,
    ]
      .map(norm)
      .filter((s) => s.length > 0)
  );
};

/**
 * True when any token in `value` (a string, a comma/slash-separated list, or an
 * array) refers to the given identity.
 */
export const isMine = (value: unknown, tokens: Set<string>): boolean => {
  if (!value || tokens.size === 0) return false;
  const parts = Array.isArray(value) ? value : String(value).split(/[,/&]|\band\b/);
  return parts.some((p) => tokens.has(norm(p)));
};

/** Partner code for a user, when their name maps to one. */
export const partnerCode = (user?: Partial<User> | null): string | undefined => {
  const initials = String(user?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return ['SH', 'AH', 'ZA'].includes(initials) ? initials : undefined;
};
