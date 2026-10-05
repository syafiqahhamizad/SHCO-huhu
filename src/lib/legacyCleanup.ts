import type { Case } from '../types';

/**
 * Titles of the starter tasks older versions added to every new file automatically.
 * They were never entered by anyone, so untouched copies are removed when files load.
 */
const OLD_STARTER_TASKS = new Set([
  'Collect grant and beneficiary documents',
  'Conduct title and bankruptcy searches',
  'Confirm client instructions and opening documents',
  'Confirm transaction parties and authority documents',
  'Prepare execution and completion documents',
  'Prepare initial pleadings checklist',
  'Prepare mitigation or trial strategy',
  'Prepare pre-trial case management bundle',
  'Prepare probate or administration filing',
  'Prepare transaction documents for review',
  'Review charge sheet and client instructions',
  'Review limitation dates and filing deadlines',
]);

/** Drops untouched auto-made starter tasks; a task someone started, noted or synced is kept. */
export const withoutStarterTasks = (cases: Case[]): Case[] =>
  cases.map((c) => {
    const tasks = c.tasks || [];
    const kept = tasks.filter(
      (t) => !(OLD_STARTER_TASKS.has(t.title) && t.status === 'Not Started' && !t.notes && !t.googleTasksSynced && !t.completedAt)
    );
    return kept.length === tasks.length ? c : { ...c, tasks: kept };
  });
