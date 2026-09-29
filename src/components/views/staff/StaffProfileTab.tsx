import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { HrDocument, StaffProfile, User } from '../../../types';
import { card, cardTitle, FirmLetterhead, labelWrap, printHtml, serif } from './staffPortalShared';
import { getPracticeSettings } from '../../../services/templateService';
import { getClaimAttachmentUrl, openClaimAttachment, uploadHrFile, validateClaimFile } from '../../../services/firebaseStorageService';
import {
  applyDraft, buildEmployeeRecordHtml, DOC_TYPES, Draft, draftOf, dt, EMPLOYMENT_TYPES, expiryInfo, GENDERS, isLawyer, MARITAL,
  PCB_CATEGORIES, RESIDENCY, SECTION_TITLES, sectionStatus, stampDay, STATUSES, trimDraft, validateDraft,
} from './staffRecord';

const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478' };
const INP: React.CSSProperties = { border: '1px solid #DDE3EB', borderRadius: 6, padding: '6px 8px', fontSize: 11.5, color: '#16223A', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
const RO: React.CSSProperties = { ...INP, background: '#F6F8FA', minHeight: 29, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const NOTE: React.CSSProperties = { fontSize: 10.5, lineHeight: 1.5, color: '#5B6478' };
const G3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 };
const BTN: React.CSSProperties = { border: '1px solid #DDE3EB', borderRadius: 6, padding: '5px 10px', fontSize: 10.5, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const BTN_DARK: React.CSSProperties = { ...BTN, border: 0, background: '#16223A', color: '#fff' };

const STAFF_ID_RE = /^SHCO-ST-(\d+)$/;

/** Next free SHCO-ST-000N — same scheme addUser uses, never re-using an existing number. */
export const nextStaffId = (users: User[]) => {
  const used = new Set(users.map((u) => u.staffProfile?.staffId).filter(Boolean) as string[]);
  const highest = Array.from(used).reduce((m, id) => {
    const x = id.match(STAFF_ID_RE);
    return x ? Math.max(m, Number(x[1])) : m;
  }, 0);
  let n = Math.max(highest, users.filter((u) => u.role !== 'Client').length) + 1;
  let id = 'SHCO-ST-' + String(n).padStart(4, '0');
  while (used.has(id)) id = 'SHCO-ST-' + String(++n).padStart(4, '0');
  return id;
};

/** Profile shape for a user who has never had one (pre-staff-record users). */
const baseProfile = (u: User): StaffProfile =>
  u.staffProfile || {
    staffId: '',
    designation: String(u.role || ''),
    department: 'Legal Practice',
    phone: '',
    emergencyContact: '',
    joinDate: '',
    employmentType: 'Permanent',
    officeLocation: 'Kuala Lumpur Office',
    bio: '',
  };

export const StaffProfileTab: React.FC<{ lh: string }> = ({ lh }) => {
  const { currentUser, users, isAdmin } = useApp();
  const admin = Boolean(isAdmin || currentUser.isSuperAdmin);
  const [selId, setSelId] = useState(currentUser.id);

  const staff = useMemo(() => users.filter((u) => u.role !== 'Client').sort((a, b) => a.name.localeCompare(b.name)), [users]);
  const id = admin ? selId : currentUser.id;
  const target = users.find((u) => u.id === id) || (id === currentUser.id ? currentUser : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {admin && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px' }}>
          <strong style={cardTitle}>Employee records</strong>
          <span style={{ fontSize: 10.5, color: '#5B6478' }}>Official HR record · as an admin you can open and edit anyone’s record</span>
          <select value={id} onChange={(e) => setSelId(e.target.value)} style={{ ...INP, width: 300, marginLeft: 'auto', cursor: 'pointer' }}>
            {!staff.some((u) => u.id === currentUser.id) && <option value={currentUser.id}>{currentUser.name} (you)</option>}
            {staff.map((u) => {
              const st = u.staffProfile?.employment?.status;
              return (
                <option key={u.id} value={u.id}>
                  {u.name + (u.id === currentUser.id ? ' (you)' : '') + ' · ' + (u.staffProfile?.staffId || 'no staff ID') + (st && st !== 'Active' ? ' · ' + st.toLowerCase() : '') + (u.status === 'Inactive' ? ' · login inactive' : '')}
                </option>
              );
            })}
          </select>
        </div>
      )}
      {!target || target.role === 'Client' ? (
        <div style={{ ...card, padding: '12px 14px', fontSize: 11.5, color: '#5B6478' }}>No staff profile to show.</div>
      ) : (
        <RecordForm key={target.id} user={target} admin={admin} self={target.id === currentUser.id} lh={lh} />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ photo */

const usePhotoUrl = (path?: string) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (path) getClaimAttachmentUrl(path).then((u) => live && setUrl(u)).catch(() => live && setUrl(null));
    return () => { live = false; };
  }, [path]);
  return url;
};

/* ------------------------------------------------------------------ section card */

const Section: React.FC<{ n: number; done: boolean; applicable: boolean; open: boolean; onToggle: () => void; right?: React.ReactNode; foot?: React.ReactNode; children: React.ReactNode }> = ({ n, done, applicable, open, onToggle, right, foot, children }) => (
  <div style={card}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: '#16223A' }}>
      <button type="button" onClick={onToggle} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: 10, border: 0, background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', textAlign: 'left' }}>
        <span style={{ width: 20, height: 20, borderRadius: 9999, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800 }}>{n}</span>
        <strong style={{ fontSize: 13 }}>{SECTION_TITLES[n - 1]}</strong>
        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: !applicable ? 'rgba(255,255,255,.12)' : done ? '#E6EFE9' : '#FBF2E9', color: !applicable ? '#C9D3E0' : done ? '#2F6F4E' : '#8A6534' }}>
          {!applicable ? 'not applicable' : done ? '✓ complete' : 'incomplete'}
        </span>
        <span style={{ fontSize: 12, color: '#C9D3E0' }}>{open ? '▾' : '▸'}</span>
      </button>
      {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{right}</div>}
    </div>
    {open && <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>}
    {open && foot && <div style={{ padding: '9px 14px', background: '#F6F8FA', borderTop: '1px solid #EEF1F5', ...NOTE }}>{foot}</div>}
  </div>
);

const Badge: React.FC<{ iso: string }> = ({ iso }) => {
  const x = expiryInfo(iso);
  return x ? <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, color: x.color, background: x.bg }}>{x.text}</span> : null;
};

/* ------------------------------------------------------------------ the form */

type RowKey = 'allowances' | 'education' | 'workHistory';

const RecordForm: React.FC<{ user: User; admin: boolean; self: boolean; lh: string }> = ({ user, admin, self, lh }) => {
  const { currentUser, users, updateUserStaffProfile, updateUserIdentity, showToast } = useApp();
  const canEdit = admin;
  const [f, setForm] = useState<Draft>(() => draftOf(user));
  const setF = (p: Partial<Draft>) => setForm((s) => ({ ...s, ...p }));
  const saved = useMemo(() => draftOf(user), [user]);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const profile = user.staffProfile;
  const staffId = profile?.staffId || '';
  const docs = profile?.hrDocuments || [];
  const [closed, setClosed] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState('');
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const docInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  // Uploads finish asynchronously — always merge onto the newest stored profile, not the one from render time.
  const latest = useRef(user);
  latest.current = user;
  const photoUrl = usePhotoUrl(profile?.photo?.path);

  const status = sectionStatus(user, f, docs, staffId);
  const applicable = status.filter(([, a]) => a);
  const doneCount = applicable.filter(([d]) => d).length;
  const legacyEmergency = !profile?.emergency && profile?.emergencyContact ? profile.emergencyContact : '';
  const colleagues = users.filter((u) => u.role !== 'Client' && u.id !== user.id).sort((a, b) => a.name.localeCompare(b.name));
  const stamp = () => ({ hrUpdatedAt: new Date().toISOString(), hrUpdatedBy: currentUser.name });

  const save = () => {
    const n = trimDraft(f);
    const problem = validateDraft(n);
    if (problem) { showToast(problem); return; }
    if (n.displayName !== saved.displayName || n.code !== saved.code) {
      const ok = updateUserIdentity(user.id, {
        ...(n.displayName !== saved.displayName ? { name: n.displayName } : {}),
        ...(n.code !== saved.code ? { code: n.code } : {}),
      });
      if (!ok) return;
    }
    // Merge onto the latest stored profile so goals, check-ins, targets and documents are kept.
    const cur = baseProfile(latest.current);
    updateUserStaffProfile(user.id, { ...applyDraft(cur, n, cur.professional?.cpdPoints), ...stamp() });
    setForm(n);
  };

  const assignId = () => {
    const next = nextStaffId(users);
    updateUserStaffProfile(user.id, { ...baseProfile(latest.current), staffId: next });
    showToast(user.name + ' is now ' + next);
  };

  const uploadDoc = async (file: File) => {
    const problem = validateClaimFile(file);
    if (problem) { showToast(problem); return; }
    setBusy('doc');
    try {
      const up = await uploadHrFile(user.id, file);
      const doc: HrDocument = { ...up, type: docType, uploadedAt: new Date().toISOString(), uploadedBy: currentUser.name };
      const cur = baseProfile(latest.current);
      updateUserStaffProfile(user.id, { ...cur, hrDocuments: [...(cur.hrDocuments || []), doc], ...stamp() });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy('');
    }
  };

  const removeDoc = (d: HrDocument) => {
    if (!window.confirm('Remove “' + d.name + '” from ' + user.name + '’s record?')) return;
    const cur = baseProfile(latest.current);
    // Only the reference is dropped; the stored file itself is kept in Firebase Storage.
    updateUserStaffProfile(user.id, { ...cur, hrDocuments: (cur.hrDocuments || []).filter((x) => x.path !== d.path), ...stamp() });
  };

  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name)) { showToast('The photo must be an image.'); return; }
    const problem = validateClaimFile(file);
    if (problem) { showToast(problem); return; }
    setBusy('photo');
    try {
      const up = await uploadHrFile(user.id, file);
      const cur = baseProfile(latest.current);
      updateUserStaffProfile(user.id, { ...cur, photo: { ...up, type: 'Photo', uploadedAt: new Date().toISOString(), uploadedBy: currentUser.name }, ...stamp() });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy('');
    }
  };

  const openDoc = async (d: HrDocument) => {
    const err = await openClaimAttachment(d);
    if (err) showToast(err);
  };

  const print = () => {
    if (dirty) { showToast('Save or discard your changes first — the printout shows the saved record.'); return; }
    const s = getPracticeSettings();
    const firm: FirmLetterhead = { address: s.address, email: s.email, phone: s.phone };
    printHtml('Employee record · ' + (profile?.fullName || user.name), buildEmployeeRecordHtml(user, users, lh, firm));
  };

  /* ---- field helpers ---- */
  type StrKey = { [K in keyof Draft]: Draft[K] extends string ? K : never }[keyof Draft];

  const show = (v: string) => <span style={RO} title={v}>{v || '—'}</span>;

  const text = (k: StrKey, label: string, o: { ph?: string; type?: string; req?: boolean; after?: React.ReactNode; span?: number } = {}) => (
    <label style={{ ...labelWrap, ...(o.span ? { gridColumn: 'span ' + o.span } : {}) }}>
      <span style={LBL}>{label}{o.req && <span style={{ color: '#B23A2E' }}> *</span>}</span>
      {canEdit ? (
        <input type={o.type || 'text'} inputMode={o.type === 'number' ? 'decimal' : undefined} value={String(f[k])} placeholder={o.ph} onChange={(e) => setF({ [k]: e.target.value } as Partial<Draft>)} style={{ ...INP, cursor: o.type === 'date' || o.type === 'month' ? 'pointer' : 'text' }} />
      ) : (
        show(o.type === 'date' || o.type === 'month' ? dt(String(f[k])) : String(f[k]))
      )}
      {o.after}
    </label>
  );

  const pick = (k: StrKey, label: string, options: [string, string][], o: { blank?: string; after?: React.ReactNode } = {}) => (
    <label style={labelWrap}>
      <span style={LBL}>{label}</span>
      {canEdit ? (
        <select value={String(f[k])} onChange={(e) => setF({ [k]: e.target.value } as Partial<Draft>)} style={{ ...INP, cursor: 'pointer' }}>
          {o.blank !== undefined && <option value="">{o.blank}</option>}
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        show(options.find(([v]) => v === f[k])?.[1] || '')
      )}
      {o.after}
    </label>
  );

  const ro = (label: string, value: React.ReactNode, hint?: string) => (
    <div style={labelWrap}>
      <span style={LBL}>{label}</span>
      <span style={RO}>{value}</span>
      {hint && <span style={NOTE}>{hint}</span>}
    </div>
  );

  const same = (xs: string[]): [string, string][] => xs.map((x) => [x, x]);

  /** Repeatable rows (allowances, education, employment history). */
  const rows = <K extends RowKey>(key: K, cols: { k: keyof Draft[K][number] & string; label: string; type?: string; w?: string }[], blank: Draft[K][number], empty: string) => {
    const list = f[key] as Draft[K][number][];
    const tpl = cols.map((c) => c.w || 'minmax(0,1fr)').join(' ') + (canEdit ? ' 28px' : '');
    const setRow = (i: number, patch: Partial<Draft[K][number]>) => setF({ [key]: list.map((r, j) => (j === i ? { ...r, ...patch } : r)) } as Partial<Draft>);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: tpl, gap: 8 }}>
            {cols.map((c) => <span key={c.k} style={LBL}>{c.label}</span>)}
            {canEdit && <span />}
          </div>
        )}
        {list.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: tpl, gap: 8, alignItems: 'center' }}>
            {cols.map((c) => {
              const val = String((r as Record<string, string>)[c.k] ?? '');
              return canEdit ? (
                <input key={c.k} type={c.type || 'text'} inputMode={c.type === 'number' ? 'decimal' : undefined} value={val} aria-label={c.label} onChange={(e) => setRow(i, { [c.k]: e.target.value } as Partial<Draft[K][number]>)} style={INP} />
              ) : (
                <span key={c.k} style={RO}>{(c.type === 'month' ? dt(val) : val) || '—'}</span>
              );
            })}
            {canEdit && (
              <button type="button" title="Remove row" onClick={() => setF({ [key]: list.filter((_, j) => j !== i) } as Partial<Draft>)} style={{ ...BTN, padding: '4px 0', color: '#B23A2E' }}>×</button>
            )}
          </div>
        ))}
        {!list.length && <span style={NOTE}>{empty}</span>}
        {canEdit && (
          <button type="button" onClick={() => setF({ [key]: [...list, { ...blank }] } as Partial<Draft>)} style={{ ...BTN, alignSelf: 'flex-start' }}>+ Add row</button>
        )}
      </div>
    );
  };

  const sec = (n: number) => ({
    n, done: status[n - 1][0], applicable: status[n - 1][1], open: !closed.has(n),
    onToggle: () => setClosed((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; }),
  });

  const sensitiveFoot = self ? 'Shown only to you and the firm’s admins.' : 'Shown only to ' + user.name + ' and the firm’s admins.';
  const lawyer = isLawyer(user, f);
  const allowTotal = f.allowances.reduce((s, a) => s + (Number(a.amount) || 0), 0);

  return (
    <>
      {/* ---- header ---- */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px' }}>
          <span style={{ position: 'relative', flex: 'none' }}>
            {photoUrl ? (
              <img src={photoUrl} alt={user.name} style={{ width: 48, height: 48, borderRadius: 9999, objectFit: 'cover', display: 'block', border: '1px solid #DDE3EB' }} />
            ) : (
              <span style={{ width: 48, height: 48, borderRadius: 9999, background: '#16223A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 19, fontWeight: 700 }}>{user.name.slice(0, 1)}</span>
            )}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <strong style={{ fontFamily: serif, fontSize: 17, color: '#16223A' }}>{user.name}</strong>
            <span style={{ fontSize: 10.5, color: '#5B6478' }}>
              {[staffId || 'no staff ID', f.designation, saved.status !== 'Active' ? saved.status : ''].filter(Boolean).join(' · ')}
            </span>
            <span style={{ fontSize: 10.5, color: '#5B6478' }}>{canEdit ? (self ? 'Your employee record · editing as admin' : 'Employee record · editing as admin') : 'Your employee record · managed by HR — ask an admin if anything is wrong'}</span>
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {canEdit && dirty && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A6534' }}>Unsaved changes</span>}
            {canEdit && <button type="button" disabled={!dirty} onClick={() => setForm(draftOf(user))} style={{ ...BTN, padding: '6px 12px', cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : 0.5 }}>Discard</button>}
            {canEdit && <button type="button" disabled={!dirty} onClick={save} style={{ ...BTN_DARK, padding: '6px 14px', cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : 0.5 }}>Save record</button>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 14px', background: '#F6F8FA', borderTop: '1px solid #EEF1F5' }}>
          <strong style={{ fontSize: 11.5, color: doneCount === applicable.length ? '#2F6F4E' : '#16223A' }}>Record {doneCount}/{applicable.length} sections complete</strong>
          <span style={{ flex: '0 0 140px', height: 6, borderRadius: 3, background: '#E3E8EF', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: (applicable.length ? (doneCount / applicable.length) * 100 : 0) + '%', background: doneCount === applicable.length ? '#2F6F4E' : '#C9A86A' }} />
          </span>
          <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {status.map(([d, a], i) => a && !d ? (
              <button key={i} type="button" onClick={() => { setClosed((s) => { const x = new Set(s); x.delete(i + 1); return x; }); document.getElementById('hr-sec-' + (i + 1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} style={{ border: '1px solid #EAD9BF', borderRadius: 10, padding: '1px 8px', fontSize: 10, fontWeight: 700, background: '#FBF2E9', color: '#8A6534', cursor: 'pointer', fontFamily: 'inherit' }}>{i + 1}. {SECTION_TITLES[i]}</button>
            ) : null)}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setClosed(new Set())} style={BTN}>Expand all</button>
            <button type="button" onClick={() => setClosed(new Set(SECTION_TITLES.map((_, i) => i + 1)))} style={BTN}>Collapse all</button>
          </span>
        </div>
      </div>

      {/* ---- 1 Personal ---- */}
      <div id="hr-sec-1"><Section {...sec(1)}
        right={canEdit ? (
          <>
            <input ref={photoInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) uploadPhoto(x); }} />
            <button type="button" disabled={busy === 'photo'} onClick={() => photoInput.current?.click()} style={{ ...BTN, background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }}>{busy === 'photo' ? 'Uploading…' : profile?.photo ? 'Change photo' : 'Upload photo'}</button>
          </>
        ) : undefined}
        foot={'NRIC is ' + sensitiveFoot.charAt(0).toLowerCase() + sensitiveFoot.slice(1) + ' Marital status and children are used for PCB tax reliefs.'}>
        <div style={G3}>
          {text('fullName', 'Full name (as per IC)', { ph: 'e.g. Muhammad Hafizuddin bin Ahmad', req: true })}
          {text('displayName', 'Display name', { ph: 'e.g. Hafizuddin', req: true })}
          {text('nric', 'NRIC / passport no.', { ph: 'e.g. 900101-10-1234' })}
          {text('birthday', 'Date of birth', { type: 'date' })}
          {pick('gender', 'Gender', same(GENDERS), { blank: '—' })}
          {text('nationality', 'Nationality', { ph: 'e.g. Malaysian' })}
          {text('race', 'Race', { ph: 'e.g. Malay' })}
          {text('religion', 'Religion', { ph: 'e.g. Islam' })}
          {pick('maritalStatus', 'Marital status', same(MARITAL), { blank: '—' })}
          {text('children', 'Number of children', { type: 'number', ph: '0' })}
        </div>
      </Section></div>

      {/* ---- 2 Contact ---- */}
      <div id="hr-sec-2"><Section {...sec(2)}>
        <div style={G3}>
          {text('phone', 'Mobile', { ph: 'e.g. 012-345 6789' })}
          {text('personalEmail', 'Personal email', { type: 'email', ph: 'name@gmail.com' })}
          {ro('Work email', user.email || '—', 'Sign-in email · changed in Users & Permissions')}
        </div>
        <label style={labelWrap}>
          <span style={LBL}>Home address</span>
          {canEdit ? (
            <textarea value={f.homeAddress} onChange={(e) => setF({ homeAddress: e.target.value })} rows={2} placeholder="Street, postcode, city, state" style={{ ...INP, resize: 'vertical', lineHeight: 1.5 }} />
          ) : (
            <span style={{ ...RO, whiteSpace: 'pre-wrap' }}>{f.homeAddress || '—'}</span>
          )}
        </label>
      </Section></div>

      {/* ---- 3 Emergency ---- */}
      <div id="hr-sec-3"><Section {...sec(3)} foot={legacyEmergency ? 'Filled in from the older one-line entry “' + legacyEmergency + '”. Check the parts and save to keep them as separate fields.' : undefined}>
        <div style={G3}>
          {text('emName', 'Name', { ph: 'e.g. Aminah binti Yusof' })}
          {text('emRelationship', 'Relationship', { ph: 'e.g. Mother' })}
          {text('emPhone', 'Phone', { ph: 'e.g. 013-456 7890' })}
        </div>
      </Section></div>

      {/* ---- 4 Employment ---- */}
      <div id="hr-sec-4"><Section {...sec(4)} foot="Setting the status to Resigned or Terminated keeps the person and all their records. Their sign-in access is controlled separately in Users & Permissions.">
        <div style={G3}>
          {ro('Staff ID', staffId ? staffId : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#B23A2E' }}>No staff ID yet</span>
              {admin ? <button type="button" onClick={assignId} style={{ ...BTN, padding: '1px 8px', borderColor: '#16223A' }}>Assign staff ID</button> : <span style={{ fontSize: 10.5, color: '#5B6478' }}>ask an admin</span>}
            </span>
          ), 'Assigned automatically')}
          {text('code', 'User code', { ph: 'e.g. MH', after: canEdit ? <span style={NOTE}>2–4 letters, unique in the firm</span> : undefined })}
          {ro('Role', String(user.role || '—') + (user.isSuperAdmin ? ' · Super Admin' : user.isAdmin ? ' · Admin' : ''), 'Set in Users & Permissions')}
          {text('designation', 'Designation', { ph: 'e.g. Associate' })}
          {text('department', 'Department', { ph: 'e.g. Litigation' })}
          {pick('employmentType', 'Employment type', same(EMPLOYMENT_TYPES))}
          {text('officeLocation', 'Office location', { ph: 'e.g. Kuala Lumpur Office' })}
          {text('joinDate', 'Join date', { type: 'date' })}
          {text('probationEndDate', 'Probation end date', { type: 'date' })}
          {text('confirmationDate', 'Confirmation date', { type: 'date' })}
          {pick('reportingTo', 'Reporting to', colleagues.map((u) => [u.id, u.name + (u.staffProfile?.designation ? ' · ' + u.staffProfile.designation : '')] as [string, string]), { blank: '—' })}
          {pick('status', 'Status', same(STATUSES))}
          {f.status !== 'Active' && text('lastWorkingDay', 'Last working day', { type: 'date' })}
        </div>
      </Section></div>

      {/* ---- 5 Pay & statutory ---- */}
      <div id="hr-sec-5"><Section {...sec(5)} foot={sensitiveFoot + ' Basic salary, allowances and zakat are used as the starting figures for new payslips in Finance → Payroll. The bank account is printed (masked) on payslips; claims are paid back to it.'}>
        <div style={G3}>
          {text('basicSalary', 'Basic salary (RM / month)', { type: 'number', ph: 'e.g. 4500' })}
          {text('zakatMonthly', 'Zakat (RM / month)', { type: 'number', ph: 'optional' })}
          <span />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={LBL}>Fixed allowances (RM / month){f.allowances.length > 0 && ' · total RM ' + allowTotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          {rows('allowances', [{ k: 'name', label: 'Allowance', w: 'minmax(0,2fr)' }, { k: 'amount', label: 'Amount (RM)', type: 'number' }], { name: '', amount: '' }, 'No fixed allowances.')}
        </div>
        <div style={{ ...G3, borderTop: '1px solid #EEF1F5', paddingTop: 10 }}>
          {text('epfNo', 'EPF no.')}
          {text('socsoNo', 'SOCSO no.')}
          {text('taxNo', 'Income tax no. (LHDN)', { ph: 'e.g. IG 12345678090' })}
          {pick('taxResidency', 'Tax residency', same(RESIDENCY), { blank: '—' })}
          {pick('pcbCategory', 'PCB category', PCB_CATEGORIES, { blank: '—' })}
          <span />
        </div>
        <div style={{ ...G3, borderTop: '1px solid #EEF1F5', paddingTop: 10 }}>
          {text('bankName', 'Bank', { ph: 'e.g. Maybank' })}
          {text('bankAccountNo', 'Account no.')}
          {text('bankAccountHolder', 'Account holder name', { ph: 'as on the bank account' })}
        </div>
      </Section></div>

      {/* ---- 6 Professional ---- */}
      <div id="hr-sec-6"><Section {...sec(6)} foot={lawyer ? undefined : 'Only needed for lawyers — fill it in and it will count towards the record.'}>
        <div style={G3}>
          {text('callToBarDate', 'Admission / call to the Bar', { type: 'date' })}
          {text('rollNo', 'Advocate & Solicitor roll no.')}
          {text('cpdThisYear', 'CPD points (' + new Date().getFullYear() + ')', { type: 'number' })}
          {text('practisingCertNo', 'Practising certificate no.')}
          {text('practisingCertExpiry', 'Practising certificate expiry', { type: 'date', after: <Badge iso={f.practisingCertExpiry} /> })}
          <span />
          {text('syarieCertNo', 'Syarie Counsel certificate no.')}
          {text('syarieCertExpiry', 'Syarie certificate expiry', { type: 'date', after: <Badge iso={f.syarieCertExpiry} /> })}
        </div>
      </Section></div>

      {/* ---- 7 Education ---- */}
      <div id="hr-sec-7"><Section {...sec(7)}>
        {rows('education', [{ k: 'qualification', label: 'Qualification', w: 'minmax(0,2fr)' }, { k: 'institution', label: 'Institution', w: 'minmax(0,2fr)' }, { k: 'year', label: 'Year', w: '90px' }], { qualification: '', institution: '', year: '' }, 'No qualifications recorded.')}
      </Section></div>

      {/* ---- 8 Employment history ---- */}
      <div id="hr-sec-8"><Section {...sec(8)}>
        {rows('workHistory', [{ k: 'employer', label: 'Employer', w: 'minmax(0,2fr)' }, { k: 'position', label: 'Position', w: 'minmax(0,2fr)' }, { k: 'from', label: 'From', type: 'month' }, { k: 'to', label: 'To', type: 'month' }], { employer: '', position: '', from: '', to: '' }, 'No previous employment recorded.')}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: '#16223A', cursor: canEdit ? 'pointer' : 'default' }}>
          <input type="checkbox" disabled={!canEdit} checked={f.noPriorEmployment} onChange={(e) => setF({ noPriorEmployment: e.target.checked })} />
          No previous employment (e.g. fresh graduate or pupil in chambers)
        </label>
      </Section></div>

      {/* ---- 9 Documents ---- */}
      <div id="hr-sec-9"><Section {...sec(9)} foot={'Images or PDF, up to 10 MB each, kept in the firm’s secure storage. ' + sensitiveFoot + (canEdit ? ' Removing a document takes it off this record; the stored file is kept.' : '')}>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ ...INP, width: 220, cursor: 'pointer' }} aria-label="Document type">
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input ref={docInput} type="file" accept="image/*,application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) uploadDoc(x); }} />
            <button type="button" disabled={busy === 'doc'} onClick={() => docInput.current?.click()} style={BTN_DARK}>{busy === 'doc' ? 'Uploading…' : '+ Upload document'}</button>
          </div>
        )}
        {!docs.length && <span style={NOTE}>No documents on file yet.</span>}
        {docs.length > 0 && (
          <div style={{ border: '1px solid #EEF1F5', borderRadius: 8, overflow: 'hidden' }}>
            {docs.map((d) => (
              <div key={d.path} style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr) 170px auto', gap: 10, alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid #F0F2F5', fontSize: 11.5, color: '#16223A' }}>
                <span style={{ fontWeight: 700 }}>{d.type}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>{d.name}</span>
                <span style={{ fontSize: 10.5, color: '#5B6478' }}>{stampDay(d.uploadedAt)}{d.uploadedBy ? ' · ' + d.uploadedBy : ''}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => openDoc(d)} style={BTN}>Open</button>
                  {canEdit && <button type="button" onClick={() => removeDoc(d)} style={{ ...BTN, color: '#B23A2E' }}>Remove</button>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section></div>

      {/* ---- 10 Milestones & bio ---- */}
      <div id="hr-sec-10"><Section {...sec(10)}>
        <label style={labelWrap}>
          <span style={LBL}>Professional bio</span>
          <textarea readOnly={!canEdit} value={f.bio} onChange={(e) => setF({ bio: e.target.value })} rows={4} placeholder="Practice focus and relevant experience, for the internal directory" style={{ ...INP, resize: 'vertical', lineHeight: 1.5, background: canEdit ? '#fff' : '#F6F8FA' }} />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, color: '#16223A', cursor: canEdit ? 'pointer' : 'default' }}>
          <input type="checkbox" disabled={!canEdit} checked={f.celebrationOptOut} onChange={(e) => setF({ celebrationOptOut: e.target.checked })} style={{ marginTop: 2 }} />
          <span>
            <strong>Hide birthday and milestone announcements</strong>
            <span style={{ display: 'block', fontSize: 10.5, color: '#5B6478' }}>The dates stay on file (date of birth in section 1, call to the Bar in section 6), but celebrations won’t appear on the Firm Start Centre. The birth year is never shown.</span>
          </span>
        </label>
      </Section></div>

      {/* ---- 11 Record ---- */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px' }}>
        <strong style={cardTitle}>11. Record</strong>
        <span style={{ fontSize: 11, color: '#5B6478' }}>
          {profile?.hrUpdatedAt ? 'Last updated by ' + (profile.hrUpdatedBy || 'HR') + ' on ' + stampDay(profile.hrUpdatedAt) : 'Not yet updated through this form'}
        </span>
        <button type="button" onClick={print} style={{ ...BTN, marginLeft: 'auto', border: 0, background: '#C9A86A', color: '#16223A', padding: '6px 12px' }}>Print / Save as PDF</button>
      </div>
    </>
  );
};
