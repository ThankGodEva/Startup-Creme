import React from 'react';
import { TrendingUp, Cpu, ArrowRight, Layers, Sparkles } from 'lucide-react';
import { getTabUrl } from '../lib/router';

interface DualHeroProps {
  currentLocale: string;
  onSelectSilo: (silo: 'finance' | 'tech') => void;
  onOpenDiscussion: () => void;
}

export const DualHero: React.FC<DualHeroProps> = ({
  currentLocale,
  onSelectSilo,
  onOpenDiscussion,
}) => {
  return (
    <div className="relative overflow-hidden bg-slate-50 border-b border-slate-200 text-slate-900 py-12 px-4">
      {/* Background Decorative Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e130_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e130_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Title & Tagline */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-700 shadow-sm mb-4">
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            <span>Topical Authority Subpath Siloing • <code className="text-cyan-700 font-bold">/{currentLocale}</code></span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4 leading-tight">
            Where High-Value Capital Meets <br className="hidden sm:inline" />
            <span className="text-teal-700 block sm:inline mt-1 sm:mt-0">
              Deep Technology Engineering
            </span>
          </h1>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-sans">
            StartupCrème provides rigorous, non-sponsored editorial intelligence and institutional analysis for founders, venture capital partners, and software architects.
          </p>
        </div>

        {/* Dual-Hero Split Grid */}
        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          {/* Finance Silo Card */}
          <a 
            href={getTabUrl('finance', currentLocale)}
            onClick={(e) => {
              e.preventDefault();
              onSelectSilo('finance');
            }}
            className="group relative rounded-2xl bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30 border border-slate-200 hover:border-emerald-500/80 p-8 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden block text-left"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="w-44 h-44 text-emerald-600" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-mono font-bold">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                  Finance & Capital
                </span>
                <span className="text-xs font-mono text-emerald-700 font-bold">/{currentLocale}/finance</span>
              </div>

              <h2 className="font-serif text-2xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors mb-3">
                Macro Economics, Private Debt & Venture Capital
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                Institutional analysis of yield curve shifts, secondary fund valuations, direct ARR debt packages, and LP distribution bottlenecks.
              </p>
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-700 shadow-xs">Private Credit</span>
                <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-700 shadow-xs">LP Liquidity</span>
                <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-700 shadow-xs">Fintech Infrastructure</span>
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 group-hover:translate-x-1.5 transition-transform">
                <span>Enter Finance Intelligence Space</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </a>

          {/* Tech Silo Card */}
          <a 
            href={getTabUrl('tech', currentLocale)}
            onClick={(e) => {
              e.preventDefault();
              onSelectSilo('tech');
            }}
            className="group relative rounded-2xl bg-gradient-to-br from-white via-cyan-50/40 to-cyan-100/30 border border-slate-200 hover:border-cyan-500/80 p-8 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden block text-left"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Cpu className="w-44 h-44 text-cyan-600" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-900 text-xs font-mono font-bold">
                  <Cpu className="w-3.5 h-3.5 text-cyan-700" />
                  Technology & Systems
                </span>
                <span className="text-xs font-mono text-cyan-700 font-bold">/{currentLocale}/tech</span>
              </div>

              <h2 className="font-serif text-2xl font-bold text-slate-900 group-hover:text-cyan-700 transition-colors mb-3">
                Autonomous Agents, GPU Systems & Compilers
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                Engineering deep-dives on multi-agent execution DAGs, silicon photonics data center interconnects, and LLM inference unit economics.
              </p>
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-700 shadow-xs">LLM Compilers</span>
                <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-700 shadow-xs">Silicon Photonics</span>
                <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-700 shadow-xs">Agentic DAGs</span>
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-bold text-cyan-700 group-hover:translate-x-1.5 transition-transform">
                <span>Enter Tech Intelligence Space</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </a>
        </div>

        {/* Quick Forum CTA Banner */}
        <div className="mt-8 bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Community Discussion Forum Active</h3>
              <p className="text-xs text-slate-600">Join verified founders & engineers discussing GPU costs, ARR multiples, and cross-border equity.</p>
            </div>
          </div>
          <a
            href={getTabUrl('discussion', currentLocale)}
            onClick={(e) => {
              e.preventDefault();
              onOpenDiscussion();
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors shrink-0 shadow-sm text-center"
          >
            Join Discussion Forum ({getTabUrl('discussion', currentLocale)})
          </a>
        </div>
      </div>
    </div>
  );
};
