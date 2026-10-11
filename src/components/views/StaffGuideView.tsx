import React, { useMemo, useState } from 'react';
import { askForm } from '../ui/askForm';
import { useApp } from '../../context/AppContext';
import { canSeeClientBilling, finGrants, finRoleKey } from '../../lib/financeAccess';
import { usePracticeSettings } from './settings/settingsShared';
import { ROLES, SECTIONS, type GuideRole } from './guideContent';

/**
 * "How to use the portal" — the staff guide, by role. Opens on the reader's own role; the other
 * roles are one click away. Wording uses the exact button and menu names in the app.
 *
 * Text markup: [[Button]] shows a button label, *bold* shows bold text.
 */

const VIDEO_URL = /^https:\/\/(drive\.google\.com|docs\.google\.com|(www\.)?youtube\.com|youtu\.be)\//;

/** *bold* and [[Button]] → styled spans. */

const rich = (text: string): React.ReactNode[] =>
  text.split(/(\[\[[^\]]+\]\]|\*[^*]+\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('[[')) return <span key={i} className="whitespace-nowrap rounded bg-[#16223A] px-1.5 py-0.5 text-[12px] font-bold !text-white">{part.slice(2, -2)}</span>;
    if (part.startsWith('*')) return <strong key={i} className="font-semibold text-[#16223A]">{part.slice(1, -1)}</strong>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });

const roleOf = (key: string, role: string): GuideRole =>
  key === 'M' || key === 'P' ? 'partner' : /accountant/i.test(role) ? 'accounts' : /assistant/i.test(role) ? 'assistant' : 'lawyer';

export const StaffGuideView: React.FC = () => {
  const { currentRole, currentUser, isAdmin, addActivityLog } = useApp();
  const [settings, saveSettings] = usePracticeSettings();
  const canEditVideo = Boolean(currentUser?.isAdmin || currentUser?.isSuperAdmin);
  const [editingVideo, setEditingVideo] = useState(false);
  const [videoDraft, setVideoDraft] = useState('');
  const mine = roleOf(finRoleKey(currentRole, currentUser, isAdmin), String(currentUser?.role || currentRole || ''));
  const [picked, setRole] = useState<GuideRole>(mine);
  const isAdminViewer = Boolean(currentUser?.isAdmin || currentUser?.isSuperAdmin);
  // Each person reads only their own role's guide; admins can look at every role (to check it).
  const role: GuideRole = isAdminViewer ? picked : mine;
  const seesBilling = canSeeClientBilling(finRoleKey(currentRole, currentUser, isAdmin), finGrants(currentUser));
  const sections = useMemo(() => SECTIONS.filter((s) =>
    s.roles === 'all' ? true
      : s.roles === 'admin' ? isAdminViewer
        : s.roles === 'billing' ? (isAdminViewer ? role === 'partner' || role === 'accounts' || seesBilling : seesBilling)
          : s.roles.includes(role)), [role, isAdminViewer, seesBilling]);
  const video = settings.guideVideos?.[role] || '';
  const roleLabel = ROLES.find(([k]) => k === role)?.[1] || '';
  const topicVideos = settings.guideTopicVideos || {};
  /** Admins paste a Google Drive / YouTube link for one topic (empty = remove). */
  const setTopicVideo = (id: string, title: string) => {
    void askForm('Video for “' + title + '”', [{ key: 'url', label: 'Google Drive or YouTube link', value: topicVideos[id] || '', placeholder: 'https://drive.google.com/…', hint: 'Leave empty to remove the video.' }]).then((f) => { if (f) saveTopicVideo(id, title, f.url.trim()); });
  };
  const saveTopicVideo = (id: string, title: string, v: string) => {
    if (v && !VIDEO_URL.test(v)) { window.alert('Paste a Google Drive or YouTube link.'); return; }
    const next = { ...topicVideos };
    if (v) next[id] = v; else delete next[id];
    saveSettings({ guideTopicVideos: next });
    addActivityLog('Staff Guide Video ' + (v ? 'Set' : 'Removed'), title);
  };
  const saveVideo = () => {
    const url = videoDraft.trim();
    if (url && !/^https:\/\/(drive\.google\.com|docs\.google\.com|(www\.)?youtube\.com|youtu\.be)\//.test(url)) return;
    saveSettings({ guideVideos: { ...(settings.guideVideos || {}), [role]: url || undefined } });
    addActivityLog('Staff Guide Video ' + (url ? 'Set' : 'Removed'), roleLabel);
    setEditingVideo(false);
  };

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-5 text-[14px] leading-relaxed text-[#1E2A40]">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A6D3B]">Staff guide</span>
        <h2 className="m-0 font-serif text-2xl font-bold text-[#16223A]">How to use the portal</h2>
        <p className="m-0 max-w-[68ch] text-[#5B6478]">Step by step, for your role. Button names match what you see on screen.{isAdminViewer ? ' As an admin you can switch roles below to check each one.' : ''}</p>
      </div>

      {isAdminViewer && <div className="flex flex-wrap gap-2" role="tablist" aria-label="Guide by role">
        {ROLES.map(([k, label, sub]) => {
          const on = role === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setRole(k)}
              className={`flex cursor-pointer flex-col items-start rounded-lg border px-3.5 py-2 text-left transition ${on ? 'border-[#16223A] bg-[#16223A]' : 'border-[#DDE3EB] bg-white hover:border-[#8A6D3B]'}`}>
              <span className={`text-[13px] font-bold ${on ? '!text-white' : 'text-[#16223A]'}`}>{label}{k === mine ? ' · you' : ''}</span>
              <span className={`text-[11px] ${on ? '!text-[#DDE3EB]' : 'text-[#5B6478]'}`}>{sub}</span>
            </button>
          );
        })}
      </div>}

      {(video || canEditVideo) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#DDE3EB] bg-white px-4 py-3">
          <span className="min-w-0 flex-1">
            <strong className="block text-[13.5px] text-[#16223A]">Video walkthrough · {roleLabel}</strong>
            <span className="block text-[12px] text-[#5B6478]">{video ? 'A short screen video of the steps below.' : 'No video yet. Record one, save it in the firm’s Google Drive and paste its link here.'}</span>
          </span>
          {video && <a href={video} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#16223A] px-3 py-2 text-[12.5px] font-bold !text-white no-underline">▶ Watch the video</a>}
          {canEditVideo && !editingVideo && <button type="button" onClick={() => { setVideoDraft(video); setEditingVideo(true); }} className="cursor-pointer rounded-lg border border-[#DDE3EB] bg-white px-3 py-2 text-[12px] font-bold text-[#16223A]">{video ? 'Change link' : 'Add video link'}</button>}
          {canEditVideo && editingVideo && (
            <span className="flex w-full flex-wrap items-center gap-2">
              <input id="guide-video-url" value={videoDraft} onChange={(e) => setVideoDraft(e.target.value)} placeholder="https://drive.google.com/file/d/… or a YouTube link" className="min-w-0 flex-1 rounded-md border border-[#DDE3EB] px-2.5 py-1.5 text-[12.5px] text-[#16223A]" />
              <button type="button" onClick={saveVideo} className="cursor-pointer rounded-md bg-[#16223A] px-3 py-1.5 text-[12px] font-bold !text-white">Save</button>
              <button type="button" onClick={() => setEditingVideo(false)} className="cursor-pointer rounded-md border border-[#DDE3EB] bg-white px-3 py-1.5 text-[12px] font-bold text-[#16223A]">Cancel</button>
              {videoDraft.trim() && !/^https:\/\/(drive\.google\.com|docs\.google\.com|(www\.)?youtube\.com|youtu\.be)\//.test(videoDraft.trim()) && <span className="w-full text-[11.5px] text-[#B23A2E]">Paste a Google Drive or YouTube link.</span>}
            </span>
          )}
        </div>
      )}

      <nav className="flex flex-wrap gap-x-3 gap-y-1 border-b border-[#DDE3EB] pb-3 text-[12.5px]" aria-label="Sections">
        {sections.map((s, i) => (
          <a key={s.id} href={'#guide-' + s.id} onClick={(e) => { e.preventDefault(); document.getElementById('guide-' + s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="text-[#3D6B9C] hover:underline">{i + 1}. {s.title}</a>
        ))}
      </nav>

      <div className="flex flex-col gap-3">
        {sections.map((s, i) => (
          <section key={s.id} id={'guide-' + s.id} className="scroll-mt-4 rounded-xl border border-[#DDE3EB] bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="m-0 flex flex-1 items-baseline gap-2 font-serif text-[17px] font-bold text-[#16223A]"><span className="font-mono text-[12px] font-medium text-[#8A6D3B]">{String(i + 1).padStart(2, '0')}</span>{s.title}</h3>
              {topicVideos[s.id] && <a href={topicVideos[s.id]} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#16223A] px-3 py-1.5 text-[12px] font-bold !text-white no-underline">▶ Watch video</a>}
              {canEditVideo && <button type="button" onClick={() => setTopicVideo(s.id, s.title)} className="cursor-pointer rounded-lg border border-[#DDE3EB] bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-[#16223A]">{topicVideos[s.id] ? 'Change video' : '+ Video'}</button>}
            </div>
            {(s.what || s.who) && (
              <div className="mb-3 flex max-w-[72ch] flex-col gap-1.5">
                {s.what && <p className="m-0"><strong className="text-[#16223A]">What it is: </strong>{rich(s.what)}</p>}
                {s.who && <p className="m-0"><strong className="text-[#16223A]">Who: </strong>{rich(s.who)}</p>}
              </div>
            )}
            {s.before && (
              <div className="mb-3 max-w-[72ch] rounded-lg border border-[#DDE3EB] bg-[#F6F8FA] px-3 py-2">
                <strong className="mb-1 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">Before you start</strong>
                <ul className="m-0 flex list-disc flex-col gap-1 pl-5">{s.before.map((t, j) => <li key={j}>{rich(t)}</li>)}</ul>
              </div>
            )}
            {s.intro && <p className="m-0 max-w-[72ch]">{rich(s.intro)}</p>}
            {s.steps && (
              <>
                {s.what && <strong className="mb-2 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">Step by step</strong>}
                <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {s.steps.map((st, j) => {
                    const t = typeof st === 'string' ? st : st.t;
                    const sub = typeof st === 'string' ? undefined : st.sub;
                    return (
                      <li key={j} className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5">
                        <span className="mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border border-[#8A6D3B] bg-[#FBF5EA] font-mono text-[11px] text-[#8A6D3B]">{j + 1}</span>
                        <span className="max-w-[72ch]">
                          {rich(t)}
                          {sub && <ul className="m-0 mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[13px] text-[#4A5468]">{sub.map((x, y) => <li key={y}>{rich(x)}</li>)}</ul>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            {s.cases && (
              <div className="mt-4 max-w-[72ch]">
                <strong className="mb-1.5 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">Other situations</strong>
                <dl className="m-0 flex flex-col gap-1.5">{s.cases.map(([k, v], j) => <div key={j} className="grid gap-0.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3"><dt className="font-semibold text-[#16223A]">{rich(k)}</dt><dd className="m-0">{rich(v)}</dd></div>)}</dl>
              </div>
            )}
            {s.stuck && (
              <div className="mt-4 max-w-[72ch]">
                <strong className="mb-1.5 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">If you see this</strong>
                <dl className="m-0 flex flex-col divide-y divide-[#EEF1F5] rounded-lg border border-[#DDE3EB]">{s.stuck.map(([k, v], j) => <div key={j} className="flex flex-col gap-0.5 px-3 py-2"><dt className="font-semibold text-[#8E2A20]">{rich(k)}</dt><dd className="m-0 text-[13px]">{rich(v)}</dd></div>)}</dl>
              </div>
            )}
            {s.mistakes && (
              <div className="mt-4 max-w-[72ch]">
                <strong className="mb-1 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">Common mistakes</strong>
                <ul className="m-0 flex list-disc flex-col gap-1 pl-5">{s.mistakes.map((t, j) => <li key={j}>{rich(t)}</li>)}</ul>
              </div>
            )}
            {s.tip && <p className="m-0 mt-3 max-w-[72ch] rounded-r-lg border-l-[3px] border-[#8A6D3B] bg-[#FBF5EA] px-3 py-2 text-[13px]">{rich(s.tip)}</p>}
          </section>
        ))}
      </div>
    </div>
  );
};
