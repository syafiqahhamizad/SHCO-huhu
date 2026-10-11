import React from 'react';
import { PeoplePicker } from '../cases/PeoplePicker';
import { useApp } from '../../../context/AppContext';
import { APPROVAL_ITEMS, PARTNER_ONLY_ITEMS, approverCode, approverPool, poolFor, ruleLabel, type ApproverRule } from '../../../lib/approvers';
import { css, S, type SettingsCtx } from './settingsShared';
import { designRole } from './permissionModel';

const GRID = 'display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.6fr) 150px minmax(0,1fr);gap:12px;';

/** Who approves — design pack `Firm Settings` (isApv). Saved in Firm & Practice Settings → `approvers`. */
export const ApproversTab = ({ C }: { C: SettingsCtx }) => {
  const { users = [] } = useApp();
  const pool = approverPool(users);
  const rules = C.settings.approvers || {};

  const upd = (id: string, label: string, next: ApproverRule) => {
    if (!C.isSuperAdmin) return C.msg('Only the Super Admin can change who approves');
    const codes = next.approvers.map((uid) => approverCode(pool.find((u) => u.id === uid) || { name: uid }));
    C.save({ approvers: { ...rules, [id]: next } }, 'Approvers Changed', label + ': ' + ruleLabel(codes, next.need));
    C.msg('Saved · ' + label);
  };

  return (
    <div style={css(S.card)}>
      <div style={css('display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Who approves</strong><span style={css(S.sub)}>tick the people who can approve each item, then choose whether all of them or only some must approve · every approve button in the system follows this list</span></div>
      <div style={css('display:flex;gap:14px;flex-wrap:wrap;padding:8px 14px;background:#FBFCFD;border-bottom:1px solid #EEF1F5')}>
        {pool.map((u) => <span key={u.id} style={css('font-size:10.5px;color:#5B6478')}><strong style={css('color:#16223A')}>{approverCode(u)}</strong> {u.name} · {designRole(u)}</span>)}
        {!pool.length && <span style={css('font-size:10.5px;color:#5B6478')}>No active staff yet. Add them in Users &amp; Roles.</span>}
      </div>
      <div style={css('padding:7px 14px;font-size:10.5px;line-height:1.5;color:#8A6534;background:#FDF8EE;border-bottom:1px solid #EEF1F5')}>You can pick anyone. For money items (claims, payments, payroll, fee sharing…) the person must also have <strong>Billing &amp; money</strong> switched on in Users &amp; Roles, or they cannot open what they approve.</div>
      <div style={css(GRID + 'padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>What needs approval</span><span>Approvers</span><span>Rule</span><span>Result</span></div>
      {APPROVAL_ITEMS.map(([id, label, where, fallback]) => {
        const r = rules[id];
        const itemPool = poolFor(id, users);
        const partnerOnly = PARTNER_ONLY_ITEMS.includes(id);
        // Only people still in the pool count (switched-off or role-changed people drop out).
        const ids = (r?.approvers || []).filter((uid) => itemPool.some((u) => u.id === uid));
        const n = ids.length;
        const need = r?.need ? Math.min(r.need, n) : n;
        const codes = ids.map((uid) => approverCode(itemPool.find((u) => u.id === uid) || { name: uid }));
        const summary = !n ? 'Not set yet · ' + fallback : need === n ? (n === 1 ? codes[0] + ' approves' : 'all of ' + codes.join(', ')) : need + ' of ' + codes.join(', ');
        const needOpts = [{ v: '0', label: n > 1 ? 'All ' + n + ' must approve' : 'Must approve' }, ...Array.from({ length: Math.max(0, n - 1) }, (_, i) => ({ v: String(i + 1), label: 'Any ' + (i + 1) + ' of ' + n }))];
        return (
          <div key={id} style={css(GRID + 'align-items:center;padding:9px 14px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{label}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{where}</span>{partnerOnly && <span style={css('display:block;font-size:10px;font-weight:700;color:#8A6534')}>Partners only (Solicitors’ Account Rules 1990)</span>}</span>
            <PeoplePicker
              id={'appr-' + id}
              options={itemPool.map((u) => ({ value: u.id, label: approverCode(u) + ' · ' + u.name, hint: designRole(u) }))}
              value={ids}
              onChange={(a) => { if (!a.length) { C.msg('Keep at least one approver'); return; } upd(id, label, { approvers: a, need: r?.need && r.need < a.length ? r.need : 0 }); }}
              placeholder="Search a name…"
            />
            <select value={String(r?.need && r.need < n ? r.need : 0)} disabled={!n} onChange={(e) => upd(id, label, { approvers: ids, need: Number(e.target.value) })} style={css(`border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;cursor:${n ? 'pointer' : 'default'}`)}>
              {needOpts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <span style={css(`font-size:10.5px;color:${n ? '#2F5680' : '#94A3B8'};font-weight:600`)}>{summary}</span>
          </div>
        );
      })}
      <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Each approver only sees their own approve button when logged in. Every approval is written to Activity Logs. Amount limits stay under Permissions &amp; limits.</div>
    </div>
  );
};
