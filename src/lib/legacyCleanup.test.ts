import { describe, expect, it } from 'vitest';
import type { Case, Client, Task } from '../types';
import { casesWithoutSalutations, clientsWithoutSalutations, recordsWithoutSalutations, stripSalutation, withoutStarterTasks } from './legacyCleanup';

const task = (over: Partial<Task>): Task => ({ id: 't', title: 'Prepare initial pleadings checklist', status: 'Not Started', ...over } as Task);
const file = (tasks: Task[]): Case => ({ id: 'CS-1', ref: 'X', title: 'Test v Test', tasks } as unknown as Case);

describe('withoutStarterTasks', () => {
  it('removes an untouched starter task', () => expect(withoutStarterTasks([file([task({})])])[0].tasks).toEqual([]));
  it('removes a starter task even if its status was only moved', () => expect(withoutStarterTasks([file([task({ status: 'In Progress' })])])[0].tasks).toHaveLength(0));
  it('keeps a starter task someone finished', () => expect(withoutStarterTasks([file([task({ status: 'Completed', completedAt: '2025-05-01' })])])[0].tasks).toHaveLength(1));
  it('keeps a starter task with notes', () => expect(withoutStarterTasks([file([task({ notes: 'called client' })])])[0].tasks).toHaveLength(1));
  it('keeps tasks people added', () => expect(withoutStarterTasks([file([task({ title: 'File defence' })])])[0].tasks).toHaveLength(1));
  it('returns the same file object when nothing changes', () => {
    const f = file([task({ title: 'File defence' })]);
    expect(withoutStarterTasks([f])[0]).toBe(f);
  });
});

describe('salutations', () => {
  it('drops Mr / Mrs / Ms / Encik / Puan / Cik', () => {
    expect(stripSalutation('Mr. Ali Bin Abu')).toBe('Ali Bin Abu');
    expect(stripSalutation('Mrs Siti')).toBe('Siti');
    expect(stripSalutation('ms. Lee')).toBe('Lee');
    expect(stripSalutation('Puan Aminah')).toBe('Aminah');
    expect(stripSalutation('Encik Razak')).toBe('Razak');
  });
  it('keeps titles and names that only start with the same letters', () => {
    expect(stripSalutation("Dato' Sri Ahmad")).toBe("Dato' Sri Ahmad");
    expect(stripSalutation('Dr. Tan')).toBe('Dr. Tan');
    expect(stripSalutation('Msian Holdings Sdn Bhd')).toBe('Msian Holdings Sdn Bhd');
    expect(stripSalutation('Missy Ventures')).toBe('Missy Ventures');
    expect(stripSalutation('Mr')).toBe('Mr');
  });
  it('cleans clients and the client names on files', () => {
    const [c] = clientsWithoutSalutations([{ id: 'C1', name: 'Mr. Ali', salutation: 'Mr' } as unknown as Client]);
    expect(c.name).toBe('Ali'); expect('salutation' in c).toBe(false);
    const [k] = casesWithoutSalutations([{ id: 'K', clientName: 'Ms. Lee', clientsList: [{ id: 'C1', name: 'Mrs. Lee' }] } as unknown as Case]);
    expect(k.clientName).toBe('Lee'); expect(k.clientsList?.[0].name).toBe('Lee');
  });
});

describe('salutations on other records', () => {
  it('documents and partners', () => {
    expect(recordsWithoutSalutations('quotations', [{ clientName: 'Mr. Ali' }])[0]).toEqual({ clientName: 'Ali' });
    expect(recordsWithoutSalutations('receipts', [{ receivedFrom: 'Puan Siti', payee: 'Acme Sdn Bhd' }])[0]).toEqual({ receivedFrom: 'Siti', payee: 'Acme Sdn Bhd' });
    expect(recordsWithoutSalutations('referralPartners', [{ name: 'Ms. Lee', contact: '012' }])[0]).toEqual({ name: 'Lee', contact: '012' });
  });
  it('history is never changed', () => {
    const logs = [{ recordTitle: 'Mr. Ali' }];
    expect(recordsWithoutSalutations('auditLogs', logs)).toBe(logs);
  });
  it('opposing parties on files', () => {
    const [k] = casesWithoutSalutations([{ id: 'K', opposingParty: 'Encik Ahmad', opposingParties: ['Encik Ahmad'], opposingPartiesList: [{ id: 'O', name: 'Encik Ahmad' }] } as unknown as Case]);
    expect(k.opposingParty).toBe('Ahmad'); expect(k.opposingParties).toEqual(['Ahmad']); expect(k.opposingPartiesList?.[0].name).toBe('Ahmad');
  });
});

describe('old starter tasks and task copies', () => {
  const base = { id: 'C1', tasks: [] } as unknown as import('../types').Case;
  const t = (title: string, extra: Record<string, unknown> = {}) => ({ id: title, title, status: 'Not Started', priority: 'High', dueDate: '2025-04-20', assignedTo: '', taskType: 'Standard', ...extra });
  it('starter tasks go even after their status was moved on the board; worked-on ones stay', async () => {
    const { withoutStarterTasks } = await import('./legacyCleanup');
    const c = { ...base, tasks: [t('Confirm client instructions and opening documents', { status: 'In Progress' }), t('Review limitation dates and filing deadlines', { notes: 'Checked: 6 years' }), t('Draft defence')] } as unknown as import('../types').Case;
    expect(withoutStarterTasks([c])[0].tasks.map((x) => x.title)).toEqual(['Review limitation dates and filing deadlines', 'Draft defence']);
  });
  it('"Task Due:" copies leave the deadlines list; real deadlines stay', async () => {
    const { withoutTaskCopies } = await import('./legacyCleanup');
    expect(withoutTaskCopies([{ id: 'DL-TASK-T1' }, { id: 'DL-001' }]).map((d) => d.id)).toEqual(['DL-001']);
  });
});
