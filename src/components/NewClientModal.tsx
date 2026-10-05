import React, { useMemo, useState } from 'react';
import { stripSalutation } from '../lib/legacyCleanup';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Client } from '../types';
import { registrationConflicts } from '../lib/conflictUtils';
import { css } from './views/finance/financeModel';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the new client id once saved (Clients opens the profile on KYC). */
  onSaved?: (id: string) => void;
}

/**
 * "Register new client" (design pack `Clients.dc.html`, COPY, DO NOT REDESIGN).
 * The conflict check runs as you type against existing clients and the opposing parties on every
 * file; any match saves the client as "Pending Partner Review".
 */
export const NewClientModal: React.FC<NewClientModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { clients = [], cases = [], addClient, getNextSequenceId, currentUser, showToast } = useApp();
  const [type, setType] = useState<Client['type']>('Individual');
  const [name, setName] = useState('');
  const [idNo, setIdNo] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const hits = useMemo(() => registrationConflicts({ name, idNo }, clients, cases), [name, idNo, clients, cases]);
  if (!isOpen) return null;
  const isCo = type === 'Corporate';
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const save = () => {
    if (!name.trim()) { showToast('Enter the client name'); return; }
    const id = getNextSequenceId('client');
    const now = new Date().toISOString();
    const me = currentUser?.name || 'Staff';
    const c: Client = {
      id,
      name: stripSalutation(name),
      type,
      ...(isCo ? { registrationNo: idNo.trim() || undefined, entityCategory: 'Sdn Bhd' as const } : { icNo: idNo.trim() || undefined, icNumber: idNo.trim() || undefined }),
      contactPerson: isCo ? '' : stripSalutation(name),
      phone: phone.trim(),
      email: email.trim(),
      address: '',
      emergencyContact: '',
      notes: '',
      kyc: [],
      status: 'Pending KYC',
      createdAt: now,
      conflictCheck: hits.length
        ? { status: 'Pending Partner Review', notes: hits.join(' '), checkedBy: me, checkedDate: now.slice(0, 10) }
        : { status: 'Clear', notes: 'No match against existing clients or opposing parties.', checkedBy: me, checkedDate: now.slice(0, 10) },
      autoConflictMatches: hits.map((h) => ({ label: 'Possible conflict', detail: h })),
      history: [{ at: now, by: me, what: 'Client registered as ' + (isCo ? 'Company' : 'Individual') + (hits.length ? '. Possible conflict: partner review needed' : ''), kind: hits.length ? 'conflict' : 'edit' }],
    };
    addClient(c);
    onClose();
    onSaved?.(id);
  };

  const fields: [string, string, (v: string) => void, string, string][] = [
    [isCo ? 'Registered company name' : 'Full name (as in NRIC)', name, setName, isCo ? 'e.g. Tiga Sinar Trading Sdn Bhd' : 'e.g. Siti Hajar binti Ahmad', '1 / -1'],
    [isCo ? 'SSM / ROC no.' : 'NRIC / passport no.', idNo, setIdNo, isCo ? 'e.g. 201901033187' : 'e.g. 900101-10-1234', 'auto'],
    ['Phone', phone, setPhone, 'e.g. 012-345 6789', 'auto'],
    ['E-mail', email, setEmail, 'e.g. name@example.com', '1 / -1'],
  ];

  return (
    <div onClick={onClose} style={css('position:fixed;inset:0;background:rgba(22,34,58,.45);z-index:50;display:flex;align-items:flex-start;justify-content:center;padding:48px 16px;overflow:auto;font-family:Inter,system-ui,-apple-system,sans-serif')}>
      <div onClick={stop} role="dialog" aria-label="Register new client" style={css('width:100%;max-width:600px;background:#fff;border-radius:12px;box-shadow:0 20px 50px rgba(22,34,58,.25);display:flex;flex-direction:column')}>
        <div style={css('display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #DDE3EB')}><strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>Register new client</strong><button type="button" onClick={onClose} aria-label="Close" style={css('margin-left:auto;border:0;background:none;font-size:18px;color:#5B6478;cursor:pointer')}>×</button></div>
        <div style={css('display:flex;flex-direction:column;gap:14px;padding:18px 20px')}>
          <div style={css('display:flex;gap:6px')}>
            {(['Individual', 'Corporate'] as const).map((t) => { const on = type === t; return <button key={t} type="button" onClick={() => setType(t)} style={css(`flex:1;border-radius:8px;padding:9px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{t === 'Corporate' ? 'Company' : 'Individual'}</button>; })}
          </div>
          <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
            {fields.map(([label, v, on, ph, col]) => (
              <label key={label} style={css(`display:flex;flex-direction:column;gap:4px;grid-column:${col}`)}><span style={css('font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#5B6478')}>{label}</span><input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} style={css('width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:8px 10px;font-size:12px;color:#16223A;outline-color:#3D6B9C')} /></label>
            ))}
          </div>
          {hits.length > 0 && <div style={css('display:flex;gap:10px;padding:10px 12px;border-radius:8px;background:#F6E4E1;border:1px solid #E8BDB5')}><AlertTriangle size={16} color="#8E2A20" style={css('flex-shrink:0;margin-top:1px')} /><span style={css('font-size:11.5px;line-height:1.5;color:#8E2A20')}><strong>Possible conflict.</strong> {hits.join(' ')} The client will be saved as "Partner review".</span></div>}
          {!hits.length && name.trim().length >= 4 && <div style={css('display:flex;gap:10px;padding:10px 12px;border-radius:8px;background:#E6EFE9')}><CheckCircle2 size={16} color="#1F5A3B" style={css('flex-shrink:0')} /><span style={css('font-size:11.5px;color:#1F5A3B')}>No match against existing clients or opposing parties.</span></div>}
        </div>
        <div style={css('display:flex;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid #DDE3EB;background:#F6F8FA;border-radius:0 0 12px 12px')}><span style={css('font-size:11px;color:#5B6478')}>Conflict check runs as you type</span><button type="button" onClick={onClose} style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Cancel</button><button type="button" onClick={save} style={css('border:0;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}>Save client</button></div>
      </div>
    </div>
  );
};
