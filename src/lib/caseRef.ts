/**
 * Rebuilds a file reference with new partner / lawyer codes, keeping everything from the matter
 * code onwards (matter code, client initials, running number, month-year). The people slots are
 * everything between "SHC" and the first matter/practice code, so stale or duplicated codes there
 * are replaced too. Partners are joined with '-' when the old ref did that ("SHC/SH-AH/…"),
 * otherwise one segment each. Returns null when the ref doesn't start with SHC/SHCO.
 *
 * Pure (no React / Firebase) so it can be unit-tested; used by cases/MatterModals.tsx.
 */
export const rebuildRef = (ref: string, newPartners: string[], newLawyer: string, matterCodes: string[]): string | null => {
  const segs = (ref || '').split('/');
  if (segs[0] !== 'SHC' && segs[0] !== 'SHCO') return null;
  const codes = new Set(matterCodes.map((x) => x.toUpperCase()));
  let anchor = segs.findIndex((x, i) => i > 0 && codes.has(x.toUpperCase()));
  if (anchor < 0) return null;
  const joined = segs.slice(1, anchor).some((x) => x.includes('-'));
  const sorted = [...newPartners].sort((a, b) => Number(b === 'SH') - Number(a === 'SH'));
  const partnerPart = sorted.length ? (joined ? [sorted.join('-')] : sorted) : [];
  return [segs[0], ...partnerPart, ...(newLawyer ? [newLawyer] : []), ...segs.slice(anchor)].join('/');
};
