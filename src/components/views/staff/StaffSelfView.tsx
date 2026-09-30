import React from 'react';
import { useApp } from '../../../context/AppContext';
import type { HrDocument, User } from '../../../types';
import { card, cardTitle, serif } from './staffPortalShared';
import { draftOf, dt, expiryInfo, isLawyer } from './staffRecord';
import { openStoredFile, storedFileKey, useStoredImageUrl } from '../../../services/fileStorageService';

/** Document types staff can see on their own record; the rest (e.g. warning letters) stay HR-only. */
export const STAFF_VISIBLE_DOCS = new Set([
  'IC copy', 'Passport copy', 'Offer letter', 'Employment contract', 'Certificate / transcript',
  'Practising certificate', 'Syarie certificate', 'Confirmation letter', 'Increment / promotion letter',
]);

const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478' };
const VAL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#16223A', overflowWrap: 'anywhere' };

const mask = (v: string, keep = 4) => (v.length > keep ? '•'.repeat(Math.min(8, v.length - keep)) + v.slice(-keep) : v);

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
    <span style={LBL}>{label}</span>
    <span style={VAL}>{value || <span style={{ color: '#94A3B8', fontWeight: 500 }}>—</span>}</span>
  </div>
);

const Expiry: React.FC<{ iso: string }> = ({ iso }) => {
  const x = expiryInfo(iso);
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {iso ? dt(iso) : null}
      {x && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, color: x.color, background: x.bg }}>{x.text}</span>}
    </span>
  );
};

const Box: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={card}>
    <div style={{ padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}><strong style={cardTitle}>{title}</strong></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14, padding: '12px 14px' }}>{children}</div>
  </div>
);

/** What a staff member sees of their own HR record — the essentials, read-only. */
export const StaffSelfView: React.FC<{ user: User }> = ({ user }) => {
  const { users } = useApp();
  const d = draftOf(user);
  const p = user.staffProfile;
  const { url: photo, needsDrive, connect } = useStoredImageUrl(p?.photo);
  const [openErr, setOpenErr] = React.useState('');

  const manager = users.find((u) => u.id === d.reportingTo)?.name || '';
  const emergency = [d.emName, d.emRelationship, d.emPhone].filter(Boolean).join(' · ');
  const docs: HrDocument[] = (p?.hrDocuments || []).filter((x) => STAFF_VISIBLE_DOCS.has(x.type));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        {photo ? (
          <img src={photo} alt="" style={{ width: 52, height: 52, borderRadius: 9999, objectFit: 'cover' }} />
        ) : (
          <span onClick={needsDrive ? connect : undefined} title={needsDrive ? 'Show photo (connects to the firm’s Google Drive)' : undefined} style={{ width: 52, height: 52, borderRadius: 9999, background: '#16223A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 21, fontWeight: 700, cursor: needsDrive ? 'pointer' : undefined }}>{user.name.slice(0, 1)}</span>
        )}
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <strong style={{ fontFamily: serif, fontSize: 18, color: '#16223A' }}>{user.name}</strong>
          <span style={{ fontSize: 11.5, color: '#5B6478' }}>{[d.designation, d.department].filter(Boolean).join(' · ')}</span>
        </span>
        <span style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <strong style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, color: '#16223A' }}>{p?.staffId || '—'}</strong>
          <span style={{ fontSize: 10.5, color: '#5B6478' }}>Code {d.code || '—'}</span>
        </span>
      </div>

      <Box title="At work">
        <Field label="Full name (as per IC)" value={d.fullName} />
        <Field label="Role" value={String(user.role || '')} />
        <Field label="Reports to" value={manager} />
        <Field label="Office" value={d.officeLocation} />
        <Field label="Employment type" value={d.employmentType} />
        <Field label="Joined" value={d.joinDate ? dt(d.joinDate) : ''} />
        <Field label="Work email" value={user.email} />
      </Box>

      <Box title="Personal & contact">
        <Field label="NRIC / passport" value={d.nric ? mask(d.nric) : ''} />
        <Field label="Date of birth" value={d.birthday ? dt(d.birthday) : ''} />
        <Field label="Mobile" value={d.phone} />
        <Field label="Home address" value={d.homeAddress} />
        <Field label="Personal email" value={d.personalEmail} />
        <Field label="Emergency contact" value={emergency} />
      </Box>

      <Box title="For your payslip">
        <Field label="EPF no." value={d.epfNo} />
        <Field label="SOCSO no." value={d.socsoNo} />
        <Field label="Income tax no." value={d.taxNo} />
        <Field label="Bank" value={d.bankName} />
        <Field label="Account no." value={d.bankAccountNo ? mask(d.bankAccountNo) : ''} />
      </Box>

      {isLawyer(user, d) && (
        <Box title="Practice">
          <Field label="Called to the Bar" value={d.callToBarDate ? dt(d.callToBarDate) : ''} />
          <Field label="Roll no." value={d.rollNo} />
          <Field label={`CPD points ${new Date().getFullYear()}`} value={d.cpdThisYear} />
          <Field label="Practising certificate" value={d.practisingCertNo} />
          <Field label="Expires" value={d.practisingCertExpiry ? <Expiry iso={d.practisingCertExpiry} /> : ''} />
          <span />
          {(d.syarieCertNo || d.syarieCertExpiry) && (
            <>
              <Field label="Syarie certificate" value={d.syarieCertNo} />
              <Field label="Expires" value={d.syarieCertExpiry ? <Expiry iso={d.syarieCertExpiry} /> : ''} />
            </>
          )}
        </Box>
      )}

      {docs.length > 0 && (
        <div style={card}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}><strong style={cardTitle}>My documents</strong></div>
          {docs.map((x, i) => (
            <div key={storedFileKey(x)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderTop: i ? '1px solid #F0F2F5' : 'none', fontSize: 11.5 }}>
              <span style={{ fontWeight: 700, color: '#16223A', width: 190 }}>{x.type}</span>
              <span style={{ flex: 1, color: '#5B6478', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
              <button type="button" onClick={() => { setOpenErr(''); void openStoredFile(x).then((e) => e && setOpenErr(e)); }} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '4px 10px', fontSize: 10.5, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer', fontFamily: 'inherit' }}>Open</button>
            </div>
          ))}
          {openErr && <div style={{ padding: '8px 14px', borderTop: '1px solid #F0F2F5', fontSize: 11, fontWeight: 600, color: '#B23A2E' }}>{openErr}</div>}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.5, color: '#5B6478' }}>
        This is your HR record, kept by the firm. If anything here is wrong or out of date, let HR know and they’ll update it.
      </p>
    </div>
  );
};
