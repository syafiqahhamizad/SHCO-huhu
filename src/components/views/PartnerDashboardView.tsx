import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Lock,
  ArrowUpRight,
  PieChart as LucidePieChart,
  Clock,
  ExternalLink,
  Share2,
  ArrowDownRight,
  Percent,
  Award,
  Download,
  Search,
  UserCheck,
  UserX,
  Layers,
  Activity,
  ChevronRight,
  Building2,
  Sparkles,
  RefreshCw,
  Briefcase,
  FileText,
  Target,
  FileCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';
import { identityTokens, isMine, partnerCode as toPartnerCode } from '../../lib/identity';
import { ProgressBar, Donut, MiniBarChart } from '../ui';
import { palette } from '../../lib/designTokens';

export const PartnerDashboardView: React.FC = () => {
  const {
    currentRole,
    isAdmin,
    cases,
    invoices,
    quotations,
    leads,
    deadlines,
    paymentVouchers,
    receipts,
    referralPartners,
    users,
    timeEntries,
    expenses,
    showToast,
  } = useApp();

  // Filters & State
  const [timeframe, setTimeframe] = useState<'MTD' | 'QTD' | 'YTD' | 'ALL'>('YTD');
  const [referralSearch, setReferralSearch] = useState<string>('');
  const [collectionSearch, setCollectionSearch] = useState<string>('');
  const [partnerBenchmarkMetric, setPartnerBenchmarkMetric] = useState<'REVENUE' | 'REFERRALS' | 'EFFICIENCY'>('REVENUE');

  const isPartner = currentRole === 'Partner' || isAdmin;
  // This is a fixed all-partners reporting view (see header subtitle) — no per-partner filter.
  const effectivePartnerFilter: 'ALL' | 'SH' | 'AH' | 'ZA' = 'ALL';

  if (!isPartner) {
    return (
      <div className="bg-white border border-[#DDE3EB] p-8 rounded-xl shadow-xs text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-16 h-16 bg-[#FBEDE9] text-[#B23A2E] rounded-full flex items-center justify-center mx-auto border border-[#FBEDE9]">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold text-[#16223A]">Partner Restricted Access</h2>
          <p className="text-xs text-slate-600 mt-1">
            This Executive Partner Dashboard contains confidential firm financial metrics, fee distributions, partner KPI tracking, and referral conversion analytics restricted exclusively to Firm Partners (Syafiqah Hamizad, Amer Haiqal, Zulaikha Afendi).
          </p>
        </div>
        <div className="pt-2">
          <span className="text-[11px] bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-300 font-mono inline-block">
            Current Role: {currentRole} (Restricted)
          </span>
        </div>
      </div>
    );
  }

  // Case lookup, used to attribute invoices/receipts to a partner via the real
  // Case.partners array instead of parsing partner codes out of ref strings
  // (a matter's ref segment [1] can be a combined code like "SH-AH").
  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  const dateInTimeframe = (dateStr?: string) => {
    if (timeframe === 'ALL') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    if (timeframe === 'MTD') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (timeframe === 'QTD') {
      const q = Math.floor(now.getMonth() / 3);
      return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === q;
    }
    return d.getFullYear() === now.getFullYear(); // YTD
  };

  // 1. Calculate totals based on partner filter
  const partnerFilteredCases = cases.filter(
    (cs) => effectivePartnerFilter === 'ALL' || cs.partners?.includes(effectivePartnerFilter as any)
  );

  const partnerFilteredInvoices = invoices.filter((i) => {
    if (effectivePartnerFilter !== 'ALL') {
      const cs = caseById.get(i.caseId);
      if (!cs?.partners?.includes(effectivePartnerFilter as any)) return false;
    }
    return dateInTimeframe(i.date);
  });

  const totalInvoiced = partnerFilteredInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
  const totalPaidInvoices = partnerFilteredInvoices
    .filter((inv) => inv.status === 'Paid')
    .reduce((acc, inv) => acc + (inv.total || 0), 0);
  const totalUnpaidInvoices = Math.max(0, totalInvoiced - totalPaidInvoices);
  const collectionRatePct = totalInvoiced > 0 ? Math.round((totalPaidInvoices / totalInvoiced) * 100) : 0;

  const over30DaysOutstanding = partnerFilteredInvoices
    .filter((inv) => {
      if (inv.status === 'Paid' || inv.status === 'Voided') return false;
      const due = inv.dueDate || inv.date;
      if (!due) return false;
      const days = Math.floor((Date.now() - new Date(due).getTime()) / 86400000);
      return days > 30;
    })
    .reduce((acc, inv) => acc + (inv.total || 0), 0);

  // 2. Monthly Revenue & Collection Analytics Data Generation
  const monthlyData = useMemo(() => {
    if (invoices.length === 0 && receipts.length === 0) {
      return [
        { month: 'Jan 2026', billed: 0, collected: 0, target: 40000, collectionRate: 0 },
        { month: 'Feb 2026', billed: 0, collected: 0, target: 40000, collectionRate: 0 },
        { month: 'Mar 2026', billed: 0, collected: 0, target: 45000, collectionRate: 0 },
        { month: 'Apr 2026', billed: 0, collected: 0, target: 45000, collectionRate: 0 },
        { month: 'May 2026', billed: 0, collected: 0, target: 50000, collectionRate: 0 },
        { month: 'Jun 2026', billed: 0, collected: 0, target: 50000, collectionRate: 0 },
        { month: 'Jul 2026', billed: 0, collected: 0, target: 55000, collectionRate: 0 },
        { month: 'Aug 2026', billed: 0, collected: 0, target: 60000, collectionRate: 0 },
      ];
    }
    const months = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026'];
    return months.map((m) => {
      const monthInv = partnerFilteredInvoices.filter((i) => i.date?.includes(m.slice(0, 3)));
      const billed = monthInv.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const collected = monthInv
        .filter((inv) => inv.status === 'Paid')
        .reduce((sum, inv) => sum + (inv.total || 0), 0);
      const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;
      return { month: m, billed, collected, target: 50000, collectionRate: rate };
    });
  }, [invoices, receipts, partnerFilteredInvoices]);

  // 3. Daily Collections Audit Ledger derived dynamically from receipts
  const rawCollections = useMemo(() => {
    return (receipts || []).map((r) => {
      const matchCase = cases.find((c) => c.id === r.caseId || c.ref === r.fileRef);
      const partners = matchCase?.partners?.length ? matchCase.partners : ['SH'];
      return {
        id: r.id,
        date: r.date,
        client: r.receivedFrom || 'Client',
        ref: r.fileRef || matchCase?.ref || 'SHC/GENERAL',
        amount: r.amount || 0,
        bank: r.accountSet === 'CLIENT' ? '1020 Client Trust Account' : '1010 Office General',
        method: r.bankRef || 'Bank Transfer',
        partners,
        partner: partners.join('/'),
        type: r.description || 'Collection',
      };
    });
  }, [receipts, cases]);

  // Filtered collections
  const filteredCollections = rawCollections.filter((c) => {
    if (effectivePartnerFilter !== 'ALL' && !c.partners.includes(effectivePartnerFilter as any)) return false;
    if (!dateInTimeframe(c.date)) return false;
    if (
      collectionSearch &&
      !c.client.toLowerCase().includes(collectionSearch.toLowerCase()) &&
      !c.ref.toLowerCase().includes(collectionSearch.toLowerCase())
    )
      return false;
    return true;
  });

  // 4. Referral Sources Breakdown Data — real Lead.referralSourceCategory / stage / quoteAmount
  //    (the enum on the Lead type; previous version matched fields — l.status, l.estimatedValue,
  //    l.source as a free string — that don't exist on Lead and always evaluated to zero).
  const REFERRAL_CATEGORY_META: Record<string, { shortName: string; icon: React.ElementType }> = {
    'Referral Partner': { shortName: 'Referral Partners', icon: Building2 },
    'Existing Client': { shortName: 'Existing Clients', icon: Users },
    'Social Media': { shortName: 'Social Media', icon: Sparkles },
    Website: { shortName: 'Website', icon: Sparkles },
    'Walk-In': { shortName: 'Walk-In', icon: Award },
    'Event / Seminar': { shortName: 'Events', icon: Award },
    Other: { shortName: 'Other', icon: DollarSign },
  };

  const referralSourcesData = useMemo(() => {
    const cats = Array.from(new Set((leads || []).map((l) => l.referralSourceCategory || 'Other')));
    if (cats.length === 0) cats.push('Other');
    return cats.map((categoryRaw) => {
      const category = String(categoryRaw);
      const meta = REFERRAL_CATEGORY_META[category] || { shortName: category, icon: DollarSign };
      const catLeads = (leads || []).filter((l) => (l.referralSourceCategory || 'Other') === category);
      const total = catLeads.length;
      const converted = catLeads.filter((l) => l.stage === 'Converted').length;
      const lost = catLeads.filter((l) => l.stage === 'Lost').length;
      const pending = total - converted - lost;
      const value = catLeads.reduce((acc, l) => acc + (l.quoteAmount || 0), 0);
      const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
      return {
        category,
        ...meta,
        total,
        converted,
        lost,
        pending,
        value,
        conversionRate: rate,
        topSource: catLeads[0]?.referralDetail || catLeads[0]?.socialMediaPlatform || category,
      };
    });
  }, [leads]);

  const totalReferralsCount = referralSourcesData.reduce((acc, s) => acc + s.total, 0);
  const totalConvertedReferrals = referralSourcesData.reduce((acc, s) => acc + s.converted, 0);
  const totalReferralValue = referralSourcesData.reduce((acc, s) => acc + s.value, 0);
  const overallReferralConversionRate =
    totalReferralsCount > 0 ? Math.round((totalConvertedReferrals / totalReferralsCount) * 100) : 0;

  // Exact mockup sequence (design/shco-portal-redesign): every donut leads with blue,
  // then green/purple/gold, with clay-orange as the 5th slice (top debtors/matters).
  const PIE_COLORS = [palette.blue, palette.green, palette.purple, palette.gold, '#B2542F'];

  // 5. Per-Partner KPI Matrix Data — roster is the real `users` list (role === 'Partner'),
  //    attribution via Case.partners (invoices/matters) and identity-token matching on
  //    Lead.assignedTo (referrals), not string-parsed ref segments or non-existent Lead fields.
  const partnersKPIMatrix = useMemo(() => {
    const partnerUsers = (users || []).filter((u) => u.role === 'Partner');
    return partnerUsers.map((u) => {
      const code = toPartnerCode(u) || 'SH';
      const tokens = identityTokens(u);

      const pInvoices = invoices.filter((i) => caseById.get(i.caseId)?.partners?.includes(code as any));
      const billed = pInvoices.reduce((acc, i) => acc + (i.total || 0), 0);
      const collected = pInvoices.filter((i) => i.status === 'Paid').reduce((acc, i) => acc + (i.total || 0), 0);
      const unpaid = Math.max(0, billed - collected);
      const efficiency = billed > 0 ? Math.round((collected / billed) * 100) : 0;

      const pLeads = leads.filter((l) => isMine(l.assignedTo, tokens));
      const referralsSourced = pLeads.length;
      const referralsConverted = pLeads.filter((l) => l.stage === 'Converted').length;
      const conversionRate = referralsSourced > 0 ? Math.round((referralsConverted / referralsSourced) * 100) : 0;

      const partnerCases = cases.filter((c) => c.partners?.includes(code as any));
      const activeMatters = partnerCases.filter((c) => c.status === 'Active').length;

      const pendingPVs = paymentVouchers.filter((pv) => !pv.approved && (pv.preparedBy === code || (!pv.approvedBy && code === 'SH'))).length;

      return {
        code,
        name: u.name,
        shortName: `${code} (${u.name.split(' ')[0]})`,
        role: u.staffProfile?.designation || u.role,
        billed,
        collected,
        unpaid,
        collectionEfficiency: efficiency,
        referralsSourced,
        referralsConverted,
        referralConversionRate: conversionRate,
        convertedRetainersValue: pLeads.filter((l) => l.stage === 'Converted').reduce((acc, l) => acc + (l.quoteAmount || 0), 0),
        activeMatters,
        resolutionRate: partnerCases.length > 0 ? Math.round((partnerCases.filter((c) => c.status === 'Closed').length / partnerCases.length) * 100) : 0,
        pendingPVs,
        targets: u.staffProfile?.targets || { billed: 50000, collected: 30000, files: 25, referrals: 10 },
        filesBrought: partnerCases.filter((c) => c.referredBy).length,
      };
    });
  }, [invoices, leads, cases, paymentVouchers, users, caseById]);

  // Target achievement — real, from each partner's own StaffProfile.targets (My Dashboard -> Edit targets),
  // not the previous hardcoded "108%" literal.
  const targetAchievementPct = useMemo(() => {
    if (effectivePartnerFilter !== 'ALL') {
      const row = partnersKPIMatrix.find((p) => p.code === effectivePartnerFilter);
      return row && row.targets.billed ? Math.round((row.billed / row.targets.billed) * 100) : 0;
    }
    const totalTarget = partnersKPIMatrix.reduce((s, p) => s + (p.targets.billed || 0), 0);
    return totalTarget ? Math.round((totalInvoiced / totalTarget) * 100) : 0;
  }, [partnersKPIMatrix, effectivePartnerFilter, totalInvoiced]);

  // 6. Referral Details Leads List — real fields: name, referralSourceCategory,
  //    referralDetail, assignedTo, quoteAmount, stage, followupDate.
  const partnerTokensByCode = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (users || []).filter((u) => u.role === 'Partner').forEach((u) => {
      const code = toPartnerCode(u);
      if (code) map.set(code, identityTokens(u));
    });
    return map;
  }, [users]);

  const referralLeadsList = useMemo(() => {
    return (leads || []).map((l) => {
      const picCode = (['SH', 'AH', 'ZA'] as const).find((code) => isMine(l.assignedTo, partnerTokensByCode.get(code) || new Set())) || 'SH';
      return {
        id: l.id,
        name: l.name || 'Lead',
        referrer: l.referralDetail || l.socialMediaPlatform || l.referralSourceCategory || 'Direct',
        category: l.referralSourceCategory || 'Other',
        partnerPIC: picCode,
        quoted: l.quoteAmount || 0,
        stage: l.stage === 'Converted' ? 'Converted' : l.stage === 'Lost' ? 'Lost' : 'In Progress',
        status: l.stage,
        date: l.followupDate || '',
        notes: l.practiceArea || '',
      };
    });
  }, [leads, partnerTokensByCode]);

  const filteredReferrals = referralLeadsList.filter((r) => {
    if (effectivePartnerFilter !== 'ALL' && r.partnerPIC !== effectivePartnerFilter) return false;
    if (referralSearch) {
      const q = referralSearch.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.referrer.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    }
    return true;
  });

  // Urgent Deadlines requiring Partner Oversight
  const urgentDeadlines = deadlines.filter((d) => d.priority === 'Urgent' || d.priority === 'High');

  // Custom Recharts Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#16223A] text-white p-3 rounded-xl border border-[#8A6D3B]/40 shadow-xl text-xs space-y-1.5 font-sans z-50">
          <p className="font-serif font-bold text-[#8A6D3B] border-b border-slate-700 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => {
            const nameLower = entry.name.toLowerCase();
            const isCurrency = nameLower.includes('revenue') || nameLower.includes('billed') || nameLower.includes('collected') || nameLower.includes('retainer') || nameLower.includes('value') || nameLower.includes('target');
            const isPercent = nameLower.includes('rate') || nameLower.includes('efficiency') || nameLower.includes('%');

            let formattedVal = entry.value;
            if (isCurrency) formattedVal = `RM ${Number(entry.value).toLocaleString('en-MY')}`;
            else if (isPercent) formattedVal = `${entry.value}%`;
            else formattedVal = `${entry.value}`;

            return (
              <div key={`tooltip-${index}`} className="flex justify-between items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5" style={{ color: entry.color || entry.fill }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span className="text-slate-200">{entry.name}:</span>
                </span>
                <span className="font-mono font-bold text-white">{formattedVal}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Sections from design/shco-portal-redesign that had no equivalent anywhere in this
  // file yet: revenue/collection-by-partner donuts, top-5 debtors/matters, debtors aging +
  // unbilled summary bars, and new-open-matters by month. Built from the same real data
  // (invoices/cases/timeEntries/expenses) already used elsewhere in this component.
  const revenueByPartner = useMemo(() => partnersKPIMatrix.map((p) => ({ label: p.name.split(' ')[0], value: p.billed, color: '' })), [partnersKPIMatrix]);
  const collectionByPartner = useMemo(() => partnersKPIMatrix.map((p) => ({ label: p.name.split(' ')[0], value: p.collected, color: '' })), [partnersKPIMatrix]);

  const top5Debtors = useMemo(() => {
    const byClient = new Map<string, { name: string; amount: number }>();
    invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Voided').forEach((i) => {
      const key = i.clientId || i.partyName || 'Unknown';
      const existing = byClient.get(key) || { name: i.partyName || 'Client', amount: 0 };
      existing.amount += Number(i.total || 0);
      byClient.set(key, existing);
    });
    return Array.from(byClient.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [invoices]);

  const top5Matters = useMemo(() => {
    const byCase = new Map<string, { ref: string; amount: number }>();
    invoices.forEach((i) => {
      const cs = cases.find((c) => c.id === i.caseId || c.ref === i.fileRef);
      if (!cs) return;
      const existing = byCase.get(cs.id) || { ref: cs.ref, amount: 0 };
      existing.amount += Number(i.total || 0);
      byCase.set(cs.id, existing);
    });
    return Array.from(byCase.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [invoices, cases]);

  const agingBuckets5 = useMemo(() => {
    const buckets = { current: 0, d31: 0, d61: 0, d91: 0, over120: 0 };
    invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Voided').forEach((i) => {
      const balance = Number(i.total || 0);
      const due = i.dueDate || i.date;
      const days = due ? Math.floor((Date.now() - new Date(due).getTime()) / 86400000) : 0;
      if (days <= 30) buckets.current += balance;
      else if (days <= 60) buckets.d31 += balance;
      else if (days <= 90) buckets.d61 += balance;
      else if (days <= 120) buckets.d91 += balance;
      else buckets.over120 += balance;
    });
    return buckets;
  }, [invoices]);

  const unbilledAgingByType = useMemo(() => {
    const bucketOf = (dateStr?: string) => {
      const days = dateStr ? Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000) : 0;
      if (days <= 30) return 0;
      if (days <= 60) return 1;
      if (days <= 90) return 2;
      if (days <= 120) return 3;
      return 4;
    };
    const time = [0, 0, 0, 0, 0];
    const disb = [0, 0, 0, 0, 0];
    timeEntries.filter((t) => t.billable && !t.billed).forEach((t) => { time[bucketOf(t.date)] += Number(t.hours || 0) * Number(t.rate || 0); });
    expenses.filter((e) => e.billable && !e.billed).forEach((e) => { disb[bucketOf(e.date)] += Number(e.amount || 0); });
    return { time, disb };
  }, [timeEntries, expenses]);

  const newMattersByMonth = useMemo(() => {
    const counts = Array(12).fill(0);
    cases.forEach((c) => {
      const opened = c.fileOpenedDate || c.createdDate;
      if (!opened) return;
      const d = new Date(opened);
      if (d.getFullYear() === new Date().getFullYear()) counts[d.getMonth()]++;
    });
    return counts;
  }, [cases]);

  return (
    <div className="space-y-6 text-xs font-sans pb-12">
      {/* Top Banner & Executive Header Controls */}
      <div className="bg-[#16223A] text-white p-5 rounded-2xl shadow-md border border-[#233554] space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#8A6D3B] text-[#16223A] uppercase tracking-wider shadow-2xs">
                CONFIDENTIAL PARTNER PORTAL
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#8A6D3B]" />
              Partner Dashboard — all-partners summary
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Compares every partner's practice, side by side — for your own record, see My Dashboard.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => showToast('Generating confidential Partner Executive Financial PDF Report...')}
              className="px-3 py-2 bg-[#8A6D3B] hover:bg-[#8A6D3B] text-[#16223A] font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export Executive Report</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="pt-3 border-t border-slate-700/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Timeframe:</span>
            <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
              {(['MTD', 'QTD', 'YTD', 'ALL'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    timeframe === tf
                      ? 'bg-white text-[#16223A] font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf === 'MTD' ? 'This Month' : tf === 'QTD' ? 'This Quarter' : tf === 'YTD' ? 'YTD 2026' : 'All Time'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Firm Financial KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Billed */}
        <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
              {effectivePartnerFilter === 'ALL' ? 'Firm Revenue Billed' : `${effectivePartnerFilter} Billed Revenue`}
            </span>
            <span className="p-2 bg-[#E7EEF6] text-[#3D6B9C] rounded-lg border border-[#E7EEF6]">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#16223A] mt-1">
            RM {totalInvoiced.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            <span>Target Achievement:</span>
            <span className={`font-bold flex items-center gap-0.5 ${targetAchievementPct >= 100 ? 'text-[#2F6F4E]' : 'text-[#8A6D3B]'}`}>
              <TrendingUp className="w-3.5 h-3.5" /> {targetAchievementPct}%
            </span>
          </div>
        </div>

        {/* Total Collections */}
        <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
              {effectivePartnerFilter === 'ALL' ? 'Total Collected Cash' : `${effectivePartnerFilter} Cash Collected`}
            </span>
            <span className="p-2 bg-[#E6EFE9] text-[#2F6F4E] rounded-lg border border-[#E6EFE9]">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#2F6F4E] mt-1">
            RM {totalPaidInvoices.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            <span>Collection Efficiency:</span>
            <span className="font-extrabold text-[#2F6F4E] bg-[#E6EFE9] px-1.5 py-0.2 rounded border border-[#E6EFE9]">
              {collectionRatePct}% Rate
            </span>
          </div>
        </div>

        {/* Unpaid / Aging Debtors */}
        <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
              Aged Debtors Outstanding
            </span>
            <span className="p-2 bg-[#FBEDE9] text-[#B23A2E] rounded-lg border border-[#FBEDE9]">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#B23A2E] mt-1">
            RM {totalUnpaidInvoices.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            <span>Over 30 Days:</span>
            <span className="font-bold text-[#B23A2E] bg-[#FBEDE9] px-1.5 py-0.2 rounded border border-[#FBEDE9]">
              RM {over30DaysOutstanding.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Referral Conversion Metric */}
        <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
              Referrals Retainer Value
            </span>
            <span className="p-2 bg-[#FBF2E9] text-[#8A6D3B] rounded-lg border border-[#FBF2E9]">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#16223A] mt-1">
            RM {totalReferralValue.toLocaleString('en-MY')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            <span>Overall Conversion:</span>
            <span className="font-extrabold text-[#8A6D3B] bg-[#FBF2E9] px-1.5 py-0.2 rounded border border-[#FBF2E9]">
              {overallReferralConversionRate}% ({totalConvertedReferrals}/{totalReferralsCount} converted)
            </span>
          </div>
        </div>
      </div>

      {/* Targets — everyone's progress, from each partner's own StaffProfile.targets */}
      <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-base font-bold flex items-center gap-2" style={{ color: palette.navy }}>
            <Target className="w-4.5 h-4.5" style={{ color: palette.gold }} />
            Targets — everyone's progress
            <span className="text-[10px] font-normal text-slate-400">· {timeframe === 'MTD' ? 'This Month' : timeframe === 'QTD' ? 'This Quarter' : timeframe === 'YTD' ? 'YTD' : 'All Time'}</span>
          </h2>
        </div>
        <div className="space-y-4">
          {partnersKPIMatrix.map((p) => (
            <div key={p.code} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
              <p className="mb-2 text-[12.5px] font-bold text-[#16223A]">{p.name}</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ProgressBar
                  label="Billed"
                  pct={p.targets.billed ? (p.billed / p.targets.billed) * 100 : 0}
                  color={palette.gold}
                  valueLabel={<span className="text-[11px] text-[#5B6478]">RM {p.billed.toLocaleString()} / {p.targets.billed.toLocaleString()}</span>}
                />
                <ProgressBar
                  label="Collected"
                  pct={p.targets.collected ? (p.collected / p.targets.collected) * 100 : 0}
                  color={palette.green}
                  valueLabel={<span className="text-[11px] text-[#5B6478]">RM {p.collected.toLocaleString()} / {p.targets.collected.toLocaleString()}</span>}
                />
                <ProgressBar
                  label="Files brought"
                  pct={p.targets.files ? (p.filesBrought / p.targets.files) * 100 : 0}
                  color={palette.blue}
                  valueLabel={<span className="text-[11px] text-[#5B6478]">{p.filesBrought} / {p.targets.files}</span>}
                />
                <ProgressBar
                  label="Referrals converted"
                  pct={p.targets.referrals ? (p.referralsConverted / p.targets.referrals) * 100 : 0}
                  color={palette.purple}
                  valueLabel={<span className="text-[11px] text-[#5B6478]">{p.referralsConverted} / {p.targets.referrals}</span>}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] text-slate-400">Targets are set per partner in My Dashboard → My Performance → Edit targets.</p>
      </div>

      {/* Revenue / collection split by partner + top-5 debtors / matters — mockup's donut pairs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-[15px] font-bold text-[#16223A]">Total revenue by partner</h3>
            <span className="text-[10px] font-semibold text-[#5B6478]">YTD 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Donut
              segments={revenueByPartner.map((d, i) => ({ label: d.label, value: d.value, color: PIE_COLORS[i % PIE_COLORS.length] }))}
              centerLabel={`RM ${(revenueByPartner.reduce((s, d) => s + d.value, 0) / 1000).toFixed(1)}k`}
              centerSub="billed"
            />
            <div className="flex-1 space-y-2">
              {revenueByPartner.map((d, i) => {
                const total = revenueByPartner.reduce((s, x) => s + x.value, 0) || 1;
                return (
                  <div key={d.label} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-[#16223A]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.label}
                    </span>
                    <span className="font-semibold text-[#5B6478]">{Math.round((d.value / total) * 100)}% · RM {d.value.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-[15px] font-bold text-[#16223A]">Total collection by partner</h3>
            <span className="text-[10px] font-semibold text-[#5B6478]">YTD 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Donut
              segments={collectionByPartner.map((d, i) => ({ label: d.label, value: d.value, color: PIE_COLORS[i % PIE_COLORS.length] }))}
              centerLabel={`RM ${(collectionByPartner.reduce((s, d) => s + d.value, 0) / 1000).toFixed(1)}k`}
              centerSub="collected"
            />
            <div className="flex-1 space-y-2">
              {collectionByPartner.map((d, i) => {
                const total = collectionByPartner.reduce((s, x) => s + x.value, 0) || 1;
                return (
                  <div key={d.label} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-[#16223A]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.label}
                    </span>
                    <span className="font-semibold text-[#5B6478]">{Math.round((d.value / total) * 100)}% · RM {d.value.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="font-serif text-[15px] font-bold text-[#16223A]">Top 5 debtors</h3>
          <div className="flex items-center gap-6">
            <Donut
              segments={top5Debtors.map((d, i) => ({ label: d.name, value: d.amount, color: PIE_COLORS[i % PIE_COLORS.length] }))}
              centerLabel={`RM ${(top5Debtors.reduce((s, d) => s + d.amount, 0) / 1000).toFixed(1)}k`}
              centerSub="outstanding"
            />
            <ol className="flex-1 space-y-1.5">
              {top5Debtors.map((d, i) => {
                const total = top5Debtors.reduce((s, x) => s + x.amount, 0) || 1;
                return (
                  <li key={d.name} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-[#16223A]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {i + 1}. {d.name}
                    </span>
                    <span className="font-semibold text-[#5B6478]">{Math.round((d.amount / total) * 100)}% · RM {d.amount.toLocaleString()}</span>
                  </li>
                );
              })}
              {top5Debtors.length === 0 && <li className="text-[11px] text-slate-400">No outstanding debtors.</li>}
            </ol>
          </div>
        </div>
        <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="font-serif text-[15px] font-bold text-[#16223A]">Top 5 matters by revenue</h3>
          <div className="flex items-center gap-6">
            <Donut
              segments={top5Matters.map((d, i) => ({ label: d.ref, value: d.amount, color: PIE_COLORS[i % PIE_COLORS.length] }))}
              centerLabel={`RM ${(top5Matters.reduce((s, d) => s + d.amount, 0) / 1000).toFixed(1)}k`}
              centerSub="billed"
            />
            <ol className="flex-1 space-y-1.5">
              {top5Matters.map((d, i) => {
                const total = top5Matters.reduce((s, x) => s + x.amount, 0) || 1;
                return (
                  <li key={d.ref} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="font-mono text-[#3D6B9C]">{d.ref}</span>
                    </span>
                    <span className="font-semibold text-[#5B6478]">{Math.round((d.amount / total) * 100)}% · RM {d.amount.toLocaleString()}</span>
                  </li>
                );
              })}
              {top5Matters.length === 0 && <li className="text-[11px] text-slate-400">No billed matters yet.</li>}
            </ol>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="font-serif text-[15px] font-bold text-[#16223A]">Debtors aging summary</h3>
          <MiniBarChart
            showValue
            formatValue={(v) => `${(v / 1000).toFixed(1)}k`}
            data={[
              { label: 'Current', value: agingBuckets5.current, color: palette.blue },
              { label: '31-60', value: agingBuckets5.d31, color: palette.blue },
              { label: '61-90', value: agingBuckets5.d61, color: palette.blue },
              { label: '91-120', value: agingBuckets5.d91, color: palette.blue },
              { label: 'Above 120', value: agingBuckets5.over120, color: palette.red },
            ]}
          />
        </div>
        <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-[15px] font-bold text-[#16223A]">Unbilled items summary</h3>
            <span className="text-[10px] font-semibold text-[#5B6478]">time &amp; disbursements</span>
          </div>
          <MiniBarChart
            showValue
            formatValue={(v) => `${(v / 1000).toFixed(1)}k`}
            data={['Current', '31-60', '61-90', '91-120', 'Above 120'].flatMap((label, i) => [
              { label, value: unbilledAgingByType.time[i], color: palette.blue },
              { label, value: unbilledAgingByType.disb[i], color: palette.gold },
            ])}
          />
          <div className="flex items-center gap-4 text-[10.5px] text-[#5B6478]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: palette.blue }} />Time entries</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: palette.gold }} />Disbursements</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-[15px] font-bold text-[#16223A]">New open matters</h3>
          <span className="text-[10px] font-semibold text-[#5B6478]">by month, {new Date().getFullYear()} · {newMattersByMonth.reduce((s, v) => s + v, 0)} total</span>
        </div>
        <MiniBarChart
          showValue
          data={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, i) => ({
            label,
            value: newMattersByMonth[i],
            color: palette.blue,
          }))}
        />
      </div>

      {/* SECTION 2: Referral Source Tracking & Conversion Charts */}
      <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#8A6D3B]" />
                Referral Sources &amp; Conversion Performance Analytics
              </h2>
              <span className="bg-[#FBF2E9] text-[#8A6D3B] font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-[#8A6D3B]">
                {overallReferralConversionRate}% Conversion Rate
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualizing lead acquisition channels, conversion efficiency into active files, and generated retainer value.
            </p>
          </div>
        </div>

        {/* Dual Recharts Grid for Referral Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart: Leads Sourced vs Converted per Channel */}
          <div className="lg:col-span-2 bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-sm font-bold text-[#16223A]">
                Referred Leads vs Converted Files by Source Channel
              </h3>
              <span className="text-[10.5px] font-mono text-slate-500">
                Total Leads: {totalReferralsCount} | Converted: {totalConvertedReferrals}
              </span>
            </div>

            <div className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={referralSourcesData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="total" name="Total Referred Leads" fill={palette.navy} radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="converted" name="Converted Files" fill={palette.green} radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart: Retainer Value Distribution */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-sm font-bold text-[#16223A] flex items-center gap-1.5">
                <LucidePieChart className="w-4 h-4 text-[#8A6D3B]" />
                <span>Retainer Value Share</span>
              </h3>
              <span className="font-mono text-xs font-bold text-[#8A6D3B]">
                RM {(totalReferralValue / 1000).toFixed(0)}k
              </span>
            </div>

            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={referralSourcesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="shortName"
                  >
                    {referralSourcesData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            {/* Custom Pie Legend list */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200">
              {referralSourcesData.map((src, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="truncate text-slate-700 font-medium">{src.shortName}:</span>
                  <span className="font-mono font-bold text-[#16223A] shrink-0">RM{(src.value / 1000).toFixed(0)}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Referrals Register Table */}
        <div className="pt-2 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="font-serif text-sm font-bold text-[#16223A] flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#8A6D3B]" />
              <span>Referrals Register &amp; Lead Conversion Tracking</span>
            </h3>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search referrer or lead..."
                value={referralSearch}
                onChange={(e) => setReferralSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#16223A] text-white text-[10.5px] uppercase tracking-wider font-bold">
                  <th className="p-3">Ref Lead / Matter Name</th>
                  <th className="p-3">Referrer &amp; Source Channel</th>
                  <th className="p-3 text-center">Partner PIC</th>
                  <th className="p-3 text-right">Quoted Retainer (RM)</th>
                  <th className="p-3 text-center">Conversion Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReferrals.map((refItem) => (
                  <tr key={refItem.id} className="hover:bg-[#F6F8FA] transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-[#16223A]">{refItem.name}</div>
                      <div className="text-[10px] text-slate-500">{refItem.notes}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{refItem.referrer}</div>
                      <div className="text-[10px] text-[#8A6D3B] font-medium">{refItem.category}</div>
                    </td>
                    <td className="p-3 text-center font-bold">
                      <span className="ref-seal">{refItem.partnerPIC}</span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                      RM {refItem.quoted.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          refItem.status === 'Converted'
                            ? 'bg-[#E6EFE9] text-[#2F6F4E] border border-[#2F6F4E]'
                            : refItem.status === 'Lost'
                            ? 'bg-[#FBEDE9] text-[#B23A2E] border border-[#B23A2E]'
                            : 'bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]'
                        }`}
                      >
                        {refItem.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => showToast(`Opened lead conversion workflow for ${refItem.name}`)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-[#16223A] font-bold text-[10.5px] rounded-lg transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Extra real feature beyond the mockup's Partner Dashboard scope — kept, but placed
          after every mockup section so the mockup's own sequence stays intact end to end. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue & Collection Composed Chart */}
        <div className="lg:col-span-2 bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-serif text-base font-bold text-[#16223A] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#8A6D3B]" />
                <span>Monthly Collection Trends &amp; Revenue Chart (2026 YTD)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Interactive Recharts visualization comparing monthly billed fees, cash collections, target trajectories, and efficiency %.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10.5px]">
              <span className="bg-[#E6EFE9] text-[#2F6F4E] border border-[#E6EFE9] font-extrabold px-2 py-0.5 rounded">
                YTD Avg Efficiency: 92.1%
              </span>
            </div>
          </div>

          {/* Recharts Composed Chart */}
          <div className="w-full h-[320px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={(val) => `RM ${(val / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" domain={[70, 100]} tick={{ fontSize: 11, fill: '#D97706' }} tickFormatter={(val) => `${val}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar yAxisId="left" dataKey="billed" name="Billed Revenue (RM)" fill={palette.navy} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar yAxisId="left" dataKey="collected" name="Cash Collected (RM)" fill={palette.green} radius={[4, 4, 0, 0]} barSize={20} />
                <Line yAxisId="left" type="monotone" dataKey="target" name="Monthly Target (RM)" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="collectionRate" name="Collection Efficiency (%)" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: '#2563EB' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Date-wise Daily Collections Log */}
        <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-serif text-base font-bold text-[#16223A] flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-[#2F6F4E]" />
                  <span>Date-wise Collections Audit</span>
                </h3>
                <p className="text-[10.5px] text-slate-500">Live ledger of incoming office &amp; client account receipts.</p>
              </div>
            </div>

            {/* Collection Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search date, client, or ref..."
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Collection Items List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {filteredCollections.map((col) => (
                <div key={col.id} className="p-3 bg-slate-50 hover:bg-[#FBF2E9]/50 border border-slate-200 rounded-xl transition-all space-y-1 shadow-2xs">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {col.date}
                    </span>
                    <span className="font-mono font-extrabold text-[#2F6F4E] text-xs">
                      +RM {col.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-[#16223A] truncate">{col.client}</div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                    <span className="truncate max-w-[140px]">{col.ref}</span>
                    <span className="font-semibold text-[#8A6D3B] bg-[#FBF2E9] px-1.5 py-0.2 rounded border border-[#FBF2E9]">
                      PIC: {col.partner}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => showToast('Opening complete SAR 1990 Receipts Ledger...')}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-[#16223A] font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-1"
          >
            <span>View Full SAR Receipts Ledger</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SECTION 3: Per-Partner KPI & Benchmark Comparative Charts */}
      <div className="bg-white border border-[#DDE3EB] rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#8A6D3B]" />
              Comparative Partner KPI Benchmarks &amp; Performance Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Side-by-side benchmark comparison between Partners (Syafiqah Hamizad, Amer Haiqal, Zulaikha Afendi).
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1">
            {(
              [
                { id: 'REVENUE', label: 'Billed vs Collected' },
                { id: 'REFERRALS', label: 'Referrals Benchmark' },
                { id: 'EFFICIENCY', label: 'Collection Efficiency %' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPartnerBenchmarkMetric(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  partnerBenchmarkMetric === tab.id
                    ? 'bg-[#16223A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Comparative Recharts Visualization */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-serif font-bold text-[#16223A]">
              {partnerBenchmarkMetric === 'REVENUE'
                ? 'Financial Benchmark: Billed Revenue vs Cash Collected (RM)'
                : partnerBenchmarkMetric === 'REFERRALS'
                ? 'Referral Benchmark: Leads Sourced vs Converted Files'
                : 'Efficiency Benchmark: Collection Rate % & Resolution Rate %'}
            </span>
            <span className="text-[10px] text-slate-500 italic">Inter-Partner Comparative Analytics</span>
          </div>

          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {partnerBenchmarkMetric === 'REVENUE' ? (
                <BarChart data={partnersKPIMatrix} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={(val) => `RM ${(val / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="billed" name="Billed Revenue (RM)" fill={palette.navy} radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="collected" name="Cash Collected (RM)" fill={palette.green} radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              ) : partnerBenchmarkMetric === 'REFERRALS' ? (
                <BarChart data={partnersKPIMatrix} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="referralsSourced" name="Referrals Sourced" fill={palette.blue} radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="referralsConverted" name="Converted Files" fill={palette.green} radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              ) : (
                <BarChart data={partnersKPIMatrix} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={(val) => `${val}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="collectionEfficiency" name="Collection Efficiency (%)" fill={palette.gold} radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="resolutionRate" name="Matter Resolution Rate (%)" fill={palette.blue} radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Partner Comparison Matrix Table */}
        <div className="pt-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#16223A] text-white text-[10.5px] uppercase tracking-wider font-bold">
                  <th className="p-3">Partner Name</th>
                  <th className="p-3 text-center">Ref Tag</th>
                  <th className="p-3 text-right">Billed Fees (RM)</th>
                  <th className="p-3 text-right">Collected (RM)</th>
                  <th className="p-3 text-center">Collection %</th>
                  <th className="p-3 text-center">Referrals Sourced</th>
                  <th className="p-3 text-center">Converted %</th>
                  <th className="p-3 text-right">Converted Retainer (RM)</th>
                  <th className="p-3 text-center">Active Matters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partnersKPIMatrix.map((p) => (
                  <tr key={p.code} className="hover:bg-[#F6F8FA] transition-colors">
                    <td className="p-3 font-bold text-[#16223A]">{p.name}</td>
                    <td className="p-3 text-center">
                      <span className="ref-seal">{p.code}</span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">
                      RM {p.billed.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-[#2F6F4E]">
                      RM {p.collected.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center font-bold">
                      <span className="bg-[#E6EFE9] text-[#2F6F4E] border border-[#E6EFE9] px-2 py-0.5 rounded text-[11px]">
                        {p.collectionEfficiency}%
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800">{p.referralsSourced}</td>
                    <td className="p-3 text-center font-bold text-[#8A6D3B]">{p.referralConversionRate}%</td>
                    <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                      RM {p.convertedRetainersValue.toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-bold text-[#3D6B9C]">{p.activeMatters}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 4: High-Risk Statutory Limitations & Pending Partner Approvals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Urgent Limitation & Court Order Deadlines */}
        <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-serif text-sm font-bold text-[#16223A] flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5 text-[#B23A2E]" />
              <span>High Risk Litigation Deadlines &amp; Limitation Audit</span>
            </h3>
            <span className="text-[10px] text-[#B23A2E] bg-[#FBEDE9] px-2 py-0.5 rounded font-bold border border-[#FBEDE9]">
              Partner Oversight
            </span>
          </div>

          <div className="space-y-2">
            {urgentDeadlines.map((d) => {
              const cs = cases.find((c) => c.id === d.caseId);
              return (
                <div
                  key={d.id}
                  className="p-3 bg-[#FBEDE9]/70 border border-[#FBEDE9] rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#B23A2E] text-xs">{d.title}</span>
                      <span className="ref-seal">{cs ? cs.ref : '—'}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      PIC: <strong>{d.partner}</strong> | Lawyer: <strong>{d.lawyer}</strong> | Matter: <strong>{cs?.title || 'Court File'}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[#B23A2E] font-bold text-xs bg-white px-2 py-0.5 rounded border border-[#B23A2E]">
                      Due: {d.dueDate}
                    </span>
                    <button
                      type="button"
                      onClick={() => showToast(`Opened deadline review for ${d.title}`)}
                      className="px-2.5 py-1 bg-[#B23A2E] hover:bg-[#B23A2E] text-white font-bold text-[10.5px] rounded-lg cursor-pointer"
                    >
                      Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Payment Voucher Authorization */}
        <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-serif text-sm font-bold text-[#16223A] flex items-center gap-2">
              <FileCheck className="w-4.5 h-4.5 text-[#8A6D3B]" />
              <span>Pending Payment Voucher Sign-Offs ({paymentVouchers.filter((pv) => !pv.approved).length})</span>
            </h3>
            <span className="text-[10px] text-[#8A6D3B] bg-[#FBF2E9] px-2 py-0.5 rounded font-bold border border-[#8A6D3B]">
              SAR 1990 Approval
            </span>
          </div>

          <div className="space-y-2">
            {paymentVouchers.filter((pv) => !pv.approved).length === 0 ? (
              <p className="text-xs text-slate-400 italic">No pending payment vouchers awaiting partner authorization.</p>
            ) : (
              paymentVouchers
                .filter((pv) => !pv.approved)
                .map((pv) => (
                  <div key={pv.id} className="p-3 bg-[#FBF2E9]/70 border border-[#FBF2E9] rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#8A6D3B] text-xs">{pv.id}</span>
                        <span className="text-[10px] font-bold bg-[#FBF2E9] text-[#8A6D3B] px-1.5 py-0.2 rounded uppercase">
                          {pv.accountSet} ACCOUNT
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 mt-0.5">{pv.description}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-extrabold text-[#16223A] text-xs">
                        RM {pv.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => showToast(`Payment Voucher ${pv.id} approved by Partner.`)}
                        className="px-2.5 py-1 bg-[#8A6D3B] hover:bg-[#8A6D3B] text-[#16223A] font-extrabold text-[10.5px] rounded-lg cursor-pointer"
                      >
                        Sign Off
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
