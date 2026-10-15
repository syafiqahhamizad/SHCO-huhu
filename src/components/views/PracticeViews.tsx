import { askForm } from '../ui/askForm';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Clock,
  Calendar as CalendarIcon,
  Flag,
  Share2,
  Plus,
  ExternalLink,
} from 'lucide-react';

/* ================= 1. HEARINGS VIEW ================= */
export const HearingsView: React.FC = () => {
  const { cases, setCurrentCaseId, setCurrentView, setCaseSubTab } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);

  const allHearings: { caseRef: string; caseId: string; date: string; time: string; purpose: string; status: string; clientRole?: string }[] = [];
  (cases || []).forEach((c) => {
    (c.hearings || []).forEach((h) => {
      allHearings.push({
        caseRef: c.ref,
        caseId: c.id,
        date: h.date,
        time: h.time,
        purpose: h.purpose,
        status: h.status,
        clientRole: c.clientRole,
      });
    });
  });

  allHearings.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#3D6B9C]" />
          All Court Hearings &amp; Appearances
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Firm-wide list of scheduled court management sessions and trials.</p>
      </div>

      <div className="bg-white border border-[#DDE3EB] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F8FA] border-b border-[#DDE3EB] text-[10px] uppercase tracking-wider text-slate-600">
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Time</th>
              <th className="p-3 font-bold">Matter Reference</th>
              <th className="p-3 font-bold">Purpose</th>
              <th className="p-3 font-bold">Timing Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allHearings.map((h, i) => {
              const isToday = h.date === todayStr;
              const isPast = h.date < todayStr;

              return (
                <tr
                  key={i}
                  onClick={() => {
                    setCaseSubTab('court');
                    setCurrentCaseId(h.caseId);
                    setCurrentView('cases');
                  }}
                  className="hover:bg-[#F6F8FA] transition-colors cursor-pointer"
                >
                  <td className="p-3 font-mono font-semibold text-slate-800">{h.date}</td>
                  <td className="p-3 font-semibold text-slate-800">{h.time}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="ref-seal">{h.caseRef}</span>
                      {h.clientRole && (
                        <span className="text-[9.5px] font-extrabold text-[#3D6B9C] bg-[#FBF2E9] border border-[#3D6B9C]/30 px-1.5 py-0.2 rounded w-max">
                          Representing: {h.clientRole}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-medium text-slate-800">{h.purpose}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isToday
                          ? 'bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]'
                          : isPast
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-[#E7EEF6] text-[#3D6B9C]'
                      }`}
                    >
                      {isToday ? 'Today' : isPast ? 'Past' : 'Upcoming'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ================= 2. CALENDAR VIEW ================= */
export const CalendarView: React.FC = () => {
  const { cases } = useApp();
  const [calendarMode, setCalendarMode] = useState<'embed' | 'grid'>('embed');
  const firmCalendarEmbedUrl =
    'https://calendar.google.com/calendar/embed?src=c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668%40group.calendar.google.com&ctz=Asia%2FKuala_Lumpur';
  // Direct subscription link for logged-in Google Calendar users
  const firmCalendarSubscribeUrl =
    'https://calendar.google.com/calendar/u/0/r?cid=c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668%40group.calendar.google.com';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = now.toISOString().slice(0, 10);

  // Calendar Event Label Helper
  const getEventLabel = (purpose: string) => {
    const p = (purpose || '').toLowerCase();
    if (p.includes('trial') || p.includes('bicara')) {
      return { tag: 'Trial / Bicara', color: 'bg-[#FBEDE9] text-[#B23A2E] border-[#B23A2E]' };
    }
    if (p.includes('hearing') || p.includes('pendengaran') || p.includes('injunction') || p.includes('appeal')) {
      return { tag: 'Hearing', color: 'bg-[#FBF2E9] text-[#8A6D3B] border-[#8A6D3B]' };
    }
    if (p.includes('ptcm') || p.includes('mention') || p.includes('sebutan') || p.includes('case management')) {
      return { tag: 'PTCM / Mention', color: 'bg-[#E7EEF6] text-[#3D6B9C] border-[#3D6B9C]' };
    }
    if (p.includes('deadline') || p.includes('filing') || p.includes('compliance') || p.includes('had masa')) {
      return { tag: 'Filing Deadline', color: 'bg-[#F1EBF6] text-[#6B3D8C] border-[#6B3D8C]' };
    }
    return { tag: 'Consultation', color: 'bg-[#E6EFE9] text-[#2F6F4E] border-[#2F6F4E]' };
  };

  const eventsByDate: Record<string, { ref: string; fullRef: string; time: string; purpose: string }[]> = {};

  (cases || []).forEach((c) => {
    (c.hearings || []).forEach((h) => {
      if (!eventsByDate[h.date]) eventsByDate[h.date] = [];
      eventsByDate[h.date].push({
        ref: c.ref.split('/')[3] || c.ref,
        fullRef: c.ref,
        time: h.time,
        purpose: h.purpose,
      });
    });
  });

  const cells = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const evs = eventsByDate[dStr] || [];
    const isToday = dStr === todayStr;

    cells.push(
      <div
        key={d}
        className={`cal-cell flex flex-col justify-between p-2 min-h-[90px] border border-[#DDE3EB]/60 rounded-lg ${
          isToday ? 'bg-[#FBF2E9]/80 border-[#8A6D3B] ring-2 ring-amber-300 font-bold' : 'bg-white hover:bg-slate-50'
        }`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-mono text-slate-700 font-bold text-xs">{d}</span>
          {evs.length > 0 && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-[#F1EBF6] text-[#6B3D8C] rounded border border-[#F1EBF6]">
              {evs.length} Event{evs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="space-y-1 overflow-y-auto max-h-[80px]">
          {evs.map((e, idx) => {
            const labelInfo = getEventLabel(e.purpose);
            return (
              <div
                key={idx}
                className="bg-[#16223A]/8 hover:bg-[#16223A]/15 border border-[#3D6B9C]/30 p-1 rounded text-[9.5px] font-bold text-[#16223A] transition-colors"
                title={`${e.fullRef} — ${e.purpose}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{e.time} {e.ref}</span>
                  <span className={`text-[8px] font-extrabold border px-1 rounded flex items-center shrink-0 ${labelInfo.color}`}>
                    {labelInfo.tag}
                  </span>
                </div>
                <div className="text-[8.5px] font-normal text-slate-600 truncate mt-0.5">
                  {e.purpose}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Banner with Google Calendar Status Label */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#3D6B9C]" />
            <h2 className="font-serif text-lg font-bold text-[#16223A]">
              Messrs Syafiqah Hamizad &amp; Co — Official Firm Google Calendar
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time synchronization with firm court dates, hearings, client consultations, and statutory filing deadlines.
          </p>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#F6F8FA] p-1 rounded-lg border border-[#DDE3EB]">
            <button
              type="button"
              onClick={() => setCalendarMode('embed')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                calendarMode === 'embed'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-[#8A6D3B]" />
              <span>Live Google Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setCalendarMode('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                calendarMode === 'grid'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-[#3D6B9C]" />
              <span>Court Diary Grid</span>
            </button>
          </div>

          <a
            href={firmCalendarSubscribeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#2F6F4E] hover:bg-[#2F6F4E] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#E6EFE9]" />
            <span>Add / Open in Signed-In Google Calendar</span>
          </a>
        </div>
      </div>

      {/* Main Content Area: Embedded Google Calendar vs Interactive Grid */}
      {calendarMode === 'embed' ? (
        <div className="bg-white border border-[#DDE3EB] rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#F6F8FA] p-3 rounded-lg border border-[#DDE3EB] text-xs gap-2">
            <span className="font-bold text-[#16223A] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2F6F4E] animate-pulse" />
              Connected Google Calendar: <code className="font-mono text-[11px] text-[#3D6B9C] bg-[#E7EEF6] px-1.5 py-0.5 rounded border border-[#E7EEF6]">c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668@group.calendar.google.com</code>
            </span>
            <span className="text-slate-600 text-[11px] font-semibold bg-[#FBF2E9] text-[#8A6D3B] px-2 py-0.5 rounded border border-[#8A6D3B]">
              Timezone: Asia/Kuala_Lumpur
            </span>
          </div>

          {/* Color Labels Guideline Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>🎨 Firm Google Calendar Color Taxonomy:</span>
              <span className="text-[10.5px] font-normal text-slate-500">(Colors display as set in your signed-in Google Calendar UI)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-[#FBEDE9] text-[#B23A2E] border border-[#B23A2E]">
                🔴 Trial / Bicara (Flamingo Red)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]">
                🟡 Hearing / Pendengaran (Banana Amber)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E7EEF6] text-[#3D6B9C] border border-[#3D6B9C]">
                🔵 PTCM / Mention (Peacock Blue)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F1EBF6] text-[#6B3D8C] border border-[#6B3D8C]">
                🟣 Filing Deadline (Grape Purple)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E6EFE9] text-[#2F6F4E] border border-[#2F6F4E]">
                🟢 Client Consultation (Sage Green)
              </span>
            </div>
          </div>

          <div className="w-full rounded-lg overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
            <iframe
              src={firmCalendarEmbedUrl}
              style={{ border: 0 }}
              width="100%"
              height="700"
              frameBorder="0"
              scrolling="no"
              title="Messrs Syafiqah Hamizad & Co Firm Google Calendar"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs space-y-3">
          <div className="flex flex-wrap justify-between items-center text-xs font-bold text-[#16223A] gap-2">
            <span className="font-serif text-sm">
              {now.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
            </span>

            {/* Color-Coded Google Calendar Label Badges */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-[#FBEDE9] text-[#B23A2E] border border-[#B23A2E]">
                🔴 Trial / Bicara
              </span>
              <span className="px-2 py-0.5 rounded bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]">
                🟡 Hearing / Pendengaran
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E7EEF6] text-[#3D6B9C] border border-[#3D6B9C]">
                🔵 PTCM / Mention
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F1EBF6] text-[#6B3D8C] border border-[#6B3D8C]">
                🟣 Filing Deadline
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E6EFE9] text-[#2F6F4E] border border-[#2F6F4E]">
                🟢 Consultation
              </span>
            </div>
          </div>

          <div className="cal-grid text-center font-bold text-[10px] text-slate-500 uppercase pb-1.5 border-b border-slate-200">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div className="cal-grid gap-1">{cells}</div>
        </div>
      )}
    </div>
  );
};

/* ================= 6. DEADLINES VIEW ================= */
export const DeadlinesView: React.FC = () => {
  const { deadlines, cases, setCurrentCaseId, setCurrentView, setCaseSubTab } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Flag className="w-5 h-5 text-[#B23A2E]" />
          Statutory Limitations &amp; Court Filing Deadlines
        </h2>
      </div>

      <div className="bg-white border border-[#DDE3EB] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F8FA] border-b border-[#DDE3EB] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Matter Ref</th>
              <th className="p-3 font-bold">Title</th>
              <th className="p-3 font-bold">Type</th>
              <th className="p-3 font-bold">Due Date</th>
              <th className="p-3 font-bold">Countdown</th>
              <th className="p-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deadlines.map((d) => {
              const cs = cases.find((c) => c.id === d.caseId);
              const days = Math.round((new Date(d.dueDate).getTime() - new Date(todayStr).getTime()) / 86400000);

              return (
                <tr
                  key={d.id}
                  onClick={() => {
                    if (cs) {
                      setCaseSubTab('tasks');
                      setCurrentCaseId(cs.id);
                      setCurrentView('cases');
                    }
                  }}
                  className="hover:bg-[#F6F8FA] cursor-pointer"
                >
                  <td className="p-3">
                    <span className="ref-seal">{cs ? cs.ref : '—'}</span>
                  </td>
                  <td className="p-3 font-bold text-[#16223A]">{d.title}</td>
                  <td className="p-3 font-semibold text-[#6B3D8C]">{d.type}</td>
                  <td className="p-3 font-mono">{d.dueDate}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        days < 0
                          ? 'bg-[#FBEDE9] text-[#B23A2E]'
                          : days <= 7
                          ? 'bg-[#FBF2E9] text-[#8A6D3B]'
                          : 'bg-[#E6EFE9] text-[#2F6F4E]'
                      }`}
                    >
                      {days < 0 ? `Overdue ${Math.abs(days)}d` : `${days}d remaining`}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-[#E7EEF6] text-[#3D6B9C] rounded text-[10px] font-bold">
                      {d.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ================= 8. REFERRAL VIEW ================= */
export const ReferralView: React.FC = () => {
  const { referralPartners = [], cases = [], addReferralPartner, updateReferralPartner, deleteReferralPartner, isAdmin, currentUser } = useApp();
  const canManage = Boolean(isAdmin || currentUser?.isAdmin || currentUser?.isSuperAdmin);
  const editRef = (r: (typeof referralPartners)[number]) => {
    void askForm('Edit ' + r.name, [
      { key: 'name', label: 'Name', value: r.name, required: true },
      { key: 'contact', label: 'Contact', value: r.contact || '' },
      { key: 'type', label: 'Commission type (Percentage / Flat / None)', value: r.commissionType },
      { key: 'value', label: 'Commission (% or RM per file)', value: String(r.commissionValue || 0) },
      { key: 'owed', label: 'Amount owed (RM)', value: String(r.amountOwed || 0) },
      { key: 'notes', label: 'Notes', value: r.notes || '' },
    ]).then((f) => { if (!f) return; const t = /flat/i.test(f.type) ? 'Flat' : /none/i.test(f.type) ? 'None' : 'Percentage'; updateReferralPartner(r.id, { name: f.name.trim(), contact: f.contact.trim(), commissionType: t, commissionValue: Number(f.value) || 0, amountOwed: Number(f.owed) || 0, notes: f.notes.trim() }); });
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refName, setRefName] = useState('');
  const [refType, setRefType] = useState<'External' | 'Partner' | 'Internal Staff'>('External');
  const [refContact, setRefContact] = useState('');
  const [refCommType, setRefCommType] = useState<'Percentage' | 'Flat' | 'None'>('Percentage');
  const [refCommVal, setRefCommVal] = useState('10');
  const [refAmountOwed, setRefAmountOwed] = useState('0');
  const [refPayStatus, setRefPayStatus] = useState<'Paid' | 'Owing' | 'N/A'>('Owing');
  const [refNotes, setRefNotes] = useState('');

  const matterCounts: Record<string, number> = {};
  (cases || []).forEach((cs) => {
    if (cs.referredBy) matterCounts[cs.referredBy] = (matterCounts[cs.referredBy] || 0) + 1;
  });

  const handleSaveReferral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refName.trim()) return;

    addReferralPartner({
      id: `REF-${Date.now()}`,
      name: refName.trim(),
      type: refType,
      contact: refContact,
      commissionType: refCommType,
      commissionValue: parseFloat(refCommVal) || 0,
      amountOwed: parseFloat(refAmountOwed) || 0,
      paymentStatus: refPayStatus,
      lastPaymentDate: new Date().toISOString().slice(0, 10),
      notes: refNotes,
      active: true,
    });

    setIsModalOpen(false);
    setRefName('');
    setRefContact('');
    setRefNotes('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#3D6B9C]" />
            Referral Sources &amp; Commission Tracking
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Key in referral partners, introduced leads, and commission details.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#16223A] hover:bg-[#16223A] text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Record Referral</span>
        </button>
      </div>

      <div className="bg-white border border-[#DDE3EB] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F8FA] border-b border-[#DDE3EB] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Referral Partner</th>
              <th className="p-3 font-bold">Type</th>
              <th className="p-3 font-bold">Contact</th>
              <th className="p-3 font-bold">Arrangement</th>
              <th className="p-3 font-bold text-right">Matters Brought In</th>
              <th className="p-3 font-bold text-right">Amount Owed (RM)</th>
              <th className="p-3 font-bold">Payment Status</th>
              {canManage && <th className="p-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(referralPartners || []).map((r) => (
              <tr key={r.id} className="hover:bg-[#F6F8FA]">
                <td className="p-3 font-bold text-[#16223A]">
                  <div>{r.name}</div>
                  {r.notes && <div className="text-[10px] font-normal text-slate-500">{r.notes}</div>}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-[#F1EBF6] text-[#6B3D8C] rounded text-[10px] font-bold">
                    {r.type}
                  </span>
                </td>
                <td className="p-3 text-slate-700">{r.contact || '—'}</td>
                <td className="p-3 text-slate-700">
                  {r.commissionType} ({r.commissionValue}{r.commissionType === 'Percentage' ? '%' : ' RM'})
                </td>
                <td className="p-3 text-right font-mono font-bold text-slate-800">
                  {matterCounts[r.id] || 0}
                </td>
                <td className="p-3 text-right font-mono text-slate-800">
                  RM {r.amountOwed.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.paymentStatus === 'Paid' ? 'bg-[#E6EFE9] text-[#2F6F4E]' : 'bg-[#FBF2E9] text-[#8A6D3B]'
                    }`}
                  >
                    {r.paymentStatus}
                  </span>
                </td>
                {canManage && <td className="p-3 whitespace-nowrap text-right">
                  <button type="button" onClick={() => editRef(r)} className="mr-3 cursor-pointer border-0 bg-transparent p-0 text-[11px] font-bold text-[#3D6B9C]">Edit</button>
                  <button type="button" onClick={() => { if (window.confirm('Delete referral partner ' + r.name + '? Leads and clients that name them keep the name.')) deleteReferralPartner(r.id); }} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-bold text-[#B23A2E]">Delete</button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Referral Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#DDE3EB]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3">Key In New Referral Source / Partner</h3>
            <form onSubmit={handleSaveReferral} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Referral / Source Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dato' Roslan / Maybank Legal Dept"
                  value={refName}
                  onChange={(e) => setRefName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Source Type</label>
                  <select
                    value={refType}
                    onChange={(e) => setRefType(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="External">External Agent / Outsider</option>
                    <option value="Partner">Firm Partner</option>
                    <option value="Internal Staff">Internal Staff</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Contact Details</label>
                  <input
                    type="text"
                    placeholder="e.g. 012-3456789 / email"
                    value={refContact}
                    onChange={(e) => setRefContact(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Commission Model</label>
                  <select
                    value={refCommType}
                    onChange={(e) => setRefCommType(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="Percentage">Percentage (%)</option>
                    <option value="Flat">Flat Fee (RM)</option>
                    <option value="None">None / Goodwill</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Commission Rate/Value</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="10"
                    value={refCommVal}
                    onChange={(e) => setRefCommVal(e.target.value)}
                    className="w-full font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Amount Owed (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={refAmountOwed}
                    onChange={(e) => setRefAmountOwed(e.target.value)}
                    className="w-full font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Payment Status</label>
                  <select
                    value={refPayStatus}
                    onChange={(e) => setRefPayStatus(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="Owing">Owing</option>
                    <option value="Paid">Paid</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Notes / Introduced Client</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes or referred client details..."
                  value={refNotes}
                  onChange={(e) => setRefNotes(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#DDE3EB] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#16223A] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save Referral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 9. FILE CLOSING CHECKLIST (MALAYSIAN BAR RISK MANAGEMENT COMPLIANT) ================= */
