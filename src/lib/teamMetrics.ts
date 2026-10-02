/**
 * Shared, pure team / leave definitions used by Dashboard → Team and the Staff Portal tiles,
 * so both screens show the same numbers.
 */
import type { LeaveApplication } from '../types';

/** Mon–Fri days in [from, to] (inclusive, local dates). */
const workingDaysBetween = (from: Date, to: Date): number => {
  let n = 0;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  while (d.getTime() <= end) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
};
export const workingDaysInMonth = (year: number, month: number) => workingDaysBetween(new Date(year, month, 1), new Date(year, month + 1, 0));

/** Monthly hours target pro-rated to `now`: target × working days elapsed (incl. today) ÷ working days in the month. */
export const proRatedTarget = (monthlyTarget: number, now = new Date()): number => {
  const total = workingDaysInMonth(now.getFullYear(), now.getMonth());
  if (!total) return monthlyTarget;
  const elapsed = workingDaysBetween(new Date(now.getFullYear(), now.getMonth(), 1), now);
  return (monthlyTarget * elapsed) / total;
};

/** Firm annual-leave entitlement used by both the Staff Portal and Dashboard → Team. */
export const ANNUAL_LEAVE_DAYS = 16;

/**
 * Annual leave left this year. Approved AND pending applications both reduce the balance
 * (a pending request is a claim on the days); pending is returned separately so screens can
 * label it. Rejected / cancelled never count.
 */
export const annualLeaveBalance = (leaves: LeaveApplication[], userId: string, year = new Date().getFullYear(), entitlement = ANNUAL_LEAVE_DAYS) => {
  const mine = leaves.filter((l) => l.userId === userId && l.leaveType === 'Annual' && (l.startDate || '').startsWith(String(year)));
  const approved = mine.filter((l) => l.status === 'Approved').reduce((s, l) => s + Number(l.days || 0), 0);
  const pending = mine.filter((l) => l.status === 'Pending').reduce((s, l) => s + Number(l.days || 0), 0);
  return { entitlement, approved, pending, left: Math.max(0, entitlement - approved - pending) };
};
