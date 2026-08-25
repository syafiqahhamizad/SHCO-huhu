import React, { useState } from 'react';
import { History, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ActivityLogsView: React.FC = () => {
  const { logs } = useApp();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.toLowerCase();
  const filteredLogs = logs.filter((log) => `${log.user} ${log.action} ${log.details}`.toLowerCase().includes(normalizedQuery));

  return (
    <div className="space-y-5 text-xs">
      <div className="bg-[#16223A] text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Read-only record</p><h2 className="font-serif text-xl font-bold mt-1">Activity Logs</h2><p className="text-slate-300 mt-1">Review recent actions across the practice system.</p></div>
        <div className="relative"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search activity" className="w-full sm:w-56 pl-8 pr-3 py-2 rounded-lg bg-white text-slate-800 border border-white/30 outline-none" /></div>
      </div>
      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#E1DCCF] flex items-center gap-2 font-bold text-[#16223A]"><History className="w-4 h-4 text-[#A9814A]" /> {filteredLogs.length} records</div>
        <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead className="bg-[#F6F4EE] text-[10px] uppercase text-slate-600"><tr><th className="p-3">Time</th><th className="p-3">User</th><th className="p-3">Action</th><th className="p-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredLogs.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-500">No activity records found.</td></tr> : filteredLogs.map((log, index) => <tr key={`${log.ts}-${index}`} className="hover:bg-slate-50"><td className="p-3 text-slate-500 whitespace-nowrap">{log.ts}</td><td className="p-3 font-bold text-slate-800">{log.user}</td><td className="p-3"><span className="px-2 py-1 rounded bg-slate-100 text-slate-800 font-bold">{log.action}</span></td><td className="p-3 text-slate-700">{log.details}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
};
