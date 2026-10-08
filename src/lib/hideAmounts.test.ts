import { describe, expect, it } from 'vitest';
import { hideAmounts } from './hideAmounts';

describe('hideAmounts', () => {
  it('hides every ringgit amount and keeps the rest', () => {
    expect(hideAmounts('Invoice INV-2026-004 paid RM 1,250.00 by Ali')).toBe('Invoice INV-2026-004 paid RM ••• by Ali');
    expect(hideAmounts('Claim RM300 and MYR 45.5 approved')).toBe('Claim RM ••• and RM ••• approved');
    expect(hideAmounts('Hearing on 12/10/2026 at 9.30')).toBe('Hearing on 12/10/2026 at 9.30');
  });
});
