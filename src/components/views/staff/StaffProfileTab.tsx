import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { StaffProfile, User } from '../../../types';
import { card, cardTitle, labelWrap, serif } from './staffPortalShared';

const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478' };
const INP: React.CSSProperties = { border: '1px solid #DDE3EB', borderRadius: 6, padding: '6px 8px', fontSize: 11.5, color: '#16223A', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
const SUB: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#5B6478' };
const EMPLOYMENT: StaffProfile['employmentType'][] = ['Permanent', 'Contract', 'Freelance', 'Intern'];

/** The fields a staff member can edit on their own profile. */
type Editable = Pick<
  StaffProfile,
  'designation' | 'department' | 'phone' | 'emergencyContact' | 'joinDate' | 'officeLocation' | 'employmentType' | 'bio'
> & {
  birthday: string;
  callToBarDate: string;
  celebrationOptOut: boolean;
  nric: string;
  epfNo: string;
  socsoNo: string;
  bankName: string;
  bankAccountNo: string;
};

const editableOf = (u: User): Editable => {
  const p = u.staffProfile;
  return {
    designation: p?.designation || String(u.role || ''),
    department: p?.department || '',
    phone: p?.phone || '',
    emergencyContact: p?.emergencyContact || '',
    joinDate: p?.joinDate || '',
    officeLocation: p?.officeLocation || '',
    employmentType: p?.employmentType || 'Permanent',
    bio: p?.bio || '',
    birthday: p?.birthday || '',
    callToBarDate: p?.callToBarDate || '',
    celebrationOptOut: Boolean(p?.celebrationOptOut),
    nric: p?.nric || '',
    epfNo: p?.epfNo || '',
    socsoNo: p?.socsoNo || '',
    bankName: p?.bankName || '',
    bankAccountNo: p?.bankAccountNo || '',
  };
};

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

export const StaffProfileTab: React.FC = () => {
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
          <strong style={cardTitle}>Staff profiles</strong>
          <span style={{ fontSize: 10.5, color: '#5B6478' }}>as an admin you can open and edit anyone’s profile</span>
          <select value={id} onChange={(e) => setSelId(e.target.value)} style={{ ...INP, width: 280, marginLeft: 'auto', cursor: 'pointer' }}>
            {!staff.some((u) => u.id === currentUser.id) && <option value={currentUser.id}>{currentUser.name} (you)</option>}
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name + (u.id === currentUser.id ? ' (you)' : '') + ' · ' + (u.staffProfile?.staffId || 'no staff ID') + (u.status === 'Inactive' ? ' · inactive' : '')}
              </option>
            ))}
          </select>
        </div>
      )}
      {!target || target.role === 'Client' ? (
        <div style={{ ...card, padding: '12px 14px', fontSize: 11.5, color: '#5B6478' }}>No staff profile to show.</div>
      ) : (
        <ProfileForm key={target.id} user={target} admin={admin} self={target.id === currentUser.id} />
      )}
    </div>
  );
};

const ProfileForm: React.FC<{ user: User; admin: boolean; self: boolean }> = ({ user, admin, self }) => {
  const { users, updateUserStaffProfile, showToast } = useApp();
  const [f, setForm] = useState<Editable>(() => editableOf(user));
  const setF = (p: Partial<Editable>) => setForm((s) => ({ ...s, ...p }));
  const saved = editableOf(user);
  const dirty = (Object.keys(f) as (keyof Editable)[]).some((k) => f[k] !== saved[k]);
  const staffId = user.staffProfile?.staffId || '';

  const save = () => {
    const t = (v: string) => v.trim();
    const n: Editable = {
      ...f,
      designation: t(f.designation), department: t(f.department), phone: t(f.phone), emergencyContact: t(f.emergencyContact),
      officeLocation: t(f.officeLocation), bio: t(f.bio), nric: t(f.nric), epfNo: t(f.epfNo), socsoNo: t(f.socsoNo),
      bankName: t(f.bankName), bankAccountNo: t(f.bankAccountNo),
    };
    const opt = (v: string) => v || undefined;
    // Merge onto the latest stored profile so goals, check-ins and targets are kept.
    updateUserStaffProfile(user.id, {
      ...baseProfile(user),
      designation: n.designation,
      department: n.department,
      phone: n.phone,
      emergencyContact: n.emergencyContact,
      joinDate: n.joinDate,
      officeLocation: n.officeLocation,
      employmentType: n.employmentType,
      bio: n.bio,
      birthday: opt(n.birthday),
      callToBarDate: opt(n.callToBarDate),
      celebrationOptOut: n.celebrationOptOut || undefined,
      nric: opt(n.nric),
      epfNo: opt(n.epfNo),
      socsoNo: opt(n.socsoNo),
      bankName: opt(n.bankName),
      bankAccountNo: opt(n.bankAccountNo),
    });
    setForm(n);
  };

  const assignId = () => {
    const next = nextStaffId(users);
    updateUserStaffProfile(user.id, { ...baseProfile(user), staffId: next });
    showToast(user.name + ' is now ' + next);
  };

  const text = (k: keyof Editable, label: string, ph = '', type = 'text') => (
    <label style={labelWrap}>
      <span style={LBL}>{label}</span>
      <input type={type} value={String(f[k] ?? '')} placeholder={ph} onChange={(e) => setF({ [k]: e.target.value } as Partial<Editable>)} style={{ ...INP, cursor: type === 'date' ? 'pointer' : 'text' }} />
    </label>
  );

  const ro = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={LBL}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#16223A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );

  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderBottom: '1px solid #EEF1F5' }}>
          <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 9999, background: '#16223A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 17, fontWeight: 700 }}>{user.name.slice(0, 1)}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong style={{ fontFamily: serif, fontSize: 17, color: '#16223A' }}>{user.name}</strong>
            <span style={{ fontSize: 10.5, color: '#5B6478' }}>{self ? 'Your profile' : 'Editing as admin'} · name, staff ID, role and email are managed in Users &amp; Permissions</span>
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {dirty && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A6534' }}>Unsaved changes</span>}
            <button type="button" disabled={!dirty} onClick={() => setForm(editableOf(user))} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, background: '#fff', color: '#16223A', cursor: dirty ? 'pointer' : 'default', fontFamily: 'inherit', opacity: dirty ? 1 : 0.5 }}>Discard</button>
            <button type="button" disabled={!dirty} onClick={save} style={{ border: 0, borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700, background: '#16223A', color: '#fff', cursor: dirty ? 'pointer' : 'default', fontFamily: 'inherit', opacity: dirty ? 1 : 0.5 }}>Save profile</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14, padding: '12px 14px' }}>
          {ro('Name', user.name)}
          {ro(
            'Staff ID',
            staffId ? (
              staffId
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#B23A2E' }}>No staff ID yet</span>
                {admin ? (
                  <button type="button" onClick={assignId} style={{ border: '1px solid #16223A', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer', fontFamily: 'inherit' }}>Assign staff ID</button>
                ) : (
                  <span style={{ fontSize: 10.5, fontWeight: 500, color: '#5B6478' }}>ask an admin</span>
                )}
              </span>
            )
          )}
          {ro('Role', String(user.role || '—') + (user.isSuperAdmin ? ' · Super Admin' : user.isAdmin ? ' · Admin' : ''))}
          {ro('Email', user.email || '—')}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}><strong style={cardTitle}>Work &amp; contact</strong></div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {text('designation', 'Designation', 'e.g. Associate')}
              {text('department', 'Department', 'e.g. Litigation')}
              {text('officeLocation', 'Office location', 'e.g. Kuala Lumpur Office')}
              <label style={labelWrap}>
                <span style={LBL}>Employment type</span>
                <select value={f.employmentType} onChange={(e) => setF({ employmentType: e.target.value as StaffProfile['employmentType'] })} style={{ ...INP, cursor: 'pointer' }}>
                  {EMPLOYMENT.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {text('phone', 'Phone', 'e.g. 012-345 6789')}
              {text('emergencyContact', 'Emergency contact', 'name · relationship · phone')}
              {text('joinDate', 'Join date', '', 'date')}
            </div>
            <label style={labelWrap}>
              <span style={LBL}>Professional bio</span>
              <textarea value={f.bio} onChange={(e) => setF({ bio: e.target.value })} rows={4} placeholder="Practice focus and relevant experience, for the internal directory" style={{ ...INP, resize: 'vertical', lineHeight: 1.5 }} />
            </label>
            <div style={{ borderTop: '1px solid #EEF1F5', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={SUB}>Milestones</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {text('birthday', 'Birthday', '', 'date')}
                {text('callToBarDate', 'Call-to-the-bar date', '', 'date')}
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, color: '#16223A', cursor: 'pointer' }}>
                <input type="checkbox" checked={f.celebrationOptOut} onChange={(e) => setF({ celebrationOptOut: e.target.checked })} style={{ marginTop: 2, cursor: 'pointer' }} />
                <span>
                  <strong>Hide my birthday and milestone announcements</strong>
                  <span style={{ display: 'block', fontSize: 10.5, color: '#5B6478' }}>The dates stay on file, but celebrations won’t appear on the Firm Start Centre. The birth year is never shown.</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ padding: '10px 14px', background: '#16223A' }}><strong style={{ fontSize: 13, color: '#fff' }}>Payslip &amp; bank details</strong></div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {text('nric', 'NRIC no.', 'e.g. 900101-10-1234')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {text('epfNo', 'EPF no.')}
              {text('socsoNo', 'SOCSO no.')}
            </div>
            {text('bankName', 'Bank', 'e.g. Maybank')}
            {text('bankAccountNo', 'Bank account no.')}
            <span style={{ fontSize: 10.5, lineHeight: 1.5, color: '#5B6478' }}>Printed on your payslip and EA form (the account number is masked). Claims are paid back to this account.</span>
          </div>
          <div style={{ padding: '9px 14px', background: '#F6F8FA', borderTop: '1px solid #EEF1F5', fontSize: 10.5, lineHeight: 1.5, color: '#5B6478' }}>
            {self ? 'In the Staff Portal these are shown only to you and the firm’s admins.' : 'In the Staff Portal these are shown only to ' + user.name + ' and the firm’s admins.'}
          </div>
        </div>
      </div>
    </>
  );
};
