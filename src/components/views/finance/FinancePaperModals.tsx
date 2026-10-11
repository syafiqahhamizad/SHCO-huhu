import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css } from './financeModel';

const LBL = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478';

/* ------------------------------ Payment reminder (email / WhatsApp) ------------------------------ */
export const ReminderModal = ({ F }: { F: FinanceCtrl }) => {
  const r = F.rem!; const set = (p: Partial<typeof r>) => F.setRem({ ...r, ...p });
  const inv = r.kind === 'invoice' ? F.app.invoices.find((i) => i.id === r.id) : undefined;
  const prev = inv?.reminders || [];
  const client = inv ? inv.partyName || F.clientName(inv.clientId) : F.app.quotations.find((q) => q.id === r.id)?.clientName || '';
  const IN = 'width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:7px 9px;font-size:11.5px;font-family:inherit;color:#16223A;outline:none;background:#fff;box-sizing:border-box';
  const CHK = 'display:flex;align-items:center;gap:5px;border:0;background:none;padding:0;font-size:12px;font-weight:600;color:#16223A;cursor:pointer;font-family:inherit';
  return (
    <>
      <div onClick={() => F.setRem(null)} style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.5)')}></div>
      <div style={css('position:fixed;top:40px;bottom:40px;overflow:auto;left:50%;transform:translateX(-50%);z-index:61;width:620px;max-width:calc(100% - 32px);background:#fff;border-radius:12px;box-shadow:0 20px 48px rgba(22,34,58,.25)')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-size:13px;color:#16223A')}>{r.send ? 'Send' : 'Payment reminder'} · {r.id}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{r.send ? 'to the client or lead' : 'to the client on this invoice'}</span></div>
        <div style={css('padding:14px 16px;display:flex;flex-direction:column;gap:10px')}>
          {prev.length > 0 && <div style={css('padding:7px 10px;border-radius:6px;background:#FBF2E9;color:#8A6534;font-size:11px;font-weight:600')}>Already reminded {prev.length}x · last on {prev[prev.length - 1]}</div>}
          <div style={css('display:flex;align-items:center;gap:14px')}><span style={css(LBL)}>Send by</span><button type="button" onClick={() => set({ viaE: !r.viaE })} style={css(CHK)}><span style={css('font-size:14px')}>{r.viaE ? '☑' : '☐'}</span>Email</button><button type="button" onClick={() => set({ viaW: !r.viaW })} style={css(CHK)}><span style={css('font-size:14px')}>{r.viaW ? '☑' : '☐'}</span>WhatsApp</button></div>
          {r.viaW && <div style={css('display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:8px;background:#F1F8F3;border:1px solid #CFE5D6')}><label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>WhatsApp to · mobile no.</span><input value={r.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="012-345 6789" style={css(IN)} /></label><label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>WhatsApp message (short)</span><textarea value={r.wa} onChange={(e) => set({ wa: e.target.value })} rows={4} style={css(IN + ';resize:vertical;line-height:1.5')} /></label><span style={css('font-size:10px;color:#2F6F4E')}>Opens WhatsApp with this message ready. Press send there.</span></div>}
          {r.viaE && <>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Email to · {client}</span><input value={r.to} onChange={(e) => set({ to: e.target.value })} placeholder="client@email.com" style={css(IN)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Subject</span><input value={r.subj} onChange={(e) => set({ subj: e.target.value })} style={css(IN)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Message</span><textarea value={r.body} onChange={(e) => set({ body: e.target.value })} rows={10} style={css(IN + ';resize:vertical;line-height:1.5')} /></label>
            <button type="button" onClick={() => set({ attach: !r.attach })} style={css('align-self:flex-start;display:flex;align-items:center;gap:6px;border:0;background:none;padding:0;font-size:11.5px;color:#16223A;cursor:pointer;font-family:inherit')}><span style={css('font-size:14px')}>{r.attach ? '☑' : '☐'}</span>Attach invoice {r.id}.pdf</button>
          </>}
        </div>
        <div style={css('display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid #EEF1F5;background:#FBFCFD')}><button type="button" onClick={() => F.setRem(null)} style={css('border-radius:6px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid #DDE3EB;background:#fff;color:#16223A')}>Cancel</button><button type="button" onClick={F.sendReminder} style={css('border-radius:6px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;border:0;background:#16223A;color:#fff')}>{r.viaE && r.viaW ? 'Send email & WhatsApp' : r.viaW ? 'Open WhatsApp' : 'Send email'}</button></div>
      </div>
    </>
  );
};

/* ------------------------------ A4 paper viewer (reports, statements, payslips) ------------------------------ */
export const PaperModal = ({ F }: { F: FinanceCtrl }) => {
  const p = F.paper!;
  return (
    <div style={css('position:fixed;inset:0;z-index:90;background:rgba(22,34,58,.7);overflow:auto;display:flex;justify-content:center;padding:24px 16px 40px')}>
      <div style={css(`width:${p.wide ? 1180 : 840}px;max-width:100%;margin:0 auto;align-self:flex-start;display:flex;flex-direction:column;gap:10px`)}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#16223A;border-radius:10px;padding:8px 12px')}><strong style={css('color:#fff;font-size:13px')}>{p.title}</strong><span style={css('font-size:10.5px;color:#C9D3E0')}>{p.sub}</span>
          {!!p.toggles?.length && <div style={css('display:flex;gap:2px;border:1px solid rgba(255,255,255,.35);border-radius:16px;padding:2px')}>{p.toggles.map((y) => <button key={y.label} type="button" onClick={y.go} style={css(`border:0;border-radius:14px;padding:3px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;background:${y.on ? '#fff' : 'transparent'};color:${y.on ? '#16223A' : '#fff'}`)}>{y.label}</button>)}</div>}
          <div style={css('margin-left:auto;display:flex;gap:6px;flex-wrap:wrap')}>{p.extra}{p.xls && <button type="button" onClick={p.xls} style={css('border:1px solid #1F6B43;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#1F6B43;color:#fff;cursor:pointer;font-family:inherit')}>Excel</button>}{p.pdf && <button type="button" onClick={p.pdf} style={css('border:1px solid #B23A2E;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#B23A2E;color:#fff;cursor:pointer;font-family:inherit')}>PDF / Print</button>}<button type="button" onClick={() => F.setPaper(null)} style={css('border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit')}>Close</button></div></div>
        <div style={css((p.wide ? 'width:1123px;' : 'width:794px;') + 'max-width:100%;min-height:600px;margin:0 auto;background:#fff;box-shadow:0 12px 32px rgba(0,0,0,.3);padding:48px 58px;box-sizing:border-box;overflow-x:auto')} dangerouslySetInnerHTML={{ __html: p.html }} />
      </div>
    </div>
  );
};
