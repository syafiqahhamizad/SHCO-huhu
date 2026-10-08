/** Money in free text ("RM 1,250.00", "RM1250", "MYR 300") → "RM •••". */
const AMOUNT = /\b(?:RM|MYR)\s?-?\d[\d,]*(?:\.\d+)?\b/gi;
export const hideAmounts = (text: string): string => String(text ?? '').replace(AMOUNT, 'RM •••');
