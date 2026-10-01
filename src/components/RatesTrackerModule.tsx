import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Server,
  Landmark,
  Webhook,
  CheckCircle2,
} from 'lucide-react';
import { RateSnapshotPayload, CentralBankRate, CloudProviderIndexEntry } from '../types';
import { store } from '../lib/store';
import { useHashAnchorScroll, Route } from '../hooks/useHashAnchorScroll';

/**
 * React Router 7 hash-aware meta export for /markets/rates
 */
export function meta({ location }: Route.MetaArgs) {
  const hash = location.hash || '#central-bank-rates';
  const canonicalUrl = `https://www.startupcreme.com/markets/rates${hash}`;

  return [
    { title: 'Macro Central Bank & Cloud Rate Trackers | StartupCrème' },
    {
      name: 'description',
      content:
        'Live institutional benchmarking of sovereign central bank policy rates alongside developer cloud compute, database storage, and bandwidth egress unit pricing.',
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

export const RatesTrackerModule: React.FC = () => {
  const [snapshot, setSnapshot] = useState<RateSnapshotPayload>(() => store.getRateSnapshot());
  const [activeRateSection, setActiveRateSection] = useState<'central-bank-rates' | 'cloud-pricing-index'>('central-bank-rates');
  const [regionFilter, setRegionFilter] = useState<'all' | 'americas_eu' | 'africa_apac'>('all');
  const [cloudCategoryFilter, setCloudCategoryFilter] = useState<string>('All Categories');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [showWebhookSpec, setShowWebhookSpec] = useState(false);

  const handleHashSectionChange = useCallback((rawHash: string) => {
    const clean = rawHash.replace(/^#/, '').toLowerCase();
    if (clean === 'cloud-pricing-index') {
      setActiveRateSection('cloud-pricing-index');
    } else {
      setActiveRateSection('central-bank-rates');
    }
  }, []);

  const { navigateToHash } = useHashAnchorScroll(handleHashSectionChange, {
    defaultHash: 'central-bank-rates',
    validHashes: ['central-bank-rates', 'cloud-pricing-index'],
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

  const filteredCloudIndex = useMemo(() => {
    if (cloudCategoryFilter === 'All Categories') {
      return snapshot.cloud_pricing_index;
    }
    return snapshot.cloud_pricing_index.filter((c) => c.category === cloudCategoryFilter);
  }, [snapshot.cloud_pricing_index, cloudCategoryFilter]);

  const handleWebhookSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    const updated = await store.triggerRateWebhookSync();
    setSnapshot(updated);
    setIsSyncing(false);
    setSyncSuccessMessage('Snapshot synchronized via /api/webhooks/n8n/rates and cached in startupcreme.rate_snapshots.');
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-12">
      {/* Module Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
            <span>Module 03</span>
            <span aria-hidden="true">·</span>
            <span>Monetary Policy & Infrastructure Index</span>
            <span aria-hidden="true">·</span>
            <code className="text-emerald-700 font-semibold">/markets/rates#{activeRateSection}</code>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Macro & Cloud Rate Trackers
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
            Live institutional benchmarking of sovereign central bank policy rates alongside developer cloud compute, database storage, and bandwidth egress unit pricing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          {/* Hash-Synchronized Section Anchor Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl">
            <a
              href="#central-bank-rates"
              onClick={(e) => {
                e.preventDefault();
                navigateToHash('central-bank-rates');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeRateSection === 'central-bank-rates'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-emerald-700" />
              <span>Central Bank Rates</span>
            </a>

            <a
              href="#cloud-pricing-index"
              onClick={(e) => {
                e.preventDefault();
                navigateToHash('cloud-pricing-index');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeRateSection === 'cloud-pricing-index'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-cyan-700" />
              <span>Cloud Pricing Index</span>
            </a>
          </div>

          <button
            type="button"
            onClick={() => setShowWebhookSpec(!showWebhookSpec)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Webhook className="w-3.5 h-3.5 text-cyan-600" />
            <span>n8n Webhook Architecture</span>
          </button>

          <button
            type="button"
            onClick={handleWebhookSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Snapshot...' : 'Sync Rate Snapshot'}</span>
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

      {/* Expandable n8n Webhook & Supabase Snapshot Architecture Drawer */}
      {showWebhookSpec && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-serif text-base font-bold text-slate-900">
                Automated n8n Webhook & Supabase Rate Snapshot Architecture
              </h2>
              <p className="text-xs text-slate-500">
                Snapshots are ingested via scheduled n8n HTTP nodes into <code className="font-mono text-slate-800">startupcreme.rate_snapshots</code>
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Last Sync: {new Date(snapshot.recorded_at).toLocaleString()}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="font-semibold text-slate-900">Webhook Ingestion Endpoint</div>
              <div className="font-mono text-emerald-700 bg-white border border-slate-200 rounded-lg px-3 py-2">
                POST /api/webhooks/n8n/rates
              </div>
              <p className="text-slate-500 leading-relaxed">
                Accepts JSON arrays of <code className="font-mono">central_bank_rates</code> and <code className="font-mono">cloud_pricing_index</code> from automated n8n cron workflows and persists a timestamped snapshot row in Supabase.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="font-semibold text-slate-900">Active Snapshot Metadata</div>
              <div className="font-mono text-[11px] text-slate-700 space-y-1">
                <div>Snapshot ID: {snapshot.id}</div>
                <div>Source Pipeline: {snapshot.source}</div>
                <div>Central Banks Tracked: {snapshot.central_bank_rates.length} Institutions</div>
                <div>Cloud Providers Indexed: {snapshot.cloud_pricing_index.length} Tiers</div>
              </div>
            </div>
          </div>
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

          {/* Region Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setRegionFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                regionFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Central Banks ({snapshot.central_bank_rates.length})
            </button>
            <button
              type="button"
              onClick={() => setRegionFilter('americas_eu')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                regionFilter === 'americas_eu' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              US & Europe
            </button>
            <button
              type="button"
              onClick={() => setRegionFilter('africa_apac')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                regionFilter === 'africa_apac' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Africa & APAC
            </button>
          </div>
        </div>

        {/* Central Bank Cards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredBanks.map((bank) => {
            const maxHist = Math.max(...bank.historical_12m, 1);
            return (
              <div
                key={bank.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-mono font-bold text-slate-800">{bank.bank_code}</span>
                    <span>
                      {bank.country_or_region} · <strong className="font-mono">{bank.currency}</strong>
                    </span>
                  </div>

                  <h3 className="font-serif text-base font-bold text-slate-900 mb-0.5">
                    {bank.bank_name}
                  </h3>
                  {bank.rate_instrument && (
                    <div className="text-[11px] text-slate-500 mb-2.5 truncate">
                      {bank.rate_instrument}
                    </div>
                  )}

                  <div className="flex items-baseline justify-between gap-2 mb-3">
                    <div className="font-mono text-3xl font-extrabold text-slate-900 tabular-nums">
                      {bank.current_rate.toFixed(2)}%
                    </div>
                    {renderTrendIndicator(bank)}
                  </div>

                  {/* Mini 12-Month Trend Bars */}
                  <div className="flex items-end gap-1 h-8 my-3 pt-1 border-b border-slate-100">
                    {bank.historical_12m.map((val, idx) => {
                      const hPct = Math.max(15, Math.min(100, (val / maxHist) * 100));
                      return (
                        <div
                          key={idx}
                          style={{ height: `${hPct}%` }}
                          className={`flex-1 rounded-t ${
                            idx === bank.historical_12m.length - 1
                              ? 'bg-slate-900'
                              : 'bg-slate-200'
                          }`}
                          title={`${val.toFixed(2)}%`}
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
          SECTION 2: CLOUD PRICING INDEX BENCHMARK TABLE (#cloud-pricing-index)
         ================================================================= */}
      <section id="cloud-pricing-index" className="space-y-6 scroll-mt-28">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-700" />
              <h2 className="font-serif text-2xl font-bold text-slate-900">
                Cloud Infrastructure Pricing Index
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Baseline developer tier comparison across serverless execution, managed Postgres storage, data egress, and H100 GPUs
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl overflow-x-auto self-start sm:self-auto">
            {[
              'All Categories',
              'Serverless Compute',
              'Managed Postgres',
              'Bandwidth & Egress',
              'AI GPU Compute',
            ].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCloudCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  cloudCategoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3.5 px-4">Cloud / Backend Provider</th>
                  <th className="py-3.5 px-4">Primary Index Focus</th>
                  <th className="py-3.5 px-4 text-right">Serverless (/1M Req)</th>
                  <th className="py-3.5 px-4 text-right">Compute (/GB-sec)</th>
                  <th className="py-3.5 px-4 text-right">DB Storage (/GB-mo)</th>
                  <th className="py-3.5 px-4 text-right">Egress (/GB)</th>
                  <th className="py-3.5 px-4 text-right">H100 GPU (/hr)</th>
                  <th className="py-3.5 px-4 text-right">30d Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-mono tabular-nums">
                {filteredCloudIndex.map((entry: CloudProviderIndexEntry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 font-sans">
                      <div className="font-bold text-slate-900">{entry.provider}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 max-w-md">{entry.notes}</div>
                    </td>
                    <td className="py-4 px-4 font-sans text-slate-600">
                      {entry.category}
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-slate-900">
                      ${entry.serverless_per_1m_req.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-600">
                      ${entry.compute_gb_sec.toFixed(6)}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-800">
                      ${entry.db_storage_per_gb.toFixed(3)}
                    </td>
                    <td
                      className={`py-4 px-4 text-right font-semibold ${
                        entry.egress_per_gb === 0 ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {entry.egress_per_gb === 0 ? '$0.00 (Zero Egress)' : `$${entry.egress_per_gb.toFixed(2)}`}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-700">
                      {entry.gpu_h100_hourly ? `$${entry.gpu_h100_hourly.toFixed(2)}/hr` : '—'}
                    </td>
                    <td className="py-4 px-4 text-right font-sans">
                      {entry.trend_30d === 'down' ? (
                        <span className="text-emerald-700 font-semibold">Decreasing</span>
                      ) : entry.trend_30d === 'up' ? (
                        <span className="text-amber-700 font-semibold">Increasing</span>
                      ) : (
                        <span className="text-slate-500">Stable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
