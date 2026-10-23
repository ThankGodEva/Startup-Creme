import React, { useState } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  MapPin,
  ExternalLink,
  Award,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { store } from '../lib/store';
import { EventOpportunity, OpportunityType } from '../types';
import { EventSubmissionSchema } from '../lib/validation';

interface PublishEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (event: EventOpportunity) => void;
}

const OPPORTUNITY_TYPES: { value: OpportunityType; label: string }[] = [
  { value: 'grant', label: 'Non-Dilutive Grant' },
  { value: 'accelerator', label: 'Accelerator / Incubator' },
  { value: 'fellowship', label: 'Founder Fellowship' },
  { value: 'pitch_competition', label: 'Pitch Competition / Hackathon' },
  { value: 'conference', label: 'Conference / Summit' },
  { value: 'incubator', label: 'University Incubator' },
  { value: 'general', label: 'General Opportunity' },
];

export const PublishEventModal: React.FC<PublishEventModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [opportunityType, setOpportunityType] = useState<OpportunityType>('grant');
  const [fundingAmount, setFundingAmount] = useState('');
  const [location, setLocation] = useState('Global (Remote)');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [vertical, setVertical] = useState<'finance' | 'tech' | 'founders-mindset'>('tech');
  const [description, setDescription] = useState('');

  // Advanced fields
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slug, setSlug] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [fullContent, setFullContent] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) {
      const autoSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(autoSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Validate payload with schema
    const validationResult = EventSubmissionSchema.safeParse({
      title,
      opportunity_type: opportunityType,
      application_url: applicationUrl,
      description,
      location: location || 'Global (Remote)',
      deadline_date: deadlineDate,
      funding_amount: fundingAmount ? fundingAmount : null,
      vertical,
      locale: 'en-us',
      slug: slug || undefined,
      content: fullContent || undefined,
    });

    if (!validationResult.success) {
      const errorsMap: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const fieldName = String(issue.path[0] || 'general');
        errorsMap[fieldName] = issue.message;
      });
      setFieldErrors(errorsMap);
      setFormError('Please resolve the highlighted validation issues before publishing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await store.publishEvent({
        title,
        opportunity_type: opportunityType,
        funding_amount: fundingAmount || null,
        location: location || 'Global (Remote)',
        deadline_date: deadlineDate,
        application_url: applicationUrl,
        vertical,
        locale: 'en-us',
        description,
        slug: slug || undefined,
        content: fullContent || description,
        cover_image: coverImage || null,
      });

      if (!res.success || !res.event) {
        setFormError(res.error || 'Failed to publish event. Please verify server connectivity.');
        return;
      }

      // Success
      if (onSuccess) {
        onSuccess(res.event);
      }
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred while publishing the opportunity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-event-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200 bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold mb-1">
              <Award className="w-3.5 h-3.5" />
              <span>Admin Opportunity Publishing Engine</span>
            </div>
            <h2 id="publish-event-title" className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
              Publish Grant, Accelerator or Event
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Manually publish verified opportunities to <code className="font-mono text-slate-700">startupcreme.events</code> and link them with an editorial post.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{formError}</div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Opportunity / Event Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g., Techstars Paris Sustainability Accelerator 2026"
              className={`w-full bg-white border ${
                fieldErrors.title ? 'border-rose-400 focus:border-rose-600' : 'border-slate-300 focus:border-amber-600'
              } rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors shadow-2xs`}
            />
            {fieldErrors.title && (
              <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.title}</p>
            )}
          </div>

          {/* Grid: Type & Funding */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Opportunity Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={opportunityType}
                onChange={(e) => setOpportunityType(e.target.value as OpportunityType)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
              >
                {OPPORTUNITY_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Funding / Award Amount (Optional)
              </label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={fundingAmount}
                  onChange={(e) => setFundingAmount(e.target.value)}
                  placeholder="e.g., $120,000 Equity-free or €250k"
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600 transition-colors shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Grid: Location & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Location / Scope <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Global (Remote) or Paris, France"
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600 transition-colors shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Application Deadline <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className={`w-full bg-white border ${
                    fieldErrors.deadline_date ? 'border-rose-400 focus:border-rose-600' : 'border-slate-300 focus:border-amber-600'
                  } rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none transition-colors shadow-2xs cursor-pointer`}
                />
              </div>
              {fieldErrors.deadline_date && (
                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.deadline_date}</p>
              )}
            </div>
          </div>

          {/* Grid: Application URL & Vertical */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Official Application Portal URL <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="url"
                  required
                  value={applicationUrl}
                  onChange={(e) => setApplicationUrl(e.target.value)}
                  placeholder="https://techstars.com/apply"
                  className={`w-full bg-white border ${
                    fieldErrors.application_url ? 'border-rose-400 focus:border-rose-600' : 'border-slate-300 focus:border-amber-600'
                  } rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors shadow-2xs`}
                />
              </div>
              {fieldErrors.application_url && (
                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.application_url}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Silo / Vertical
              </label>
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
              >
                <option value="tech">Tech & AI</option>
                <option value="finance">Finance & FinTech</option>
                <option value="founders-mindset">Founders Mindset</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">
                Summary / Eligibility Overview <span className="text-rose-600">*</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {description.length}/2000 chars
              </span>
            </div>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Concise briefing on the opportunity: funding amount, equity terms, key milestones, requirements, and target startup stages..."
              className={`w-full bg-white border ${
                fieldErrors.description ? 'border-rose-400 focus:border-rose-600' : 'border-slate-300 focus:border-amber-600'
              } rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors shadow-2xs leading-relaxed`}
            />
            {fieldErrors.description && (
              <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.description}</p>
            )}
          </div>

          {/* Advanced Collapsible Accordion */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                <span>Advanced Editorial Options (Slug, Cover Image, Full Article)</span>
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-4 pt-2 space-y-3.5 border-t border-slate-200 bg-white">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Custom URL Slug
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="auto-generated-from-title"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    URL: <code className="font-mono">/events#{slug || 'slug'}</code>
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cover Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Full Editorial Narrative / Deep-Dive (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={fullContent}
                    onChange={(e) => setFullContent(e.target.value)}
                    placeholder="Extended briefing, evaluation criteria, mentor network, and application walkthrough..."
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-600 font-sans leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    If left empty, this defaults to the summary description.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing Opportunity...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Publish Opportunity</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
