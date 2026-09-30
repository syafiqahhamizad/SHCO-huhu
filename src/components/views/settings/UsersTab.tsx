import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { Role, StaffProfile, User } from '../../../types';
import { partnerCode } from '../../../lib/identity';
import { provisionFirebaseUser } from '../../../services/firebaseAuthService';
import { DEFAULT_BRANCHES } from '../../../services/templateService';
import { css, S, Txt, type SettingsCtx } from './settingsShared';
import { designRole, isManagingPartner, isSuper, personChanges, SUPER_EMAIL } from './permissionModel';

const PC = ['#16223A', '#3D6B9C', '#6B3D8C', '#2E7D7A', '#8A6534', '#5E6F2F', '#8C2F4C'];
const GRID = 'display:grid;grid-template-columns:minmax(0,1.5fr) 150px 110px 100px 120px 84px 100px 176px;gap:10px;';
const SEL = 'border:1px solid #DDE3EB;border-radius:6px;padding:5px 6px;font-size:11px;color:#16223A;background:#fff';

const initials = (name: string) => name.split(' ').filter((w) => w && !/^(binti|bin|a\/l)$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const suggestCode = (name: string) =>
  name.replace(/\b(encik|puan|cik|tuan|dato'?|datin|dr|mr|mrs|ms)\b\.?/gi, '').split(/[\s@.]+/).filter((w) => /^[a-z]/i.test(w) && !/^(bin|binti|bt|bte|a\/l|a\/p)$/i.test(w)).map((w) => w[0]).join('').toUpperCase().slice(0, 3);

/** 'YYYY-MM-DD HH:MM' → 'Today 9:12' / 'Yesterday' / '3 days ago' / '12 Aug 2026'. */
export const lastLoginLabel = (ts?: string) => {
  if (!ts) return '—';
  const d = new Date(ts.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return ts;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86400000);
  if (diff <= 0) return 'Today ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return diff + ' days ago';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const roleFromDesign = (v: string): { role: Role; mp: boolean } =>
  v === 'Managing Partner' ? { role: 'Partner', mp: true } : v === 'Reviewer (auditor)' ? { role: 'Reviewer', mp: false } : { role: v as Role, mp: false };

export const UsersTab = ({ C }: { C: SettingsCtx }) => {
  const app = useApp();
  const { users = [], currentUser, customRoles = [], rolesMatrix = {}, updateUserRoleAndAdmin, repairUserAccess, updateUserIdentity, updateUserAccount, deleteUser } = app;
  const [adding, setAdding] = useState(false);
  const [repairing, setRepairing] = useState<string | null>(null);
  const ROLES = ['Managing Partner', 'Partner', 'Lawyer', 'Assistant', 'Accountant', 'Reviewer (auditor)', 'Client', ...customRoles];
  const branches = (C.settings.branches && C.settings.branches.length ? C.settings.branches : DEFAULT_BRANCHES).map((b) => b.name);
  const hqName = ((C.settings.branches || DEFAULT_BRANCHES).find((b) => b.hq) || { name: branches[0] }).name;
  const canAdmin = Boolean(currentUser?.isAdmin || isSuper(currentUser));
  const active = users.filter((u) => u.status !== 'Inactive').length;

  const onRole = (u: User, v: string) => {
    const cur = designRole(u);
    if (v === cur) return;
    if (u.email === SUPER_EMAIL && v !== 'Managing Partner') return C.msg('The Managing Partner is always Super admin');
    const { role, mp } = roleFromDesign(v);
    const noAdmin = role === 'Client' || role === 'Reviewer';
    const isAdmin = mp ? true : noAdmin || (role === 'Partner' && !mp) ? false : u.isAdmin;
    const isSuperAdmin = noAdmin || (role === 'Partner' && !mp) ? false : u.isSuperAdmin;
    if (updateUserRoleAndAdmin(u.id, role, isAdmin, isSuperAdmin)) {
      C.log('User Role Changed', u.name + ': ' + cur + ' → ' + v);
      C.msg(u.name + ' is now ' + v);
    }
  };

  const toggleAdmin = (u: User) => {
    if (u.email === SUPER_EMAIL) return C.msg('The Managing Partner is always Super admin');
    if (u.role === 'Client' || u.role === 'Reviewer') return C.msg(designRole(u) + ' cannot be an admin');
    const sup = isSuper(u);
    const next = sup ? { a: false, s: false, label: 'no longer an admin' } : u.isAdmin ? { a: true, s: true, label: 'now a Super admin' } : { a: true, s: false, label: 'now an admin' };
    if (updateUserRoleAndAdmin(u.id, u.role, next.a, next.s)) {
      C.log('User Admin Changed', u.name + ' is ' + next.label);
      C.msg(u.name + ' is ' + next.label);
    }
  };

  const toggleActive = (u: User) => {
    const on = u.status !== 'Inactive';
    if (updateUserAccount(u.id, { status: on ? 'Inactive' : 'Active' })) {
      C.log(on ? 'User Switched Off' : 'User Reactivated', u.name + ' (' + u.email + ')');
      C.msg(on ? u.name + ' switched off: login blocked' : u.name + ' reactivated');
    }
  };

  return (
    <div style={css(S.card)}>
      <div style={css('display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>People &amp; roles</strong><span style={css(S.sub)}>{active + ' active people'} · role decides what each person can open; their files decide what data they see</span><button type="button" onClick={() => (canAdmin ? setAdding(true) : C.msg('Only an admin can add people'))} style={css('margin-left:auto;border:0;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>+ Add person</button></div>
      <div style={css(GRID + 'padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Name · email</span><span>Role</span><span>Branch</span><span>Admin</span><span>Access</span><span>2-step login</span><span>Last login</span><span></span></div>
      {users.length === 0 && <div style={css('padding:14px;font-size:11px;color:#5B6478')}>No users in the roster yet. Add the first person with “+ Add person”.</div>}
      {users.map((u, i) => {
        const on = u.status !== 'Inactive';
        const sup = isSuper(u);
        const adm = sup || u.isAdmin;
        const nX = personChanges(rolesMatrix, u);
        const fa = !!u.twoStepLogin;
        const code = u.role === 'Client' ? '' : partnerCode(u) || '';
        const staffId = u.staffProfile?.staffId || (u.role === 'Client' ? 'Client account' : 'Staff ID pending');
        const rv = designRole(u);
        return (
          <div key={u.id} style={css(GRID + `align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5;opacity:${on ? 1 : 0.5}`)}>
            <span style={css('display:flex;align-items:center;gap:8px;min-width:0')}>
              <span style={css(`width:26px;height:26px;flex-shrink:0;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:700;color:#fff;background:${PC[i % PC.length]}`)}>{initials(u.name)}</span>
              <span style={css('min-width:0;flex:1')}>
                <Txt value={u.name} readOnly={!canAdmin} onCommit={(v) => { if (!v.trim()) return; if (updateUserIdentity(u.id, { name: v })) { C.log('User Renamed', u.name + ' → ' + v.trim()); C.msg('Saved ' + v.trim()); } }} style="width:100%;border:0;padding:0;font-size:11.5px;font-weight:700;color:#16223A;background:transparent" />
                <input value={u.email} readOnly title="Sign-in email — create a new account to change it" style={css('width:100%;border:0;padding:0;font-size:10px;color:#5B6478;background:transparent')} />
                <span style={css('display:flex;align-items:center;gap:6px;font-size:9.5px;color:#94A3B8')}>
                  {u.role !== 'Client' && <Txt value={code} readOnly={!canAdmin} maxLength={4} title="User code (2–4 letters, unique)" placeholder="CODE" map={(v) => v.replace(/[^a-z]/gi, '').toUpperCase()} onCommit={(v) => { if (updateUserIdentity(u.id, { code: v })) { C.log('User Code Changed', u.name + ': ' + (code || '—') + ' → ' + v); C.msg(u.name + ' code is now ' + v); } }} style="width:40px;border:1px solid #DDE3EB;border-radius:4px;padding:0 3px;font-family:ui-monospace, Menlo, monospace;font-size:9.5px;font-weight:700;color:#16223A;background:#fff" />}
                  <span style={css('font-family:ui-monospace, Menlo, monospace')}>{staffId}</span>
                </span>
              </span>
            </span>
            <select value={rv} onChange={(e) => onRole(u, e.target.value)} style={css(SEL)}>{(ROLES.includes(rv) ? ROLES : [...ROLES, rv]).map((r) => <option key={r} value={r}>{r}</option>)}</select>
            <select value={u.branch || hqName} onChange={(e) => { if (updateUserAccount(u.id, { branch: e.target.value })) { C.log('User Branch Changed', u.name + ' → ' + e.target.value); C.msg(u.name + ' · ' + e.target.value); } }} style={css(SEL)}>{(branches.includes(u.branch || hqName) ? branches : [...branches, u.branch as string]).map((b) => <option key={b} value={b}>{b}</option>)}</select>
            <button type="button" onClick={() => toggleAdmin(u)} title={u.email === SUPER_EMAIL ? 'Managing Partner: always Super admin' : 'Click to switch admin on/off (— → Admin → Super admin → —)'} style={css(`justify-self:start;border:0;border-radius:10px;padding:2px 9px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;background:${adm ? '#16223A' : '#F0F2F5'};color:${adm ? '#fff' : '#94A3B8'}`)}>{sup ? 'Super admin' : adm ? 'Admin' : '—'}</button>
            <button type="button" onClick={() => C.go('perms', { who: u.id })} style={css('justify-self:start;display:flex;flex-direction:column;align-items:flex-start;border:1px solid #DDE3EB;border-radius:6px;padding:3px 8px;background:#fff;cursor:pointer;font-family:inherit')}><span style={css('font-size:10.5px;font-weight:700;color:#2F5680')}>Check access</span><span style={css(`font-size:9.5px;color:${nX ? '#8A6534' : '#94A3B8'}`)}>{isManagingPartner(u) ? 'everything' : nX ? nX + ' change' + (nX > 1 ? 's' : '') + ' from role' : 'same as role'}</span></button>
            <button type="button" onClick={() => { if (updateUserAccount(u.id, { twoStepLogin: !fa })) { C.log('2-step Login Changed', u.name + ': ' + (fa ? 'Off' : 'On')); C.msg(u.name + ' · 2-step login ' + (fa ? 'off' : 'on')); } }} title="Recorded here; the sign-in itself is enforced by the Google Workspace / Firebase account" style={css(`justify-self:start;border:0;border-radius:10px;padding:2px 9px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;background:${fa ? '#E6EFE9' : '#FBEDE9'};color:${fa ? '#2F6F4E' : '#B23A2E'}`)}>{fa ? 'On' : 'Off'}</button>
            <span style={css('font-size:10.5px;color:#5B6478')}>{lastLoginLabel(u.lastLoginAt)}</span>
            <span style={css('justify-self:end;display:flex;gap:4px')}>
              <button type="button" disabled={repairing === u.id} title="Re-apply this user's role/admin access to their real Firebase account — use this if their real permissions ever fall out of sync with what's shown here." onClick={async () => { setRepairing(u.id); const ok = await repairUserAccess(u.id); setRepairing(null); if (ok) { C.log('User Access Repaired', u.name + ' (' + u.email + ')'); C.msg(u.name + ' · access repaired'); } }} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;background:#fff;color:#2F5680;cursor:pointer;font-family:inherit;white-space:nowrap')}>{repairing === u.id ? 'Repairing…' : 'Repair Access'}</button>
              {!on && u.email !== SUPER_EMAIL && <button type="button" onClick={() => { if (window.confirm(`Remove user ${u.name} from this system?`) && deleteUser(u.id)) C.msg(u.name + ' removed'); }} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;background:#fff;color:#B23A2E;cursor:pointer;font-family:inherit')}>Remove</button>}
              <button type="button" onClick={() => toggleActive(u)} style={css(`border:1px solid #DDE3EB;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;background:#fff;color:${on ? '#B23A2E' : '#2F6F4E'};cursor:pointer;font-family:inherit;white-space:nowrap`)}>{on ? 'Switch off' : 'Reactivate'}</button>
            </span>
          </div>
        );
      })}
      <div style={css('display:flex;flex-direction:column;gap:3px;padding:9px 14px;background:#F6F8FA;font-size:10.5px;line-height:1.5;color:#5B6478')}><span>Switching someone off blocks their login immediately; their history stays. New staff added here appear automatically in Staff Portal, Payroll and the referrer list.</span><span><strong style={css('color:#16223A')}>Reviewer (auditor)</strong>: outside auditor login, read-only. Sees Cases and the Client Account (SAR 1990) only; cannot add, edit or approve.</span><span><strong style={css('color:#16223A')}>Client</strong>: invited from the client’s profile (Clients → Client Portal). Sees only their own files, documents and bills in the Client Portal.</span><span><strong style={css('color:#16223A')}>Admin</strong>: can manage Users &amp; Roles, Settings and Activity Logs on top of their role. The Managing Partner is Super admin and cannot be switched off.</span><span><strong style={css('color:#16223A')}>Check access</strong>: opens that person’s own access. Access is set by role first, then changed per person where needed.</span></div>
      {adding && <AddPersonModal C={C} roles={ROLES} branches={branches} hq={hqName} onClose={() => setAdding(false)} />}
    </div>
  );
};

const LBL = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478';
const INP = 'width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A;background:#fff;font-family:inherit';
const HINT = 'font-size:10px;color:#94A3B8';

/** "+ Add person": same rules as the old Users & Permissions → Add New User form. */
const AddPersonModal = ({ C, roles, branches, hq, onClose }: { C: SettingsCtx; roles: string[]; branches: string[]; hq: string; onClose: () => void }) => {
  const { users = [], addUser, showToast } = useApp();
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [roleV, setRoleV] = useState('Lawyer');
  const [branch, setBranch] = useState(hq);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { role, mp } = roleFromDesign(roleV);
  const isClient = role === 'Client';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fail = (m: string) => { setErr(m); showToast(m); };
    const em = email.trim().toLowerCase();
    const c = code.trim().toUpperCase();
    if (!name.trim() || !em) return fail('Name and Email are required');
    if (!isClient) {
      if (!fullName.trim()) return fail('Full name (as per IC) is required for staff.');
      if (!/^[A-Z]{2,4}$/.test(c)) return fail('User code must be 2–4 letters, e.g. SH or NFA.');
      if (users.some((u) => (partnerCode(u) || '') === c)) return fail(`Code ${c} is already used by someone else.`);
    }
    if ((role === 'Partner' || role === 'Lawyer') && !em.endsWith('@shcolaw.com')) return fail('Partner and Lawyer accounts must use a verified @shcolaw.com Google Workspace email.');
    if (users.some((u) => u.email.toLowerCase() === em)) return fail(`${em} is already in the roster.`);
    const admin = mp || (isAdmin && !isClient && role !== 'Reviewer');
    const sup = isSuperAdmin && !isClient && role !== 'Reviewer';
    if ((admin || sup) && !C.isSuperAdmin) return fail('Admin privileges can only be assigned by the Super Admin.');
    setErr('');
    setBusy(true);
    try {
      const provisioned = await provisionFirebaseUser({ name: name.trim(), email: em, role, isAdmin: admin, isSuperAdmin: sup });
      const newUser: User = {
        id: provisioned.id,
        name: name.trim(),
        email: em,
        role,
        isAdmin: admin,
        isSuperAdmin: sup,
        status: 'Active',
        branch,
        ...(!isClient ? { code: c, staffProfile: { fullName: fullName.trim() } as StaffProfile } : {}),
      };
      if (addUser(newUser)) {
        C.log('User Added', `${newUser.name} (${newUser.email}) · ${roleV}${c ? ' · ' + c : ''}`);
        onClose();
        window.alert(`Firebase account created.\n\nEmail: ${provisioned.email}\nTemporary password: ${provisioned.temporaryPassword}\n\nGive this password securely to the new user and ask them to change it after signing in.`);
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Unable to create the Firebase user account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.6);overflow:auto;display:flex;justify-content:center;padding:40px 16px')}>
      <form onSubmit={submit} style={css('width:480px;max-width:100%;align-self:flex-start;border-radius:12px;background:#fff;overflow:hidden')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:12px 18px;background:#16223A')}><strong style={css('font-size:14px;color:#fff')}>Add person</strong><button type="button" onClick={onClose} style={css('margin-left:auto;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit')}>Close</button></div>
        <div style={css('padding:16px 18px;display:flex;flex-direction:column;gap:12px;font-size:12px;color:#16223A')}>
          <div style={css('padding:8px 12px;border-radius:8px;background:#E7EEF6;font-size:11px;line-height:1.5;color:#2F5680')}>Adding staff also creates their Firebase login and a staff record with the next unique Staff ID (SHCO-ST-000N). Employment and payslip details are completed later in Staff Portal → My profile.</div>
          <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Display name *</span><input value={name} onChange={(e) => { setName(e.target.value); if (!codeTouched) setCode(suggestCode(e.target.value)); }} placeholder="e.g. Hafizuddin" style={css(INP)} /><span style={css(HINT)}>How their name appears around the system.</span></label>
          {!isClient && (
            <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:10px')}>
              <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Full name (as per IC) *</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Muhammad Hafizuddin bin Ahmad" style={css(INP)} /><span style={css(HINT)}>Printed on payslips and EA forms.</span></label>
              <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>User code *</span><input value={code} maxLength={4} onChange={(e) => { setCodeTouched(true); setCode(e.target.value.replace(/[^a-z]/gi, '').toUpperCase()); }} placeholder="e.g. MH" style={css(INP + ';font-family:ui-monospace, Menlo, monospace;font-weight:700')} /><span style={css(HINT)}>2–4 letters, unique.</span></label>
            </div>
          )}
          <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Email *</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@shcolaw.com" style={css(INP)} /></label>
          <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px')}>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Role *</span><select value={roleV} onChange={(e) => setRoleV(e.target.value)} style={css(INP)}>{roles.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Branch</span><select value={branch} onChange={(e) => setBranch(e.target.value)} style={css(INP)}>{branches.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
          </div>
          <span style={css(HINT)}>Partner and Lawyer accounts need an @shcolaw.com email. Reviewer, Assistant and Accountant accounts may use an outside email.</span>
          {!isClient && role !== 'Reviewer' && !mp && (
            <div style={css('display:flex;gap:16px')}>
              <label style={css('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600')}><input type="checkbox" checked={isAdmin} disabled={!C.isSuperAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />Admin</label>
              <label style={css('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600')}><input type="checkbox" checked={isSuperAdmin} disabled={!C.isSuperAdmin} onChange={(e) => setIsSuperAdmin(e.target.checked)} />Super admin</label>
              {!C.isSuperAdmin && <span style={css('font-size:10px;color:#B23A2E')}>Only the Super Admin can grant admin.</span>}
            </div>
          )}
          {err && <div style={css('padding:8px 12px;border-radius:8px;background:#FBEDE9;font-size:11px;color:#B23A2E')}>{err}</div>}
          <div style={css('display:flex;justify-content:flex-end;gap:8px;padding-top:4px')}>
            <button type="button" onClick={onClose} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Cancel</button>
            <button type="submit" disabled={busy} style={css('border:0;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>{busy ? 'Creating…' : 'Create user'}</button>
          </div>
        </div>
      </form>
    </div>
  );
};
