import { describe, expect, it } from 'vitest';
import type { Case, Task } from '../types';
import { withoutStarterTasks } from './legacyCleanup';

const task = (over: Partial<Task>): Task => ({ id: 't', title: 'Prepare initial pleadings checklist', status: 'Not Started', ...over } as Task);
const file = (tasks: Task[]): Case => ({ id: 'CS-1', ref: 'X', title: 'Test v Test', tasks } as unknown as Case);

describe('withoutStarterTasks', () => {
  it('removes an untouched starter task', () => expect(withoutStarterTasks([file([task({})])])[0].tasks).toEqual([]));
  it('keeps a starter task someone started', () => expect(withoutStarterTasks([file([task({ status: 'In Progress' })])])[0].tasks).toHaveLength(1));
  it('keeps a starter task with notes', () => expect(withoutStarterTasks([file([task({ notes: 'called client' })])])[0].tasks).toHaveLength(1));
  it('keeps tasks people added', () => expect(withoutStarterTasks([file([task({ title: 'File defence' })])])[0].tasks).toHaveLength(1));
  it('returns the same file object when nothing changes', () => {
    const f = file([task({ title: 'File defence' })]);
    expect(withoutStarterTasks([f])[0]).toBe(f);
  });
});
