import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { QuotationLineItem } from '../types';

type LineItemsEditorProps = {
  items: QuotationLineItem[];
  onChange: (items: QuotationLineItem[]) => void;
};

const categories: QuotationLineItem['category'][] = ['Fee - Fixed', 'Fee - SRO', 'Disbursement', 'Reimbursement'];
const categoryLabels: Record<QuotationLineItem['category'], string> = {
  'Fee - Fixed': 'Professional Fees',
  'Fee - SRO': 'Professional Fees',
  Disbursement: 'Disbursement',
  Reimbursement: 'Reimbursement',
};

const resolveLineItemAmount = (item: QuotationLineItem): number => {
  const quantity = Number(item.quantity ?? 1);
  const unitPrice = Number(item.unitPrice ?? item.amount ?? 0);
  const total = item.chargeType === 'Per Quantity' ? quantity * unitPrice : unitPrice;
  return Number.isFinite(total) ? total : 0;
};

const normalizeItem = (item: QuotationLineItem): QuotationLineItem => {
  const quantity = Number(item.quantity ?? 1);
  const unitPrice = Number(item.unitPrice ?? item.amount ?? 0);
  const chargeType = item.chargeType ?? (item.category === 'Disbursement' || item.category === 'Reimbursement' ? 'Per Quantity' : 'Fixed');
  const amount = chargeType === 'Per Quantity' ? quantity * unitPrice : unitPrice;
  return { ...item, quantity, unitPrice, chargeType, amount };
};

export const LineItemsEditor: React.FC<LineItemsEditorProps> = ({ items, onChange }) => {
  const updateItem = (index: number, updates: Partial<QuotationLineItem>) => {
    const updated = items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return normalizeItem({ ...item, ...updates });
    });
    onChange(updated);
  };

  const addItem = (category: QuotationLineItem['category'] = 'Fee - Fixed') => {
    const chargeType = category === 'Disbursement' || category === 'Reimbursement' ? 'Per Quantity' : 'Fixed';
    onChange([...items, normalizeItem({ description: '', category, quantity: 1, unitPrice: 0, chargeType, amount: 0 })]);
  };

  const removeItem = (index: number) => {
    if (items.length > 0) onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const sectionOrder: QuotationLineItem['category'][] = ['Fee - Fixed', 'Disbursement', 'Reimbursement'];
  const subtotal = items.reduce((total, item) => total + resolveLineItemAmount(normalizeItem(item)), 0);

  return (
    <div className="space-y-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-[#E5E7EB] dark:bg-[#15192A] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-bold uppercase text-[10px] text-[#16223A] dark:text-[#E8ECFF]">Billing line items</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Professional fees, disbursements, and reimbursements are entered by category.</div>
        </div>
      </div>

      <div className="space-y-3">
        {sectionOrder.map((category) => {
          const sectionItems = items
            .map((item, index) => ({ item: normalizeItem(item), index }))
            .filter(({ item }) => category === 'Fee - Fixed' ? item.category === 'Fee - Fixed' || item.category === 'Fee - SRO' : item.category === category);

          return (
            <section key={category} className="rounded-md border border-[#16223A]/20 dark:border-slate-700 bg-[#F3F4F6] dark:bg-[#1B2330] p-2 shadow-sm">
              <div className="mb-2 flex items-center justify-between rounded bg-[#16223A] px-2 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-white">{categoryLabels[category]}</span>
                <button type="button" onClick={() => addItem(category)} className="flex items-center gap-1 text-[10px] font-bold text-amber-200 hover:text-white cursor-pointer">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              <div className="space-y-2">
                {sectionItems.length > 0 ? sectionItems.map(({ item, index }) => (
                  <div key={`${index}-${item.category}-${item.description || 'row'}`} className="grid grid-cols-[minmax(0,1.7fr)_80px_120px_120px_26px] items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-[#111827]">
                    <input
                      value={item.description}
                      onChange={(event) => updateItem(index, { description: event.target.value })}
                      placeholder="Description"
                      className="min-w-0 w-full bg-transparent text-[11px] text-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity ?? 1}
                      onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 1 })}
                      className="w-full bg-transparent text-right font-mono text-[11px] text-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice ?? 0}
                      onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) || 0 })}
                      className="w-full bg-transparent text-right font-mono text-[11px] text-slate-800 dark:text-slate-100"
                    />
                    <div className="text-right font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                      {resolveLineItemAmount(normalizeItem(item)).toFixed(2)}
                    </div>
                    <button type="button" onClick={() => removeItem(index)} title="Remove line item" className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )) : (
                  <div className="text-[10px] italic text-slate-500 dark:text-slate-400">No {categoryLabels[category].toLowerCase()} added.</div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex justify-end border-t border-[#E1DCCF] dark:border-slate-700 pt-2 font-mono text-xs font-bold text-[#16223A] dark:text-[#E8ECFF]">
        Subtotal: RM {subtotal.toFixed(2)}
      </div>
    </div>
  );
};