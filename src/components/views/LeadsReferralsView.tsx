import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ClipboardList,
  Flame,
  Plus,
  Share2,
  Trash2,
  TrendingUp,
  UserCheck,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LeadsView } from './LeadsView';
import { Lead, Programme } from '../../types';
import { Donut, StatCard, StatusBadge } from '../ui';
import { palette, tint, tintText } from '../../lib/designTokens';

type SubTab = 'overview' | 'allLeads' | 'programmes' | 'referrers';

const SOURCE_COLORS = [palette.blue, palette.green, palette.gold, palette.purple, palette.red, palette.slate, '#0E4C55', '#8A6534'];

const PROGRAMME_TYPES: Programme['type'][] = ['Seminar', 'Networking', 'BNI', 'Webinar', 'Other'];

const blankProgrammeDraft = () => ({
  title: '',
  type: 'Seminar' as Programme['type'],
  date: new Date().toISOString().slice(0, 10),
  location: '',
  registrations: 0,
});

/**
 * Top-level "Leads & Referrals" dashboard tab (design_handoff_my_dashboard/LEADS_AND_REFERRALS.md).
 * Wraps the existing, already-real LeadsView (list/pipeline/convert/delete) as the "All leads"
 * sub-tab rather than duplicating it, and adds three new sub-tabs sourced from real `leads` /
 * `programmes` / `referralPartners` / `users` data: Overview, Programmes, Referrers.
 */
export const LeadsReferralsView: React.FC = () => {
  const {
    leads,
    cases,
    users,
    referralPartners,
    programmes,
    addProgramme,
    deleteProgramme,
    addLead,
    currentUser,
    showToast,
    getNextSequenceId,
  } = useApp() as any;

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [programmeFormOpen, setProgrammeFormOpen] = useState(false);
  const [draft, setDraft] = useState(blankProgrammeDraft());

  const isAdminUser = Boolean(currentUser?.isAdmin || currentUser?.isSuperAdmin);
  const todayStr = new Date().toISOString().slice(0, 10);

  // --- Overview -------------------------------------------------------
  const totalLeads = (leads || []).length;
  const convertedLeads = (leads || []).filter((l: Lead) => l.stage === 'Converted').length;
  const conversionRate = totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  const hotLeads = (leads || []).filter((l: Lead) => l.warmth === 'Hot' || l.warmthLevel === 3).length;

  const sourceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    (leads || []).forEach((l: Lead) => {
      const key = l.referralSourceCategory || l.source || 'Other';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value], i) => ({ label, value, color: SOURCE_COLORS[i % SOURCE_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  const upcomingProgrammes = useMemo(
    () =>
      (programmes || [])
        .filter((p: Programme) => p.date >= todayStr)
        .sort((a: Programme, b: Programme) => a.date.localeCompare(b.date))
        .slice(0, 4),
    [programmes, todayStr]
  );

  // --- Programmes -------------------------------------------------------
  const sortedProgrammes = useMemo(
    () => [...(programmes || [])].sort((a: Programme, b: Programme) => b.date.localeCompare(a.date)),
    [programmes]
  );

  const saveProgramme = () => {
    if (!draft.title.trim()) return;
    addProgramme({
      id: `PRG${Date.now()}`,
      title: draft.title.trim(),
      type: draft.type,
      date: draft.date,
      location: draft.location.trim() || undefined,
      registrations: Number(draft.registrations) || 0,
    });
    setProgrammeFormOpen(false);
    setDraft(blankProgrammeDraft());
  };

  // "Make lead" creates a real, placeholder-named Lead attributed to the programme — the
  // attendee's actual name/phone/email is filled in afterwards from the All leads tab (the
  // existing Edit-lead flow), since a programme sign-up here has no attendee list to pull from.
  const makeLeadFromProgramme = (p: Programme) => {
    addLead({
      id: getNextSequenceId('lead'),
      name: `New lead — ${p.title}`,
      phone: '',
      email: '',
      practiceArea: 'General',
      source: `${p.type} — ${p.title}`,
      referralSourceCategory: p.type === 'BNI' ? 'Referral Partner' : 'Event / Seminar',
      referralDetail: p.title,
      warmth: 'Warm',
      warmthLevel: 2,
      stage: 'Inquiry',
      conflictCheck: { status: 'Not Started', notes: 'Pending partner conflict review', checkedBy: '', checkedDate: '' },
      quoteAmount: 0,
      followupDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    } as Lead);
    showToast(`Lead created from "${p.title}" — edit it to add the attendee's name and contact.`);
    setSubTab('allLeads');
  };

  // --- Referrers -------------------------------------------------------
  // Grouped by whoever the lead names as their referrer (Lead.referralDetail — the free-text
  // name the intake form already captures for Existing Client / Outside Referrer / Referral
  // Partner leads), cross-referenced against real `users` (firm partners/staff) and
  // `referralPartners` (outside referrers with a commission arrangement) to label the type.
  const referrerRows = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase();
    const staffByName = new Map((users || []).map((u: any) => [norm(u.name), u]));

    const groups = new Map<string, { name: string; type: string; leads: Lead[] }>();
    (leads || []).forEach((l: Lead) => {
      const rawName = (l.referralDetail || '').trim();
      if (!rawName) return;
      const key = norm(rawName);
      if (!groups.has(key)) {
        const staff = staffByName.get(key) as { role?: string } | undefined;
        const type = staff ? (staff.role === 'Partner' ? 'Partner' : 'Staff') : 'Outside referrer';
        groups.set(key, { name: rawName, type, leads: [] });
      }
      groups.get(key)!.leads.push(l);
    });
    // Referral partners with a commission arrangement but zero leads yet still belong on the roster.
    (referralPartners || []).forEach((r: any) => {
      const key = norm(r.name);
      if (!groups.has(key)) groups.set(key, { name: r.name, type: r.type === 'Partner' ? 'Partner' : r.type === 'Internal Staff' ? 'Staff' : 'Outside referrer', leads: [] });
    });

    return Array.from(groups.values())
      .map((g) => ({
        name: g.name,
        type: g.type,
        leadCount: g.leads.length,
        becameClients: g.leads.filter((l) => l.stage === 'Converted').length,
        stillOpen: g.leads.filter((l) => l.stage !== 'Converted' && l.stage !== 'Lost').length,
      }))
      .sort((a, b) => b.leadCount - a.leadCount);
  }, [leads, users, referralPartners]);

  const groupedReferrers = useMemo(() => {
    const order = ['Partner', 'Staff', 'Outside referrer'];
    return order
      .map((type) => ({ type, rows: referrerRows.filter((r) => r.type === type) }))
      .filter((g) => g.rows.length);
  }, [referrerRows]);

  const TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'allLeads', label: 'All leads', icon: ClipboardList },
    { key: 'programmes', label: 'Programmes', icon: CalendarDays },
    { key: 'referrers', label: 'Referrers', icon: Share2 },
  ];

  return (
    <div className="space-y-4 pb-8 text-[12px]">
      <div className="flex items-center gap-2 rounded-xl border bg-white p-2" style={{ borderColor: palette.border }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold"
            style={{ backgroundColor: subTab === t.key ? palette.navy : 'transparent', color: subTab === t.key ? '#fff' : palette.slate }}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total leads" value={totalLeads} icon={ClipboardList} color={palette.navy} />
            <StatCard label="Converted" value={convertedLeads} icon={UserCheck} color={palette.green} />
            <StatCard label="Conversion rate" value={`${conversionRate}%`} icon={TrendingUp} color={palette.blue} />
            <StatCard label="Hot leads" value={hotLeads} icon={Flame} color={palette.gold} />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-4" style={{ borderColor: palette.border }}>
              <strong className="font-serif text-[14px] text-[#16223A]">Where leads come from</strong>
              <div className="mt-3 flex items-center gap-5">
                <Donut segments={sourceBreakdown} centerLabel={totalLeads} centerSub="leads" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  {sourceBreakdown.map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-[11.5px]">
                      <span className="flex items-center gap-1.5 truncate text-[#16223A]">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                      <span className="font-bold text-[#5B6478]">{s.value}</span>
                    </div>
                  ))}
                  {sourceBreakdown.length === 0 && <p className="text-[11px] text-[#5B6478]">No leads yet.</p>}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4" style={{ borderColor: palette.border }}>
              <div className="flex items-center justify-between">
                <strong className="font-serif text-[14px] text-[#16223A]">Upcoming programmes</strong>
                <button type="button" onClick={() => setSubTab('programmes')} className="text-[10.5px] font-bold" style={{ color: tintText.gold }}>
                  All programmes &rarr;
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {upcomingProgrammes.map((p: Programme) => (
                  <div key={p.id} className="flex items-center gap-2.5 rounded-lg p-2" style={{ backgroundColor: tint.blue }}>
                    <CalendarDays className="h-4 w-4 shrink-0" style={{ color: tintText.blue }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-[#16223A]">{p.title}</p>
                      <p className="text-[10.5px] text-[#5B6478]">{p.date} · {p.type} · {p.registrations} registered</p>
                    </div>
                  </div>
                ))}
                {upcomingProgrammes.length === 0 && <p className="text-[11px] text-[#5B6478]">No upcoming programmes booked.</p>}
              </div>
            </div>
          </section>
        </div>
      )}

      {subTab === 'allLeads' && <LeadsView />}

      {subTab === 'programmes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] text-[#5B6478]">Events, seminars and BNI/networking sessions — track sign-ups and turn attendees into leads.</p>
            <button
              type="button"
              onClick={() => setProgrammeFormOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#16223A] px-3 py-2 text-[11.5px] font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New programme
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
            <table className="w-full border-collapse text-left text-[11.5px]">
              <thead>
                <tr className="border-b bg-[#F6F8FA] text-[10px] uppercase text-[#5B6478]" style={{ borderColor: palette.border }}>
                  <th className="p-3 font-bold">Programme</th>
                  <th className="p-3 font-bold">Type</th>
                  <th className="p-3 font-bold">Date</th>
                  <th className="p-3 font-bold text-right">Registrations</th>
                  <th className="p-3 font-bold text-right">Attendance</th>
                  <th className="p-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: palette.border }}>
                {sortedProgrammes.map((p: Programme) => (
                  <tr key={p.id} className="hover:bg-[#F6F8FA]">
                    <td className="p-3 font-bold text-[#16223A]">
                      {p.title}
                      {p.location && <div className="text-[10px] font-normal text-[#5B6478]">{p.location}</div>}
                    </td>
                    <td className="p-3"><StatusBadge label={p.type} tone="purple" /></td>
                    <td className="p-3 text-[#5B6478]">{p.date}</td>
                    <td className="p-3 text-right font-mono">{p.registrations}</td>
                    <td className="p-3 text-right font-mono">{p.attendance ?? '—'}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => makeLeadFromProgramme(p)}
                          className="rounded-md border border-[#DDE3EB] px-2 py-1 text-[10.5px] font-bold text-[#3D6B9C]"
                        >
                          Make lead
                        </button>
                        {isAdminUser && (
                          <button type="button" onClick={() => deleteProgramme(p.id)} className="rounded-md border border-rose-200 p-1 text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedProgrammes.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-[11px] text-[#94A3B8]">No programmes yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {programmeFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16223A]/45 p-4">
              <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
                <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: palette.border }}>
                  <strong className="font-serif text-[14px] text-[#16223A]">New programme</strong>
                  <button type="button" onClick={() => setProgrammeFormOpen(false)} className="ml-auto text-[#5B6478]"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-2.5 p-4">
                  <input
                    autoFocus
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="Programme title"
                    className="w-full rounded-lg border px-2.5 py-2 text-[12.5px]"
                    style={{ borderColor: palette.border }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={draft.type}
                      onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as Programme['type'] }))}
                      className="rounded-lg border px-2.5 py-2 text-[12px]"
                      style={{ borderColor: palette.border }}
                    >
                      {PROGRAMME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className="rounded-lg border px-2.5 py-2 text-[12px]" style={{ borderColor: palette.border }} />
                  </div>
                  <input
                    value={draft.location}
                    onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                    placeholder="Location (optional)"
                    className="w-full rounded-lg border px-2.5 py-2 text-[12.5px]"
                    style={{ borderColor: palette.border }}
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.registrations}
                    onChange={(e) => setDraft((d) => ({ ...d, registrations: Number(e.target.value) }))}
                    placeholder="Registrations so far"
                    className="w-full rounded-lg border px-2.5 py-2 text-[12.5px]"
                    style={{ borderColor: palette.border }}
                  />
                </div>
                <div className="flex items-center gap-2 border-t bg-[#F6F8FA] px-4 py-3" style={{ borderColor: palette.border }}>
                  <button type="button" onClick={() => setProgrammeFormOpen(false)} className="rounded-lg border bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5B6478]" style={{ borderColor: palette.border }}>Cancel</button>
                  <button type="button" onClick={saveProgramme} className="ml-auto rounded-lg bg-[#16223A] px-4 py-1.5 text-[12px] font-bold text-white">Save programme</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'referrers' && (
        <div className="space-y-4">
          <p className="text-[11.5px] text-[#5B6478]">Referral fees and payouts are tracked in Accounts &amp; Compliance — this is who's sending leads, not what they're owed.</p>
          {groupedReferrers.map((g) => (
            <div key={g.type} className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
              <div className="flex items-center gap-2 border-b bg-[#F6F8FA] px-3.5 py-2" style={{ borderColor: palette.border }}>
                <UsersIcon className="h-3.5 w-3.5 text-[#5B6478]" />
                <strong className="text-[11px] font-bold uppercase tracking-wide text-[#5B6478]">{g.type}</strong>
              </div>
              <table className="w-full border-collapse text-left text-[11.5px]">
                <thead>
                  <tr className="text-[10px] uppercase text-[#5B6478]">
                    <th className="p-3 font-bold">Name</th>
                    <th className="p-3 font-bold text-right">Leads</th>
                    <th className="p-3 font-bold text-right">Became clients</th>
                    <th className="p-3 font-bold text-right">Still open</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: palette.border }}>
                  {g.rows.map((r) => (
                    <tr key={r.name} className="hover:bg-[#F6F8FA]">
                      <td className="p-3 font-bold text-[#16223A]">{r.name}</td>
                      <td className="p-3 text-right font-mono">{r.leadCount}</td>
                      <td className="p-3 text-right font-mono" style={{ color: tintText.green }}>{r.becameClients}</td>
                      <td className="p-3 text-right font-mono">{r.stillOpen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {groupedReferrers.length === 0 && (
            <div className="rounded-xl border bg-white p-6 text-center text-[11px] text-[#94A3B8]" style={{ borderColor: palette.border }}>
              No named referrers yet — leads gain a referrer once "Existing Client" / "Outside Referrer" / "Referral Partner" source detail is filled in.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
