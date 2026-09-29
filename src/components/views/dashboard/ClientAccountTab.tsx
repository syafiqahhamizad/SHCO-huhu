import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { palette, tint, tintText, serifFont } from '../../../lib/designTokens';
import type { Retainer } from '../../../types';

/** Partner-code -> avatar color. Mirrors the fixed 'SH' | 'AH' | 'ZA' partner codes in
 * types.ts (see PartnerCode) — not a design token because it keys off partner identity,
 * not semantic meaning. */
const PARTNER_COLOR: Record<string, string> = {
  SH: palette.navy,
  AH: palette.blue,
  ZA: palette.purple,
};

const fmtRM = (n: number) =>
  `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthsBetween = (fromIso: string, toDate: Date): number => {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  return (toDate.getFullYear() - from.getFullYear()) * 12 + (toDate.getMonth() - from.getMonth());
};

interface MatterGroup {
  clientId: string;
  caseId: string;
  balance: number;
  lastDate: string;
  entries: Retainer[];
}

interface CheckItem {
  key: string;
  title: string;
  ref: string;
  amount: number;
  why: string;
  color: string;
}

/**
 * "Client account" sub-tab of My Dashboard — visible to all partners.
 * Replicates the isCacc block of design/My Dashboard.dc.html (lines ~158-190) exactly:
 * 4 KPI cards, an "Items to check" table with a per-row audit-trailed toggle, a
 * "Largest balances" table, and a "Reconciliation" summary panel.
 *
 * All figures are derived from real useApp() data (retainers, cases, clients,
 * threeWayRec, bankReconciliationEntries) — nothing here is fabricated.
 */
export const ClientAccountTab: React.FC = () => {
  const {
    retainers,
    cases,
    clients,
    threeWayRec,
    bankReconciliationEntries,
    clientAccountChecks,
    toggleClientAccountCheck,
  } = useApp();

  const today = useMemo(() => new Date(), []);

  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  // Total client trust funds held — reuses the exact per-client Deposit/Apply/Refund
  // computation already used for "Total Trust Funds Held" in AccountingViews.tsx
  // (RetainersView / TrustReportsView). Do not re-derive this differently.
  const totalHeld = useMemo(() => {
    const clientBalances: Record<string, number> = {};
    retainers.forEach((r) => {
      clientBalances[r.clientId] = (clientBalances[r.clientId] || 0) + (r.type === 'Deposit' ? r.amount : -r.amount);
    });
    return Object.values(clientBalances).reduce((acc, v) => acc + v, 0);
  }, [retainers]);

  // Per-matter (clientId + caseId) groupings — needed for overdrawn / dormant /
  // stakeholder detection and the "Largest balances" table, which the client-level
  // total above doesn't give us.
  const matterGroups = useMemo<MatterGroup[]>(() => {
    const map = new Map<string, MatterGroup>();
    retainers.forEach((r) => {
      if (!r.clientId || !r.caseId) return;
      const key = `${r.clientId}|${r.caseId}`;
      const delta = r.type === 'Deposit' ? r.amount : -r.amount;
      const g = map.get(key) || { clientId: r.clientId, caseId: r.caseId, balance: 0, lastDate: '', entries: [] };
      g.balance += delta;
      if (!g.lastDate || r.date > g.lastDate) g.lastDate = r.date;
      g.entries.push(r);
      map.set(key, g);
    });
    return Array.from(map.values());
  }, [retainers]);

  const checkedMap = useMemo(() => new Map(clientAccountChecks.map((c) => [c.itemKey, c])), [clientAccountChecks]);

  const nameRef = (g: MatterGroup) => {
    const client = clientById.get(g.clientId);
    const kase = caseById.get(g.caseId);
    return { client, kase, label: `${client?.name || g.clientId} · ${kase?.ref || g.caseId}` };
  };

  // Items to check — real detection against retainers, no fabricated rows.
  const checkItems = useMemo<CheckItem[]>(() => {
    const items: CheckItem[] = [];

    // Unidentified receipts: retainers explicitly flagged as unidentified (Retainer.unidentified).
    // Nothing in the app sets this flag yet, so this list is honestly empty until an intake
    // flow starts flagging receipts it can't auto-match.
    retainers
      .filter((r) => r.unidentified === true)
      .forEach((r) => {
        items.push({
          key: `unidentified:${r.id}`,
          title: r.remarks || 'Unidentified receipt',
          ref: `Retainer ${r.id} · ${r.date}`,
          amount: r.amount,
          why: 'No client/matter link — must be identified before it can be reconciled.',
          color: palette.blue,
        });
      });

    matterGroups.forEach((g) => {
      const { client, kase, label } = nameRef(g);

      if (g.balance < 0) {
        items.push({
          key: `overdrawn:${g.clientId}:${g.caseId}`,
          title: label,
          ref: kase?.title || g.caseId,
          amount: g.balance,
          why: "Ledger balance is negative — breaches Solicitors' Account Rules 1990 r.7; top up immediately.",
          color: palette.red,
        });
      }

      if (g.balance > 0 && monthsBetween(g.lastDate, today) > 12) {
        items.push({
          key: `dormant:${g.clientId}:${g.caseId}`,
          title: label,
          ref: `No movement since ${g.lastDate}`,
          amount: g.balance,
          why: 'Dormant over 12 months — consider reporting to the Registrar of Unclaimed Moneys.',
          color: palette.gold,
        });
      }

      if (g.balance > 0 && kase?.status === 'Closed') {
        items.push({
          key: `stakeholder:${g.clientId}:${g.caseId}`,
          title: label,
          ref: kase?.title || g.caseId,
          amount: g.balance,
          why: 'Matter is closed but funds are still held — release, transfer or report before archiving.',
          color: palette.purple,
        });
      }

      void client;
    });

    return items;
  }, [retainers, matterGroups, caseById, clientById, today]);

  const openCount = checkItems.filter((i) => !checkedMap.has(i.key)).length;
  const stakeholderHeld = checkItems
    .filter((i) => i.key.startsWith('stakeholder:'))
    .reduce((acc, i) => acc + i.amount, 0);

  const reconciledToDate = useMemo(() => {
    const dated = bankReconciliationEntries.filter((e) => e.status === 'Reconciled' && e.reconciledDate);
    if (dated.length === 0) return null;
    return dated.reduce((latest, e) => (e.reconciledDate! > latest ? e.reconciledDate! : latest), dated[0].reconciledDate!);
  }, [bankReconciliationEntries]);

  const latestRecon = threeWayRec.length > 0 ? threeWayRec[threeWayRec.length - 1] : null;

  const latestSignOff = useMemo(() => {
    const dated = bankReconciliationEntries.filter((e) => e.status === 'Reconciled' && e.reconciledBy && e.reconciledDate);
    if (dated.length === 0) return null;
    return dated.reduce((latest, e) => (e.reconciledDate! > latest.reconciledDate! ? e : latest), dated[0]);
  }, [bankReconciliationEntries]);

  const kpis = [
    {
      label: 'Total held',
      value: fmtRM(totalHeld),
      note: 'Client Trust Account (SAR 1990)',
      color: palette.navy,
    },
    {
      label: 'Reconciled to',
      value: reconciledToDate ?? 'Not yet',
      note: reconciledToDate ? 'Latest bank reconciliation date' : 'No reconciliation entries on file',
      color: reconciledToDate ? palette.green : palette.red,
    },
    {
      label: 'Items to check',
      value: String(openCount),
      note: openCount > 0 ? 'Before the next reconciliation' : 'Nothing outstanding',
      color: openCount > 0 ? palette.red : palette.green,
    },
    {
      label: 'Stakeholder sums held',
      value: fmtRM(stakeholderHeld),
      note: 'Held on matters marked Closed',
      color: stakeholderHeld > 0 ? palette.gold : palette.green,
    },
  ];

  const largestBalances = useMemo(() => {
    return matterGroups
      .filter((g) => g.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map((g) => {
        const { client, kase, label } = nameRef(g);
        const pic = kase?.partners?.[0] || '—';
        return {
          key: `${g.clientId}:${g.caseId}`,
          label,
          ref: kase?.ref || g.caseId,
          pic,
          picColor: PARTNER_COLOR[pic] || palette.slate,
          balance: g.balance,
          forWhat: kase?.type || kase?.matterCode || 'Client matter',
        };
      });
  }, [matterGroups, caseById, clientById]);

  return (
    <div className="flex flex-col gap-4">
      {/* KPI row */}
      <section className="grid grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-xl border p-3.5" style={{ borderColor: palette.border, background: palette.card }}>
            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: palette.slate }}>
              {k.label}
            </span>
            <span className="text-[23px] font-bold leading-tight" style={{ fontFamily: serifFont, color: k.color }}>
              {k.value}
            </span>
            <span className="text-[10.5px] leading-snug" style={{ color: palette.slate }}>
              {k.note}
            </span>
          </div>
        ))}
      </section>

      <section className="grid items-start gap-4" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
        {/* Items to check */}
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: palette.border, background: palette.card }}>
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
            <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
              Items to check
            </strong>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              before the next reconciliation
            </span>
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold"
              style={{ background: tint.red, color: palette.red }}
            >
              {openCount} open
            </span>
          </div>
          <div
            className="grid gap-3 px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-wider"
            style={{ gridTemplateColumns: 'minmax(0,1.4fr) 100px minmax(0,1fr) 110px', color: palette.slate, background: palette.page, borderBottom: '1px solid #EEF1F5' }}
          >
            <span>What</span>
            <span className="text-right">Amount</span>
            <span>Why it matters</span>
            <span />
          </div>
          {checkItems.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
              None flagged — nothing needs checking before the next reconciliation.
            </div>
          )}
          {checkItems.map((c) => {
            const checked = checkedMap.get(c.key);
            return (
              <div
                key={c.key}
                className="grid items-center gap-3 px-3.5 py-2"
                style={{
                  gridTemplateColumns: 'minmax(0,1.4fr) 100px minmax(0,1fr) 110px',
                  borderBottom: '1px solid #F0F2F5',
                  borderLeft: `3px solid ${c.color}`,
                  opacity: checked ? 0.55 : 1,
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] font-bold" style={{ color: palette.navy }}>
                    {c.title}
                  </span>
                  <span className="block truncate text-[10px]" style={{ color: palette.slate }}>
                    {c.ref}
                  </span>
                </span>
                <span className="text-right text-[12px] font-extrabold" style={{ color: palette.navy }}>
                  {fmtRM(c.amount)}
                </span>
                <span className="text-[10.5px] leading-snug" style={{ color: palette.slate }}>
                  {c.why}
                  {checked && (
                    <span className="block text-[9.5px]" style={{ color: palette.green }}>
                      Checked by {checked.checkedBy} · {new Date(checked.checkedAt).toLocaleDateString('en-MY')}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => toggleClientAccountCheck(c.key)}
                  className="justify-self-end whitespace-nowrap rounded-md px-2.5 py-1 text-[10.5px] font-bold"
                  style={{
                    border: `1px solid ${checked ? palette.green : palette.red}`,
                    background: checked ? tint.green : '#fff',
                    color: checked ? palette.green : palette.red,
                  }}
                >
                  {checked ? 'Checked' : 'Mark checked'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          {/* Largest balances */}
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: palette.border, background: palette.card }}>
            <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
              <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
                Largest balances
              </strong>
              <span className="text-[10.5px]" style={{ color: palette.slate }}>
                by matter
              </span>
            </div>
            <div
              className="grid gap-2.5 px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-wider"
              style={{ gridTemplateColumns: 'minmax(0,1.3fr) 60px 100px 90px', color: palette.slate, background: palette.page, borderBottom: '1px solid #EEF1F5' }}
            >
              <span>Client · matter</span>
              <span>PIC</span>
              <span className="text-right">Balance</span>
              <span>For</span>
            </div>
            {largestBalances.length === 0 && (
              <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
                No trust balances held yet.
              </div>
            )}
            {largestBalances.map((l) => (
              <div
                key={l.key}
                className="grid items-center gap-2.5 px-3.5 py-1.5"
                style={{ gridTemplateColumns: 'minmax(0,1.3fr) 60px 100px 90px', borderBottom: '1px solid #F0F2F5' }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] font-semibold" style={{ color: palette.navy }}>
                    {l.label}
                  </span>
                  <span className="block text-[9.5px]" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: palette.blue }}>
                    {l.ref}
                  </span>
                </span>
                <span
                  className="grid h-[22px] w-[22px] place-items-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: l.picColor }}
                >
                  {l.pic}
                </span>
                <span className="text-right text-[11.5px] font-bold" style={{ color: palette.navy }}>
                  {fmtRM(l.balance)}
                </span>
                <span className="truncate text-[10.5px]" style={{ color: palette.slate }}>
                  {l.forWhat}
                </span>
              </div>
            ))}
            <div className="px-3.5 py-2 text-[10.5px]" style={{ background: palette.page, color: palette.slate }}>
              Full ledger: Client Account → Client Trust Account (SAR 1990)
            </div>
          </div>

          {/* Reconciliation summary */}
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: palette.border, background: palette.card }}>
            <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
              <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
                Reconciliation
              </strong>
              <span className="text-[10.5px]" style={{ color: palette.slate }}>
                bank vs ledger
              </span>
            </div>
            {!latestRecon ? (
              <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
                No reconciliation on file yet — pending the next monthly 3-way reconciliation.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3.5 py-1.5">
                  <span className="flex-1 text-[11.5px]" style={{ color: palette.navy }}>
                    Bank statement ({latestRecon.month})
                  </span>
                  <strong className="text-[11.5px]" style={{ color: palette.navy }}>
                    {fmtRM(latestRecon.bankStatement)}
                  </strong>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5" style={{ borderTop: '1px solid #F0F2F5' }}>
                  <span className="flex-1 text-[11.5px]" style={{ color: palette.navy }}>
                    Cash book / GL
                  </span>
                  <strong className="text-[11.5px]" style={{ color: palette.navy }}>
                    {fmtRM(latestRecon.cashBookGL)}
                  </strong>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5" style={{ borderTop: '1px solid #F0F2F5' }}>
                  <span className="flex-1 text-[11.5px]" style={{ color: palette.navy }}>
                    Matter ledgers total
                  </span>
                  <strong className="text-[11.5px]" style={{ color: palette.navy }}>
                    {fmtRM(latestRecon.matterLedgerTotal)}
                  </strong>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5" style={{ borderTop: '1px solid #F0F2F5' }}>
                  <span className="flex-1 text-[11.5px]" style={{ color: palette.navy }}>
                    Difference (bank vs cash book)
                  </span>
                  <strong className="text-[11.5px]" style={{ color: latestRecon.bankVsCashBook === 0 ? palette.green : palette.red }}>
                    {fmtRM(latestRecon.bankVsCashBook)}
                  </strong>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5" style={{ borderTop: '1px solid #F0F2F5' }}>
                  <span className="flex-1 text-[11.5px]" style={{ color: palette.navy }}>
                    Status
                  </span>
                  <strong className="text-[11.5px]" style={{ color: latestRecon.status === 'MATCHED' ? palette.green : palette.red }}>
                    {latestRecon.status}
                  </strong>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5" style={{ borderTop: '1px solid #F0F2F5' }}>
                  <span className="flex-1 text-[11.5px]" style={{ color: palette.navy }}>
                    Signed off by
                  </span>
                  <strong className="text-[11.5px]" style={{ color: latestSignOff ? tintText.blue : palette.slate }}>
                    {latestSignOff ? `${latestSignOff.reconciledBy} · ${latestSignOff.reconciledDate}` : 'Pending sign-off'}
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ClientAccountTab;
