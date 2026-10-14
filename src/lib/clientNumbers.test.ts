import { describe, expect, it } from 'vitest';
import { clientRef, nextClientNo, numberClients } from './clientNumbers';

describe('client numbers', () => {
  const clients = [
    { id: 'HQ-C004', createdAt: '2026-03-01T10:00:00Z' },
    { id: 'CL-2026-833', createdAt: '2026-01-05T10:00:00Z' },
    { id: 'HQ-C003' },
    { id: 'CL-2026-119', createdAt: '2026-09-01T10:00:00Z' },
  ];
  const files = [
    { clientIds: ['CL-2026-833'], opened: '2025-08-12' },
    { clientIds: ['CL-2026-833'], opened: '2026-02-01' },
    { clientIds: ['HQ-C003', 'HQ-C004'], opened: '2026-02-10' },
  ];
  it('one style; year = first file opened, else registration; one running number in order', () => {
    const m = numberClients(clients, files, 2026);
    expect(m.get('CL-2026-833')).toBe('CL-2025-001'); // first file opened in 2025
    expect(m.get('HQ-C003')).toBe('CL-2026-002'); // same file date as HQ-C004 → by key
    expect(m.get('HQ-C004')).toBe('CL-2026-003');
    expect(m.get('CL-2026-119')).toBe('CL-2026-004'); // no file: registration year
    expect(new Set(m.values()).size).toBe(4);
  });
  it('a client with no file and no date gets this year, at the end', () => {
    expect(numberClients([{ id: 'X' }], [], 2027).get('X')).toBe('CL-2027-001');
  });
  it('new clients continue the running number', () => {
    expect(nextClientNo(['CL-2025-001', 'CL-2026-004', undefined, 'HQ-C009'], 2026)).toBe('CL-2026-005');
    expect(nextClientNo([], 2026)).toBe('CL-2026-001');
  });
  it('shows the client number, else the old key', () => {
    expect(clientRef({ id: 'HQ-C001', clientNo: 'CL-2026-001' })).toBe('CL-2026-001');
    expect(clientRef({ id: 'HQ-C001' })).toBe('HQ-C001');
  });
});
