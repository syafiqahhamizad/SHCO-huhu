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

export const LineItemsEditor: React.FC<LineItemsEditorProps> = ({ items, onChange }) => {
  const updateItem = (index: number, updates: Partial<QuotationLineItem>) => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item));
  };

  const addItem = (category: QuotationLineItem['category'] = 'Fee - Fixed') => onChange([...items, { description: '', category, amount: 0 }]);
  const removeItem = (index: number) => {
    if (items.length > 1) onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-2 rounded-lg border border-slate-300 bg-[#E5E7EB] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div><div className="font-bold uppercase text-[10px] text-[#16223A]">Billing line items</div><div className="text-[10px] text-slate-500">Edit existing rows or add your own professional fees and recoverable costs.</div></div>
      </div>
      <div className="space-y-3">{categories.filter((category, index, all) => all.indexOf(category) === index && (category === 'Fee - Fixed' || category === 'Disbursement' || category === 'Reimbursement')).map((category) => {
        const sectionItems = items.map((item, index) => ({ item, index })).filter(({ item }) => category === 'Fee - Fixed' ? item.category === 'Fee - Fixed' || item.category === 'Fee - SRO' : item.category === category);
        return <section key={category} className="rounded-md border border-[#16223A]/20 bg-[#F3F4F6] p-2 shadow-sm"><div className="mb-2 flex items-center justify-between rounded bg-[#16223A] px-2 py-1.5"><span className="text-[10px] font-bold uppercase tracking-wide text-white">{categoryLabels[category]}</span><button type="button" onClick={() => addItem(category)} className="flex items-center gap-1 text-[10px] font-bold text-amber-200 cursor-pointer hover:text-white"><Plus className="h-3 w-3" /> Add</button></div><div className="space-y-2">{sectionItems.length > 0 ? sectionItems.map(({ item, index }) => <div key={`${index}-${item.category}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2"><input value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} placeholder="Description" className="min-w-0 w-full text-xs" /><select value={item.category} onChange={(event) => updateItem(index, { category: event.target.value as QuotationLineItem['category'] })} className="w-32 text-[10px]">{categories.map((option) => <option key={option} value={option}>{categoryLabels[option]}{option === 'Fee - SRO' ? ' (SRO)' : option === 'Fee - Fixed' ? ' (Fixed)' : ''}</option>)}</select><div className="flex items-center gap-1"><input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => updateItem(index, { amount: Number(event.target.value) || 0 })} className="w-24 text-right font-mono text-xs" /><button type="button" onClick={() => removeItem(index)} disabled={items.length === 1} title="Remove line item" className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button></div></div>) : <div className="text-[10px] italic text-slate-400">No {categoryLabels[category].toLowerCase()} added.</div>}</div></section>;
      })}</div>
      <div className="flex justify-end border-t border-[#E1DCCF] pt-2 font-mono text-xs font-bold text-[#16223A]">Subtotal: RM {items.reduce((total, item) => total + item.amount, 0).toFixed(2)}</div>
    </div>
  );
};