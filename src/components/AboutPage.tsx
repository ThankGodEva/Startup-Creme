import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  ShieldCheck,
  Code2,
  TrendingUp,
  Cpu,
  Globe,
  ExternalLink,
  ArrowRight,
  Database,
  Scale,
  Award,
} from 'lucide-react';
import { NavigationTab, isMarketsEnabled } from '../lib/router';
import { useHashAnchorScroll, Route } from '../hooks/useHashAnchorScroll';
import { updatePageSEO } from '../lib/seo';

/**
 * Schema.org JSON-LD graph combining NewsMediaOrganization (StartupCrème),
 * parent Organization (Habinsoft Technologies Limited), and Founder/CEO Person (Chibueze ThankGod)
 * for maximum Google E-E-A-T and Knowledge Graph indexing.
 */
export const ABOUT_PAGE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['NewsMediaOrganization', 'Organization'],
      '@id': 'https://www.startupcreme.com/#organization',
      name: 'StartupCrème',
      alternateName: 'Startup Crème',
      url: 'https://www.startupcreme.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.startupcreme.com/logo.jpg',
        width: 512,
        height: 512,
      },
      description:
        'StartupCrème is a global digital publication and opportunity engine helping founders, software architects, and finance professionals build, fund, and scale companies in the age of AI.',
      foundingDate: '2024',
      founder: {
        '@id': 'https://www.startupcreme.com/#founder',
      },
      parentOrganization: {
        '@type': 'Organization',
        '@id': 'https://habinsoft.com/#organization',
        name: 'Habinsoft Technologies Limited',
        url: 'https://habinsoft.com',
        description:
          'Registered software and technology company specializing in scalable web infrastructure, business intelligence, and digital publishing.',
        founder: {
          '@id': 'https://www.startupcreme.com/#founder',
        },
      },
      publishingPrinciples: 'https://www.startupcreme.com/about#editorial-standards',
      ethicsPolicy: 'https://www.startupcreme.com/about#editorial-standards',
      KnowsAbout: [
        'Venture Capital & SaaS Financial Modeling',
        'Macroeconomic Policy & Central Bank Interest Rates',
        'Cloud Infrastructure FinOps & Pricing Benchmarks',
        'Artificial Intelligence & Autonomous Workflow Automation',
        'Full-Stack Software Architecture',
        'Startup Accelerators, Grants & Fractional Executive Talent',
      ],
    },
    {
      '@type': 'Person',
      '@id': 'https://www.startupcreme.com/#founder',
      name: 'Chibueze ThankGod',
      jobTitle: 'Founder & Chief Executive Officer',
      description:
        'Software Engineer, Full-Stack Developer, and Tech Entrepreneur leading Habinsoft Technologies Limited and StartupCrème.',
      url: 'https://www.startupcreme.com/about#leadership',
      worksFor: [
        {
          '@id': 'https://habinsoft.com/#organization',
        },
        {
          '@id': 'https://www.startupcreme.com/#organization',
        },
      ],
      knowsAbout: [
        'Full-Stack Software Engineering',
        'Distributed Web Infrastructure',
        'Financial Technology Systems',
        'AI Workflow Automation',
        'Technical SEO & Digital Publishing',
      ],
    },
    {
      '@type': 'AboutPage',
      '@id': 'https://www.startupcreme.com/about#webpage',
      url: 'https://www.startupcreme.com/about',
      name: 'About StartupCrème | Mission, Leadership & Editorial Standards',
      description:
        'Learn how StartupCrème, built and operated by Habinsoft Technologies Limited under the leadership of Chibueze ThankGod, empowers founders, software architects, and finance leaders.',
      isPartOf: {
        '@id': 'https://www.startupcreme.com/#organization',
      },
      mainEntity: {
        '@id': 'https://www.startupcreme.com/#organization',
      },
    },
  ],
};

/**
 * React Router 7 compatible meta export for /about
 */
export function meta({ location }: Route.MetaArgs) {
  const hash = location.hash || '';
  const canonicalUrl = `https://www.startupcreme.com/about${hash}`;

  return [
    {
      title: 'About StartupCrème | Institutional Finance, Tech & AI Intelligence',
    },
    {
      name: 'description',
      content:
        'StartupCrème is a global guide and opportunity engine operated by Habinsoft Technologies Limited and led by Chibueze ThankGod, helping founders, software architects, and finance professionals scale in the age of AI.',
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
    { property: 'og:url', content: canonicalUrl },
  ];
}

interface AboutPageProps {
  currentLocale?: string;
  onNavigateTab?: (tab: NavigationTab, hash?: string) => void;
}

type AboutSectionHash =
  | 'mission'
  | 'origin-story'
  | 'leadership'
  | 'editorial-standards';

export const AboutPage: React.FC<AboutPageProps> = ({
  currentLocale = 'en-us',
  onNavigateTab,
}) => {
  const [activeSection, setActiveSection] = useState<AboutSectionHash>('mission');

  const handleHashChange = useCallback((rawHash: string) => {
    const clean = rawHash.replace(/^#/, '').toLowerCase() as AboutSectionHash;
    if (
      [
        'mission',
        'origin-story',
        'leadership',
        'editorial-standards',
      ].includes(clean)
    ) {
      setActiveSection(clean);
    } else {
      setActiveSection('mission');
    }
  }, []);

  const { navigateToHash } = useHashAnchorScroll(handleHashChange, {
    defaultHash: 'mission',
    validHashes: [
      'mission',
      'origin-story',
      'leadership',
      'editorial-standards',
    ],
    metaFn: meta,
  });

  useEffect(() => {
    updatePageSEO({
      title: 'About StartupCrème | Institutional Finance, Tech & AI Intelligence',
      description:
        'StartupCrème is a global guide dedicated to helping founders, software architects, and finance professionals build, fund, and scale companies in the age of AI. Operated by Habinsoft Technologies Limited.',
      canonicalUrl: 'https://www.startupcreme.com/about',
      type: 'website',
    });

    // Inject Organization & Person JSON-LD into <head> for E-E-A-T verification
    const scriptId = 'startupcreme-about-jsonld';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(ABOUT_PAGE_JSON_LD);

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Institutional Hero Section (#mission) */}
      <section
        id="mission"
        className="bg-white border-b border-slate-200 pt-12 pb-14 px-4 scroll-mt-24"
      >
        <div className="max-w-6xl mx-auto">
          {/* Unboxed Editorial Kicker (Zero-Pill Discipline) */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 mb-4">
            <span className="text-emerald-700 font-semibold">Institutional Profile</span>
            <span aria-hidden="true">·</span>
            <span>Habinsoft Technologies Limited</span>
            <span aria-hidden="true">·</span>
            <span>E-E-A-T & Editorial Governance</span>
            <span aria-hidden="true">·</span>
            <code className="text-slate-700">/about</code>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.12] max-w-4xl text-balance">
            Engineering the Intelligence Layer for Modern Finance, Software Architecture, and AI-Driven Enterprise Scaling.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 mt-5 max-w-3xl leading-relaxed">
            <strong className="text-slate-900 font-semibold">StartupCrème</strong> (
            <code className="text-sm font-mono text-slate-800">startupcreme.com</code>) is a global guide and opportunity engine dedicated to helping founders, software architects, and finance professionals build, fund, and scale resilient companies in the age of artificial intelligence.
          </p>

          {/* Section Jump Navigation Bar */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl overflow-x-auto max-w-full">
              {(
                [
                  { id: 'mission', label: '01. Mission & Pillars' },
                  { id: 'origin-story', label: '02. The Origin Story' },
                  { id: 'leadership', label: '03. Leadership & Habinsoft' },
                  { id: 'editorial-standards', label: '04. Editorial & Data Standards' },
                ] as Array<{ id: AboutSectionHash; label: string }>
              ).map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToHash(item.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeSection === item.id
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
              <span>Parent Entity: Habinsoft Technologies Ltd</span>
              <span aria-hidden="true">·</span>
              <a
                href="https://habinsoft.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-900 font-semibold hover:text-emerald-700 inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <span>habinsoft.com</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 pt-12 space-y-12">
        {/* Core Pillars Grid */}
        <section aria-labelledby="pillars-heading">
          <div className="mb-6">
            <div className="text-xs font-mono text-emerald-700 font-semibold mb-1">
              01. Core Mandate & Institutional Pillars
            </div>
            <h2
              id="pillars-heading"
              className="font-serif text-2xl sm:text-3xl font-bold text-slate-900"
            >
              Three Integrated Pillars of Execution
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Every research dispatch, financial simulator, and directory index on StartupCrème is architected around three foundational pillars.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-4 pb-3 border-b border-slate-100">
                  <span>Pillar 01</span>
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900 mb-2">
                  Rigorous Financial Analysis & Macro Rate Intelligence
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Institutional-grade coverage of venture capital liquidity, private credit, sovereign monetary policy, SaaS unit economics, and multi-round cap table dilution modeling for CFOs and capital allocators.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('finance')}
                  className="font-semibold text-slate-900 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Explore Finance Silo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('calculators', '#saas-runway')}
                  className="font-mono text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  /calculators
                </button>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-4 pb-3 border-b border-slate-100">
                  <span>Pillar 02</span>
                  <Cpu className="w-4 h-4 text-cyan-700" />
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900 mb-2">
                  Cutting-Edge Tech Stacks & AI Workflow Automation
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Deep architectural blueprints covering distributed systems, serverless Postgres economics, GPU cluster FinOps, autonomous AI agents, and production-ready engineering workflows.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('tech')}
                  className="font-semibold text-slate-900 hover:text-cyan-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Explore Tech Silo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('calculators', '#cloud-cost-estimator')}
                  className="font-mono text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  #cloud-cost-estimator
                </button>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-4 pb-3 border-b border-slate-100">
                  <span>Pillar 03</span>
                  <Globe className="w-4 h-4 text-teal-700" />
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900 mb-2">
                  Actionable Startup Directories, Grants & Remote Talent
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Verified indexing of high-growth startups across FinTech, AI, E-Commerce, and Cloud Infrastructure, paired with curated non-dilutive grant pipelines and remote fractional executive mandates.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('directory', '#startups-directory')}
                  className="font-semibold text-slate-900 hover:text-teal-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Startup Directory</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('careers', '#remote-jobs-board')}
                  className="font-mono text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  /careers
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: The Origin Story (#origin-story) */}
        <section
          id="origin-story"
          className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-xs scroll-mt-24"
        >
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4">
              <div className="text-xs font-mono text-emerald-700 font-semibold mb-1">
                02. The Origin Story
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
                From Developer Publication to Institutional Opportunity Engine
              </h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Why we unified financial journalism, interactive quantitative tools, and startup discovery under a single engineering roof.
              </p>

              <dl className="mt-6 pt-6 border-t border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Architecture Standard</dt>
                  <dd className="font-mono font-semibold text-slate-900">YMYL & E-E-A-T Compliant</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Primary Coverage</dt>
                  <dd className="font-mono font-semibold text-slate-900">Finance · Tech · AI</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Global Editions</dt>
                  <dd className="font-mono font-semibold text-slate-900 tabular-nums">7 Regional Locales</dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-8 space-y-4 text-sm text-slate-600 leading-relaxed lg:border-l lg:border-slate-200 lg:pl-8">
              <p>
                <strong className="text-slate-900 font-semibold">StartupCrème began with a clear observation:</strong> the modern technology founder and software architect can no longer separate code decisions from capital decisions. In an era defined by foundation models, usage-based cloud billing, and shifting central bank liquidity cycles, choosing between serverless compute tiers or structuring a seed-stage cap table is simultaneously an engineering problem and a corporate finance problem.
              </p>
              <p>
                What started as a developer-driven technical publication analyzing software architecture and fintech infrastructure rapidly exposed a deeper gap in the market. Founders, CTOs, and finance operators were forced to piece together fragmented information—reading macroeconomic commentary on one platform, building ad-hoc runway and dilution spreadsheets in isolation, and searching across scattered boards for verified startup benchmarks, grants, and remote engineering talent.
              </p>
              <p>
                Under the stewardship of <strong className="text-slate-900 font-semibold">Habinsoft Technologies Limited</strong>, StartupCrème was re-architected from a standalone editorial publication into a comprehensive, interactive <strong className="text-slate-900 font-semibold">opportunity and intelligence engine</strong>. Today, alongside our deep-dive Finance and Technology silos, StartupCrème provides interactive SaaS runway and equity dilution calculators, cloud infrastructure cost estimators, an admin-verified Startup &amp; FinTech Directory, and a curated remote executive and engineering talent board.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Leadership & Parent Organization (#leadership) */}
        <section
          id="leadership"
          className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-xs scroll-mt-24"
        >
          <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-emerald-700 font-semibold mb-1">
                03. Leadership & Parent Organization
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
                Corporate Governance & Executive Leadership
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Built with institutional software engineering discipline and transparent corporate accountability.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-500">
              <span>Operating Entity: Habinsoft Technologies Limited</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Parent Company Card: Habinsoft Technologies Limited */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-500 mb-3">
                  <span className="font-semibold text-slate-900">Parent Organization</span>
                  <span>habinsoft.com</span>
                </div>

                <h3 className="font-serif text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Habinsoft Technologies Limited</span>
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  <strong className="text-slate-900">Habinsoft Technologies Limited</strong> (
                  <a
                    href="https://habinsoft.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline font-medium"
                  >
                    habinsoft.com
                  </a>
                  ) is a registered software and technology company specializing in scalable web infrastructure, enterprise business intelligence systems, and authoritative digital publishing platforms.
                </p>

                <p className="text-xs text-slate-500 leading-relaxed mb-5">
                  Habinsoft Technologies Limited provides the underlying cloud architecture, database security governance, automated data pipelines, and long-term capital backing that power StartupCrème's global operations.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <div className="text-slate-500 font-mono">
                  <span>Core Practice: Web Infra · BI · Publishing</span>
                </div>
                <a
                  href="https://habinsoft.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-emerald-700 transition-colors"
                >
                  <span>Visit habinsoft.com</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Founder & CEO Card: Chibueze ThankGod */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-500 mb-3">
                  <span className="font-semibold text-slate-900">Founder & Chief Executive Officer</span>
                  <span>Executive Leadership</span>
                </div>

                <h3 className="font-serif text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-cyan-700 shrink-0" />
                  <span>Chibueze ThankGod</span>
                </h3>

                <div className="text-xs text-slate-500 font-mono mb-3">
                  Software Engineer · Full-Stack Developer · Tech Entrepreneur
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  <strong className="text-slate-900">Chibueze ThankGod</strong> is the Founder and CEO of Habinsoft Technologies Limited and the chief architect behind StartupCrème. A seasoned Software Engineer, Full-Stack Developer, and Tech Entrepreneur, he leads both the technical systems engineering and editorial product strategy of the platform.
                </p>

                <p className="text-xs text-slate-500 leading-relaxed mb-5">
                  Drawing on hands-on experience building distributed web applications, relational data architectures, and automated AI workflows, Chibueze established StartupCrème to ensure that founders and financial operators have access to verifiable, engineering-grade intelligence rather than speculative commentary.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>Discipline: Full-Stack Systems & FinTech Architecture</span>
                <span className="text-emerald-700 font-semibold">Verified Author & Architect</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Editorial & Data Standards (#editorial-standards) */}
        <section
          id="editorial-standards"
          className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-xs scroll-mt-24"
        >
          <div className="border-b border-slate-200 pb-6 mb-8">
            <div className="text-xs font-mono text-emerald-700 font-semibold mb-1">
              04. Our Editorial & Data Standards
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
              Methodology, Verification & YMYL Data Integrity
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Because financial modeling, central bank monetary policy, and cloud infrastructure budgeting directly impact corporate capital allocation (Your Money or Your Life — YMYL), StartupCrème enforces strict verification protocols across all data modules and editorial publications.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
                <Scale className="w-4 h-4 text-emerald-700" />
                <span>01 · Monetary & Central Bank Rate Verification</span>
              </div>
              <h3 className="font-serif text-base font-bold text-slate-900 mb-2">
                Primary-Source Central Bank Auditing
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Benchmark policy rates tracked by StartupCrème (including the US Federal Reserve FOMC target range, ECB Deposit Facility Rate, Bank of England Official Bank Rate, CBN Monetary Policy Rate, SARB, CBK, BoJ, and RBI) are cross-checked against official Monetary Policy Committee (MPC) communiqués and include direct source links to each central bank's primary publication.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
                <Database className="w-4 h-4 text-cyan-700" />
                <span>02 · Cloud Infrastructure & FinOps Benchmarks</span>
              </div>
              <h3 className="font-serif text-base font-bold text-slate-900 mb-2">
                Published On-Demand & Enterprise Rate Cards
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Our Cloud Infrastructure Cost Estimator and Pricing Index evaluate published unit pricing across AWS, Google Cloud, Supabase, Vercel, Cloudflare, and Neon—accounting for serverless invocation rates, compute GB-seconds, managed PostgreSQL storage, data egress thresholds, and AI GPU hourly commitments.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <span>03 · Admin-Gated Directory & Talent Curation</span>
              </div>
              <h3 className="font-serif text-base font-bold text-slate-900 mb-2">
                Authenticated Submissions & Human Moderation
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Every startup profile submitted to the StartupCrème Directory (<code className="font-mono text-slate-700">/directory</code>) and every role submitted to the Remote Startup Job Board (<code className="font-mono text-slate-700">/careers</code>) requires authenticated user attribution and mandatory administrator review before appearing to public viewers.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
                <Award className="w-4 h-4 text-slate-800" />
                <span>04 · Editorial Independence & Non-Sponsored Analysis</span>
              </div>
              <h3 className="font-serif text-base font-bold text-slate-900 mb-2">
                Strict Separation of Research & Commercial Partnerships
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Technical architecture evaluations, venture capital analyses, accelerator and grant listings, and financial calculator formulas are produced independently by our engineering and editorial team. StartupCrème does not accept undisclosed paid placements in its benchmark indices.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom Institutional CTA Bar */}
        <section className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
          <div>
            <div className="text-xs font-mono text-slate-500 mb-1">
              Explore the StartupCrème Ecosystem
            </div>
            <h2 className="font-serif text-xl font-bold text-slate-900">
              Ready to Model Your Runway, Benchmark Your Stack, or Index Your Company?
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Access our interactive financial tools, verified startup directory, and remote executive talent board.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab?.('calculators', '#saas-runway')}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Launch Financial Calculators
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab?.('directory', '#startups-directory')}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Browse Startup Directory
            </button>
            {isMarketsEnabled() && (
              <button
                type="button"
                onClick={() => onNavigateTab?.('rates', '#central-bank-rates')}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                View Macro & Cloud Rates
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
