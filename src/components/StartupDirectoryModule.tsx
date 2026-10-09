import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  ExternalLink,
  Plus,
  X,
  Building2,
  CheckCircle2,
  SlidersHorizontal,
  Trash2,
  ShieldCheck,
  Clock,
  Lock,
} from 'lucide-react';
import { StartupEntry, StartupStage, CreateStartupPayload, UserProfile } from '../types';
import { store } from '../lib/store';
import { useHashAnchorScroll, Route } from '../hooks/useHashAnchorScroll';

/**
 * React Router 7 hash-aware meta export for /directory
 */
export function meta({ location }: Route.MetaArgs) {
  const hash = location.hash || '#startups-directory';
  const canonicalUrl = `https://www.startupcreme.com/directory${hash}`;

  return [
    { title: 'The Startup & FinTech Directory | StartupCrème' },
    {
      name: 'description',
      content:
        'Curated index of high-signal early-stage and growth companies building financial infrastructure, autonomous AI systems, e-commerce platforms, and modern developer tooling.',
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
    { property: 'og:url', content: canonicalUrl },
  ];
}

/**
 * React Router 7 compatible loader for /directory
 */
export async function loader({ request }: { request?: Request } = {}) {
  let stage = 'all';
  let vertical = 'all';
  if (request) {
    const url = new URL(request.url);
    stage = url.searchParams.get('stage') || 'all';
    vertical = url.searchParams.get('vertical') || 'all';
  }
  const startups = await store.fetchStartups();
  return {
    startups,
    filters: { stage, vertical },
  };
}

/**
 * React Router 7 compatible action for submitting a startup to startupcreme.startups
 */
export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const payload: CreateStartupPayload = {
    name: String(formData.get('name') || ''),
    tagline: String(formData.get('tagline') || ''),
    description: String(formData.get('description') || ''),
    website_url: String(formData.get('website_url') || ''),
    logo_url: String(formData.get('logo_url') || '') || null,
    stage: String(formData.get('stage') || 'mvp') as StartupStage,
    vertical: String(formData.get('vertical') || 'FinTech'),
    tech_stack: String(formData.get('tech_stack') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
  return await store.submitStartup(payload);
}

const STAGE_OPTIONS: Array<{ value: 'all' | StartupStage; label: string }> = [
  { value: 'all', label: 'All Stages' },
  { value: 'idea', label: 'Idea' },
  { value: 'mvp', label: 'MVP' },
  { value: 'bootstrapped', label: 'Bootstrapped' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
];

const VERTICAL_OPTIONS = [
  'All Verticals',
  'FinTech',
  'AI',
  'E-Commerce',
  'Cloud & Infra',
  'EdTech',
  'Developer Tools',
];

function formatStageLabel(stage: StartupStage): string {
  switch (stage) {
    case 'idea':
      return 'Idea Stage';
    case 'mvp':
      return 'MVP';
    case 'bootstrapped':
      return 'Bootstrapped';
    case 'seed':
      return 'Seed';
    case 'series_a':
      return 'Series A';
    default:
      return stage;
  }
}

interface StartupDirectoryModuleProps {
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
}

export const StartupDirectoryModule: React.FC<StartupDirectoryModuleProps> = ({
  currentUser,
  onOpenAuth,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [startups, setStartups] = useState<StartupEntry[]>(() => store.getStartups(isAdmin));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<string>('All Verticals');
  const [selectedStage, setSelectedStage] = useState<'all' | StartupStage>('all');
  const [activeHashSection, setActiveHashSection] = useState<
    'startups-directory' | 'submit-startup'
  >('startups-directory');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleHashSectionChange = useCallback((rawHash: string) => {
    const clean = rawHash.replace(/^#/, '').toLowerCase();
    if (clean === 'submit-startup') {
      setActiveHashSection('submit-startup');
      setShowSubmitModal(true);
    } else {
      setActiveHashSection('startups-directory');
      setShowSubmitModal(false);
    }
  }, []);

  const { navigateToHash } = useHashAnchorScroll(handleHashSectionChange, {
    defaultHash: 'startups-directory',
    validHashes: ['startups-directory', 'submit-startup'],
    metaFn: meta,
  });

  // Form State
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [stage, setStage] = useState<StartupStage>('mvp');
  const [vertical, setVertical] = useState('FinTech');
  const [techStackInput, setTechStackInput] = useState('React Router, Supabase, Tailwind');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    store.fetchStartups(isAdmin).then((list) => {
      if (mounted) setStartups(list);
    });
    const unsubscribe = store.subscribe(() => {
      if (mounted) setStartups(store.getStartups(isAdmin));
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [isAdmin]);

  const filteredStartups = useMemo(() => {
    return startups.filter((s) => {
      if (!isAdmin && !s.is_approved) return false;

      const normSelected = selectedVertical.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normStartupVertical = s.vertical.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchesVertical =
        selectedVertical === 'All Verticals' || normStartupVertical === normSelected;

      const matchesStage = selectedStage === 'all' || s.stage === selectedStage;

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.vertical.toLowerCase().includes(q) ||
        s.tech_stack.some((t) => t.toLowerCase().includes(q));

      return matchesVertical && matchesStage && matchesSearch;
    });
  }, [startups, selectedVertical, selectedStage, searchQuery, isAdmin]);

  const handleOpenSubmission = () => {
    if (!currentUser) {
      if (onOpenAuth) {
        onOpenAuth();
      } else {
        setShowSubmitModal(true);
        navigateToHash('submit-startup');
      }
      return;
    }
    setShowSubmitModal(true);
    navigateToHash('submit-startup');
  };

  const handleCreateStartup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth?.();
      return;
    }
    if (!name.trim() || !tagline.trim() || !websiteUrl.trim()) return;

    setIsSubmitting(true);
    let normalizedUrl = websiteUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const techStack = techStackInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await store.submitStartup({
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim() || tagline.trim(),
      website_url: normalizedUrl,
      logo_url: logoUrl.trim() || null,
      stage,
      vertical,
      tech_stack: techStack.length > 0 ? techStack : ['TypeScript', 'Supabase'],
      submitted_by: currentUser.id,
    });

    setIsSubmitting(false);

    if (res.success) {
      setShowSubmitModal(false);
      navigateToHash('startups-directory');
      setName('');
      setTagline('');
      setDescription('');
      setWebsiteUrl('');
      setLogoUrl('');
      if (isAdmin) {
        setSubmissionNotice(
          `"${res.startup?.name || name}" has been published to the StartupCrème Directory.`
        );
      } else {
        setSubmissionNotice(
          `"${res.startup?.name || name}" has been submitted for Admin approval and will appear in the directory once approved.`
        );
      }
      setTimeout(() => setSubmissionNotice(null), 7000);
    } else if (res.error) {
      setSubmissionNotice(res.error);
    }
  };

  const handleApproveStartup = async (startup: StartupEntry) => {
    if (!isAdmin) return;
    setBusyId(startup.id);
    await store.approveStartup(startup.id, true);
    setBusyId(null);
    setSubmissionNotice(`Approved "${startup.name}". It is now visible to all viewers.`);
    setTimeout(() => setSubmissionNotice(null), 5000);
  };

  const handleDeleteStartup = async (startup: StartupEntry) => {
    if (!isAdmin) return;
    setBusyId(startup.id);
    await store.deleteStartup(startup.id);
    setBusyId(null);
    setSubmissionNotice(`Deleted "${startup.name}" from database.`);
    setTimeout(() => setSubmissionNotice(null), 5000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-10 min-w-0 overflow-x-hidden">
      {/* Module Header */}
      <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2 flex-wrap min-w-0">
            <span>Module 02</span>
            <span aria-hidden="true">·</span>
            <span>Verified Company Index</span>
            <span aria-hidden="true">·</span>
            <code className="text-emerald-700 font-semibold break-all">/directory#{activeHashSection}</code>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight break-words">
            The Startup & FinTech Directory
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed break-words">
            Curated index of high-signal early-stage and growth companies building financial infrastructure, autonomous AI systems, e-commerce platforms, and modern developer tooling.
          </p>
        </div>

        {/* Hash-Synchronized Directory Section Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl self-start md:self-auto shrink-0 max-w-full overflow-x-auto no-scrollbar">
          <a
            href="#startups-directory"
            onClick={(e) => {
              e.preventDefault();
              setShowSubmitModal(false);
              navigateToHash('startups-directory');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeHashSection === 'startups-directory' && !showSubmitModal
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-cyan-600" />
            <span>Directory Index</span>
          </a>

          <a
            href="#submit-startup"
            onClick={(e) => {
              e.preventDefault();
              handleOpenSubmission();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeHashSection === 'submit-startup' || showSubmitModal
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit Startup</span>
          </a>
        </div>
      </div>

      {/* Submission Confirmation Banner */}
      {submissionNotice && (
        <div className="mb-6 bg-white border border-emerald-300 rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs text-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{submissionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSubmissionNotice(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-8 shadow-xs space-y-4 max-w-full min-w-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between min-w-0">
          {/* Real-time Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search startups by name, tagline, vertical, or tech stack (e.g., FinTech, E-Commerce, AI, Supabase)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
            />
          </div>

          {/* Stage Segmented Filter - swipeable on mobile */}
          <div className="w-full lg:w-auto min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl overflow-x-auto no-scrollbar scroll-smooth w-full overscroll-x-contain touch-pan-x py-1">
              {STAGE_OPTIONS.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setSelectedStage(st.value)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 select-none active:scale-95 ${
                    selectedStage === st.value
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vertical Filter Bar - swipeable on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 min-w-0">
          <div className="w-full sm:w-auto min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-0.5">
              <span className="text-xs text-slate-500 font-medium mr-1 flex items-center gap-1 shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Vertical:</span>
              </span>
              {VERTICAL_OPTIONS.map((vert) => (
                <button
                  key={vert}
                  type="button"
                  onClick={() => setSelectedVertical(vert)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${
                    selectedVertical === vert
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {vert}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs font-mono text-slate-500 tabular-nums shrink-0 self-end sm:self-auto">
            Showing {filteredStartups.length} of {startups.length} companies
          </div>
        </div>
      </div>

      {/* Directory Grid Container (#startups-directory) */}
      <section id="startups-directory" className="scroll-mt-28 min-w-0 max-w-full">
        {filteredStartups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-w-0">
            {filteredStartups.map((startup) => (
              <article
                key={startup.id}
                className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0 max-w-full overflow-hidden ${
                  !startup.is_approved
                    ? 'border-amber-300 bg-amber-50/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="min-w-0">
                  {/* Pending Approval Badge for Admin */}
                  {!startup.is_approved && (
                    <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono font-semibold">
                      <Clock className="w-3 h-3" />
                      <span>Pending Admin Approval</span>
                    </div>
                  )}

                  {/* Header: Logo + Name + Metadata */}
                  <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {startup.logo_url ? (
                        <div className="h-12 min-w-12 max-w-[120px] rounded-xl border border-slate-200 bg-white flex items-center justify-center p-1.5 shrink-0 shadow-2xs">
                          <img
                            src={startup.logo_url}
                            alt={`${startup.name} logo`}
                            className="max-h-9 max-w-full w-auto h-auto object-contain"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.className =
                                  'w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 font-serif font-bold text-lg shrink-0';
                                parent.textContent = startup.name.charAt(0).toUpperCase();
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 font-serif font-bold text-lg shrink-0">
                          {startup.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="font-serif text-lg font-bold text-slate-900 leading-snug break-words">
                          {startup.name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 flex-wrap">
                          <span className="font-semibold text-emerald-700">{startup.vertical}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-600">
                            {formatStageLabel(startup.stage)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tagline */}
                  <p className="text-sm font-semibold text-slate-800 leading-snug mb-2.5 break-words">
                    {startup.tagline}
                  </p>

                  {/* Description */}
                  <p className="text-xs text-slate-500 leading-relaxed mb-5 line-clamp-3 break-words">
                    {startup.description}
                  </p>
                </div>

                <div className="min-w-0">
                  {/* Tech Stack Metadata */}
                  {startup.tech_stack && startup.tech_stack.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 mb-4 min-w-0">
                      <div className="text-[11px] text-slate-400 mb-1.5">Architecture & Stack</div>
                      <div className="flex flex-wrap gap-1.5 min-w-0">
                        {startup.tech_stack.map((tech, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-mono break-all"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer External Link & Admin Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs flex-wrap min-w-0">
                    <span className="text-slate-400 font-mono">
                      {new Date(startup.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>

                    <div className="flex items-center gap-2 flex-wrap">
                      {isAdmin && !startup.is_approved && (
                        <button
                          type="button"
                          disabled={busyId === startup.id}
                          onClick={() => handleApproveStartup(startup)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          disabled={busyId === startup.id}
                          onClick={() => handleDeleteStartup(startup)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete startup from database"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}

                      <a
                        href={startup.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:text-emerald-700 transition-colors shrink-0"
                      >
                        <span>Visit Website</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="font-serif text-lg font-bold text-slate-900 mb-1">
              No startups in the directory yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
              {searchQuery || selectedVertical !== 'All Verticals' || selectedStage !== 'all'
                ? 'No companies matched your current vertical, funding stage, or search filter criteria.'
                : 'Be the first to submit a startup to the StartupCrème Directory.'}
            </p>
            {searchQuery || selectedVertical !== 'All Verticals' || selectedStage !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedVertical('All Verticals');
                  setSelectedStage('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Reset Directory Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenSubmission}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {currentUser ? 'Submit a Startup' : 'Sign In to Submit a Startup'}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Submit a Startup Section / Modal (#submit-startup) */}
      <section id="submit-startup" className="mt-12 scroll-mt-28 min-w-0 max-w-full">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-xs max-w-full overflow-hidden min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 mb-6 min-w-0">
            <div>
              <div className="text-xs font-mono text-emerald-700 font-semibold mb-1">
                #submit-startup
              </div>
              <h2 className="font-serif text-xl font-bold text-slate-900">
                Submit Your Startup to the StartupCrème Index
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showcase your FinTech, AI, E-Commerce, or Cloud Infrastructure company to institutional investors and technical founders.
              </p>
            </div>
            {!showSubmitModal && (
              <button
                type="button"
                onClick={handleOpenSubmission}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
              >
                {currentUser ? 'Open Submission Form' : 'Sign In to Submit'}
              </button>
            )}
          </div>

          {!currentUser ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Sign In Required to Submit a Startup
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Only signed-in users can submit a startup to the directory. Submissions from members are reviewed and approved by an Admin before appearing publicly.
                  </p>
                </div>
              </div>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  Sign In to Continue
                </button>
              )}
            </div>
          ) : showSubmitModal ? (
            <form onSubmit={handleCreateStartup} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Paystack Treasury"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Website URL *
                  </label>
                  <input
                    type="text"
                    required
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://company.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Vertical *
                  </label>
                  <select
                    value={vertical}
                    onChange={(e) => setVertical(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  >
                    <option value="FinTech">FinTech</option>
                    <option value="AI">AI</option>
                    <option value="E-Commerce">E-Commerce</option>
                    <option value="Cloud & Infra">Cloud & Infra</option>
                    <option value="EdTech">EdTech</option>
                    <option value="Developer Tools">Developer Tools</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Funding Stage *
                  </label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as StartupStage)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  >
                    <option value="idea">Idea</option>
                    <option value="mvp">MVP</option>
                    <option value="bootstrapped">Bootstrapped</option>
                    <option value="seed">Seed</option>
                    <option value="series_a">Series A</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  One-Line Tagline *
                </label>
                <input
                  type="text"
                  required
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Automated cross-border treasury and settlement APIs for enterprises"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product & Architecture Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your product architecture, target market, and core differentiation..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tech Stack (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={techStackInput}
                    onChange={(e) => setTechStackInput(e.target.value)}
                    placeholder="React Router, Supabase, Tailwind, Rust"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Logo URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://company.com/logo.png"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                  {logoUrl.trim() && (
                    <div className="mt-2 flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="h-10 min-w-10 max-w-[120px] px-2 py-1 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0">
                        <img
                          src={logoUrl.trim()}
                          alt="Logo preview"
                          className="max-h-7 max-w-full w-auto h-auto object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500">Live logo preview (supports rectangular & square logos)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-slate-500">
                  {isAdmin
                    ? 'Posting as Admin: Your submission will be published immediately.'
                    : 'Your submission will be reviewed by an Admin before appearing publicly.'}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubmitModal(false);
                      navigateToHash('startups-directory');
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isSubmitting
                      ? 'Submitting...'
                      : isAdmin
                      ? 'Publish to Directory'
                      : 'Submit for Approval'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
              <span>
                All verified submissions are indexed in <code className="font-mono text-slate-700">startupcreme.startups</code> with direct do-follow founder attribution.
              </span>
              <a
                href="#submit-startup"
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenSubmission();
                }}
                className="font-semibold text-slate-900 hover:text-emerald-700 underline-offset-2 hover:underline"
              >
                Launch Submission Form →
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
