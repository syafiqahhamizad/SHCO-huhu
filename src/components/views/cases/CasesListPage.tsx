import React, { useMemo, useState } from 'react';
import { useRemembered } from '../../../lib/navHistory';
import { Archive, Plus, Scale, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import type { Case } from '../../../types';
import { extractMatterRunningNumber } from '../../../services/matterService';
import { useConfirmation } from '../../../hooks/useConfirmation';
import { RecycleBinModal } from '../../RecycleBinModal';
import { css } from './caseUi';
import { activeStorage, ensureMatterFolder, prepareStorage } from '../../../services/fileStorageService';
import { DEFAULT_PRACTICE_SETTINGS, getPracticeSettings } from '../../../services/templateService';
import { fileAge, lawyerOf, openedOf, partiesOf, practiceOf, staffOf } from './caseModel';

const ST: Record<string, [string, string]> = { Active: ['#E6EFE9', '#2F6F4E'], Pending: ['#FBF2E9', '#8A6D3B'], Closed: ['#EEF1F5', '#5B6478'], Archive: ['#FBEDE9', '#B23A2E'] };
const COL: Record<string, string> = { Active: '#2F6F4E', Pending: '#8A6D3B', Closed: '#5B6478', Archive: '#B23A2E' };

/** Cases List (design: Cases List.dc.html). Real cases only — scoped like the old registry. */
export const CasesListPage: React.FC = () => {
  const { cases = [], clients = [], users = [], currentUser, currentPartnerCode, isAdmin, deletedRecords = [], setCurrentCaseId, setCaseSubTab, setIsNewCaseModalOpen, deleteCase, updateCase, showToast } = useApp();
  const { confirm, ConfirmationModal } = useConfirmation();
  const [q, setQ] = useRemembered('cases.q', '');
  const [status, setStatus] = useRemembered('cases.status', '');
  const [pic, setPic] = useRemembered('cases.pic', 'ALL');
  const [area, setArea] = useRemembered('cases.area', '');
  const [folderRun, setFolderRun] = useState<string | null>(null);
  const [closeOnly, setCloseOnly] = useRemembered('cases.closeOnly', false);
  const [binOpen, setBinOpen] = useState(false);
  const staff = useMemo(() => staffOf(users), [users]);
  const isFirmAdmin = Boolean(isAdmin || currentUser?.isSuperAdmin);

  const all = useMemo(() => [...cases].sort((a, b) => {
    const na = extractMatterRunningNumber(a.ref), nb = extractMatterRunningNumber(b.ref);
    if (na !== -1 && nb !== -1 && na !== nb) return nb - na;
    return String(b.createdDate || b.id).localeCompare(String(a.createdDate || a.id));
  }), [cases]);

  // Same scoping as before: firm admins see every file; everyone else sees files they handle.
  const tags = [currentUser?.name, currentUser?.email?.split('@')[0], currentPartnerCode, currentUser?.code].filter(Boolean).map((v) => String(v).toLowerCase());
  const mineCase = (c: Case) => {
    const m = (v?: string) => Boolean(v && tags.some((t) => v.toLowerCase().includes(t)));
    return m(c.lawyerInCharge) || (c.lawyers || []).some(m) || (c.partners || []).some((p) => tags.includes(String(p).toLowerCase()));
  };
  const scoped = isFirmAdmin ? all : all.filter(mineCase);

  const ql = q.trim().toLowerCase();
  const clientOf = (c: Case) => c.clientName || partiesOf(c, clients).filter((p) => p.side === 'client').map((p) => p.name).join(' & ') || '—';
  const byQ = (c: Case) => !ql || [c.ref, c.title, clientOf(c), c.courtCaseNo].join(' ').toLowerCase().includes(ql);
  const byPic = (c: Case) => pic === 'ALL' || (c.partners || []).includes(pic as never) || (c.lawyers || []).includes(pic) || lawyerOf(c) === pic;
  const pendingClose = (c: Case) => c.closeRequest?.status === 'Pending';
  // Every practice area registered in Firm Settings, plus any older name still on a file, with its count.
  const registered = ((getPracticeSettings().practiceAreas && getPracticeSettings().practiceAreas!.length ? getPracticeSettings().practiceAreas : DEFAULT_PRACTICE_SETTINGS.practiceAreas) || []).map((a) => a.name);
  const areas = Array.from(new Set([...registered, ...scoped.map((c) => practiceOf(c)).filter(Boolean)]));
  const areaCount = (a: string) => scoped.filter((c) => practiceOf(c) === a).length;
  const byArea = (c: Case) => !area || practiceOf(c) === area;
  const pre = scoped.filter((c) => byPic(c) && byArea(c) && byQ(c) && (!closeOnly || pendingClose(c)));
  const list = pre.filter((c) => !status || c.status === status);
  const waiting = scoped.filter(pendingClose).length;

  const card = (label: string, key: string, color: string, count: number) => {
    const on = status === key;
    return { label, key, color, count, on };
  };
  const cards = [...['Active', 'Pending', 'Closed', 'Archive'].map((k) => card(k, k, COL[k], pre.filter((c) => c.status === k).length)), card(isFirmAdmin ? 'All firm files' : 'All my files', '', '#16223A', pre.length)];
  const partners = staff.filter((p) => p.isPartner);
  const lawyers = Array.from(new Set(cases.flatMap((c) => [...(c.lawyers || []), lawyerOf(c)]).filter(Boolean))).filter((n) => !partners.some((p) => p.name === n));
  const binCount = deletedRecords.filter((r) => r.entityType === 'Case').length;
  const cols = 'minmax(215px,250px) minmax(200px,1.6fr) minmax(120px,1fr) minmax(130px,1fr) 80px 96px 74px' + (isFirmAdmin ? ' 32px' : '');
  const hasFilters = !!(q || status || area || pic !== 'ALL' || closeOnly);

  const open = (c: Case) => { setCaseSubTab('overview'); setCurrentCaseId(c.id); };
  const del = async (e: React.MouseEvent, c: Case) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete this file?', variant: 'danger', confirmText: 'Move to recycle bin',
      message: 'Use this only for files opened in error or duplicates. Finished matters should be closed, not deleted. It can be restored from the recycle bin.',
      details: [{ label: 'File no.', value: c.ref }, { label: 'Title', value: c.title }],
    });
    if (!ok) return;
    deleteCase(c.id);
    showToast(c.ref + ' moved to recycle bin');
  };

  // Files opened before Drive was set up: create their folders in one go (admins).
  const noFolder = cases.filter((c) => !c.gdriveFolderUrl && c.status !== 'Archive');
  const createMissingFolders = async () => {
    const todo = [...noFolder];
    let made = 0;
    try {
      await prepareStorage();
      for (const c of todo) {
        setFolderRun('Creating Drive folders… ' + (made + 1) + ' of ' + todo.length);
        const f = await ensureMatterFolder(c);
        if (f) { updateCase(c.id, { gdriveFolderId: f.id, gdriveFolderUrl: f.url }); made++; }
      }
      showToast(made + ' Drive folder' + (made === 1 ? '' : 's') + ' created.');
    } catch (e) {
      showToast('Stopped after ' + made + ' folder' + (made === 1 ? '' : 's') + ': ' + (e instanceof Error ? e.message : String(e)));
    }
    setFolderRun(null);
  };

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px;font-size:12px;color:#16223A')}>
      <div style={css('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid #DDE3EB;padding:16px;border-radius:12px')}>
        <div style={css('display:flex;flex-direction:column;gap:3px')}>
          <div style={css('display:flex;align-items:center;gap:8px')}><Scale style={css('width:20px;height:20px;color:#3D6B9C')} /><span style={css('font-family:Georgia,serif;font-size:18px;font-weight:700;color:#16223A')}>{isFirmAdmin ? 'Firm legal matter registry' : 'My files'}</span></div>
          <span style={css('font-size:12px;color:#5B6478')}>{isFirmAdmin ? 'Every active, closed and archived file in the firm' : 'Files where you are partner in charge or on the team · ' + (currentUser?.name || '')}</span>
        </div>
        <div style={css('display:flex;align-items:center;gap:8px')}>
          <button type="button" onClick={() => setBinOpen(true)} style={css('display:flex;align-items:center;gap:6px;border:1px solid #DDE3EB;border-radius:10px;padding:9px 13px;font-size:12px;font-weight:700;background:#F1F4F7;color:#16223A;cursor:pointer')}><Archive style={css('width:15px;height:15px;color:#3D6B9C')} />Recycle bin ({binCount})</button>
          <button type="button" onClick={() => { setCurrentCaseId(null); setIsNewCaseModalOpen(true); }} style={css('display:flex;align-items:center;gap:7px;border:0;border-radius:10px;padding:9px 15px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}><Plus style={css('width:15px;height:15px')} />Open new file</button>
        </div>
      </div>

      <div style={css('display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px')}>
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={() => setStatus(c.on && c.key ? '' : c.key)} style={css(`display:flex;flex-direction:column;gap:4px;text-align:left;border-radius:10px;padding:12px;cursor:pointer;background:#fff;border-style:solid;border-width:4px 1px 1px;border-color:${c.color} ${c.on ? c.color : '#DDE3EB'} ${c.on ? c.color : '#DDE3EB'};box-shadow:${c.on ? '0 0 0 1px ' + c.color : 'none'}`)}>
            <span style={css('font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#5B6478')}>{c.label}</span>
            <span style={css(`font-size:24px;font-weight:700;color:${c.color}`)}>{c.count}</span>
          </button>
        ))}
      </div>

      {waiting > 0 && (
        <button type="button" onClick={() => setCloseOnly(!closeOnly)} style={css(`display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:1px solid ${closeOnly ? '#8A6D3B' : '#E8D9B8'};background:#FBF7EE;font-size:12.5px;color:#16223A;cursor:pointer;text-align:left;font-family:inherit`)}>
          <strong>{waiting} close request{waiting > 1 ? 's' : ''} waiting for partner approval.</strong>
          <span style={css('color:#4A5468')}>{closeOnly ? 'Showing only these files. Click to show all.' : 'Click to show them. Open a file to approve or send back.'}</span>
        </button>
      )}

      {isFirmAdmin && activeStorage() === 'drive' && noFolder.length > 0 && (
        <button type="button" disabled={!!folderRun} onClick={createMissingFolders} style={css('display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:1px solid #C9D6E6;background:#F3F7FB;font-size:12.5px;color:#16223A;cursor:pointer;text-align:left;font-family:inherit')}>
          <strong>{folderRun || noFolder.length + ' file' + (noFolder.length > 1 ? 's have' : ' has') + ' no Google Drive folder yet.'}</strong>
          {!folderRun && <span style={css('color:#4A5468')}>Click to create {noFolder.length > 1 ? 'them all' : 'it'} in SHCO Portal › Case files › practice area › “NNN - title”, each with the working folders for its practice area (litigation: Cause Papers, Correspondences, Documents; conveyancing: Documents, Correspondences; corporate: Agreement, Correspondences, Documents). Old drives are not touched.</span>}
        </button>
      )}

      <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:12px;background:#fff;border:1px solid #DDE3EB;padding:10px 12px;border-radius:10px')}>
        <div style={css('display:flex;align-items:center;gap:6px;border:1px solid #DDE3EB;border-radius:8px;padding:6px 10px;background:#F6F8FA;width:300px')}><Search style={css('width:14px;height:14px;color:#5B6478')} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="File no., title, client or court case no." style={css('flex:1;min-width:0;border:0;outline:0;font-size:12px;color:#16223A;background:transparent')} /></div>
        <label style={css('display:flex;align-items:center;gap:6px')}><span style={css('font-size:10px;font-weight:700;text-transform:uppercase;color:#5B6478')}>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={css('font-size:12px;background:#F6F8FA;border:1px solid #DDE3EB;border-radius:6px;padding:5px 8px;font-weight:600;color:#16223A')}>
            {[['', 'All statuses'], ['Active', 'Active'], ['Pending', 'Pending'], ['Closed', 'Closed'], ['Archive', 'Archive']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={css('display:flex;align-items:center;gap:6px')}><span style={css('font-size:10px;font-weight:700;text-transform:uppercase;color:#5B6478')}>Practice area</span>
          <select value={area} onChange={(e) => setArea(e.target.value)} style={css('font-size:12px;background:#F6F8FA;border:1px solid #DDE3EB;border-radius:6px;padding:5px 8px;font-weight:600;color:#16223A')}>
            <option value="">All practice areas</option>
            {areas.map((a) => <option key={a} value={a}>{a} ({areaCount(a)})</option>)}
          </select>
        </label>
        {isFirmAdmin && (
          <label style={css('display:flex;align-items:center;gap:6px')}><span style={css('font-size:10px;font-weight:700;text-transform:uppercase;color:#5B6478')}>PIC</span>
            <select value={pic} onChange={(e) => setPic(e.target.value)} style={css('font-size:12px;background:#F6F8FA;border:1px solid #DDE3EB;border-radius:6px;padding:5px 8px;font-weight:600;color:#16223A')}>
              <option value="ALL">All PICs</option>
              {partners.map((p) => <option key={p.code} value={p.code}>{p.name} (Partner)</option>)}
              {lawyers.map((n) => <option key={n} value={n}>{n} (Lawyer)</option>)}
            </select>
          </label>
        )}
        {hasFilters && <button type="button" onClick={() => { setQ(''); setStatus(''); setArea(''); setPic('ALL'); setCloseOnly(false); }} style={css('border:0;background:none;padding:0;font-size:11.5px;font-weight:700;color:#3D6B9C;cursor:pointer')}>Clear filters</button>}
        <span style={css('margin-left:auto;font-size:11px;color:#5B6478')}>Showing {list.length} of {scoped.length}{isFirmAdmin ? ' firm files' : ' of your files'} · newest file no. first</span>
      </div>

      <div style={css('background:#fff;border:1px solid #DDE3EB;border-radius:12px;overflow-x:auto')}>
        <div style={css('min-width:1120px')}>
          <div style={css(`display:grid;grid-template-columns:${cols};gap:12px;padding:11px 14px;background:#16223A;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-radius:11px 11px 0 0`)}>
            <span>File no.</span><span>Title · client</span><span>Practice area</span><span>Partner · lawyer</span><span>File age</span><span>Status</span><span>Drive</span>{isFirmAdmin && <span />}
          </div>
          {list.map((c) => {
            const st = ST[c.status] || ST.Closed;
            const pNames = (c.partners || []).map((code) => (staff.find((p) => p.code === code)?.name || code) + ' (' + code + ')').join(', ');
            const lw = Array.from(new Set([lawyerOf(c), ...(c.lawyers || [])].filter(Boolean))).join(', ');
            return (
              <div key={c.id} onClick={() => open(c)} className="hover:!bg-[#F6F8FA]" style={css(`display:grid;grid-template-columns:${cols};gap:12px;align-items:center;padding:11px 14px;border-bottom:1px solid #F0F2F5;cursor:pointer;background:#fff`)}>
                <span style={css('justify-self:start;font-family:ui-monospace,monospace;font-size:10.5px;font-weight:700;color:#16223A;background:#F1F4F7;border:1px solid #DDE3EB;border-radius:5px;padding:3px 6px;word-break:break-all;max-width:100%')}>{c.ref}</span>
                <span style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}><span style={css('font-size:12.5px;font-weight:700;color:#16223A;line-height:1.35')}>{c.title}</span><span style={css('font-size:11px;color:#5B6478')}>{clientOf(c)}</span></span>
                <span style={css('display:flex;flex-direction:column;gap:3px;align-items:flex-start')}><span style={css('font-weight:500;color:#1E293B')}>{practiceOf(c) || '—'}</span>{c.clientRole && <span style={css('font-size:9.5px;font-weight:800;color:#3D6B9C;background:#FBF2E9;border:1px solid #D8C7A8;padding:1px 6px;border-radius:4px')}>Side: {c.clientRole}</span>}</span>
                <span style={css('display:flex;flex-direction:column;gap:2px')}><span style={css('font-weight:700;color:#16223A')}>{pNames || '—'}</span><span style={css('font-size:11px;color:#5B6478')}>{lw || '—'}</span></span>
                <span style={css('justify-self:start;font-family:ui-monospace,monospace;font-size:11px;font-weight:700;color:#1E293B;background:#F1F4F7;border:1px solid #E2E8F0;border-radius:5px;padding:2px 8px')}>{fileAge(openedOf(c))}</span>
                <span style={css('display:flex;flex-direction:column;gap:3px;align-items:flex-start')}>
                  <span style={css(`font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:${st[0]};color:${st[1]}`)}>{c.status}</span>
                  {pendingClose(c) && <span style={css('font-size:9.5px;font-weight:800;color:#8A6D3B')}>Close requested</span>}
                </span>
                <span style={css('display:flex;flex-direction:column;gap:1px;justify-self:start')}>
                  {c.gdriveFolderUrl
                    ? <a href={c.gdriveFolderUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Open this file's Google Drive folder" style={css('font-size:11px;font-weight:700;color:#2F4F7A;white-space:nowrap')}>Open ↗</a>
                    : <span title="No Drive folder yet. Open the file and use Create Drive folder." style={css('font-size:11px;color:#94A3B8')}>—</span>}
                  {c.oldDriveFolderUrl && <a href={c.oldDriveFolderUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="This file's folder in an old drive" style={css('font-size:10px;font-weight:600;color:#5B6478;white-space:nowrap')}>Old folder ↗</a>}
                </span>
                {isFirmAdmin && (
                  <button type="button" onClick={(e) => del(e, c)} title="Delete file (wrongly entered)" className="hover:!bg-[#FBEDE9] hover:!border-[#F1C9C1]" style={css('justify-self:end;display:grid;place-items:center;width:28px;height:28px;border-radius:7px;border:1px solid transparent;background:transparent;cursor:pointer')}><Trash2 style={css('width:14px;height:14px;color:#B23A2E')} /></button>
                )}
              </div>
            );
          })}
          {!list.length && (
            <div style={css('padding:28px;text-align:center;font-size:12px;color:#5B6478')}>
              {scoped.length ? 'No files match these filters.' : isFirmAdmin ? 'No files yet. Use Open new file to open the first one.' : 'No files assigned to you yet.'}
            </div>
          )}
        </div>
      </div>
      <RecycleBinModal isOpen={binOpen} onClose={() => setBinOpen(false)} />
      {ConfirmationModal}
    </div>
  );
};
