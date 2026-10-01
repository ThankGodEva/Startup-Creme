import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Briefcase,
  ExternalLink,
  Plus,
  X,
  CheckCircle2,
  SlidersHorizontal,
  Trash2,
  ShieldCheck,
  Clock,
  Lock,
} from 'lucide-react';
import { JobListing, CreateJobPayload, UserProfile } from '../types';
import { store } from '../lib/store';
import { useHashAnchorScroll, Route } from '../hooks/useHashAnchorScroll';

/**
 * React Router 7 hash-aware meta export for /careers
 */
export function meta({ location }: Route.MetaArgs) {
  const hash = location.hash || '#remote-jobs-board';
  const canonicalUrl = `https://www.startupcreme.com/careers${hash}`;

  return [
    { title: 'Remote Startup Job & Fractional Talent Board | StartupCrème' },
    {
      name: 'description',
      content:
        'High-leverage remote roles across distributed systems engineering, cloud FinOps, quantitative financial modeling, and fractional CTO/CFO leadership.',
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
    { property: 'og:url', content: canonicalUrl },
  ];
}

/**
 * React Router 7 compatible loader for /careers
 */
export async function loader({ request }: { request?: Request } = {}) {
  let category = 'all';
  let job_type = 'all';
  if (request) {
    const url = new URL(request.url);
    category = url.searchParams.get('category') || 'all';
    job_type = url.searchParams.get('job_type') || 'all';
  }
  const jobs = await store.fetchJobs();
  return {
    jobs,
    filters: { category, job_type },
  };
}

/**
 * React Router 7 compatible action for posting a job to startupcreme.jobs
 */
export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const payload: CreateJobPayload = {
    title: String(formData.get('title') || ''),
    company_name: String(formData.get('company_name') || ''),
    company_logo: String(formData.get('company_logo') || '') || null,
    location: String(formData.get('location') || 'Remote (Global)'),
    job_type: String(formData.get('job_type') || 'Full-time'),
    category: String(formData.get('category') || 'Engineering'),
    apply_url: String(formData.get('apply_url') || ''),
    salary_range: String(formData.get('salary_range') || '') || null,
  };
  return await store.postJob(payload);
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All Roles' },
  { id: 'Engineering', label: 'Remote Software Engineering' },
  { id: 'FinOps', label: 'FinOps' },
  { id: 'Financial Modeling', label: 'Financial Modeling' },
  { id: 'Leadership', label: 'Fractional C-Suite (CTO/CFO)' },
];

const JOB_TYPES = ['All Types', 'Full-time', 'Fractional', 'Contract'];

interface CareersBoardModuleProps {
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
}

export const CareersBoardModule: React.FC<CareersBoardModuleProps> = ({
  currentUser,
  onOpenAuth,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [jobs, setJobs] = useState<JobListing[]>(() => store.getJobs(isAdmin));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedJobType, setSelectedJobType] = useState<string>('All Types');
  const [activeCareerSection, setActiveCareerSection] = useState<
    'remote-jobs-board' | 'post-job'
  >('remote-jobs-board');
  const [showPostJobModal, setShowPostJobModal] = useState(false);
  const [postNotice, setPostNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleHashSectionChange = useCallback((rawHash: string) => {
    const clean = rawHash.replace(/^#/, '').toLowerCase();
    if (clean === 'post-job') {
      setActiveCareerSection('post-job');
      setShowPostJobModal(true);
    } else {
      setActiveCareerSection('remote-jobs-board');
      setShowPostJobModal(false);
    }
  }, []);

  const { navigateToHash } = useHashAnchorScroll(handleHashSectionChange, {
    defaultHash: 'remote-jobs-board',
    validHashes: ['remote-jobs-board', 'post-job'],
    metaFn: meta,
  });

  // Post a Job Form State
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [location, setLocation] = useState('Remote (Global)');
  const [jobType, setJobType] = useState('Full-time');
  const [category, setCategory] = useState('Engineering');
  const [applyUrl, setApplyUrl] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    store.fetchJobs(isAdmin).then((list) => {
      if (mounted) setJobs(list);
    });
    const unsubscribe = store.subscribe(() => {
      if (mounted) setJobs(store.getJobs(isAdmin));
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [isAdmin]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!isAdmin && !job.is_active) return false;

      const matchesCategory =
        selectedCategory === 'all' ||
        job.category.toLowerCase() === selectedCategory.toLowerCase() ||
        (selectedCategory === 'Financial Modeling' &&
          (job.category.toLowerCase() === 'finance' ||
            job.category.toLowerCase() === 'financial modeling'));

      const matchesType =
        selectedJobType === 'All Types' ||
        job.job_type.toLowerCase() === selectedJobType.toLowerCase();

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        job.title.toLowerCase().includes(q) ||
        job.company_name.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.category.toLowerCase().includes(q) ||
        (job.salary_range && job.salary_range.toLowerCase().includes(q));

      return matchesCategory && matchesType && matchesSearch;
    });
  }, [jobs, selectedCategory, selectedJobType, searchQuery, isAdmin]);

  const handleOpenPostJob = () => {
    if (!currentUser) {
      if (onOpenAuth) {
        onOpenAuth();
      } else {
        setShowPostJobModal(true);
        navigateToHash('post-job');
      }
      return;
    }
    setShowPostJobModal(true);
    navigateToHash('post-job');
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth?.();
      return;
    }
    if (!title.trim() || !companyName.trim() || !applyUrl.trim()) return;

    setIsSubmitting(true);
    let normalizedApplyUrl = applyUrl.trim();
    if (
      !/^https?:\/\//i.test(normalizedApplyUrl) &&
      !normalizedApplyUrl.startsWith('mailto:')
    ) {
      normalizedApplyUrl = `https://${normalizedApplyUrl}`;
    }

    const res = await store.postJob({
      title: title.trim(),
      company_name: companyName.trim(),
      company_logo: companyLogo.trim() || null,
      location: location.trim() || 'Remote (Global)',
      job_type: jobType,
      category,
      apply_url: normalizedApplyUrl,
      salary_range: salaryRange.trim() || null,
    });

    setIsSubmitting(false);

    if (res.success) {
      setShowPostJobModal(false);
      navigateToHash('remote-jobs-board');
      setTitle('');
      setCompanyName('');
      setCompanyLogo('');
      setApplyUrl('');
      setSalaryRange('');
      if (isAdmin) {
        setPostNotice(
          `"${res.job?.title || title}" at ${companyName} is now live on the StartupCrème Talent Board.`
        );
      } else {
        setPostNotice(
          `"${res.job?.title || title}" at ${companyName} has been submitted for Admin approval and will appear on the board once approved.`
        );
      }
      setTimeout(() => setPostNotice(null), 7000);
    } else if (res.error) {
      setPostNotice(res.error);
    }
  };

  const handleApproveJob = async (job: JobListing) => {
    if (!isAdmin) return;
    setBusyId(job.id);
    await store.approveJob(job.id, true);
    setBusyId(null);
    setPostNotice(`Approved "${job.title}" at ${job.company_name}. It is now visible to all viewers.`);
    setTimeout(() => setPostNotice(null), 5000);
  };

  const handleDeleteJob = async (job: JobListing) => {
    if (!isAdmin) return;
    setBusyId(job.id);
    await store.deleteJob(job.id);
    setBusyId(null);
    setPostNotice(`Deleted "${job.title}" from database.`);
    setTimeout(() => setPostNotice(null), 5000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Module Header */}
      <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
            <span>Module 04</span>
            <span aria-hidden="true">·</span>
            <span>Executive & Technical Talent Network</span>
            <span aria-hidden="true">·</span>
            <code className="text-emerald-700 font-semibold">/careers#{activeCareerSection}</code>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Remote Startup Job & Fractional Talent Board
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
            High-leverage remote roles across distributed systems engineering, cloud FinOps, quantitative financial modeling, and fractional CTO/CFO leadership.
          </p>
        </div>

        {/* Hash-Synchronized Careers Section Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl self-start md:self-auto shrink-0">
          <a
            href="#remote-jobs-board"
            onClick={(e) => {
              e.preventDefault();
              setShowPostJobModal(false);
              navigateToHash('remote-jobs-board');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCareerSection === 'remote-jobs-board' && !showPostJobModal
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-teal-700" />
            <span>Remote Jobs Board</span>
          </a>

          <a
            href="#post-job"
            onClick={(e) => {
              e.preventDefault();
              handleOpenPostJob();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCareerSection === 'post-job' || showPostJobModal
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post a Job</span>
          </a>
        </div>
      </div>

      {/* Confirmation Notice */}
      {postNotice && (
        <div className="mb-6 bg-white border border-emerald-300 rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs text-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{postNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPostNotice(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles by title, company, remote region, or compensation..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
            />
          </div>

          {/* Contract Type Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl overflow-x-auto">
            {JOB_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedJobType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedJobType === type
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 font-medium mr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Practice Area:</span>
            </span>
            {CATEGORY_TABS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono text-slate-500 tabular-nums">
            {filteredJobs.length} {filteredJobs.length === 1 ? 'position' : 'positions'}
          </div>
        </div>
      </div>

      {/* Job Listings List / Grid (#remote-jobs-board) */}
      <section id="remote-jobs-board" className="scroll-mt-28">
        {filteredJobs.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 shadow-xs overflow-hidden">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className={`p-6 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-5 ${
                  !job.is_active ? 'bg-amber-50/20' : 'hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-start gap-4">
                  {job.company_logo ? (
                    <img
                      src={job.company_logo}
                      alt={`${job.company_name} logo`}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 font-serif font-bold text-lg shrink-0">
                      {job.company_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 flex-wrap">
                      {!job.is_active && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono font-semibold">
                          <Clock className="w-3 h-3" />
                          <span>Pending Admin Approval</span>
                        </span>
                      )}
                      <span className="font-semibold text-slate-800">{job.company_name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-700 font-medium">{job.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{job.location}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-700 font-semibold">{job.job_type}</span>
                    </div>

                    <h2 className="font-serif text-lg font-bold text-slate-900 leading-snug">
                      {job.title}
                    </h2>

                    {job.salary_range && (
                      <div className="text-xs font-mono text-slate-600 mt-1.5 tabular-nums">
                        Compensation: <strong className="text-slate-900">{job.salary_range}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0 flex-wrap">
                  <span className="text-xs font-mono text-slate-400">
                    Posted{' '}
                    {new Date(job.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    {isAdmin && !job.is_active && (
                      <button
                        type="button"
                        disabled={busyId === job.id}
                        onClick={() => handleApproveJob(job)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        disabled={busyId === job.id}
                        onClick={() => handleDeleteJob(job)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete job from database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}

                    <a
                      href={job.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                    >
                      <span>Apply Directly</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="font-serif text-lg font-bold text-slate-900 mb-1">
              No remote positions posted yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
              {searchQuery || selectedCategory !== 'all' || selectedJobType !== 'All Types'
                ? 'Try clearing your category or contract type filter to view all open engineering, finance, and fractional executive mandates.'
                : 'Be the first to post a remote engineering, FinOps, or fractional executive role.'}
            </p>
            {searchQuery || selectedCategory !== 'all' || selectedJobType !== 'All Types' ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedJobType('All Types');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Reset Job Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenPostJob}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {currentUser ? 'Post a Job' : 'Sign In to Post a Job'}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Post a Job Section / Form (#post-job) */}
      <section id="post-job" className="mt-12 scroll-mt-28">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 mb-6">
            <div>
              <div className="text-xs font-mono text-emerald-700 font-semibold mb-1">
                #post-job
              </div>
              <h2 className="font-serif text-xl font-bold text-slate-900">
                Post a Remote Role or Fractional Executive Mandate
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Reach StartupCrème engineers, FinOps architects, financial modelers, and fractional CTO/CFOs.
              </p>
            </div>
            {!showPostJobModal && (
              <button
                type="button"
                onClick={handleOpenPostJob}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
              >
                {currentUser ? 'Open Job Submission Form' : 'Sign In to Post a Job'}
              </button>
            )}
          </div>

          {!currentUser ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Sign In Required to Post a Job
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Only signed-in users can post a job listing. Listings submitted by members are reviewed and approved by an Admin before appearing on the board.
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
          ) : showPostJobModal ? (
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Fractional CFO (Series A FinTech) or Staff Rust Engineer"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g., Kora Quant Analytics"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Remote Location Scope *
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Remote (Global) or Remote (Africa)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Practice Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="FinOps">FinOps</option>
                    <option value="Financial Modeling">Financial Modeling</option>
                    <option value="Leadership">Leadership (Fractional CTO/CFO)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Engagement Type *
                  </label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Fractional">Fractional</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Compensation / Retainer Range
                  </label>
                  <input
                    type="text"
                    value={salaryRange}
                    onChange={(e) => setSalaryRange(e.target.value)}
                    placeholder="$160,000 – $195,000 or $15k/mo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Application URL or Email *
                  </label>
                  <input
                    type="text"
                    required
                    value={applyUrl}
                    onChange={(e) => setApplyUrl(e.target.value)}
                    placeholder="https://company.com/careers/apply"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Logo URL (Optional)
                </label>
                <input
                  type="text"
                  value={companyLogo}
                  onChange={(e) => setCompanyLogo(e.target.value)}
                  placeholder="https://company.com/logo.png"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-slate-500">
                  {isAdmin
                    ? 'Posting as Admin: Your job listing will be published immediately.'
                    : 'Your job listing will be reviewed by an Admin before appearing publicly.'}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPostJobModal(false);
                      navigateToHash('remote-jobs-board');
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
                      ? 'Publish Job Listing'
                      : 'Submit for Approval'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
              <span>
                All verified remote engineering, FinOps, and fractional executive positions are published to <code className="font-mono text-slate-700">startupcreme.jobs</code>.
              </span>
              <a
                href="#post-job"
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenPostJob();
                }}
                className="font-semibold text-slate-900 hover:text-emerald-700 underline-offset-2 hover:underline"
              >
                Launch Job Posting Form →
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
