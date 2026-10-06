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
} from 'lucide-react';
import { EventOpportunity, UserProfile, Post } from '../types';
import { store } from '../lib/store';
import { useHashAnchorScroll, Route } from '../hooks/useHashAnchorScroll';

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
  onSelectPost?: (post: Post) => void;
  onOpenAuth?: () => void;
}

const OPPORTUNITY_TYPES = [
  { id: 'all', label: 'All Opportunities' },
  { id: 'grant', label: 'Non-Dilutive Grants' },
  { id: 'accelerator', label: 'Accelerators & Incubators' },
  { id: 'fellowship', label: 'Fellowships' },
  { id: 'pitch_competition', label: 'Pitch Competitions & Hackathons' },
  { id: 'conference', label: 'Conferences' },
];

export const EventsModule: React.FC<EventsModuleProps> = ({
  currentUser,
  onSelectPost,
  onOpenAuth,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [events, setEvents] = useState<EventOpportunity[]>(() => store.getEvents());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'closing-soon' | 'active'>('all');
  const [selectedEvent, setSelectedEvent] = useState<EventOpportunity | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleHashChange = useCallback((rawHash: string) => {
    const clean = rawHash.replace(/^#/, '').toLowerCase();
    if (clean === 'grants') {
      setSelectedType('grant');
    } else if (clean === 'accelerators') {
      setSelectedType('accelerator');
    } else if (clean === 'closing-soon') {
      setDeadlineFilter('closing-soon');
    }
  }, []);

  const { navigateToHash } = useHashAnchorScroll(handleHashChange, {
    defaultHash: 'opportunities',
    validHashes: ['opportunities', 'grants', 'accelerators', 'closing-soon'],
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

  // Filter events based on criteria
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((evt) => {
      // Type match
      const normType = String(evt.opportunity_type || '').toLowerCase();
      let matchesType = true;
      if (selectedType !== 'all') {
        if (selectedType === 'accelerator') {
          matchesType = normType.includes('accelerator') || normType.includes('incubator');
        } else if (selectedType === 'pitch_competition') {
          matchesType = normType.includes('pitch') || normType.includes('hackathon') || normType.includes('competition');
        } else {
          matchesType = normType.includes(selectedType.toLowerCase());
        }
      }

      // Search match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        evt.title.toLowerCase().includes(q) ||
        evt.description.toLowerCase().includes(q) ||
        evt.location.toLowerCase().includes(q) ||
        (evt.funding_amount && evt.funding_amount.toLowerCase().includes(q));

      // Deadline match
      let matchesDeadline = true;
      if (evt.deadline_date) {
        const d = new Date(evt.deadline_date).getTime();
        const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
        if (deadlineFilter === 'closing-soon') {
          matchesDeadline = diffDays >= 0 && diffDays <= 14;
        } else if (deadlineFilter === 'active') {
          matchesDeadline = diffDays >= 0;
        }
      }

      return matchesType && matchesSearch && matchesDeadline;
    });
  }, [events, selectedType, searchQuery, deadlineFilter]);

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

  const getDaysRemaining = (deadlineStr: string) => {
    try {
      const target = new Date(deadlineStr).getTime();
      const now = Date.now();
      const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
      return diff;
    } catch {
      return null;
    }
  };

  const copyWebhookCurl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.startupcreme.com';
    const sampleCurl = `curl -X POST "${origin}/api/events/webhook" \\
  -H "Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_title": "Google for Startups Accelerator: AI First",
    "application_url": "https://startup.google.com/accelerator/ai",
    "slug": "google-ai-accelerator-cohort",
    "vertical": "tech",
    "locale": "en-us",
    "title": "Google for Startups Accelerator Opens 2026 AI Cohort With $350k Cloud Capital",
    "content": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Google has opened applications for its flagship AI-First founder cohort." }]
        }
      ]
    },
    "opportunity_type": "accelerator",
    "funding_amount": "$350,000 Equity-Free Cloud Credits",
    "location": "Global (Remote & In-Person)",
    "deadline_date": "2026-11-30T23:59:59Z"
  }'`;
    navigator.clipboard.writeText(sampleCurl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

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
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        {/* Search & Deadline Controls */}
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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value as any)}
              className="w-full sm:w-auto bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-600 shadow-2xs cursor-pointer"
            >
              <option value="all">All Timelines</option>
              <option value="closing-soon">Closing Soon (&lt; 14 Days)</option>
              <option value="active">Active Deadlines</option>
            </select>
          </div>
        </div>

        {/* Opportunity Type Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {OPPORTUNITY_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                selectedType === t.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
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
              : 'Try clearing your search query or selecting "All Opportunities" to view the full pipeline.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((item) => {
            const daysLeft = item.deadline_date ? getDaysRemaining(item.deadline_date) : null;
            const isClosingSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;
            const isExpired = daysLeft !== null && daysLeft < 0;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedEvent(item)}
                className="group bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer text-left"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      <Award className="w-3 h-3 text-amber-600" />
                      {item.opportunity_type?.replace(/_/g, ' ')}
                    </span>

                    {/* Deadline Pill */}
                    {daysLeft !== null && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          isExpired
                            ? 'bg-slate-100 text-slate-500'
                            : isClosingSoon
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {isExpired
                          ? 'Expired'
                          : daysLeft === 0
                          ? 'Closes Today'
                          : `${daysLeft}d left`}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-2 mb-2">
                    {item.title}
                  </h3>

                  {/* Funding Amount Highlight */}
                  {item.funding_amount && (
                    <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-mono font-bold">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>{item.funding_amount}</span>
                    </div>
                  )}

                  {/* Excerpt */}
                  <p className="text-xs text-slate-500 line-clamp-3 mb-4 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Footer Info & Actions */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1 truncate max-w-[180px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </span>

                    {item.linked_post && (
                      <span className="text-amber-700 font-medium flex items-center gap-0.5">
                        <FileText className="w-3 h-3" />
                        <span>Editorial Post</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <a
                      href={item.application_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:text-amber-700 transition-colors"
                    >
                      <span>Apply Portal</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>

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

                      <span className="text-xs font-medium text-amber-700 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
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
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6 text-left">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                    {selectedEvent.opportunity_type?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    ID: {selectedEvent.id.slice(0, 8)}...
                  </span>
                </div>
                <h2 className="font-serif text-2xl font-bold text-slate-900 leading-snug">
                  {selectedEvent.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
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
                  {selectedEvent.deadline_date
                    ? new Date(selectedEvent.deadline_date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Open / Rolling'}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Location & Scope</span>
                <span className="font-semibold text-slate-900">
                  {selectedEvent.location}
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

            {/* Linked Post Analysis if available */}
            {selectedEvent.linked_post && (
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono text-amber-800 uppercase font-semibold">
                    Linked Editorial Article
                  </div>
                  <div className="font-serif text-sm font-bold text-slate-900 line-clamp-1">
                    {selectedEvent.linked_post.title}
                  </div>
                </div>
                {onSelectPost && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPost(selectedEvent.linked_post!);
                      setSelectedEvent(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                  >
                    Read Analysis
                  </button>
                )}
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <a
                href={selectedEvent.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
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
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
