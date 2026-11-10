import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Search,
  ExternalLink,
  Award,
  Sparkles,
  DollarSign,
  MapPin,
  Clock,
  ArrowRight,
  Filter,
  Trash2,
  Code2,
  Copy,
  Check,
  Building2,
  FileText,
  ChevronRight,
  Info,
  Loader2,
  Plus,
  Share2,
  Globe,
} from 'lucide-react';
import { EventOpportunity, UserProfile, Post } from '../types';
import { store } from '../lib/store';
import { getPostUrl, getEventUrl, getEventShareUrl } from '../lib/router';
import { getEventBanner } from '../lib/eventsHelper';
import { useHashAnchorScroll, Route } from '../hooks/useHashAnchorScroll';
import { PublishEventModal } from './PublishEventModal';

/**
 * React Router 7 hash-aware meta export for /events
 */
export function meta({ location }: Route.MetaArgs) {
  const hash = location.hash || '#opportunities';
  const canonicalUrl = `https://www.startupcreme.com/events${hash}`;

  return [
    { title: 'Grants, Accelerators & Startup Events | StartupCrème' },
    {
      name: 'description',
      content:
        'Curated non-dilutive grants, venture accelerators, founder fellowships, and pitch competitions for software engineers, fintech builders, and tech entrepreneurs.',
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
    { property: 'og:url', content: canonicalUrl },
  ];
}

/**
 * React Router 7 compatible loader for /events
 */
export async function loader({ request }: { request?: Request } = {}) {
  let type = 'all';
  let search = '';
  if (request) {
    const url = new URL(request.url);
    type = url.searchParams.get('type') || 'all';
    search = url.searchParams.get('search') || '';
  }
  const events = await store.fetchEvents(type, search);
  return { events, filters: { type, search } };
}

interface EventsModuleProps {
  currentUser?: UserProfile | null;
  initialEventSlug?: string | null;
  onSelectPost?: (post: Post) => void;
  onOpenAuth?: () => void;
}

export interface OpportunityChip {
  id: string;
  label: string;
  types: string[];
}

/**
 * Exact mapping of filter chips to opportunity_type enum values:
 * - Non-Dilutive Grants: grant
 * - Accelerators & Incubators: accelerator, incubator
 * - Fellowships: fellowship
 * - Pitch Competitions & Hackathons: pitch_competition, hackathon
 * - Conferences: conference
 * - All Opportunities: shows all published, non-expired events
 */
const OPPORTUNITY_CHIPS: OpportunityChip[] = [
  { id: 'all', label: 'All Opportunities', types: [] },
  { id: 'grant', label: 'Non-Dilutive Grants', types: ['grant'] },
  { id: 'accelerator', label: 'Accelerators & Incubators', types: ['accelerator', 'incubator'] },
  { id: 'fellowship', label: 'Fellowships', types: ['fellowship'] },
  { id: 'pitch_competition', label: 'Pitch Competitions & Hackathons', types: ['pitch_competition', 'hackathon'] },
  { id: 'conference', label: 'Conferences', types: ['conference'] },
];

export type TimelineFilter = 'all' | '7' | '30' | '90' | 'past';

const formatOpportunityType = (type?: string | null): string => {
  if (!type) return 'Opportunity';
  const clean = String(type).toLowerCase().trim();
  switch (clean) {
    case 'grant':
      return 'Grant';
    case 'accelerator':
      return 'Accelerator';
    case 'incubator':
      return 'Incubator';
    case 'fellowship':
      return 'Fellowship';
    case 'pitch_competition':
      return 'Pitch Competition';
    case 'hackathon':
      return 'Hackathon';
    case 'conference':
      return 'Conference';
    default:
      return clean.replace(/_/g, ' ');
  }
};

const formatDeadline = (dateStr?: string | null): string => {
  if (!dateStr) return 'Open / Rolling';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Open / Rolling';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Open / Rolling';
  }
};

export const EventsModule: React.FC<EventsModuleProps> = ({
  currentUser,
  initialEventSlug,
  onSelectPost,
  onOpenAuth,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [events, setEvents] = useState<EventOpportunity[]>(() => store.getEvents());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [deadlineFilter, setDeadlineFilter] = useState<TimelineFilter>('all');
  const [selectedEvent, setSelectedEvent] = useState<EventOpportunity | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  // Deep-linking: match initialEventSlug to an event on mount/load
  useEffect(() => {
    if (!initialEventSlug || events.length === 0) return;
    const match = events.find(
      (e) => e.slug === initialEventSlug || e.id === initialEventSlug
    );
    if (match) {
      setSelectedEvent(match);
    }
  }, [initialEventSlug, events]);

  const openEvent = (item: EventOpportunity) => {
    setSelectedEvent(item);
    const eventUrl = getEventUrl(item);
    if (window.location.pathname !== eventUrl) {
      window.history.pushState({}, '', eventUrl);
    }
  };

  const closeEvent = () => {
    setSelectedEvent(null);
    if (window.location.pathname.startsWith('/events/') || window.location.pathname.startsWith('/grants/')) {
      window.history.pushState({}, '', '/events#opportunities');
    }
  };

  const handleShareEvent = async (item: EventOpportunity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = getEventShareUrl(item);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedEventId(item.id);
      setTimeout(() => {
        setCopiedEventId((prev) => (prev === item.id ? null : prev));
      }, 2500);
    } catch {
      setCopiedEventId(item.id);
      setTimeout(() => {
        setCopiedEventId((prev) => (prev === item.id ? null : prev));
      }, 2500);
    }
  };

  const handleHashChange = useCallback((rawHash: string) => {
    const clean = rawHash.replace(/^#/, '').toLowerCase();
    if (clean === 'grants') {
      setSelectedType('grant');
    } else if (clean === 'accelerators' || clean === 'incubators') {
      setSelectedType('accelerator');
    } else if (clean === 'fellowships') {
      setSelectedType('fellowship');
    } else if (clean === 'pitch-competitions' || clean === 'hackathons') {
      setSelectedType('pitch_competition');
    } else if (clean === 'conferences') {
      setSelectedType('conference');
    } else if (clean === 'closing-soon' || clean === 'closing-7' || clean === '7-days') {
      setDeadlineFilter('7');
    } else if (clean === 'closing-30' || clean === '30-days') {
      setDeadlineFilter('30');
    } else if (clean === 'closing-90' || clean === '90-days') {
      setDeadlineFilter('90');
    } else if (clean === 'past' || clean === 'expired') {
      setDeadlineFilter('past');
    } else if (clean === 'opportunities' || clean === 'all') {
      setSelectedType('all');
      setDeadlineFilter('all');
    }
  }, []);

  const { navigateToHash } = useHashAnchorScroll(handleHashChange, {
    defaultHash: 'opportunities',
    validHashes: [
      'opportunities',
      'all',
      'grants',
      'accelerators',
      'incubators',
      'fellowships',
      'pitch-competitions',
      'hackathons',
      'conferences',
      'closing-soon',
      'closing-7',
      'closing-30',
      'closing-90',
      'past',
    ],
    metaFn: meta,
  });

  // Hydrate events from store and backend
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await store.fetchEvents();
        if (isMounted) {
          setEvents(data);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    loadData();

    const unsubscribe = store.subscribe(() => {
      if (isMounted) {
        setEvents(store.getEvents());
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const getDaysRemaining = useCallback((deadlineStr?: string | null): number | null => {
    if (!deadlineStr) return null;
    try {
      const target = new Date(deadlineStr).getTime();
      if (isNaN(target)) return null;
      const now = Date.now();
      return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  }, []);

  // Filter events based on criteria & sort by soonest deadline
  const filteredEvents = useMemo(() => {
    const allPosts = store.getPosts();

    const list = events.filter((evt) => {
      // 1. Public security boundary:
      // An Event & Grant CAN but MUST NOT have a post.
      // If linked_post_id is present, non-admin users only see it if the linked post is published.
      // If linked_post_id is null/undefined (standalone opportunity), it is publicly visible.
      const linkedPost = evt.linked_post || allPosts.find((p) => p.id === evt.linked_post_id);
      if (!isAdmin && evt.linked_post_id) {
        if (!linkedPost || linkedPost.status !== 'published') {
          return false;
        }
      }

      // 2. Exact opportunity_type matching from filter chips
      if (selectedType !== 'all') {
        const chip = OPPORTUNITY_CHIPS.find((c) => c.id === selectedType);
        if (chip && chip.types.length > 0) {
          const normType = String(evt.opportunity_type || '').toLowerCase().trim();
          const matches = chip.types.some((t) => t.toLowerCase() === normType);
          if (!matches) return false;
        }
      }

      // 3. Search query matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = evt.title.toLowerCase().includes(q);
        const descMatch = evt.description.toLowerCase().includes(q);
        const locMatch = evt.location.toLowerCase().includes(q);
        const fundMatch = evt.funding_amount ? evt.funding_amount.toLowerCase().includes(q) : false;
        const postMatch = linkedPost ? linkedPost.title.toLowerCase().includes(q) : false;
        if (!titleMatch && !descMatch && !locMatch && !fundMatch && !postMatch) {
          return false;
        }
      }

      // 4. Timelines dropdown filter & hide expired events by default
      const diffDays = getDaysRemaining(evt.deadline_date);

      if (deadlineFilter === 'all') {
        // "All Opportunities" shows all published, non-expired events.
        // Hide events whose deadline_date is in the past by default.
        if (diffDays !== null && diffDays < 0) {
          return false;
        }
      } else if (deadlineFilter === '7') {
        // Closing in 7 days (non-expired)
        if (diffDays === null || diffDays < 0 || diffDays > 7) {
          return false;
        }
      } else if (deadlineFilter === '30') {
        // Closing in 30 days (non-expired)
        if (diffDays === null || diffDays < 0 || diffDays > 30) {
          return false;
        }
      } else if (deadlineFilter === '90') {
        // Closing in 90 days (non-expired)
        if (diffDays === null || diffDays < 0 || diffDays > 90) {
          return false;
        }
      } else if (deadlineFilter === 'past') {
        // Explicitly view past / closed opportunities
        if (diffDays === null || diffDays >= 0) {
          return false;
        }
      }

      return true;
    });

    // 5. Sort by soonest deadline: closest future deadline appears first
    return list.sort((a, b) => {
      const timeA = a.deadline_date ? new Date(a.deadline_date).getTime() : Infinity;
      const timeB = b.deadline_date ? new Date(b.deadline_date).getTime() : Infinity;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [events, selectedType, searchQuery, deadlineFilter, isAdmin, getDaysRemaining]);

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this event from the database?')) {
      return;
    }
    setDeletingId(id);
    try {
      await store.deleteEvent(id);
      setEvents((prev) => prev.filter((item) => item.id !== id));
      if (selectedEvent?.id === id) {
        setSelectedEvent(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const allPosts = useMemo(() => store.getPosts(), [events]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Module Hero Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-2">
            <span>Module 05</span>
            <span aria-hidden="true">·</span>
            <span>Global Opportunity Engine</span>
            <span aria-hidden="true">·</span>
            <code className="text-amber-700 font-semibold">/events</code>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Grants, Accelerators & Startup Events
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
            Curated non-dilutive grants, institutional venture accelerators, founder fellowships, and tech competitions. Automatically scraped, parsed, and verified for high-growth tech and finance founders.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowPublishModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Publish Event</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            >
              <span>Admin Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        {/* Search & Timeline Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by grant name, funder, tech domain, or region..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600 shadow-2xs"
            />
          </div>

          {/* Timelines Dropdown: Closing in 7 days, 30 days, 90 days */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <div className="relative w-full sm:w-auto">
              <select
                value={deadlineFilter}
                onChange={(e) => setDeadlineFilter(e.target.value as TimelineFilter)}
                className="w-full sm:w-auto bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-600 shadow-2xs cursor-pointer"
                aria-label="Filter opportunities by timeline"
              >
                <option value="all">All Timelines (Non-Expired)</option>
                <option value="7">Closing in 7 days</option>
                <option value="30">Closing in 30 days</option>
                <option value="90">Closing in 90 days</option>
                <option value="past">Past Opportunities</option>
              </select>
            </div>
          </div>
        </div>

        {/* Opportunity Type Pill Tabs (Exactly mapped to opportunity_type) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {OPPORTUNITY_CHIPS.map((chip) => {
            const isSelected = selectedType === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedType(chip.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono pt-1">
          <span>
            Showing <strong className="text-slate-800">{filteredEvents.length}</strong>{' '}
            {filteredEvents.length === 1 ? 'opportunity' : 'opportunities'}
            {deadlineFilter === 'all' && ' (active, non-expired)'}
            {deadlineFilter === '7' && ' (closing in 7 days)'}
            {deadlineFilter === '30' && ' (closing in 30 days)'}
            {deadlineFilter === '90' && ' (closing in 90 days)'}
            {deadlineFilter === 'past' && ' (past / closed)'}
          </span>
          <span className="text-[11px] text-slate-400">
            Sorted by soonest deadline
          </span>
        </div>
      </div>

      {/* Main Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-serif text-lg font-bold text-slate-900 mb-1">
            {events.length === 0 ? 'No Active Opportunities Listed' : 'No Opportunities Match Filters'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {events.length === 0
              ? 'Our editorial intelligence team continuously monitors and publishes verified non-dilutive grants, venture accelerators, and hackathons. Check back shortly for active windows.'
              : 'Try clearing your search query, adjusting the timeline, or selecting "All Opportunities" to view the full pipeline.'}
          </p>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowPublishModal(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Publish Opportunity Now</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            >
              <span>Sign in as Admin to Publish Events</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((item) => {
            const daysLeft = getDaysRemaining(item.deadline_date);
            const isClosingSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;
            const isExpired = daysLeft !== null && daysLeft < 0;
            const linkedPost = item.linked_post || allPosts.find((p) => p.id === item.linked_post_id);
            const bannerUrl = getEventBanner(item);
            const isCopied = copiedEventId === item.id;

            return (
              <div
                key={item.id}
                onClick={() => openEvent(item)}
                className="group bg-white border border-slate-200 hover:border-slate-300 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer text-left"
              >
                <div>
                  {/* Hero Banner for Every Event */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                    <img
                      src={bannerUrl}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                    {/* Top Badges on Banner */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider bg-slate-900/80 backdrop-blur-xs text-white border border-white/20 shadow-xs">
                        <Award className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>{formatOpportunityType(item.opportunity_type)}</span>
                      </span>

                      {daysLeft !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold backdrop-blur-xs shadow-xs ${
                            isExpired
                              ? 'bg-slate-900/80 text-slate-300 border border-white/20'
                              : isClosingSoon
                              ? 'bg-rose-900/80 text-rose-200 border border-rose-400/40'
                              : 'bg-emerald-900/80 text-emerald-200 border border-emerald-400/40'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {isExpired
                            ? 'Expired'
                            : daysLeft === 0
                            ? 'Closes Today'
                            : `${daysLeft}d left`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-900/80 backdrop-blur-xs text-blue-200 border border-blue-400/40 shadow-xs">
                          <Clock className="w-3 h-3" />
                          Rolling
                        </span>
                      )}
                    </div>

                    {/* Funding Pill on Banner bottom */}
                    <div className="absolute bottom-2.5 left-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-xs border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold shadow-xs">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{item.funding_amount || 'Non-dilutive / Grant'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5">
                    {/* Standalone vs Post Tag */}
                    <div className="mb-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      {linkedPost ? (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span>Includes Editorial Post</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Standalone Verified Opportunity</span>
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-2 mb-2 leading-snug">
                      {item.title}
                    </h3>

                    {/* Excerpt / Description */}
                    <p className="text-xs text-slate-500 line-clamp-3 mb-4 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Linked Post Highlight if present */}
                    {linkedPost && (
                      <div className="mb-4 pt-3 border-t border-slate-100">
                        <a
                          href={getPostUrl(linkedPost)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectPost) {
                              e.preventDefault();
                              onSelectPost(linkedPost);
                            }
                          }}
                          className="group/link flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/80 text-amber-950 transition-colors"
                          title={`Read editorial analysis: ${linkedPost.title}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span className="text-xs font-semibold truncate">
                              Analysis: {linkedPost.title}
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-amber-700 shrink-0 transition-transform group-hover/link:translate-x-0.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Info & Actions */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono gap-2">
                    <span className="flex items-center gap-1 truncate max-w-[170px]" title={item.location}>
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.location || 'Global (Remote)'}</span>
                    </span>

                    <span className="flex items-center gap-1 text-slate-600 shrink-0" title={`Deadline: ${formatDeadline(item.deadline_date)}`}>
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatDeadline(item.deadline_date)}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={item.application_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:text-amber-700 transition-colors"
                      >
                        <span>Apply</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>

                      <button
                        type="button"
                        onClick={(e) => handleShareEvent(item, e)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                        }`}
                        title="Copy unique shareable link"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>Share</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={(e) => handleDeleteEvent(item.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete event from database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {linkedPost ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPost?.(linkedPost);
                          }}
                          className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                        >
                          <span>Read Post</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-amber-700 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl text-left">
            {/* Modal Banner Hero */}
            <div className="relative aspect-video sm:aspect-21/9 w-full overflow-hidden bg-slate-900">
              <img
                src={getEventBanner(selectedEvent)}
                alt={selectedEvent.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

              {/* Close Button on Banner */}
              <button
                type="button"
                onClick={closeEvent}
                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/90 text-white backdrop-blur-xs transition-colors cursor-pointer border border-white/20"
                aria-label="Close modal"
              >
                ✕
              </button>

              {/* Overlaid Badges */}
              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider bg-slate-900/90 text-amber-400 border border-amber-400/40 backdrop-blur-xs shadow-xs">
                    {formatOpportunityType(selectedEvent.opportunity_type)}
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    ID: {selectedEvent.id.slice(0, 8)}...
                  </span>
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-white leading-snug drop-shadow-xs">
                  {selectedEvent.title}
                </h2>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Unique Shareable Link Box */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 font-mono uppercase tracking-wider">
                    <Share2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Unique Shareable Link</span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-700">
                    Canonical Opportunity URL
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getEventShareUrl(selectedEvent)}
                    className="flex-1 bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 select-all focus:outline-none"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => handleShareEvent(selectedEvent)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      copiedEventId === selectedEvent.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {copiedEventId === selectedEvent.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Social Share Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500 font-medium">Quick share:</span>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `${selectedEvent.title} - ${getEventShareUrl(selectedEvent)}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 text-[11px] font-medium transition-colors"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                      getEventShareUrl(selectedEvent)
                    )}&text=${encodeURIComponent(
                      `${selectedEvent.title} | Grants & Events on @startupcreme`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-sky-600 hover:border-sky-300 text-[11px] font-medium transition-colors"
                  >
                    X / Twitter
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                      getEventShareUrl(selectedEvent)
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-300 text-[11px] font-medium transition-colors"
                  >
                    LinkedIn
                  </a>
                </div>
              </div>

              {/* Key stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Funding / Grant</span>
                  <span className="font-bold text-emerald-700 text-sm font-mono">
                    {selectedEvent.funding_amount || 'Non-Specified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Application Deadline</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {formatDeadline(selectedEvent.deadline_date)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Location & Scope</span>
                  <span className="font-semibold text-slate-900">
                    {selectedEvent.location || 'Global (Remote)'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="font-serif text-sm font-bold text-slate-900 mb-2">
                  Opportunity Brief & Scope
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {selectedEvent.description}
                </p>
              </div>

              {/* Linked Post Analysis OR Standalone Status */}
              {(() => {
                const linkedPost =
                  selectedEvent.linked_post ||
                  allPosts.find((p) => p.id === selectedEvent.linked_post_id);
                if (linkedPost) {
                  return (
                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-mono text-amber-800 uppercase font-semibold">
                          Linked Editorial Article
                        </div>
                        <div className="font-serif text-sm font-bold text-slate-900 line-clamp-1">
                          {linkedPost.title}
                        </div>
                      </div>
                      {onSelectPost && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectPost(linkedPost);
                            closeEvent();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                        >
                          Read Analysis
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3 text-xs text-slate-600">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Verified Standalone Opportunity:</strong> This grant/event is curated directly without requiring a companion editorial article.
                    </span>
                  </div>
                );
              })()}

              {/* Modal Bottom Actions */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={selectedEvent.application_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <span>Open Application Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteEvent(selectedEvent.id, e)}
                      className="px-3.5 py-2 rounded-xl text-rose-700 hover:bg-rose-50 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Delete Event
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeEvent}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Manual Opportunity Publishing Modal */}
      <PublishEventModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onSuccess={(newEvent) => {
          setEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)]);
        }}
      />
    </div>
  );
};
