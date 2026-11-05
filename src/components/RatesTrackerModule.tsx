import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Landmark,
  CheckCircle2,
  Percent,
  BarChart3,
  Table as TableIcon,
  Download,
  Edit3,
  ExternalLink,
  X,
  Save,
  AlertCircle,
  ArrowUpRight,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import { RateSnapshotPayload, CentralBankRate, CountryInflationRecord, YearlyInflationRate } from '../types';
import { store } from '../lib/store';
import { useHashAnchorScroll, Route } from '../hooks/useHashAnchorScroll';

/**
 * React Router 7 hash-aware meta export for /markets/rates
 */
export function meta({ location }: Route.MetaArgs) {
  const hash = location.hash || '#central-bank-rates';
  const canonicalUrl = `https://www.startupcreme.com/markets/rates${hash}`;

  return [
    { title: 'Macro Central Bank & 10-Year Inflation Rate Tracker | StartupCrème' },
    {
      name: 'description',
      content:
        'Live sovereign central bank policy rates, 10-year historical inflation rate trajectories (2017–2026), monetary policy easing cycles, and real yield curves.',
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
    { property: 'og:url', content: canonicalUrl },
  ];
}

/**
 * React Router 7 compatible loader for /markets/rates
 */
export async function loader() {
  const snapshot = await store.fetchRateSnapshot();
  return {
    snapshot,
  };
}

/**
 * React Router 7 compatible action for triggering n8n rate snapshot webhook sync
 */
export async function action() {
  const updated = await store.triggerRateWebhookSync();
  return {
    success: true,
    snapshot: updated,
  };
}

const INFLATION_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

export const RatesTrackerModule: React.FC = () => {
  const [snapshot, setSnapshot] = useState<RateSnapshotPayload>(() => store.getRateSnapshot());
  const [regionFilter, setRegionFilter] = useState<'all' | 'americas_eu' | 'africa_apac'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  // Inflation section state (Trend Charts & Cards active first)
  const [inflationViewMode, setInflationViewMode] = useState<'cards' | 'matrix'>('cards');
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>('inf-us');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CountryInflationRecord | null>(null);
  const [isSavingInflation, setIsSavingInflation] = useState(false);
  const [adminSaveMessage, setAdminSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentUser = store.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const handleHashSectionChange = useCallback((_rawHash: string) => {
    // Hash change handler for anchor jumps
  }, []);

  const { navigateToHash } = useHashAnchorScroll(handleHashSectionChange, {
    defaultHash: 'central-bank-rates',
    validHashes: ['central-bank-rates', 'inflation-rates'],
    metaFn: meta,
  });

  useEffect(() => {
    let mounted = true;
    store.fetchRateSnapshot().then((snap) => {
      if (mounted) setSnapshot(snap);
    });
    const unsubscribe = store.subscribe(() => {
      if (mounted) setSnapshot(store.getRateSnapshot());
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const filteredBanks = useMemo(() => {
    return snapshot.central_bank_rates.filter((bank) => {
      if (regionFilter === 'americas_eu') {
        return ['FED', 'ECB', 'BoE'].includes(bank.bank_code);
      }
      if (regionFilter === 'africa_apac') {
        return ['CBN', 'SARB', 'CBK', 'BoJ', 'RBI'].includes(bank.bank_code);
      }
      return true;
    });
  }, [snapshot.central_bank_rates, regionFilter]);

  const inflationRatesList = useMemo(() => {
    const list = snapshot.inflation_rates && snapshot.inflation_rates.length > 0
      ? snapshot.inflation_rates
      : store.getInflationRates();

    return list.filter((item) => {
      if (regionFilter === 'americas_eu') {
        return ['US', 'EU', 'GB'].includes(item.country_code);
      }
      if (regionFilter === 'africa_apac') {
        return ['NG', 'ZA', 'KE', 'JP', 'IN'].includes(item.country_code);
      }
      return true;
    });
  }, [snapshot.inflation_rates, regionFilter]);

  const handleWebhookSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    const updated = await store.triggerRateWebhookSync();
    setSnapshot(updated);
    setIsSyncing(false);
    setSyncSuccessMessage('Snapshot synchronized successfully with live macroeconomic data sources.');
    setTimeout(() => setSyncSuccessMessage(null), 5000);
  };

  const renderTrendIndicator = (bank: CentralBankRate) => {
    if (bank.trend === 'up') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-700 tabular-nums">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+{bank.change_bps} bps (Hike)</span>
        </span>
      );
    }
    if (bank.trend === 'down') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-700 tabular-nums">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{bank.change_bps} bps (Cut)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-500 tabular-nums">
        <Minus className="w-3.5 h-3.5" />
        <span>0 bps (Hold)</span>
      </span>
    );
  };

  // Helper to open edit modal for a specific country
  const handleOpenEditModal = (countryId?: string) => {
    const all = snapshot.inflation_rates && snapshot.inflation_rates.length > 0
      ? snapshot.inflation_rates
      : store.getInflationRates();
    const target = all.find((c) => c.id === countryId) || all[0];
    if (target) {
      // deep clone
      setEditingRecord(JSON.parse(JSON.stringify(target)));
      setAdminSaveMessage(null);
      setIsEditModalOpen(true);
    }
  };

  // Handle saving modified inflation record
  const handleSaveInflationRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    setIsSavingInflation(true);
    setAdminSaveMessage(null);

    // Ensure 10y history sorted and compute stats
    const history = [...(editingRecord.history_10y || [])].sort((a, b) => a.year - b.year);
    const sum = history.reduce((acc, h) => acc + h.rate, 0);
    const avg = history.length > 0 ? parseFloat((sum / history.length).toFixed(2)) : 0;
    
    let high = history[0] || { year: 2022, rate: 0 };
    let low = history[0] || { year: 2020, rate: 0 };
    for (const h of history) {
      if (h.rate > high.rate) high = h;
      if (h.rate < low.rate) low = h;
    }

    const latest = history[history.length - 1] || { year: 2026, rate: 0 };

    const payloadToSave: CountryInflationRecord = {
      ...editingRecord,
      history_10y: history,
      current_rate: latest.rate,
      ten_year_avg: avg,
      ten_year_high: { year: high.year, rate: high.rate },
      ten_year_low: { year: low.year, rate: low.rate },
      updated_at: new Date().toISOString(),
    };

    const res = await store.updateInflationRecord(payloadToSave);
    setIsSavingInflation(false);

    if (res.success) {
      setAdminSaveMessage({
        type: 'success',
        text: `Successfully saved ${editingRecord.country} inflation data to startupcreme.rate_snapshots database!`,
      });
      setTimeout(() => {
        setIsEditModalOpen(false);
      }, 1200);
    } else {
      setAdminSaveMessage({
        type: 'error',
        text: res.error || 'Failed to persist inflation rates to database.',
      });
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const list = snapshot.inflation_rates && snapshot.inflation_rates.length > 0
      ? snapshot.inflation_rates
      : store.getInflationRates();

    const headers = [
      'Country',
      'Code',
      'Currency',
      'Benchmark Index',
      'Statistical Agency',
      '2017 (%)',
      '2018 (%)',
      '2019 (%)',
      '2020 (%)',
      '2021 (%)',
      '2022 (%)',
      '2023 (%)',
      '2024 (%)',
      '2025 (%)',
      '2026 Latest (%)',
      '10-Year Average (%)',
      '10-Year Peak Rate (%)',
      '10-Year Peak Year',
      '10-Year Low Rate (%)',
      '10-Year Low Year',
      'Target Band',
      'Trend Status',
      'Official Source URL',
    ];

    const rows = list.map((record) => {
      const yearMap = new Map(record.history_10y.map((h) => [h.year, h.rate]));
      return [
        `"${record.country}"`,
        `"${record.country_code}"`,
        `"${record.currency}"`,
        `"${record.benchmark_index}"`,
        `"${record.statistical_agency}"`,
        yearMap.get(2017) ?? '',
        yearMap.get(2018) ?? '',
        yearMap.get(2019) ?? '',
        yearMap.get(2020) ?? '',
        yearMap.get(2021) ?? '',
        yearMap.get(2022) ?? '',
        yearMap.get(2023) ?? '',
        yearMap.get(2024) ?? '',
        yearMap.get(2025) ?? '',
        yearMap.get(2026) ?? record.current_rate,
        record.ten_year_avg,
        record.ten_year_high.rate,
        record.ten_year_high.year,
        record.ten_year_low.rate,
        record.ten_year_low.year,
        `"${record.target_band}"`,
        `"${record.trend_label}"`,
        `"${record.official_source_url}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `startupcreme-inflation-rates-10y-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute cumulative price increase over 10 years (compound effect: (1+r1)*(1+r2)... - 1)
  const getCumulativePriceGrowth = (history: YearlyInflationRate[]) => {
    let multiplier = 1.0;
    for (const item of history) {
      multiplier *= 1 + item.rate / 100;
    }
    return ((multiplier - 1) * 100).toFixed(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-12">
      {/* Module Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
            <span>Module 03</span>
            <span aria-hidden="true">·</span>
            <span>Monetary Policy & Macro Trackers</span>
            <span aria-hidden="true">·</span>
            <code className="text-emerald-700 font-semibold">/markets/rates</code>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Macro Monetary & Inflation Rate Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
            Live institutional benchmarking of sovereign central bank policy rates and 10-year historical inflation rate trajectories across developed and emerging economies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          {/* Section Navigation Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => navigateToHash('central-bank-rates')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 bg-white shadow-xs transition-all cursor-pointer"
            >
              <Landmark className="w-3.5 h-3.5 text-emerald-700" />
              <span>Central Bank Rates</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToHash('inflation-rates')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              <Percent className="w-3.5 h-3.5 text-indigo-600" />
              <span>Inflation Rates (10Y)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleWebhookSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Live Snapshot'}</span>
          </button>
        </div>
      </div>

      {/* Sync Confirmation */}
      {syncSuccessMessage && (
        <div className="bg-white border border-emerald-300 rounded-xl p-4 flex items-center gap-2.5 text-xs text-slate-800 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{syncSuccessMessage}</span>
        </div>
      )}

      {/* =================================================================
          SECTION 1: GLOBAL CENTRAL BANK INTEREST RATES TRACKER (#central-bank-rates)
         ================================================================= */}
      <section id="central-bank-rates" className="space-y-6 scroll-mt-28">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-700" />
              <h2 className="font-serif text-2xl font-bold text-slate-900">
                Global Central Bank Interest Rates Tracker
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Benchmark monetary policy rates, basis-point adjustments, inflation spreads, and upcoming MPC decision dates
            </p>
          </div>

          {/* Region Filter Segmented Control */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setRegionFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                regionFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Central Banks ({snapshot.central_bank_rates.length})
            </button>
            <button
              type="button"
              onClick={() => setRegionFilter('americas_eu')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                regionFilter === 'americas_eu'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              US & Europe
            </button>
            <button
              type="button"
              onClick={() => setRegionFilter('africa_apac')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                regionFilter === 'africa_apac'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Africa & APAC
            </button>
          </div>
        </div>

        {/* 8 Central Bank Rate Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredBanks.map((bank) => {
            const maxHistorical = Math.max(...bank.historical_12m, bank.current_rate);
            return (
              <div
                key={bank.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-slate-500 tracking-wider">
                      {bank.bank_code}
                    </span>
                    <h3 className="font-serif text-base font-bold text-slate-900 leading-tight mt-0.5">
                      {bank.bank_name}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {bank.rate_instrument}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {bank.country_or_region} · {bank.currency}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div className="font-mono text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                    {bank.current_rate.toFixed(2)}%
                  </div>
                  {renderTrendIndicator(bank)}
                </div>

                {/* 12-Month Sparkline Bars */}
                <div className="space-y-1">
                  <div className="flex items-end gap-1 h-8 pt-1">
                    {bank.historical_12m.map((rate, idx) => {
                      const heightPercent = maxHistorical > 0 ? (rate / maxHistorical) * 100 : 20;
                      const isCurrent = idx === bank.historical_12m.length - 1;
                      return (
                        <div
                          key={idx}
                          className={`flex-1 rounded-xs transition-all ${
                            isCurrent ? 'bg-slate-900' : 'bg-slate-200'
                          }`}
                          style={{ height: `${Math.max(15, heightPercent)}%` }}
                          title={`Month ${idx + 1}: ${rate.toFixed(2)}%`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 space-y-1.5 text-xs font-mono tabular-nums text-slate-500">
                  <div className="flex justify-between">
                    <span className="font-sans">Previous Rate:</span>
                    <span className="text-slate-800">{bank.previous_rate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">Last MPC Decision:</span>
                    <span className="text-slate-800">{bank.last_decision_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">Headline CPI YoY:</span>
                    <span className="text-slate-800">{bank.inflation_yoy.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">Real Policy Yield:</span>
                    <span
                      className={
                        bank.real_rate >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'
                      }
                    >
                      {bank.real_rate >= 0 ? `+${bank.real_rate.toFixed(2)}%` : `${bank.real_rate.toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100">
                    <span className="font-sans">Next MPC Decision:</span>
                    <span className="text-slate-700">{bank.next_meeting_date}</span>
                  </div>
                  {bank.official_source_url && (
                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <a
                        href={bank.official_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline-offset-2 hover:underline"
                      >
                        Verify Official Central Bank Source ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =================================================================
          SECTION 2: INFLATION RATES (10-YEAR HISTORICAL TRAJECTORY)
          Placed directly below the Central Bank Interest Rates Tracker
         ================================================================= */}
      <section id="inflation-rates" className="space-y-6 pt-4 scroll-mt-28">
        <div className="border-t border-slate-200 pt-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1.5">
              <span>Section 02</span>
              <span aria-hidden="true">·</span>
              <span>10-Year Historical Trajectory (2017–2026)</span>
              <span aria-hidden="true">·</span>
              <code className="text-indigo-600 font-semibold">#inflation-rates</code>
            </div>
            <div className="flex items-center gap-2.5">
              <Percent className="w-5 h-5 text-indigo-600" />
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Inflation Rates (10-Year Historical Trajectory)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
              Annual headline consumer price inflation metrics (2017–2026) benchmarking price stability, the 2022 post-pandemic inflation shock, disinflation trajectories, and official central bank policy bands.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* View Switcher: Trend Charts & Cards before Matrix Table */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setInflationViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  inflationViewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="View interactive trend charts & country profiles"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Trend Charts & Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setInflationViewMode('matrix')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  inflationViewMode === 'matrix'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="View full 10-year comparative matrix table"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Matrix Table</span>
              </button>
            </div>

            {/* CSV Export */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Download 10-year inflation matrix as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export 10Y CSV</span>
            </button>

            {/* Admin Update Button */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleOpenEditModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Admin: Update Rates</span>
              </button>
            )}
          </div>
        </div>

        {/* VIEW 1: INTERACTIVE TREND CHARTS & COUNTRY CARDS */}
        {inflationViewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {inflationRatesList.map((record) => {
              const maxRate = Math.max(...record.history_10y.map((h) => h.rate), 10);
              const cumulative = getCumulativePriceGrowth(record.history_10y);

              return (
                <div
                  key={record.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg select-none">{record.flag_emoji}</span>
                          <span className="text-xs font-mono font-bold text-slate-500">
                            {record.country_code}
                          </span>
                        </div>
                        <h3 className="font-serif text-base font-bold text-slate-900 leading-tight mt-1">
                          {record.country}
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate max-w-[200px]" title={record.benchmark_index}>
                          {record.benchmark_index}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {record.currency}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <div className="text-[10px] uppercase font-mono text-slate-400">2026 Latest Rate</div>
                        <div className="font-mono text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                          {record.current_rate.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-mono text-slate-400">10Y Avg</div>
                        <div className="font-mono text-sm font-bold text-slate-700 tabular-nums">
                          {record.ten_year_avg.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* 10-Year Bar Chart Visualization */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>2017</span>
                        <span className="text-slate-500 font-semibold">10-Year Annual Trend</span>
                        <span>2026</span>
                      </div>
                      <div className="flex items-end gap-1 h-16 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        {record.history_10y.map((item) => {
                          const heightPct = Math.max(12, Math.min(100, (item.rate / maxRate) * 100));
                          const isPeak = item.rate === record.ten_year_high.rate;
                          const isLatest = item.year === 2026;

                          let barColor = 'bg-slate-300';
                          if (isPeak) barColor = 'bg-rose-500';
                          else if (isLatest) barColor = 'bg-indigo-600';
                          else if (item.rate > 5.0) barColor = 'bg-amber-400';

                          return (
                            <div
                              key={item.year}
                              className="flex-1 flex flex-col justify-end items-center h-full group relative"
                            >
                              <div
                                className={`w-full rounded-xs transition-all ${barColor}`}
                                style={{ height: `${heightPct}%` }}
                              />
                              {/* Hover Tooltip */}
                              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-20 pointer-events-none">
                                <span>{item.year}: {item.rate.toFixed(1)}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Metrics Breakdown */}
                    <div className="space-y-1.5 text-xs font-mono tabular-nums text-slate-500 pt-1">
                      <div className="flex justify-between">
                        <span className="font-sans">10Y Peak:</span>
                        <span className="text-rose-700 font-semibold">
                          {record.ten_year_high.rate.toFixed(1)}% ({record.ten_year_high.year})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans">10Y Low:</span>
                        <span className="text-slate-800">
                          {record.ten_year_low.rate.toFixed(1)}% ({record.ten_year_low.year})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans">10Y Price Growth:</span>
                        <span className="text-slate-900 font-semibold">+{cumulative}%</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100">
                        <span className="font-sans">Target Band:</span>
                        <span className="text-slate-700 font-sans text-[11px] truncate max-w-[150px]">{record.target_band}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Agency Link & Edit */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    {record.official_source_url ? (
                      <a
                        href={record.official_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                      >
                        <span>{record.statistical_agency.split('(')[1]?.replace(')', '') || 'Source'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-400 font-sans">Official Bureau</span>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(record.id)}
                        className="font-sans font-semibold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 2: COMPARATIVE 10-YEAR MATRIX TABLE */}
        {inflationViewMode === 'matrix' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-900">
                  10-Year Annual Consumer Price Index (CPI) Matrix
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 font-mono">2017 to 2026 (YoY %)</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  <span>&gt;8.0% Shock Peak</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span>3.0%–8.0% Elevated</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span>&le;3.0% Anchored Target</span>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                      Country & Benchmark Index
                    </th>
                    {INFLATION_YEARS.map((yr) => (
                      <th
                        key={yr}
                        className={`py-3 px-3 text-right font-semibold min-w-[65px] ${
                          yr === 2026 ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''
                        }`}
                      >
                        {yr}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-right font-semibold min-w-[75px] bg-slate-100/70">
                      10Y Avg
                    </th>
                    <th className="py-3 px-3 text-center font-semibold min-w-[90px]">
                      10Y Range
                    </th>
                    <th className="py-3 px-3 font-semibold min-w-[130px]">
                      Target Band
                    </th>
                    <th className="py-3 px-3 text-center font-semibold min-w-[90px]">
                      Trend
                    </th>
                    {isAdmin && (
                      <th className="py-3 px-3 text-right font-semibold min-w-[60px]">
                        Edit
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {inflationRatesList.map((record) => {
                    const yearMap = new Map(record.history_10y.map((h) => [h.year, h.rate]));
                    const isSelected = selectedCountryId === record.id;
                    const peakRate = record.ten_year_high.rate;

                    return (
                      <tr
                        key={record.id}
                        onClick={() => setSelectedCountryId(record.id)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-50/20' : ''
                        }`}
                      >
                        {/* Country & Index Sticky Column */}
                        <td className="py-3.5 px-4 font-sans sticky left-0 bg-white z-10 shadow-xs border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-base select-none">{record.flag_emoji}</span>
                            <div>
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <span>{record.country}</span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {record.currency}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-normal truncate max-w-[180px]" title={record.benchmark_index}>
                                {record.benchmark_index}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 10-Year Annual Rate Columns */}
                        {INFLATION_YEARS.map((yr) => {
                          const val = yearMap.get(yr);
                          const isPeak = val !== undefined && val === peakRate && val > 3.0;
                          const isLatest = yr === 2026;

                          let textColor = 'text-slate-700';
                          if (val !== undefined) {
                            if (val > 8.0) textColor = 'text-rose-700 font-bold';
                            else if (val > 3.5) textColor = 'text-amber-700 font-semibold';
                            else if (val <= 2.2 && val >= 0) textColor = 'text-emerald-700';
                          }

                          return (
                            <td
                              key={yr}
                              className={`py-3.5 px-3 text-right text-xs ${
                                isLatest ? 'bg-indigo-50/40 font-bold text-indigo-900' : ''
                              }`}
                            >
                              <div className="flex items-center justify-end gap-1">
                                <span className={textColor}>
                                  {val !== undefined ? `${val.toFixed(1)}%` : '—'}
                                </span>
                                {isPeak && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"
                                    title={`10-Year Peak (${val?.toFixed(1)}%)`}
                                  />
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* 10Y Avg Column */}
                        <td className="py-3.5 px-3 text-right font-bold text-slate-900 bg-slate-50/80">
                          {record.ten_year_avg.toFixed(2)}%
                        </td>

                        {/* 10Y Range (Low - High) */}
                        <td className="py-3.5 px-3 text-center text-[11px] text-slate-600">
                          <span>{record.ten_year_low.rate.toFixed(1)}%</span>
                          <span className="text-slate-400 mx-1">→</span>
                          <span className="font-semibold text-rose-700">{record.ten_year_high.rate.toFixed(1)}%</span>
                        </td>

                        {/* Target Band */}
                        <td className="py-3.5 px-3 font-sans text-[11px] text-slate-600">
                          {record.target_band}
                        </td>

                        {/* Trend Status */}
                        <td className="py-3.5 px-3 text-center font-sans">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              record.trend_label === 'Disinflating'
                                ? 'text-emerald-700'
                                : record.trend_label === 'Accelerating'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {record.trend_label === 'Disinflating' && <TrendingDown className="w-3 h-3 text-emerald-600" />}
                            {record.trend_label === 'Accelerating' && <TrendingUp className="w-3 h-3 text-amber-600" />}
                            {record.trend_label === 'Anchored' && <Minus className="w-3 h-3 text-slate-400" />}
                            <span>{record.trend_label}</span>
                          </span>
                        </td>

                        {/* Admin Direct Edit Action */}
                        {isAdmin && (
                          <td className="py-3.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(record.id);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                              title={`Edit ${record.country} inflation data`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Selected Country Context Drawer / Insight Bar */}
            {selectedCountryId && (() => {
              const selected = inflationRatesList.find((c) => c.id === selectedCountryId);
              if (!selected) return null;
              const cumulative = getCumulativePriceGrowth(selected.history_10y);

              return (
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{selected.flag_emoji}</span>
                        <span>{selected.country} Inflation Dynamics</span>
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500 font-mono">Agency: {selected.statistical_agency}</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed font-sans max-w-3xl">
                      {selected.notes || 'Official national statistical agency headline consumer price index benchmarking.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 font-mono">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-sans uppercase">10Y Cumulative Price Growth</div>
                      <div className="text-sm font-extrabold text-slate-900 tabular-nums">+{cumulative}%</div>
                    </div>
                    {selected.official_source_url && (
                      <a
                        href={selected.official_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline"
                      >
                        <span>Official Agency Data</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Institutional Authority & Database Sync Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-start gap-3">
            <Layers className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800">
                Institutional Reliability & Database Persistence
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed max-w-3xl">
                Sovereign inflation records are standardized against official statistical authorities (BLS, Eurostat, NBS, ONS, SBJ, Stats SA, KNBS, MoSPI) and cached in <code className="font-mono text-slate-700">startupcreme.inflation_rates</code>. Rates are maintained for macro risk modeling and real yield calculations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto font-mono text-[11px] text-slate-500">
            <span>Last Snapshot: {new Date(snapshot.recorded_at).toLocaleDateString()}</span>
          </div>
        </div>
      </section>

      {/* =================================================================
          ADMIN EDIT INFLATION MODAL
         ================================================================= */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">
                    Update Inflation Rates: {editingRecord.country}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Persisting updates to startupcreme.inflation_rates database
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveInflationRecord} className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Select Country to Edit */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Select Sovereign Economy
                </label>
                <select
                  value={editingRecord.id}
                  onChange={(e) => {
                    const all = snapshot.inflation_rates && snapshot.inflation_rates.length > 0
                      ? snapshot.inflation_rates
                      : store.getInflationRates();
                    const target = all.find((c) => c.id === e.target.value);
                    if (target) setEditingRecord(JSON.parse(JSON.stringify(target)));
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(snapshot.inflation_rates || store.getInflationRates()).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.flag_emoji} {c.country} ({c.currency}) - {c.benchmark_index}
                    </option>
                  ))}
                </select>
              </div>

              {/* 10-Year Annual Rates Grid (2017 to 2026) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-700 font-semibold">
                    10-Year Annual Trajectory Rates (YoY %)
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">
                    Editable values for 2017–2026
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {INFLATION_YEARS.map((yr) => {
                    const currentHistoryItem = editingRecord.history_10y.find((h) => h.year === yr);
                    const currentVal = currentHistoryItem ? currentHistoryItem.rate : 0;

                    return (
                      <div key={yr} className="space-y-1">
                        <span className="block text-[11px] font-mono font-semibold text-slate-600">
                          {yr} {yr === 2026 && '(Latest)'}
                        </span>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={currentVal}
                            onChange={(e) => {
                              const newRate = parseFloat(e.target.value) || 0;
                              const updatedHistory = editingRecord.history_10y.map((h) =>
                                h.year === yr ? { ...h, rate: newRate } : h
                              );
                              // If year wasn't present, add it
                              if (!editingRecord.history_10y.some((h) => h.year === yr)) {
                                updatedHistory.push({ year: yr, rate: newRate });
                              }
                              setEditingRecord({
                                ...editingRecord,
                                history_10y: updatedHistory,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono tabular-nums text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                          <span className="absolute right-2 top-1.5 text-slate-400 font-mono text-xs pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Target Band & Trend Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Central Bank Target Tolerance Band
                  </label>
                  <input
                    type="text"
                    value={editingRecord.target_band}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, target_band: e.target.value })
                    }
                    placeholder="e.g. 2.0% Symmetric Target"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Trend Status
                  </label>
                  <select
                    value={editingRecord.trend_label}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        trend_label: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Disinflating">Disinflating</option>
                    <option value="Accelerating">Accelerating</option>
                    <option value="Anchored">Anchored</option>
                    <option value="Volatile">Volatile</option>
                  </select>
                </div>
              </div>

              {/* Statistical Agency & Official Source URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Statistical Reporting Agency
                  </label>
                  <input
                    type="text"
                    value={editingRecord.statistical_agency}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        statistical_agency: e.target.value,
                      })
                    }
                    placeholder="e.g. U.S. Bureau of Labor Statistics (BLS)"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Official Statistical Source URL
                  </label>
                  <input
                    type="url"
                    value={editingRecord.official_source_url}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        official_source_url: e.target.value,
                      })
                    }
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Notes & Institutional Commentary */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Macro Context & Notes
                </label>
                <textarea
                  rows={2}
                  value={editingRecord.notes || ''}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, notes: e.target.value })
                  }
                  placeholder="Key drivers (energy, food, FX transmission, policy stance)..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Feedback Message */}
              {adminSaveMessage && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2 text-xs ${
                    adminSaveMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {adminSaveMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{adminSaveMessage.text}</span>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingInflation}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingInflation ? 'Saving to Database...' : 'Save & Sync Snapshot'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
