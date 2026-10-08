import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { Case, Client, PartnerCode } from '../../../types';
import { DEFAULT_PRACTICE_SETTINGS, getPracticeSettings } from '../../../services/templateService';
import { builtInFeeTemplates } from '../../../lib/financeDocs';
import { canSeeFinanceView, finRoleKey } from '../../../lib/financeAccess';
import { css } from './caseUi';
import { WarrantToActActions, warrantInputFor } from './WarrantToAct';
import { activeStorage, ensureMatterFolder, prepareStorage } from '../../../services/fileStorageService';
import { iso, isFileHandler, partiesOf, stamp, staffOf, type Person } from './caseModel';

/* Practice-specific intake (design: New File Form.dc.html). Values are the firm's own choice
 * lists; text fields only carry placeholders — nothing is pre-filled with sample data. */
type FieldDef = [label: string, opts: string[] | 0, placeholder: string, key?: string];
const FIELDS: Record<string, FieldDef[]> = {
  L: [['Court level', ['High Court / Mahkamah Tinggi', 'Sessions Court / Mahkamah Sesyen', 'Magistrates’ Court / Mahkamah Majistret', 'Court of Appeal', 'Federal Court'], '', 'courtLevel'], ['Court registry', 0, 'e.g. Shah Alam', 'courtLocation'], ['Suit no.', 0, 'e.g. BA-B52NCvC-214-09/2026', 'suit'], ['Claim amount (RM)', 0, 'e.g. 750,000.00']],
  CR: [['Court level', ['Magistrates’ Court / Mahkamah Majistret', 'Sessions Court / Mahkamah Sesyen', 'High Court / Mahkamah Tinggi'], '', 'courtLevel'], ['Court registry', 0, 'e.g. Kajang', 'courtLocation'], ['Charge no.', 0, '', 'suit'], ['Offence & section', 0, 'e.g. Penal Code s.420 (Cheating)']],
  SY: [['Mahkamah', ['Mahkamah Rendah Syariah', 'Mahkamah Tinggi Syariah', 'Mahkamah Rayuan Syariah'], '', 'courtLevel'], ['Lokasi mahkamah', 0, 'e.g. Bangi', 'courtLocation'], ['No. kes', 0, '', 'suit'], ['Jenis tuntutan', ['Perceraian (Fasakh / Talaq)', 'Hadhanah', 'Nafkah', 'Harta sepencarian', 'Faraid', 'Mal (lain-lain)'], '', 'subtype']],
  EST: [['Proceeding type', ['Grant of Probate', 'Letters of Administration', 'Order for Sale', 'Vesting Order', 'Small estate (Pejabat Tanah)'], '', 'subtype'], ['Deceased name', 0, ''], ['Court / registry', 0, 'e.g. High Court, Shah Alam', 'courtLocation'], ['Gross estate value (RM)', 0, '']],
  CONV: [['Transaction', ['Subsale S&P (SPA)', 'Developer S&P', 'Loan / facility', 'Memorandum of Transfer', 'Discharge of charge', 'Tenancy'], '', 'subtype'], ['Title no.', 0, 'e.g. HSD 12345, PT 678, Mukim Kajang', 'propertyTitleNo'], ['Property address', 0, '', 'propertyAddress'], ['Financier bank', 0, '', 'financierBank'], ['Purchase price (RM)', 0, 'e.g. 650,000.00', 'purchasePrice'], ['Loan amount (RM)', 0, '']],
  CORP: [['Transaction type', ['Share sale', 'Joint venture', 'Commercial contract', 'Advisory', 'Company secretarial'], '', 'corporateMatterType'], ['Target entity (SSM no.)', 0, ''], ['Deal value (RM)', 0, '', 'contractValue']],
};
const SIDES: Record<string, [string, string[], string]> = {
  L: ['We act for', ['Plaintiff', 'Defendant', 'Appellant', 'Respondent', 'Third party', 'Intervener'], 'Opponent (defendant / other party)'],
  CR: ['We act for', ['Accused (OKT)', 'Complainant / victim', 'Watching brief'], 'Prosecution / other party'],
  SY: ['Kami mewakili', ['Plaintif', 'Defendan', 'Pemohon', 'Responden'], 'Pihak lawan'],
  EST: ['We act for', ['Executor / administrator', 'Beneficiary', 'Caveator', 'Purchaser (OFS)'], 'Other party (caveator / beneficiary)'],
  CONV: ['We act for', ['Purchaser', 'Vendor', 'Borrower', 'Financier bank', 'Landlord', 'Tenant'], 'Other party (vendor / purchaser)'],
  CORP: ['We act for', ['Company', 'Buyer', 'Seller', 'Shareholder', 'Investor'], 'Counterparty'],
};
const GENERIC_SIDE: [string, string[], string] = ['We act for', ['Client', 'Plaintiff', 'Defendant', 'Applicant', 'Respondent'], 'Other party'];

const norm = (s: string) => String(s || '').trim().toLowerCase();

export const NewFilePage: React.FC = () => {
  const {
    clients = [], cases = [], users = [], currentUser, currentRole, isAdmin, newCasePrefill, setNewCasePrefill,
    setIsNewCaseModalOpen, setIsRegisterClientModalOpen, setCurrentCaseId, setCaseSubTab, setCurrentView,
    addCase, updateCase, getNextSequenceId, incrementSequenceCounter, showToast,
  } = useApp();
  const settings = getPracticeSettings();
  const areas = (settings.practiceAreas && settings.practiceAreas.length ? settings.practiceAreas : DEFAULT_PRACTICE_SETTINGS.practiceAreas) || [];
  const mcodes = (settings.matterCodes && settings.matterCodes.length ? settings.matterCodes : DEFAULT_PRACTICE_SETTINGS.matterCodes) || [];
  const staff = useMemo(() => staffOf(users), [users]);
  const partnerList = staff.filter((p) => p.isPartner);
  const isPartner = currentRole === 'Partner' || Boolean(isAdmin || currentUser?.isSuperAdmin);

  const [clientId, setClientId] = useState('');
  const [cq, setCq] = useState<string | undefined>(undefined);
  const [listOpen, setListOpen] = useState(false);
  const [areaI, setAreaI] = useState(0);
  const [code, setCode] = useState('');
  const [custom, setCustom] = useState('');
  const [title, setTitle] = useState('');
  const [opp, setOpp] = useState('');
  // Client initials in the file no. are typed by the firm, never worked out automatically.
  const [initials, setInitials] = useState('');
  const [makeWta, setMakeWta] = useState(true);
  const [side, setSide] = useState<Record<string, string>>({});
  const [vals, setVals] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState(false);
  const [partners, setPartners] = useState<string[]>(() => {
    const me = staff.find((p) => p.name === currentUser?.name);
    return me?.isPartner ? [me.code] : [];
  });
  const [pq, setPq] = useState('');
  const [pOpen, setPOpen] = useState(false);
  const [lawyer, setLawyer] = useState('');
  const [lq, setLq] = useState<string | undefined>(undefined);
  const [lOpen, setLOpen] = useState(false);
  const [done, setDone] = useState<Case | null>(null);

  useEffect(() => {
    if (!newCasePrefill) return;
    if (newCasePrefill.clientId) setClientId(newCasePrefill.clientId);
    if (newCasePrefill.caseTitle) setTitle(newCasePrefill.caseTitle);
    if (newCasePrefill.opponentName) setOpp(newCasePrefill.opponentName);
    if (newCasePrefill.practiceArea) {
      const i = areas.findIndex((a) => norm(a.name) === norm(newCasePrefill.practiceArea || '') || norm(newCasePrefill.practiceArea || '').includes(norm(a.name)));
      if (i >= 0) setAreaI(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCasePrefill]);

  const A = areas[Math.min(areaI, areas.length - 1)] || { name: 'Civil Litigation', code: 'L' };
  const tag = A.code;
  const inArea = (m: { practiceArea: string }) => norm(m.practiceArea) === norm(A.name) || m.practiceArea === A.code || (A.code === 'L' && /litigation/i.test(m.practiceArea));
  const codes = mcodes.filter(inArea);
  const otherCodes = mcodes.filter((m) => !inArea(m));
  const curCode = code === 'CUSTOM' || mcodes.some((m) => m.code === code) ? code : codes[0]?.code || (codes.length ? '' : 'CUSTOM');
  const codePart = curCode === 'CUSTOM' ? custom.trim().toUpperCase() : curCode;
  const C: Client | undefined = clients.find((c) => c.id === clientId);
  const S3 = SIDES[tag] || GENERIC_SIDE;
  const sideVal = side[tag] ?? S3[1][0];

  // Conflict: is the client the other side on an existing file, or is the other side a firm client?
  const conflict = useMemo(() => {
    const hits: string[] = [];
    if (C) {
      const n = norm(C.name);
      cases.forEach((cs) => {
        const others = partiesOf(cs, clients).filter((p) => p.side === 'opposing').map((p) => norm(p.name));
        if (n.length >= 3 && others.some((o) => o && (o === n || o.includes(n) || n.includes(o)))) hits.push(`${C.name} is the other side in ${cs.ref}.`);
      });
    }
    const o = norm(opp);
    if (o.length >= 3) clients.forEach((cl) => { const cn = norm(cl.name); if (cn.length >= 3 && cl.id !== clientId && (cn === o || cn.includes(o) || o.includes(cn))) hits.push(`${cl.name} (the other side) is a client of the firm.`); });
    return hits;
  }, [C, opp, cases, clients, clientId]);
  const conflictOpen = conflict.length > 0 && !reviewed;

  const lawyerP = staff.find((p) => p.code === lawyer);
  const now = new Date();
  const mmyy = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getFullYear()).slice(-2);
  const runNo = getNextSequenceId('case');
  const sortedPartners = [...partners].sort((a, b) => Number(b === 'SH') - Number(a === 'SH'));
  const refFor = (no: string) => ['SHC', ...sortedPartners, ...(lawyer ? [lawyer] : []), ...(codePart ? [codePart] : []), initials || '??', no, mmyy].join('/');
  const ref = refFor(done ? '' : '###');

  const blocker = !C ? 'Choose the client' : !initials ? 'Type the client initials for the file no.' : !codePart ? 'Choose a matter code' : conflictOpen ? 'Conflict needs partner review' : !title.trim() ? 'Enter a matter title' : !partners.length ? 'Pick a partner in charge' : '';

  const fee = (settings.feeTemplates || {})[tag] || builtInFeeTemplates()[tag];

  const fields = (FIELDS[tag] || []).map(([label, opts, ph, key], i, arr) => ({ label, opts, ph, key, k: tag + i, v: vals[tag + i] ?? '', span: arr.length % 2 && i === arr.length - 1 ? '1 / -1' : 'auto' }));

  const close = () => { if (setNewCasePrefill) setNewCasePrefill(null); setIsNewCaseModalOpen(false); };

  const submit = () => {
    if (blocker) { showToast(blocker); return; }
    if (!C) return;
    const finalRef = refFor(runNo);
    if (cases.some((x) => x.ref.trim() === finalRef)) { showToast('That file no. is already in use. Check the running number.'); return; }
    const id = `CASE-${Date.now()}`;
    const today = iso(new Date());
    const intake: Record<string, string> = {};
    const mapped: Partial<Case> = {};
    let courtLevel = '', courtLocation = '', suit = '';
    fields.forEach((f) => {
      const v = f.v.trim();
      if (!v) return;
      intake[f.label] = v;
      if (f.key === 'courtLevel') courtLevel = v;
      else if (f.key === 'courtLocation') courtLocation = v;
      else if (f.key === 'suit') suit = v;
      else if (f.key) (mapped as Record<string, string>)[f.key] = v;
    });
    const levelShort = courtLevel.split(' / ')[0];
    const lawyerName = lawyerP?.name;
    const partyRole = sideVal;
    const kase: Case = {
      id, ref: finalRef, title: title.trim(), createdDate: today, fileOpenedDate: today,
      clientId: C.id, clientName: C.name, clientRole: partyRole,
      clientsList: [{ id: C.id, clientId: C.id, name: C.name, role: partyRole, icOrRegNo: C.icNo || C.icNumber || C.registrationNo || '', phone: C.phone || '', email: C.email || '' }],
      type: A.name, practiceArea: A.name, matterCode: codePart || undefined,
      lawyerInCharge: lawyerName, lawyers: lawyerName ? [lawyerName] : [],
      partners: sortedPartners as PartnerCode[],
      court: [levelShort, courtLocation].filter(Boolean).join(' '), judge: '', courtCaseNo: suit || undefined,
      courtDetails: levelShort || courtLocation ? { level: levelShort || undefined, location: courtLocation || undefined } : undefined,
      opposingParty: opp.trim(), opposingParties: opp.trim() ? [opp.trim()] : [],
      opposingPartiesList: opp.trim() ? [{ id: 'OP-' + id + '-0', name: opp.trim(), role: 'Opposing party' }] : [],
      opposingCounsel: [],
      status: 'Active', nextHearing: '', lastAccessed: new Date().toISOString(), caseNotes: '',
      hearings: [], documents: [], courtDiary: [], tasks: [], serviceRecord: [], meetingNotes: [], internalNotes: [],
      statusStage: 0, intakeDetails: Object.keys(intake).length ? intake : undefined,
      conflictReview: conflict.length ? { status: 'Reviewed', detail: conflict.join(' '), by: currentUser?.name, at: stamp() } : { status: 'Clear', at: stamp() },
      activityLogs: [{ id: 'CAL-' + Date.now(), timestamp: stamp().replace('T', ' '), type: 'Status Update', title: 'File opened', description: 'File opened' + (conflict.length ? '. Possible conflict reviewed by ' + (currentUser?.name || 'a partner') : '. Conflict check clear'), actor: currentUser?.name || '' }],
      ...mapped,
    };
    addCase(kase);
    incrementSequenceCounter('case');
    setDone(kase);
    // Every new file gets its Google Drive folder straight away (Shared Drive › Matters).
    if (activeStorage() === 'drive') {
      void (async () => {
        try {
          await prepareStorage();
          const f = await ensureMatterFolder(kase.ref, kase.title);
          if (f) updateCase(kase.id, { gdriveFolderId: f.id, gdriveFolderUrl: f.url });
        } catch (e) {
          showToast('File opened, but the Drive folder was not created: ' + (e instanceof Error ? e.message : String(e)) + '. Use "Create Drive folder" on the file.');
        }
      })();
    }
  };

  const goFile = () => { if (!done) return; close(); setCaseSubTab('overview'); setCurrentCaseId(done.id); };
  const again = () => { setDone(null); setTitle(''); setOpp(''); setInitials(''); setVals({}); setReviewed(false); setClientId(''); };

  const pqq = pq.toLowerCase().trim();
  const pList = partnerList.filter((p) => !pqq || p.name.toLowerCase().includes(pqq) || p.code.toLowerCase().includes(pqq));
  const lqq = (lq || '').toLowerCase().trim();
  const lawyerOpts: Person[] = staff.filter((p) => !partners.includes(p.code) && isFileHandler(p));
  const lList = lawyerOpts.filter((p) => !lqq || p.name.toLowerCase().includes(lqq) || p.code.toLowerCase().includes(lqq));
  const cqq = (cq || '').toLowerCase().trim();
  const matches = clients.filter((c) => !cqq || [c.name, c.icNo, c.icNumber, c.registrationNo].join(' ').toLowerCase().includes(cqq)).slice(0, 30);

  const lbl = 'font-size:12px;font-weight:600;color:#5B6478';
  const inp = 'border:1px solid #C9D1DC;border-radius:8px;padding:10px;font-size:13px;color:#16223A;min-width:0;width:100%;background:#fff';
  const dd = 'position:absolute;z-index:5;top:calc(100% + 4px);left:0;right:0;max-height:240px;overflow:auto;background:#fff;border:1px solid #C9D1DC;border-radius:8px;box-shadow:0 8px 24px rgba(22,34,58,.12);padding:4px';
  const ddItem = (sel: boolean) => `display:flex;justify-content:space-between;gap:10px;width:100%;border:0;border-radius:6px;padding:9px 10px;background:${sel ? '#EEF1F5' : '#fff'};color:#16223A;font-size:13px;text-align:left;cursor:pointer`;

  return (
    <div style={css('display:flex;flex-direction:column;gap:18px;color:#16223A')}>
      <div style={css('display:flex;align-items:center;gap:10px;font-size:13px')}>
        <button type="button" onClick={close} style={css('border:0;background:none;padding:0;cursor:pointer;color:#5B6478;font-weight:500;font-size:13px;font-family:inherit')}>Cases</button>
        <span style={css('color:#5B6478')}>/</span><strong style={css('font-family:Georgia,serif;font-size:20px')}>Open a new file</strong>
      </div>

      {!done && (
        <div style={css('display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start')}>
          <div style={css('flex:1 1 520px;max-width:760px;min-width:0;display:flex;flex-direction:column;background:#fff;border:1px solid #DDE3EB;border-radius:12px')}>
            <div style={css('position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;padding:14px 24px;background:#16223A;color:#fff;border-radius:12px 12px 0 0')}>
              <span style={css('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#E9C46A')}>File no. preview</span>
              <span style={css('font-family:ui-monospace,monospace;font-size:15px;font-weight:800;word-break:break-all')}>{ref}</span>
              <span style={css('flex-basis:100%;font-size:12px;line-height:1.5;color:#C9D1DC')}>Built from partner, lawyer, matter type and the client initials you type. Running number ({runNo}) is given when the file opens.</span>
            </div>

            <div style={css('padding:20px 24px;display:flex;flex-direction:column;gap:12px;border-bottom:1px solid #EEF1F5')}>
              <span style={css('font-family:Georgia,serif;font-size:16px;font-weight:700')}>1. Client</span>
              <div style={css('display:flex;gap:8px;align-items:flex-start')}>
                <div style={css('position:relative;flex:1;min-width:0')}>
                  <input value={cq ?? (C ? C.name + ' · ' + (C.type || '') : '')} onChange={(e) => { setCq(e.target.value); setListOpen(true); }} onFocus={(e) => { e.target.select(); setCq(''); setListOpen(true); }} onBlur={() => { setListOpen(false); setCq(undefined); }} placeholder="Search client by name, IC or company no." style={css('box-sizing:border-box;width:100%;border:1px solid #C9D1DC;border-radius:8px;padding:10px 12px;font-size:13px;background:#fff;color:#16223A')} />
                  {listOpen && (
                    <div style={css(dd)}>
                      {matches.map((c) => (
                        <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); setClientId(c.id); setReviewed(false); setListOpen(false); setCq(undefined); (document.activeElement as HTMLElement | null)?.blur(); }} className="hover:!bg-[#F0F3F7]" style={css(ddItem(c.id === clientId))}>
                          <span>{c.name}</span><span style={css('color:#5B6778;font-size:12px')}>{c.type}{c.icNo || c.registrationNo ? ' · ' + (c.icNo || c.registrationNo) : ''}</span>
                        </button>
                      ))}
                      {!matches.length && <div style={css('padding:10px;font-size:12.5px;color:#5B6778')}>{clients.length ? 'No client found. Use + New client.' : 'No clients registered yet. Use + New client.'}</div>}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setIsRegisterClientModalOpen(true)} style={css('flex-shrink:0;height:40px;border:1px solid #C9D1DC;border-radius:8px;padding:0 14px;font-size:12.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>+ New client</button>
              </div>
              <label style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}>
                <span style={css('font-size:12px;font-weight:600;color:#5B6478')}>Client initials (for the file no.)</span>
                <input id="newfile-initials" value={initials} maxLength={8} placeholder="e.g. AH" onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z0-9&-]/g, ''))} style={css('width:120px;height:36px;border:1px solid #C9D1DC;border-radius:8px;padding:0 10px;font-family:ui-monospace,monospace;font-size:13px;font-weight:700;color:#16223A;text-transform:uppercase')} />
              </label>
              {(() => {
                const cf = !C && !opp.trim() ? { bg: '#EEF1F5', fg: '#4A5468', title: 'Conflict check.', text: 'Choose the client and the other side to check.' }
                  : !conflict.length ? { bg: '#E6EFE9', fg: '#1F5A3B', title: 'No conflict.', text: 'Not found as the other side in any file, and the other side is not a firm client.' }
                    : reviewed ? { bg: '#E6EFE9', fg: '#1F5A3B', title: 'Conflict reviewed.', text: 'Partner confirmed safe to act. Saved on the file.' }
                      : { bg: '#FFF4E5', fg: '#7A4300', title: 'Possible conflict.', text: conflict.join(' ') };
                return (
                  <div style={css(`display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;font-size:12.5px;background:${cf.bg};color:${cf.fg}`)}>
                    <strong style={css('flex-shrink:0')}>{cf.title}</strong><span>{cf.text}</span>
                    {conflictOpen && (isPartner
                      ? <button type="button" onClick={() => setReviewed(true)} style={css('margin-left:auto;flex-shrink:0;border:0;border-radius:7px;padding:6px 11px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}>Partner reviewed</button>
                      : <span style={css('margin-left:auto;flex-shrink:0;font-size:12px;font-weight:700')}>A partner must review</span>)}
                  </div>
                );
              })()}
            </div>

            <div style={css('padding:20px 24px;display:flex;flex-direction:column;gap:14px;border-bottom:1px solid #EEF1F5')}>
              <span style={css('font-family:Georgia,serif;font-size:16px;font-weight:700')}>2. Matter</span>
              <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px')}>
                <label style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(lbl)}>Practice area</span>
                  <select value={String(areaI)} onChange={(e) => { const i = Number(e.target.value); setAreaI(i); setCode(''); }} style={css(inp)}>
                    {areas.map((a, i) => <option key={a.id || a.code} value={String(i)}>{a.name}</option>)}
                  </select>
                </label>
                <label style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(lbl)}>Matter code</span>
                  <select value={curCode} onChange={(e) => setCode(e.target.value)} style={css(inp)}>
                    {codes.length > 0 && <optgroup label={A.name}>{codes.map((m) => <option key={m.id} value={m.code}>{m.code} ({m.name})</option>)}</optgroup>}
                    {otherCodes.length > 0 && <optgroup label="Other registered codes">{otherCodes.map((m) => <option key={m.id} value={m.code}>{m.code} ({m.name} - {m.practiceArea})</option>)}</optgroup>}
                    <option value="CUSTOM">Custom code…</option>
                  </select>
                </label>
                {curCode === 'CUSTOM' && (
                  <label style={css('grid-column:2;display:flex;flex-direction:column;gap:6px')}><span style={css(lbl)}>Custom matter code</span>
                    <input value={custom} onChange={(e) => setCustom(e.target.value.toUpperCase())} placeholder={'e.g. ' + A.code} style={css(inp + ';font-family:ui-monospace,monospace;font-weight:700;text-transform:uppercase')} />
                  </label>
                )}
                <label style={css('grid-column:1 / -1;display:flex;flex-direction:column;gap:6px')}><span style={css(lbl)}>Matter title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client name v. Other side (nature of claim)" style={css(inp)} /></label>
                <label style={css('grid-column:1 / -1;display:flex;flex-direction:column;gap:6px')}><span style={css(lbl)}>{S3[2]}</span><input value={opp} onChange={(e) => { setOpp(e.target.value); setReviewed(false); }} style={css(inp)} /></label>
                <div style={css('grid-column:1 / -1;display:flex;flex-direction:column;gap:6px')}><span style={css(lbl)}>{S3[0]}</span>
                  <div style={css('display:flex;flex-wrap:wrap;gap:6px')}>
                    {S3[1].map((label) => { const sel = sideVal === label; return <button key={label} type="button" onClick={() => setSide((s) => ({ ...s, [tag]: label }))} style={css(`border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:600;cursor:pointer;background:${sel ? '#16223A' : '#fff'};color:${sel ? '#fff' : '#16223A'};border:1px solid ${sel ? '#16223A' : '#C9D1DC'}`)}>{label}</button>; })}
                  </div>
                </div>
                {fields.length > 0 && <div style={css('grid-column:1 / -1;display:flex;align-items:center;gap:8px;padding-top:6px;border-top:1px dashed #DDE3EB')}><span style={css('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#3D6B9C')}>{A.name} details</span></div>}
                {fields.map((f) => (
                  <label key={f.k} style={css(`display:flex;flex-direction:column;gap:6px;grid-column:${f.span}`)}><span style={css(lbl)}>{f.label}</span>
                    {f.opts ? (
                      <select value={f.v} onChange={(e) => setVals((s) => ({ ...s, [f.k]: e.target.value }))} style={css(inp)}>
                        <option value="">—</option>
                        {f.opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={f.v} placeholder={f.ph} onChange={(e) => setVals((s) => ({ ...s, [f.k]: e.target.value }))} style={css(inp)} />
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div style={css('padding:20px 24px;display:flex;flex-direction:column;gap:14px;border-bottom:1px solid #EEF1F5')}>
              <span style={css('font-family:Georgia,serif;font-size:16px;font-weight:700')}>3. Team</span>
              <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(lbl)}>Partner in charge (one or more)</span>
                <div style={css('position:relative;max-width:520px')}>
                  <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:6px;border:1px solid #C9D1DC;border-radius:8px;padding:6px 8px;background:#fff;min-height:40px;box-sizing:border-box')}>
                    {sortedPartners.map((code) => (
                      <span key={code} style={css('display:flex;align-items:center;gap:6px;border-radius:6px;padding:4px 6px 4px 10px;font-size:12.5px;font-weight:600;background:#16223A;color:#fff')}>{(staff.find((p) => p.code === code)?.name || code) + ' (' + code + ')'}<button type="button" onMouseDown={(e) => { e.preventDefault(); setPartners((s) => s.filter((x) => x !== code)); }} aria-label="Remove" style={css('border:0;background:none;color:#C9D1DC;font-size:14px;line-height:1;padding:0 2px;cursor:pointer')}>×</button></span>
                    ))}
                    <input value={pq} onChange={(e) => { setPq(e.target.value); setPOpen(true); }} onFocus={() => setPOpen(true)} onBlur={() => { setPOpen(false); setPq(''); }} placeholder={partners.length ? 'Add another partner…' : 'Search partner by name or code'} style={css('flex:1;min-width:120px;border:0;outline:none;padding:4px;font-size:13px;color:#16223A;background:transparent')} />
                  </div>
                  {pOpen && (
                    <div style={css(dd)}>
                      {pList.map((p) => { const sel = partners.includes(p.code); return (
                        <button key={p.code} type="button" onMouseDown={(e) => { e.preventDefault(); setPq(''); setPartners((s) => (sel ? s.filter((x) => x !== p.code) : [...s, p.code])); if (lawyer === p.code) setLawyer(''); }} className="hover:!bg-[#F0F3F7]" style={css(ddItem(sel))}><span>{p.name} ({p.code})</span><span style={css('font-size:12px;font-weight:700;color:#1F5A3B')}>{sel ? '✓ Added' : ''}</span></button>
                      ); })}
                      {!pList.length && <div style={css('padding:10px;font-size:12.5px;color:#5B6778')}>{partnerList.length ? 'No partner found.' : 'No partners in Users & Roles yet.'}</div>}
                    </div>
                  )}
                </div>
              </div>
              <div style={css('display:flex;flex-direction:column;gap:6px;max-width:520px')}><span style={css(lbl)}>Lawyer in charge (optional)</span>
                <div style={css('position:relative')}>
                  <input value={lq ?? (lawyerP ? lawyerP.name + ' (' + lawyerP.code + ')' : '')} onChange={(e) => { setLq(e.target.value); setLOpen(true); }} onFocus={() => { setLOpen(true); setLq(''); }} onBlur={() => { setLOpen(false); setLq(undefined); }} placeholder="Search lawyer by name or code" style={css('box-sizing:border-box;width:100%;border:1px solid #C9D1DC;border-radius:8px;padding:10px 12px;font-size:13px;background:#fff;color:#16223A')} />
                  {lOpen && (
                    <div style={css(dd)}>
                      {lList.map((p) => (
                        <button key={p.code + p.name} type="button" onMouseDown={(e) => { e.preventDefault(); setLawyer(p.code); setLOpen(false); setLq(undefined); (document.activeElement as HTMLElement | null)?.blur(); }} className="hover:!bg-[#F0F3F7]" style={css(ddItem(p.code === lawyer))}><span>{p.name} ({p.code})</span><span style={css('font-size:12px;font-weight:700;color:#1F5A3B')}>{p.code === lawyer ? '✓' : ''}</span></button>
                      ))}
                      <button type="button" onMouseDown={(e) => { e.preventDefault(); setLawyer(''); setLOpen(false); setLq(undefined); (document.activeElement as HTMLElement | null)?.blur(); }} style={css(ddItem(!lawyer))}><span>None</span><span>{!lawyer ? '✓' : ''}</span></button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={css('padding:20px 24px;display:flex;flex-direction:column;gap:12px')}>
              <span style={css('font-family:Georgia,serif;font-size:16px;font-weight:700')}>4. Warrant to Act</span>
              <label style={css('display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid #DDE3EB;border-radius:10px;background:#F6F8FA;cursor:pointer')}>
                <input id="newfile-wta" type="checkbox" checked={makeWta} onChange={(e) => setMakeWta(e.target.checked)} style={css('margin-top:3px')} />
                <span style={css('display:flex;flex-direction:column;gap:2px')}>
                  <span style={css('font-size:13px;font-weight:700')}>Prepare the Warrant to Act when the file opens</span>
                  <span style={css('font-size:12px;color:#5B6478')}>Filled with the client’s name, IC / company no., address, the matter, court and suit no. View, PDF, print or Word straight after the file opens.</span>
                </span>
              </label>
            </div>

            <div style={css('display:flex;align-items:center;gap:10px;padding:14px 24px;border-top:1px solid #EEF1F5;background:#FBFCFD;border-radius:0 0 12px 12px')}>
              <button type="button" onClick={close} style={css('border:1px solid #C9D1DC;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Cancel</button>
              <span style={css('margin-left:auto;font-size:12px;color:#A3321F')}>{blocker}</span>
              <button type="button" onClick={submit} style={css(`border:0;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;background:${blocker ? '#9AA4B2' : '#16223A'};color:#fff`)}>Open file</button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div style={css('max-width:640px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;background:#fff;border:1px solid #DDE3EB;border-radius:12px;padding:36px 28px')}>
          <span style={css('width:44px;height:44px;border-radius:9999px;display:grid;place-items:center;font-size:20px;font-weight:800;background:#2F6F4E;color:#fff')}>✓</span>
          <strong style={css('font-family:Georgia,serif;font-size:22px')}>File opened</strong>
          <span style={css('font-family:ui-monospace,monospace;font-size:17px;font-weight:800')}>{done.ref}</span>
          <span style={css('font-size:13px;color:#5B6478')}>{done.title} · {done.clientName}</span>
          {makeWta && (
            <div style={css('width:100%;margin-top:10px;display:flex;flex-direction:column;gap:8px;align-items:flex-start;text-align:left;border:1px solid #DDE3EB;border-radius:10px;padding:12px 14px')}>
              <strong style={css('font-family:Georgia,serif;font-size:14px')}>Warrant to Act</strong>
              <span style={css('font-size:12px;color:#5B6478')}>Filled from the client and file details. Print it for the client to sign, then upload the signed copy in the file’s Letters tab. Also available any time in Letters › Warrant to Act.</span>
              <WarrantToActActions input={warrantInputFor(done, clients.find((x) => x.id === done.clientId), opp)} />
            </div>
          )}
          <div style={css('width:100%;margin-top:10px;border:1px solid #DDE3EB;border-radius:10px;text-align:left')}>
            <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5;font-family:Georgia,serif;font-size:14px;font-weight:700')}>What happens next</div>
            {([
              ['Quotation', fee ? 'Make it from the ' + A.name + ' fee template in Billing & Collections' : 'Make it in Billing & Collections', 'Not made yet', canSeeFinanceView('billing', finRoleKey(currentRole, currentUser, isAdmin)) ? () => { close(); setCurrentView('billing'); } : null, 'Open Billing'],
              ['Engagement letter', 'E-signature is not connected yet. Print it and get it signed.', 'Not sent', null, ''],
              ['File cover', 'Print and put on the physical file (in the file: Print file cover)', 'To do', goFile, 'Go to file'],
            ] as [string, string, string, (() => void) | null, string][]).map(([t, d, s, act, a]) => (
              <div key={t} style={css('display:grid;grid-template-columns:minmax(0,1fr) 110px 110px;gap:12px;align-items:center;padding:10px 14px;border-bottom:1px solid #F0F2F5')}>
                <span style={css('display:flex;flex-direction:column;gap:2px')}><span style={css('font-size:13px;font-weight:700')}>{t}</span><span style={css('font-size:12px;color:#4A5468')}>{d}</span></span>
                <span style={css('justify-self:start;padding:3px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:#EEF1F5;color:#2B3445')}>{s}</span>
                {act ? <button type="button" onClick={act} style={css('border:1px solid #C9D1DC;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>{a}</button> : <span />}
              </div>
            ))}
          </div>
          <div style={css('display:flex;gap:8px;margin-top:8px')}>
            <button type="button" onClick={again} style={css('border:1px solid #C9D1DC;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Open another</button>
            <button type="button" onClick={close} style={css('border:1px solid #C9D1DC;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Back to cases</button>
            <button type="button" onClick={goFile} style={css('border:0;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}>Go to the file</button>
          </div>
        </div>
      )}
    </div>
  );
};
