import React, { useState, useMemo, useCallback } from 'react';
import {
  Calculator,
  TrendingUp,
  PieChart,
  Server,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import { RunwayProjectionMonth, CapTableStakeholder } from '../types';
import { useHashAnchorScroll, Route } from '../hooks/useHashAnchorScroll';

/**
 * React Router 7 hash-aware meta export for /calculators
 */
export function meta({ location }: Route.MetaArgs) {
  const hash = location.hash || '#saas-runway';
  const canonicalUrl = `https://www.startupcreme.com/calculators${hash}`;

  return [
    { title: 'Interactive Financial & Tech Calculators | StartupCrème' },
    {
      name: 'description',
      content: 'Institutional-grade scenario modeling for founders, CFOs, and infrastructure architects.',
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
    { property: 'og:url', content: canonicalUrl },
  ];
}

/**
 * React Router 7 compatible loader for /calculators
 */
export async function loader() {
  return {
    module: 'calculators',
    defaultPresets: {
      cashBalance: 1200000,
      mrr: 42000,
      mrrGrowthRate: 8.5,
      grossBurn: 115000,
      grossMargin: 82,
    },
    timestamp: new Date().toISOString(),
  };
}

export type CalculatorSubTab = 'saas-runway' | 'cap-table' | 'cloud-cost-estimator';

export const CalculatorsModule: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<CalculatorSubTab>('saas-runway');

  const handleHashTabChange = useCallback((rawTab: string) => {
    const clean = rawTab.replace(/^#/, '').toLowerCase();
    if (clean === 'saas-runway' || clean === 'runway') {
      setActiveSubTab('saas-runway');
    } else if (clean === 'cap-table' || clean === 'captable') {
      setActiveSubTab('cap-table');
    } else if (clean === 'cloud-cost-estimator' || clean === 'cloud') {
      setActiveSubTab('cloud-cost-estimator');
    }
  }, []);

  const { navigateToHash } = useHashAnchorScroll(handleHashTabChange, {
    defaultHash: 'saas-runway',
    validHashes: ['saas-runway', 'cap-table', 'cloud-cost-estimator', 'runway', 'captable', 'cloud'],
    metaFn: meta,
  });

  // ------------------------------------------------------------------
  // 1. SAAS RUNWAY & BURN RATE STATE
  // ------------------------------------------------------------------
  const [cashBalance, setCashBalance] = useState<number>(1250000);
  const [mrr, setMrr] = useState<number>(45000);
  const [mrrGrowthRate, setMrrGrowthRate] = useState<number>(9.0);
  const [grossBurn, setGrossBurn] = useState<number>(120000);
  const [grossMarginPct, setGrossMarginPct] = useState<number>(82);
  const [monthlyExpenseCreep, setMonthlyExpenseCreep] = useState<number>(1500);

  const runwayAnalysis = useMemo(() => {
    const months: RunwayProjectionMonth[] = [];
    let runningCash = cashBalance;
    let currentMrr = mrr;
    let currentBurn = grossBurn;
    let exactRunwayMonths: number | 'Infinite (Default Alive)' = 'Infinite (Default Alive)';
    let breakEvenMonth: number | null = null;
    let depletionMonth: number | null = null;

    const monthNames = [
      'Month 1',
      'Month 2',
      'Month 3',
      'Month 4',
      'Month 5',
      'Month 6',
      'Month 7',
      'Month 8',
      'Month 9',
      'Month 10',
      'Month 11',
      'Month 12',
    ];

    // Simulate up to 60 months for exact runway calculation, store first 12 for projection table/chart
    for (let m = 1; m <= 60; m++) {
      const startCash = runningCash;
      const grossProfit = currentMrr * (grossMarginPct / 100);
      const netBurn = currentBurn - grossProfit; // positive means burning cash, negative means cash-flow positive
      const endCash = Math.max(0, startCash - netBurn);

      if (netBurn <= 0 && breakEvenMonth === null) {
        breakEvenMonth = m;
      }

      if (startCash > 0 && startCash - netBurn <= 0 && depletionMonth === null) {
        const fraction = netBurn > 0 ? startCash / netBurn : 0;
        exactRunwayMonths = Number(((m - 1) + fraction).toFixed(1));
        depletionMonth = m;
      }

      if (m <= 12) {
        months.push({
          month: m,
          label: monthNames[m - 1],
          startingCash: Math.round(startCash),
          mrr: Math.round(currentMrr),
          grossMarginDollar: Math.round(grossProfit),
          grossBurn: Math.round(currentBurn),
          netBurn: Math.round(netBurn),
          endingCash: Math.round(endCash),
          isDepleted: endCash <= 0,
          isProfitable: netBurn <= 0,
        });
      }

      runningCash = endCash;
      currentMrr = currentMrr * (1 + mrrGrowthRate / 100);
      currentBurn = currentBurn + monthlyExpenseCreep;
    }

    const initialGrossProfit = mrr * (grossMarginPct / 100);
    const initialNetBurn = grossBurn - initialGrossProfit;
    const zeroGrowthRunway =
      initialNetBurn > 0 ? Number((cashBalance / initialNetBurn).toFixed(1)) : ('Infinite' as const);

    return {
      months,
      initialNetBurn: Math.round(initialNetBurn),
      initialArr: Math.round(mrr * 12),
       month12Arr: Math.round((months[11]?.mrr || mrr) * 12),
      exactRunwayMonths,
      zeroGrowthRunway,
      breakEvenMonth,
      depletionMonth,
      isDefaultAlive: depletionMonth === null,
    };
  }, [cashBalance, mrr, mrrGrowthRate, grossBurn, grossMarginPct, monthlyExpenseCreep]);

  const handleExportRunwayCsv = () => {
    const headers = ['Month', 'Starting Cash ($)', 'MRR ($)', 'Gross Profit ($)', 'Gross Burn ($)', 'Net Burn ($)', 'Ending Cash ($)'];
    const rows = runwayAnalysis.months.map(m => [
      m.label,
      m.startingCash,
      m.mrr,
      m.grossMarginDollar,
      m.grossBurn,
      m.netBurn,
      m.endingCash,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'startupcreme-12m-runway-projection.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ------------------------------------------------------------------
  // 2. CAP TABLE DILUTION SIMULATOR STATE
  // ------------------------------------------------------------------
  const [founderCount, setFounderCount] = useState<number>(2);
  const [initialShares] = useState<number>(10000000);
  const [seedPreMoney, setSeedPreMoney] = useState<number>(8000000);
  const [seedInvestment, setSeedInvestment] = useState<number>(2000000);
  const [seedOptionPoolPct, setSeedOptionPoolPct] = useState<number>(10);
  const [isPreMoneyOptionPool, setIsPreMoneyOptionPool] = useState<boolean>(true);

  const [seriesAPreMoney, setSeriesAPreMoney] = useState<number>(28000000);
  const [seriesAInvestment, setSeriesAInvestment] = useState<number>(7000000);
  const [seriesAOptionTopUpPct, setSeriesAOptionTopUpPct] = useState<number>(5);
  const [exitValuation, setExitValuation] = useState<number>(150000000);

  const capTableCalc = useMemo(() => {
    // SEED ROUND MATH
    const seedPostMoney = seedPreMoney + seedInvestment;
    const seedInvestorOwnership = seedPostMoney > 0 ? (seedInvestment / seedPostMoney) * 100 : 0;

    // In a Pre-Money Option Pool shuffle, the option pool % is carved out of pre-money (diluting founders before Seed investors)
    const effectiveSeedOptionPct = seedOptionPoolPct;
    const founderOwnershipPostSeed = isPreMoneyOptionPool
      ? Math.max(0, 100 - seedInvestorOwnership - effectiveSeedOptionPct)
      : Math.max(0, (100 - seedInvestorOwnership) * (1 - effectiveSeedOptionPct / 100));

    const esopOwnershipPostSeed = 100 - founderOwnershipPostSeed - seedInvestorOwnership;

    const postSeedTotalShares = Math.round(
      initialShares / Math.max(0.05, founderOwnershipPostSeed / 100)
    );
    const seedSharePrice = seedPreMoney / (postSeedTotalShares * ((founderOwnershipPostSeed + esopOwnershipPostSeed) / 100));

    // SERIES A ROUND MATH
    const seriesAPostMoney = seriesAPreMoney + seriesAInvestment;
    const seriesAInvestorOwnership = seriesAPostMoney > 0 ? (seriesAInvestment / seriesAPostMoney) * 100 : 0;

    // Dilution factor applied to existing Seed stakeholders + Series A option pool refresh
    const retentionFactor = Math.max(0, (100 - seriesAInvestorOwnership - seriesAOptionTopUpPct) / 100);

    const founderOwnershipPostSeriesA = founderOwnershipPostSeed * retentionFactor;
    const seedInvestorOwnershipPostSeriesA = seedInvestorOwnership * retentionFactor;
    const esopOwnershipPostSeriesA =
      esopOwnershipPostSeed * retentionFactor + seriesAOptionTopUpPct;

    const postSeriesATotalShares = Math.round(
      postSeedTotalShares / Math.max(0.05, retentionFactor)
    );
    const seriesASharePrice = seriesAPreMoney / postSeedTotalShares;

    const stakeholders: CapTableStakeholder[] = [
      {
        name: `Founding Team (${founderCount} Co-Founders)`,
        role: 'founder',
        sharesPostSeed: Math.round(postSeedTotalShares * (founderOwnershipPostSeed / 100)),
        ownershipPostSeed: Number(founderOwnershipPostSeed.toFixed(2)),
        sharesPostSeriesA: Math.round(postSeriesATotalShares * (founderOwnershipPostSeriesA / 100)),
        ownershipPostSeriesA: Number(founderOwnershipPostSeriesA.toFixed(2)),
        exitPayout: Math.round(exitValuation * (founderOwnershipPostSeriesA / 100)),
      },
      {
        name: 'Employee Option Pool (ESOP)',
        role: 'esop',
        sharesPostSeed: Math.round(postSeedTotalShares * (esopOwnershipPostSeed / 100)),
        ownershipPostSeed: Number(esopOwnershipPostSeed.toFixed(2)),
        sharesPostSeriesA: Math.round(postSeriesATotalShares * (esopOwnershipPostSeriesA / 100)),
        ownershipPostSeriesA: Number(esopOwnershipPostSeriesA.toFixed(2)),
        exitPayout: Math.round(exitValuation * (esopOwnershipPostSeriesA / 100)),
      },
      {
        name: 'Seed Round Investors',
        role: 'seed_investor',
        sharesPostSeed: Math.round(postSeedTotalShares * (seedInvestorOwnership / 100)),
        ownershipPostSeed: Number(seedInvestorOwnership.toFixed(2)),
        sharesPostSeriesA: Math.round(postSeriesATotalShares * (seedInvestorOwnershipPostSeriesA / 100)),
        ownershipPostSeriesA: Number(seedInvestorOwnershipPostSeriesA.toFixed(2)),
        exitPayout: Math.round(exitValuation * (seedInvestorOwnershipPostSeriesA / 100)),
      },
      {
        name: 'Series A Institutional Lead',
        role: 'series_a_investor',
        sharesPostSeed: 0,
        ownershipPostSeed: 0,
        sharesPostSeriesA: Math.round(postSeriesATotalShares * (seriesAInvestorOwnership / 100)),
        ownershipPostSeriesA: Number(seriesAInvestorOwnership.toFixed(2)),
        exitPayout: Math.round(exitValuation * (seriesAInvestorOwnership / 100)),
      },
    ];

    return {
      seedPostMoney,
      seriesAPostMoney,
      seedSharePrice,
      seriesASharePrice,
      founderOwnershipPostSeed: Number(founderOwnershipPostSeed.toFixed(2)),
      founderOwnershipPostSeriesA: Number(founderOwnershipPostSeriesA.toFixed(2)),
      perFounderPostSeriesA: Number((founderOwnershipPostSeriesA / Math.max(1, founderCount)).toFixed(2)),
      perFounderExitPayout: Math.round((exitValuation * (founderOwnershipPostSeriesA / 100)) / Math.max(1, founderCount)),
      totalFounderDilutionPct: Number((100 - founderOwnershipPostSeriesA).toFixed(2)),
      stakeholders,
    };
  }, [
    founderCount,
    initialShares,
    seedPreMoney,
    seedInvestment,
    seedOptionPoolPct,
    isPreMoneyOptionPool,
    seriesAPreMoney,
    seriesAInvestment,
    seriesAOptionTopUpPct,
    exitValuation,
  ]);

  // ------------------------------------------------------------------
  // 3. CLOUD INFRASTRUCTURE COST ESTIMATOR STATE
  // ------------------------------------------------------------------
  const [monthlyActiveUsers, setMonthlyActiveUsers] = useState<number>(85000);
  const [monthlyApiRequestsMillions, setMonthlyApiRequestsMillions] = useState<number>(45);
  const [dbStorageGb, setDbStorageGb] = useState<number>(60);
  const [monthlyEgressGb, setMonthlyEgressGb] = useState<number>(850);
  const [computeGbHours, setComputeGbHours] = useState<number>(420);

  const cloudComparison = useMemo(() => {
    const computeGbSeconds = computeGbHours * 3600;

    // 1. AWS Enterprise (Lambda + RDS Multi-AZ + CloudFront + Cognito)
    const awsCompute = Math.max(0, monthlyApiRequestsMillions - 1) * 0.2 + computeGbSeconds * 0.00001667;
    const awsDatabase = 138 + dbStorageGb * 0.23; // RDS Multi-AZ db.t4g.medium base + storage
    const awsEgress = Math.max(0, monthlyEgressGb - 100) * 0.085 + 32; // NAT Gateway + CloudFront egress
    const awsAuth = Math.max(0, monthlyActiveUsers - 50000) * 0.0055;
    const awsTotal = Math.round(awsCompute + awsDatabase + awsEgress + awsAuth);

    // 2. Supabase Pro + Vercel Pro Stack
    const supaBaseFee = 25 + 20; // Supabase Pro ($25) + Vercel Pro ($20)
    const supaCompute =
      Math.max(0, monthlyApiRequestsMillions - 10) * 0.6 + computeGbSeconds * 0.000015 + 15; // Dedicated compute add-on
    const supaDatabase = Math.max(0, dbStorageGb - 8) * 0.125;
    const supaEgress = Math.max(0, monthlyEgressGb - 250) * 0.09;
    const supaAuth = Math.max(0, monthlyActiveUsers - 100000) * 0.00325;
    const supaVercelTotal = Math.round(supaBaseFee + supaCompute + supaDatabase + supaEgress + supaAuth);

    // 3. Cloudflare Workers + R2 + Neon Serverless Postgres
    const cfBaseFee = 5 + 19; // Workers Paid ($5) + Neon Launch/Scale ($19)
    const cfCompute =
      Math.max(0, monthlyApiRequestsMillions - 10) * 0.3 + computeGbSeconds * 0.000011;
    const cfDatabase = Math.max(0, dbStorageGb - 10) * 0.10;
    const cfEgress = Math.max(0, monthlyEgressGb - 500) * 0.015; // R2 has $0 egress; minimal DB replica transfer
    const cfAuth = Math.max(0, monthlyActiveUsers - 100000) * 0.0025;
    const cloudflareNeonTotal = Math.round(cfBaseFee + cfCompute + cfDatabase + cfEgress + cfAuth);

    const tiers = [
      {
        id: 'aws',
        name: 'AWS (Lambda + RDS Multi-AZ + CloudFront)',
        subtitle: 'Enterprise IaaS & Managed Relational Stack',
        monthlyTotal: awsTotal,
        annualTotal: awsTotal * 12,
        computeCost: Math.round(awsCompute),
        dbCost: Math.round(awsDatabase),
        egressCost: Math.round(awsEgress),
        authCost: Math.round(awsAuth),
        strengths: 'Granular VPC isolation, compliance certifications, and deep enterprise IAM.',
        watchout: 'NAT Gateway hourly fees and $0.085–$0.09/GB un-cached egress drive steep bill spikes.',
      },
      {
        id: 'supabase_vercel',
        name: 'Supabase Pro + Vercel Fluid Compute',
        subtitle: 'Modern Full-Stack TypeScript & Postgres Platform',
        monthlyTotal: supaVercelTotal,
        annualTotal: supaVercelTotal * 12,
        computeCost: Math.round(supaBaseFee + supaCompute),
        dbCost: Math.round(supaDatabase),
        egressCost: Math.round(supaEgress),
        authCost: Math.round(supaAuth),
        strengths: '100k free MAU Auth, integrated RLS, pgvector, and Fluid Compute I/O savings.',
        watchout: 'Monitor un-cached media egress above 250GB; offload static media to Cloudflare R2.',
      },
      {
        id: 'cloudflare_neon',
        name: 'Cloudflare Workers + R2 + Neon Postgres',
        subtitle: 'Zero-Egress Edge Compute & Serverless Database',
        monthlyTotal: cloudflareNeonTotal,
        annualTotal: cloudflareNeonTotal * 12,
        computeCost: Math.round(cfBaseFee + cfCompute),
        dbCost: Math.round(cfDatabase),
        egressCost: Math.round(cfEgress),
        authCost: Math.round(cfAuth),
        strengths: '$0.00 R2 bandwidth egress and CPU-time-only isolate billing.',
        watchout: 'Requires Hyperdrive connection pooling for regional Postgres latency management.',
      },
    ];

    const lowest = [...tiers].sort((a, b) => a.monthlyTotal - b.monthlyTotal)[0];
    const highest = [...tiers].sort((a, b) => b.monthlyTotal - a.monthlyTotal)[0];
    const annualSavingsMax = (highest.monthlyTotal - lowest.monthlyTotal) * 12;

    return {
      tiers,
      lowest,
      annualSavingsMax,
    };
  }, [monthlyActiveUsers, monthlyApiRequestsMillions, dbStorageGb, monthlyEgressGb, computeGbHours]);

  const maxCashChartValue = useMemo(() => {
    return Math.max(
      cashBalance,
      ...runwayAnalysis.months.map(m => Math.max(m.endingCash, m.mrr * 3)),
      100000
    );
  }, [cashBalance, runwayAnalysis.months]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Module Header */}
      <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
            <span>Module 01</span>
            <span aria-hidden="true">·</span>
            <span>Interactive Founder & FinOps Workbench</span>
            <span aria-hidden="true">·</span>
            <code className="text-emerald-700 font-semibold">/calculators#{activeSubTab}</code>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Interactive Financial & Tech Calculators
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
            Institutional-grade scenario modeling for founders, CFOs, and infrastructure architects. Simulate 12-month cash depletion, multi-round equity dilution, and cloud unit economics in real time.
          </p>
        </div>

        {/* Segmented Calculator Switcher (Hash-Synchronized) */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl self-start lg:self-auto overflow-x-auto max-w-full">
          <a
            href="#saas-runway"
            onClick={(e) => {
              e.preventDefault();
              navigateToHash('saas-runway');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'saas-runway'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>SaaS Runway & Burn</span>
          </a>

          <a
            href="#cap-table"
            onClick={(e) => {
              e.preventDefault();
              navigateToHash('cap-table');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'cap-table'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-cyan-600" />
            <span>Cap Table Dilution</span>
          </a>

          <a
            href="#cloud-cost-estimator"
            onClick={(e) => {
              e.preventDefault();
              navigateToHash('cloud-cost-estimator');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'cloud-cost-estimator'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-teal-600" />
            <span>Cloud Cost Estimator</span>
          </a>
        </div>
      </div>

      {/* =================================================================
          SUB-MODULE 1A: SAAS RUNWAY & BURN RATE CALCULATOR (#saas-runway)
         ================================================================= */}
      {activeSubTab === 'saas-runway' && (
        <section id="saas-runway" className="space-y-8 scroll-mt-28">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Parameter Controls */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-serif text-lg font-bold text-slate-900">
                    Treasury & Operating Inputs
                  </h2>
                  <p className="text-xs text-slate-500">
                    Adjust treasury balance, MRR trajectory, and monthly operating expenses
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCashBalance(1250000);
                    setMrr(45000);
                    setMrrGrowthRate(9.0);
                    setGrossBurn(120000);
                    setGrossMarginPct(82);
                    setMonthlyExpenseCreep(1500);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Reset to default Series Seed benchmark"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Cash Balance */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label className="font-semibold text-slate-700">Current Cash Balance ($)</label>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    ${cashBalance.toLocaleString()}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={25000}
                  value={cashBalance}
                  onChange={(e) => setCashBalance(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
                <input
                  type="range"
                  min={50000}
                  max={10000000}
                  step={50000}
                  value={Math.min(10000000, cashBalance)}
                  onChange={(e) => setCashBalance(Number(e.target.value))}
                  className="w-full mt-2 accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Current MRR */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label className="font-semibold text-slate-700">Current Monthly Recurring Revenue (MRR)</label>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    ${mrr.toLocaleString()}/mo
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={2500}
                  value={mrr}
                  onChange={(e) => setMrr(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
                <input
                  type="range"
                  min={0}
                  max={500000}
                  step={5000}
                  value={Math.min(500000, mrr)}
                  onChange={(e) => setMrr(Number(e.target.value))}
                  className="w-full mt-2 accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Monthly Compounding Growth Rate */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label className="font-semibold text-slate-700">Monthly MRR Growth Rate (%)</label>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {mrrGrowthRate.toFixed(1)}% MoM
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={0.5}
                  value={mrrGrowthRate}
                  onChange={(e) => setMrrGrowthRate(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-1">
                  <span>0% (Flat)</span>
                  <span>10% (3.1x YoY)</span>
                  <span>20% (8.9x YoY)</span>
                  <span>30%</span>
                </div>
              </div>

              {/* Gross Monthly Burn Expenses */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label className="font-semibold text-slate-700">Gross Monthly Burn Expenses ($)</label>
                  <span className="font-mono font-bold text-rose-700 tabular-nums">
                    ${grossBurn.toLocaleString()}/mo
                  </span>
                </div>
                <input
                  type="number"
                  min={1000}
                  step={5000}
                  value={grossBurn}
                  onChange={(e) => setGrossBurn(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
                <input
                  type="range"
                  min={10000}
                  max={600000}
                  step={5000}
                  value={Math.min(600000, grossBurn)}
                  onChange={(e) => setGrossBurn(Number(e.target.value))}
                  className="w-full mt-2 accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Gross Margin & Expense Creep Grid */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SaaS Gross Margin (%)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={grossMarginPct}
                    onChange={(e) => setGrossMarginPct(Math.min(100, Math.max(10, Number(e.target.value))))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly OpEx Creep ($/mo)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={monthlyExpenseCreep}
                    onChange={(e) => setMonthlyExpenseCreep(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Executive KPIs & 12-Month Visual Chart */}
            <div className="lg:col-span-7 space-y-6">
              {/* Primary KPI Strip */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium mb-1">
                    Month 1 Net Burn
                  </div>
                  <div className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                    {runwayAnalysis.initialNetBurn > 0
                      ? `$${runwayAnalysis.initialNetBurn.toLocaleString()}`
                      : `+$${Math.abs(runwayAnalysis.initialNetBurn).toLocaleString()}`}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5">
                    {runwayAnalysis.initialNetBurn > 0
                      ? 'Monthly net treasury outflow'
                      : 'Net cash-flow positive'}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium mb-1">
                    Growth-Adjusted Runway
                  </div>
                  <div className="font-mono text-2xl font-extrabold text-emerald-700 tabular-nums">
                    {typeof runwayAnalysis.exactRunwayMonths === 'number'
                      ? `${runwayAnalysis.exactRunwayMonths} mos`
                      : 'Default Alive'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                    Static (0% growth): {runwayAnalysis.zeroGrowthRunway}{' '}
                    {typeof runwayAnalysis.zeroGrowthRunway === 'number' ? 'mos' : ''}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium mb-1">
                    Projected Month 12 ARR
                  </div>
                  <div className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                    ${runwayAnalysis.month12Arr.toLocaleString()}
                  </div>
                  <div className="text-xs text-emerald-700 mt-1.5 font-mono tabular-nums">
                    Now: ${runwayAnalysis.initialArr.toLocaleString()} ARR
                  </div>
                </div>
              </div>

              {/* Default Alive / Alert Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {runwayAnalysis.isDefaultAlive ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-900">
                      {runwayAnalysis.isDefaultAlive
                        ? 'Trajectory Verdict: Default Alive — '
                        : 'Trajectory Verdict: Capital Raise Required — '}
                    </span>
                    {runwayAnalysis.breakEvenMonth
                      ? `Compounding MRR gross profit overtakes operating expenses in Month ${runwayAnalysis.breakEvenMonth}.`
                      : runwayAnalysis.depletionMonth
                      ? `Treasury reaches zero in Month ${runwayAnalysis.depletionMonth} unless MRR growth accelerates or burn is reduced.`
                      : 'Cash reserves cover the 12-month operating horizon.'}
                  </div>
                </div>
              </div>

              {/* 12-Month Cash Depletion Visual Chart */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                  <div>
                    <h3 className="font-serif text-base font-bold text-slate-900">
                      12-Month Cash Balance & Monthly Revenue Trajectory
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ending treasury reserve vs. compounding monthly recurring revenue
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 inline-block"></span>
                      <span>Ending Cash ($)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block"></span>
                      <span>MRR ($)</span>
                    </span>
                  </div>
                </div>

                {/* Bar Chart Grid */}
                <div className="grid grid-cols-12 gap-2 items-end h-52 pt-6 pb-2 px-2 border-b border-slate-200">
                  {runwayAnalysis.months.map((item) => {
                    const cashHeightPct = Math.max(
                      3,
                      Math.min(100, (item.endingCash / maxCashChartValue) * 100)
                    );
                    const mrrHeightPct = Math.max(
                      3,
                      Math.min(100, (item.mrr / maxCashChartValue) * 100)
                    );
                    return (
                      <div
                        key={item.month}
                        className="flex flex-col items-center h-full justify-end group relative"
                      >
                        {/* Hover Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-12 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-[10px] font-mono rounded-lg px-2 py-1 whitespace-nowrap shadow-md">
                          M{item.month}: Cash ${(item.endingCash / 1000).toFixed(0)}k · MRR ${(item.mrr / 1000).toFixed(0)}k
                        </div>

                        <div className="w-full flex items-end justify-center gap-1 h-full">
                          <div
                            style={{ height: `${item.endingCash === 0 ? 2 : cashHeightPct}%` }}
                            className={`w-2.5 sm:w-3.5 rounded-t transition-all ${
                              item.endingCash === 0 ? 'bg-rose-400' : 'bg-slate-800 group-hover:bg-slate-900'
                            }`}
                          />
                          <div
                            style={{ height: `${mrrHeightPct}%` }}
                            className="w-2 sm:w-2.5 rounded-t bg-emerald-500 group-hover:bg-emerald-600 transition-all"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 mt-2">
                          M{item.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 12-Month Cash Depletion Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  12-Month Cash Depletion & Operating Schedule
                </h3>
                <p className="text-xs text-slate-500">
                  Month-by-month cash balance, gross margin contribution, and net burn ledger
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportRunwayCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV Schedule</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4 text-right">Starting Cash</th>
                    <th className="py-3 px-4 text-right">MRR</th>
                    <th className="py-3 px-4 text-right">Gross Profit ({grossMarginPct}%)</th>
                    <th className="py-3 px-4 text-right">Gross Burn</th>
                    <th className="py-3 px-4 text-right">Net Burn / Flow</th>
                    <th className="py-3 px-4 text-right">Ending Cash</th>
                    <th className="py-3 px-4 text-right">Treasury Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-mono tabular-nums">
                  {runwayAnalysis.months.map((row) => (
                    <tr key={row.month} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                        {row.label}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        ${row.startingCash.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-semibold">
                        ${row.mrr.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        ${row.grossMarginDollar.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        ${row.grossBurn.toLocaleString()}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-semibold ${
                          row.netBurn <= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {row.netBurn <= 0
                          ? `+$${Math.abs(row.netBurn).toLocaleString()}`
                          : `-$${row.netBurn.toLocaleString()}`}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ${row.endingCash.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-sans text-xs">
                        {row.isDepleted ? (
                          <span className="text-rose-700 font-semibold">Cash Depleted</span>
                        ) : row.isProfitable ? (
                          <span className="text-emerald-700 font-semibold">Cash-Flow Positive</span>
                        ) : (
                          <span className="text-slate-500">Runway Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================
          SUB-MODULE 1B: CAP TABLE DILUTION SIMULATOR (#cap-table)
         ================================================================= */}
      {activeSubTab === 'cap-table' && (
        <section id="cap-table" className="space-y-8 scroll-mt-28">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Inputs Panel */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="font-serif text-lg font-bold text-slate-900">
                  Seed & Series A Financing Parameters
                </h2>
                <p className="text-xs text-slate-500">
                  Model pre-money valuations, round sizes, and ESOP option pool expansion
                </p>
              </div>

              {/* Founding Team */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Number of Co-Founders</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {founderCount} Founders ({(100 / founderCount).toFixed(1)}% initial each)
                  </span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFounderCount(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        founderCount === num
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {num} {num === 1 ? 'Founder' : 'Founders'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seed Round Block */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900">01. Seed Round Terms</h3>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    Post-Money: ${(capTableCalc.seedPostMoney / 1000000).toFixed(1)}M
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Pre-Money Valuation ($)
                    </label>
                    <input
                      type="number"
                      step={500000}
                      min={1000000}
                      value={seedPreMoney}
                      onChange={(e) => setSeedPreMoney(Math.max(500000, Number(e.target.value)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Seed Investment ($)
                    </label>
                    <input
                      type="number"
                      step={250000}
                      min={100000}
                      value={seedInvestment}
                      onChange={(e) => setSeedInvestment(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="font-semibold text-slate-600">Seed Option Pool Target (%)</label>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">{seedOptionPoolPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    step={1}
                    value={seedOptionPoolPct}
                    onChange={(e) => setSeedOptionPoolPct(Number(e.target.value))}
                    className="w-full accent-cyan-600 cursor-pointer"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-500">Option Pool Structure:</span>
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsPreMoneyOptionPool(true)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                          isPreMoneyOptionPool ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Pre-Money Carveout
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPreMoneyOptionPool(false)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                          !isPreMoneyOptionPool ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Post-Money Shared
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Series A Round Block */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900">02. Series A Round Terms</h3>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    Post-Money: ${(capTableCalc.seriesAPostMoney / 1000000).toFixed(1)}M
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Series A Pre-Money ($)
                    </label>
                    <input
                      type="number"
                      step={1000000}
                      min={2000000}
                      value={seriesAPreMoney}
                      onChange={(e) => setSeriesAPreMoney(Math.max(1000000, Number(e.target.value)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Series A Raised ($)
                    </label>
                    <input
                      type="number"
                      step={500000}
                      min={0}
                      value={seriesAInvestment}
                      onChange={(e) => setSeriesAInvestment(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="font-semibold text-slate-600">Series A ESOP Pool Top-Up (%)</label>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">{seriesAOptionTopUpPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={15}
                    step={0.5}
                    value={seriesAOptionTopUpPct}
                    onChange={(e) => setSeriesAOptionTopUpPct(Number(e.target.value))}
                    className="w-full accent-cyan-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Exit Valuation Simulator */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label className="font-semibold text-slate-700">Hypothetical Exit / M&A Valuation ($)</label>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    ${(exitValuation / 1000000).toFixed(0)}M
                  </span>
                </div>
                <input
                  type="range"
                  min={20000000}
                  max={1000000000}
                  step={10000000}
                  value={exitValuation}
                  onChange={(e) => setExitValuation(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Right Column: Dilution Outputs & Cap Table */}
            <div className="lg:col-span-7 space-y-6">
              {/* Summary KPIs */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium mb-1">
                    Founders Post-Seed
                  </div>
                  <div className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                    {capTableCalc.founderOwnershipPostSeed}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                    Implied Seed PPS: ${capTableCalc.seedSharePrice.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium mb-1">
                    Founders Post-Series A
                  </div>
                  <div className="font-mono text-2xl font-extrabold text-cyan-700 tabular-nums">
                    {capTableCalc.founderOwnershipPostSeriesA}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                    {capTableCalc.perFounderPostSeriesA}% per Co-Founder
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium mb-1">
                    Payout Per Founder at Exit
                  </div>
                  <div className="font-mono text-2xl font-extrabold text-emerald-700 tabular-nums">
                    ${(capTableCalc.perFounderExitPayout / 1000000).toFixed(2)}M
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                    At ${(exitValuation / 1000000).toFixed(0)}M Exit
                  </div>
                </div>
              </div>

              {/* Proportional Ownership Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base font-bold text-slate-900">
                    Post-Series A Ownership Distribution
                  </h3>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    Total Cumulative Dilution: {capTableCalc.totalFounderDilutionPct}%
                  </span>
                </div>

                <div className="w-full h-5 rounded-xl overflow-hidden flex bg-slate-100 border border-slate-200">
                  <div
                    style={{ width: `${capTableCalc.stakeholders[0].ownershipPostSeriesA}%` }}
                    className="bg-slate-900 h-full transition-all"
                    title="Founding Team"
                  />
                  <div
                    style={{ width: `${capTableCalc.stakeholders[1].ownershipPostSeriesA}%` }}
                    className="bg-teal-500 h-full transition-all"
                    title="Employee Option Pool (ESOP)"
                  />
                  <div
                    style={{ width: `${capTableCalc.stakeholders[2].ownershipPostSeriesA}%` }}
                    className="bg-cyan-600 h-full transition-all"
                    title="Seed Round Investors"
                  />
                  <div
                    style={{ width: `${capTableCalc.stakeholders[3].ownershipPostSeriesA}%` }}
                    className="bg-emerald-600 h-full transition-all"
                    title="Series A Investors"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 shrink-0" />
                    <span className="text-slate-600 truncate">
                      Founders ({capTableCalc.stakeholders[0].ownershipPostSeriesA}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 shrink-0" />
                    <span className="text-slate-600 truncate">
                      ESOP ({capTableCalc.stakeholders[1].ownershipPostSeriesA}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-xs bg-cyan-600 shrink-0" />
                    <span className="text-slate-600 truncate">
                      Seed ({capTableCalc.stakeholders[2].ownershipPostSeriesA}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 shrink-0" />
                    <span className="text-slate-600 truncate">
                      Series A ({capTableCalc.stakeholders[3].ownershipPostSeriesA}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Cap Table Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-serif text-base font-bold text-slate-900">
                    Stakeholder Cap Table & Exit Waterfall Ledger
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <th className="py-3 px-4">Stakeholder Class</th>
                        <th className="py-3 px-4 text-right">Post-Seed %</th>
                        <th className="py-3 px-4 text-right">Post-Series A Shares</th>
                        <th className="py-3 px-4 text-right">Post-Series A %</th>
                        <th className="py-3 px-4 text-right">Exit Proceeds ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-mono tabular-nums">
                      {capTableCalc.stakeholders.map((s) => (
                        <tr key={s.name} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-sans font-semibold text-slate-900">
                            {s.name}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-600">
                            {s.ownershipPostSeed.toFixed(2)}%
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-600">
                            {s.sharesPostSeriesA.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {s.ownershipPostSeriesA.toFixed(2)}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                            ${s.exitPayout.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================
          SUB-MODULE 1C: CLOUD INFRASTRUCTURE COST ESTIMATOR (#cloud-cost-estimator)
         ================================================================= */}
      {activeSubTab === 'cloud-cost-estimator' && (
        <section id="cloud-cost-estimator" className="space-y-8 scroll-mt-28">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Workload Controls */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="font-serif text-lg font-bold text-slate-900">
                  Production Workload Profile
                </h2>
                <p className="text-xs text-slate-500">
                  Configure traffic, database footprint, and monthly egress volume
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-700">Monthly Active Users (MAU)</label>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {monthlyActiveUsers.toLocaleString()} MAU
                  </span>
                </div>
                <input
                  type="range"
                  min={5000}
                  max={1000000}
                  step={5000}
                  value={monthlyActiveUsers}
                  onChange={(e) => setMonthlyActiveUsers(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-700">Monthly Serverless / API Requests</label>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {monthlyApiRequestsMillions}M req/mo
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={500}
                  step={1}
                  value={monthlyApiRequestsMillions}
                  onChange={(e) => setMonthlyApiRequestsMillions(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-700">Managed Postgres Storage (GB)</label>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {dbStorageGb} GB
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={2000}
                  step={5}
                  value={dbStorageGb}
                  onChange={(e) => setDbStorageGb(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-700">Monthly Bandwidth / Data Egress (GB)</label>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {monthlyEgressGb.toLocaleString()} GB
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={10000}
                  step={50}
                  value={monthlyEgressGb}
                  onChange={(e) => setMonthlyEgressGb(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-700">Compute Execution (GB-Hours / mo)</label>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {computeGbHours} GB-hrs
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={5000}
                  step={20}
                  value={computeGbHours}
                  onChange={(e) => setComputeGbHours(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Right Column: Provider Comparison Cards & Itemized Table */}
            <div className="lg:col-span-7 space-y-6">
              {/* FinOps Headline Callout */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500 font-medium">
                    Optimal Cost-Efficiency Stack for Current Workload
                  </div>
                  <div className="font-serif text-xl font-bold text-slate-900 mt-0.5">
                    {cloudComparison.lowest.name}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-slate-500">Max Annual Infrastructure Savings</div>
                  <div className="font-mono text-2xl font-extrabold text-emerald-700 tabular-nums">
                    ${cloudComparison.annualSavingsMax.toLocaleString()}/yr
                  </div>
                </div>
              </div>

              {/* 3 Provider Cards */}
              <div className="grid sm:grid-cols-3 gap-4">
                {cloudComparison.tiers.map((tier) => {
                  const isLowest = tier.id === cloudComparison.lowest.id;
                  return (
                    <div
                      key={tier.id}
                      className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                        isLowest
                          ? 'border-emerald-500 shadow-sm'
                          : 'border-slate-200 shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-mono text-slate-500 mb-1">
                          {isLowest ? 'Best Unit Economics' : 'Benchmark Tier'}
                        </div>
                        <h3 className="font-serif text-base font-bold text-slate-900 leading-snug">
                          {tier.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 mb-4">{tier.subtitle}</p>
                      </div>

                      <div>
                        <div className="pt-3 border-t border-slate-100">
                          <div className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                            ${tier.monthlyTotal.toLocaleString()}
                            <span className="text-xs font-normal text-slate-500">/mo</span>
                          </div>
                          <div className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                            ${tier.annualTotal.toLocaleString()}/year
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Itemized Cost Matrix */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-serif text-base font-bold text-slate-900">
                    Itemized Monthly Infrastructure Cost Breakdown
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <th className="py-3 px-4">Cloud Provider Stack</th>
                        <th className="py-3 px-4 text-right">Compute & Base</th>
                        <th className="py-3 px-4 text-right">Postgres Storage</th>
                        <th className="py-3 px-4 text-right">Bandwidth Egress</th>
                        <th className="py-3 px-4 text-right">Auth / MAU</th>
                        <th className="py-3 px-4 text-right">Monthly Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-mono tabular-nums">
                      {cloudComparison.tiers.map((tier) => (
                        <tr key={tier.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-sans">
                            <div className="font-semibold text-slate-900">{tier.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{tier.watchout}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-600">
                            ${tier.computeCost.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-600">
                            ${tier.dbCost.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-600">
                            ${tier.egressCost.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-600">
                            ${tier.authCost.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            ${tier.monthlyTotal.toLocaleString()}/mo
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
