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
  Filter,
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

export const PartnerDashboardView: React.FC = () => {
  const {
    currentRole,
    currentPartnerCode,
    isAdmin,
    cases,
    invoices,
    quotations,
    leads,
    deadlines,
    paymentVouchers,
    receipts,
    referralPartners,
    showToast,
  } = useApp();

  // Filters & State
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<'ALL' | 'SH' | 'AH' | 'ZA'>('ALL');
  const [timeframe, setTimeframe] = useState<'MTD' | 'QTD' | 'YTD' | 'ALL'>('YTD');
  const [referralSearch, setReferralSearch] = useState<string>('');
  const [collectionSearch, setCollectionSearch] = useState<string>('');
  const [partnerBenchmarkMetric, setPartnerBenchmarkMetric] = useState<'REVENUE' | 'REFERRALS' | 'EFFICIENCY'>('REVENUE');

  const isPartner = currentRole === 'Partner' || isAdmin;
  const effectivePartnerFilter = isAdmin ? selectedPartnerFilter : currentPartnerCode;

  if (!isPartner) {
    return (
      <div className="bg-white border border-[#E1DCCF] p-8 rounded-xl shadow-xs text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-16 h-16 bg-rose-50 text-rose-700 rounded-full flex items-center justify-center mx-auto border border-rose-200">
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

  // 1. Calculate totals based on partner filter
  const partnerFilteredCases = cases.filter(
    (cs) =>
      effectivePartnerFilter === 'ALL' ||
      cs.ref.includes(`/${effectivePartnerFilter}/`) ||
      cs.partners?.includes(effectivePartnerFilter as any)
  );

  const partnerFilteredInvoices = invoices.filter(
    (i) =>
      effectivePartnerFilter === 'ALL' ||
      i.fileRef?.includes(`/${effectivePartnerFilter}/`)
  );

  const totalInvoiced = partnerFilteredInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
  const totalPaidInvoices = partnerFilteredInvoices
    .filter((inv) => inv.status === 'Paid')
    .reduce((acc, inv) => acc + (inv.total || 0), 0);
  const totalUnpaidInvoices = Math.max(0, totalInvoiced - totalPaidInvoices);
  const collectionRatePct = totalInvoiced > 0 ? Math.round((totalPaidInvoices / totalInvoiced) * 100) : 0;

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
      const partner = r.fileRef
        ? r.fileRef.split('/')[2] || 'SH'
        : matchCase?.ref
        ? matchCase.ref.split('/')[2] || 'SH'
        : 'SH';
      return {
        id: r.id,
        date: r.date,
        client: r.receivedFrom || 'Client',
        ref: r.fileRef || matchCase?.ref || 'SHC/GENERAL',
        amount: r.amount || 0,
        bank: r.accountSet === 'CLIENT' ? '1020 Client Trust Account' : '1010 Office General',
        method: r.bankRef || 'Bank Transfer',
        partner,
        type: r.description || 'Collection',
      };
    });
  }, [receipts, cases]);

  // Filtered collections
  const filteredCollections = rawCollections.filter((c) => {
    if (effectivePartnerFilter !== 'ALL' && c.partner !== effectivePartnerFilter) return false;
    if (
      collectionSearch &&
      !c.client.toLowerCase().includes(collectionSearch.toLowerCase()) &&
      !c.ref.toLowerCase().includes(collectionSearch.toLowerCase())
    )
      return false;
    return true;
  });

  // 4. Referral Sources Breakdown Data derived from leads
  const referralCategories = [
    { category: 'Other Law Firms / Bar Alumni', shortName: 'Bar Alumni', icon: Building2 },
    { category: 'Existing Satisfied Clients', shortName: 'Clients', icon: Users },
    { category: 'Bank Panels & Financial Ins.', shortName: 'Bank Panels', icon: DollarSign },
    { category: 'Personal & Network Alliances', shortName: 'Networks', icon: Award },
    { category: 'Digital / Web & Social Media', shortName: 'Digital / Web', icon: Sparkles },
  ];

  const referralSourcesData = useMemo(() => {
    return referralCategories.map((cat) => {
      const catLeads = (leads || []).filter(
        (l) => l.source === cat.category || (cat.category.includes('Digital') && (l.source === 'Website' || l.source === 'Social Media'))
      );
      const total = catLeads.length;
      const converted = catLeads.filter((l) => l.status === 'Converted').length;
      const lost = catLeads.filter((l) => l.status === 'Lost').length;
      const pending = total - converted - lost;
      const value = catLeads.reduce((acc, l) => acc + (l.estimatedValue || 0), 0);
      const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
      return {
        ...cat,
        total,
        converted,
        lost,
        pending,
        value,
        conversionRate: rate,
        topSource: catLeads[0]?.referrer || catLeads[0]?.contact || 'None',
      };
    });
  }, [leads]);

  const totalReferralsCount = referralSourcesData.reduce((acc, s) => acc + s.total, 0);
  const totalConvertedReferrals = referralSourcesData.reduce((acc, s) => acc + s.converted, 0);
  const totalReferralValue = referralSourcesData.reduce((acc, s) => acc + s.value, 0);
  const overallReferralConversionRate =
    totalReferralsCount > 0 ? Math.round((totalConvertedReferrals / totalReferralsCount) * 100) : 0;

  const PIE_COLORS = ['#16223A', '#10B981', '#D97706', '#2563EB', '#8B5CF6'];

  // 5. Per-Partner KPI Matrix Data
  const partnersKPIMatrix = useMemo(() => {
    const partnerList = [
      { code: 'SH', name: 'Syafiqah Hamizad', shortName: 'SH (Syafiqah)', role: 'Managing Partner' },
      { code: 'AH', name: 'Amer Haiqal', shortName: 'AH (Amer)', role: 'Senior Litigation Partner' },
      { code: 'ZA', name: 'Zulaikha Afendi', shortName: 'ZA (Zulaikha)', role: 'Conveyancing & Corporate Partner' },
    ];

    return partnerList.map((p) => {
      const pInvoices = invoices.filter((i) => i.fileRef?.includes(`/${p.code}/`));
      const billed = pInvoices.reduce((acc, i) => acc + (i.total || 0), 0);
      const collected = pInvoices.filter((i) => i.status === 'Paid').reduce((acc, i) => acc + (i.total || 0), 0);
      const unpaid = Math.max(0, billed - collected);
      const efficiency = billed > 0 ? Math.round((collected / billed) * 100) : 0;

      const pLeads = leads.filter((l) => l.partnerPIC === p.code || l.referredBy === p.code);
      const referralsSourced = pLeads.length;
      const referralsConverted = pLeads.filter((l) => l.status === 'Converted').length;
      const conversionRate = referralsSourced > 0 ? Math.round((referralsConverted / referralsSourced) * 100) : 0;

      const activeMatters = cases.filter(
        (c) => (c.ref?.includes(`/${p.code}/`) || c.partners?.includes(p.code as any)) && c.status === 'Active'
      ).length;

      const pendingPVs = paymentVouchers.filter(
        (pv) => !pv.approved && (pv.preparedBy === p.code || (!pv.approvedBy && p.code === 'SH'))
      ).length;

      return {
        ...p,
        billed,
        collected,
        unpaid,
        collectionEfficiency: efficiency,
        referralsSourced,
        referralsConverted,
        referralConversionRate: conversionRate,
        convertedRetainersValue: pLeads
          .filter((l) => l.status === 'Converted')
          .reduce((acc, l) => acc + (l.estimatedValue || 0), 0),
        activeMatters,
        resolutionRate: cases.filter((c) => c.ref?.includes(`/${p.code}/`)).length > 0 ? 100 : 0,
        pendingPVs,
      };
    });
  }, [invoices, leads, cases, paymentVouchers]);

  // 6. Referral Details Leads List
  const referralLeadsList = useMemo(() => {
    return (leads || []).map((l) => ({
      id: l.id,
      name: l.clientName || 'Lead Client',
      referrer: l.referrer || l.source || 'Direct',
      category: l.source || 'General',
      partnerPIC: l.partnerPIC || 'SH',
      quoted: l.estimatedValue || 0,
      stage: l.status === 'Converted' ? 'Converted' : 'In Progress',
      status: l.status,
      date: l.date || '2026-08-01',
      notes: l.notes || l.areaOfLaw || '',
    }));
  }, [leads]);

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
        <div className="bg-[#16223A] text-white p-3 rounded-xl border border-amber-400/40 shadow-xl text-xs space-y-1.5 font-sans z-50">
          <p className="font-serif font-bold text-amber-300 border-b border-slate-700 pb-1">{label}</p>
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

  return (
    <div className="space-y-6 text-xs font-sans pb-12">
      {/* Top Banner & Executive Header Controls */}
      <div className="bg-[#16223A] text-white p-5 rounded-2xl shadow-md border border-[#233554] space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-[#16223A] uppercase tracking-wider shadow-2xs">
                CONFIDENTIAL PARTNER PORTAL
              </span>
              <span className="text-[10.5px] text-amber-200/90 font-mono font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Messrs Syafiqah Hamizad &amp; Co Analytics Engine
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-amber-400" />
              Executive Partner Dashboard &amp; Interactive Charts
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Real-time firm revenue trends, partner KPI benchmark comparisons, referral channel conversion charts, and live date-wise collection audit ledgers.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => showToast('Generating confidential Partner Executive Financial PDF Report...')}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-[#16223A] font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export Executive Report</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="pt-3 border-t border-slate-700/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          {/* Partner Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>{isAdmin ? 'Partner Filter:' : 'Assigned Partner:'}</span>
            </span>
            <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
              {(
                [
                  { code: 'ALL', label: 'All Firm' },
                  { code: 'SH', label: 'SH (Syafiqah)' },
                  { code: 'AH', label: 'AH (Amer)' },
                  { code: 'ZA', label: 'ZA (Zulaikha)' },
                ] as const
              ).map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => isAdmin && setSelectedPartnerFilter(p.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isAdmin ? 'cursor-pointer' : 'cursor-default'} ${
                    effectivePartnerFilter === p.code
                      ? 'bg-amber-400 text-[#16223A] shadow-xs font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

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
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
              {effectivePartnerFilter === 'ALL' ? 'Firm Revenue Billed' : `${effectivePartnerFilter} Billed Revenue`}
            </span>
            <span className="p-2 bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#16223A] mt-1">
            RM {totalInvoiced.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            <span>Target Achievement:</span>
            <span className="font-bold text-emerald-700 flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> 108%
            </span>
          </div>
        </div>

        {/* Total Collections */}
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
              {effectivePartnerFilter === 'ALL' ? 'Total Collected Cash' : `${effectivePartnerFilter} Cash Collected`}
            </span>
            <span className="p-2 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-emerald-900 mt-1">
            RM {totalPaidInvoices.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            <span>Collection Efficiency:</span>
            <span className="font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              {collectionRatePct}% Rate
            </span>
          </div>
        </div>

        {/* Unpaid / Aging Debtors */}
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
              Aged Debtors Outstanding
            </span>
            <span className="p-2 bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-rose-900 mt-1">
            RM {totalUnpaidInvoices.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            <span>Over 30 Days:</span>
            <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
              RM 12,000.00
            </span>
          </div>
        </div>

        {/* Referral Conversion Metric */}
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
              Referrals Retainer Value
            </span>
            <span className="p-2 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#16223A] mt-1">
            RM {totalReferralValue.toLocaleString('en-MY')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100">
            <span>Overall Conversion:</span>
            <span className="font-extrabold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
              {overallReferralConversionRate}% ({totalConvertedReferrals}/{totalReferralsCount} converted)
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: Firm-wide Revenue & Collection Visual Breakdown with Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue & Collection Composed Chart */}
        <div className="lg:col-span-2 bg-white border border-[#E1DCCF] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-serif text-base font-bold text-[#16223A] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-600" />
                <span>Monthly Collection Trends &amp; Revenue Chart (2026 YTD)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Interactive Recharts visualization comparing monthly billed fees, cash collections, target trajectories, and efficiency %.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10.5px]">
              <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 font-extrabold px-2 py-0.5 rounded">
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
                <Bar yAxisId="left" dataKey="billed" name="Billed Revenue (RM)" fill="#16223A" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar yAxisId="left" dataKey="collected" name="Cash Collected (RM)" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                <Line yAxisId="left" type="monotone" dataKey="target" name="Monthly Target (RM)" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="collectionRate" name="Collection Efficiency (%)" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: '#2563EB' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Date-wise Daily Collections Log */}
        <div className="bg-white border border-[#E1DCCF] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-serif text-base font-bold text-[#16223A] flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-emerald-700" />
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
                <div key={col.id} className="p-3 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 rounded-xl transition-all space-y-1 shadow-2xs">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {col.date}
                    </span>
                    <span className="font-mono font-extrabold text-emerald-900 text-xs">
                      +RM {col.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-[#16223A] truncate">{col.client}</div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                    <span className="truncate max-w-[140px]">{col.ref}</span>
                    <span className="font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
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

      {/* SECTION 2: Referral Source Tracking & Conversion Charts */}
      <div className="bg-white border border-[#E1DCCF] rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                <Share2 className="w-5 h-5 text-amber-600" />
                Referral Sources &amp; Conversion Performance Analytics
              </h2>
              <span className="bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-amber-300">
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
                  <Bar dataKey="total" name="Total Referred Leads" fill="#16223A" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="converted" name="Converted Files" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart: Retainer Value Distribution */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-sm font-bold text-[#16223A] flex items-center gap-1.5">
                <LucidePieChart className="w-4 h-4 text-amber-600" />
                <span>Retainer Value Share</span>
              </h3>
              <span className="font-mono text-xs font-bold text-amber-900">
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
              <Briefcase className="w-4 h-4 text-amber-600" />
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
                  <tr key={refItem.id} className="hover:bg-[#FAF8F2] transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-[#16223A]">{refItem.name}</div>
                      <div className="text-[10px] text-slate-500">{refItem.notes}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{refItem.referrer}</div>
                      <div className="text-[10px] text-amber-800 font-medium">{refItem.category}</div>
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
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : refItem.status === 'In Progress'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
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

      {/* SECTION 3: Per-Partner KPI & Benchmark Comparative Charts */}
      <div className="bg-white border border-[#E1DCCF] rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" />
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
                  <Bar dataKey="billed" name="Billed Revenue (RM)" fill="#16223A" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="collected" name="Cash Collected (RM)" fill="#10B981" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              ) : partnerBenchmarkMetric === 'REFERRALS' ? (
                <BarChart data={partnersKPIMatrix} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="referralsSourced" name="Referrals Sourced" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="referralsConverted" name="Converted Files" fill="#10B981" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              ) : (
                <BarChart data={partnersKPIMatrix} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={(val) => `${val}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="collectionEfficiency" name="Collection Efficiency (%)" fill="#D97706" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="resolutionRate" name="Matter Resolution Rate (%)" fill="#059669" radius={[4, 4, 0, 0]} barSize={28} />
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
                  <tr key={p.code} className="hover:bg-[#FAF8F2] transition-colors">
                    <td className="p-3 font-bold text-[#16223A]">{p.name}</td>
                    <td className="p-3 text-center">
                      <span className="ref-seal">{p.code}</span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">
                      RM {p.billed.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-emerald-800">
                      RM {p.collected.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center font-bold">
                      <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                        {p.collectionEfficiency}%
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800">{p.referralsSourced}</td>
                    <td className="p-3 text-center font-bold text-amber-900">{p.referralConversionRate}%</td>
                    <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                      RM {p.convertedRetainersValue.toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-bold text-blue-900">{p.activeMatters}</td>
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
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-serif text-sm font-bold text-[#16223A] flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-700" />
              <span>High Risk Litigation Deadlines &amp; Limitation Audit</span>
            </h3>
            <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold border border-rose-200">
              Partner Oversight
            </span>
          </div>

          <div className="space-y-2">
            {urgentDeadlines.map((d) => {
              const cs = cases.find((c) => c.id === d.caseId);
              return (
                <div
                  key={d.id}
                  className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-rose-900 text-xs">{d.title}</span>
                      <span className="ref-seal">{cs ? cs.ref : '—'}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      PIC: <strong>{d.partner}</strong> | Lawyer: <strong>{d.lawyer}</strong> | Matter: <strong>{cs?.title || 'Court File'}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-rose-900 font-bold text-xs bg-white px-2 py-0.5 rounded border border-rose-300">
                      Due: {d.dueDate}
                    </span>
                    <button
                      type="button"
                      onClick={() => showToast(`Opened deadline review for ${d.title}`)}
                      className="px-2.5 py-1 bg-rose-800 hover:bg-rose-900 text-white font-bold text-[10.5px] rounded-lg cursor-pointer"
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
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-serif text-sm font-bold text-[#16223A] flex items-center gap-2">
              <FileCheck className="w-4.5 h-4.5 text-amber-600" />
              <span>Pending Payment Voucher Sign-Offs ({paymentVouchers.filter((pv) => !pv.approved).length})</span>
            </h3>
            <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-300">
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
                  <div key={pv.id} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-950 text-xs">{pv.id}</span>
                        <span className="text-[10px] font-bold bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded uppercase">
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
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-[#16223A] font-extrabold text-[10.5px] rounded-lg cursor-pointer"
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
