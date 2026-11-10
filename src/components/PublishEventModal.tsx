import React, { useState, useRef } from 'react';
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
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Globe,
} from 'lucide-react';
import { store } from '../lib/store';
import { EventOpportunity, OpportunityType } from '../types';
import { EventSubmissionSchema } from '../lib/validation';
import { EVENT_BANNER_PRESETS, getEventBanner } from '../lib/eventsHelper';
import { getEventShareUrl } from '../lib/router';

interface PublishEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (event: EventOpportunity) => void;
}

const OPPORTUNITY_TYPES: { value: OpportunityType; label: string }[] = [
  { value: 'grant', label: 'Non-Dilutive Grant' },
  { value: 'accelerator', label: 'Accelerator' },
  { value: 'incubator', label: 'Incubator' },
  { value: 'fellowship', label: 'Founder Fellowship' },
  { value: 'pitch_competition', label: 'Pitch Competition' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'conference', label: 'Conference / Summit' },
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
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');

  // Banner image state
  const [bannerImage, setBannerImage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Companion Post Toggle: "An 'Events & Grants' can but must not have a post"
  const [createCompanionPost, setCreateCompanionPost] = useState(false);
  const [vertical, setVertical] = useState<'finance' | 'tech' | 'founders-mindset'>('tech');
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const resp = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        throw new Error(`Upload failed with status: ${resp.status}`);
      }

      const result = await resp.json();
      if (result.success && result.url) {
        setBannerImage(result.url);
      } else {
        throw new Error(result.error || 'Failed to retrieve uploaded image URL');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Image upload failed. You can paste an image URL instead.');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const currentEffectiveBanner = bannerImage.trim() || getEventBanner({ opportunity_type: opportunityType });
  const previewSlug = slug || 'new-opportunity';

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
      banner_image: bannerImage.trim() || null,
      create_post: createCompanionPost,
      vertical,
      locale: 'en-us',
      slug: slug || undefined,
      content: createCompanionPost ? (fullContent || description) : undefined,
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
        banner_image: currentEffectiveBanner,
        cover_image: currentEffectiveBanner,
        create_post: createCompanionPost,
        vertical,
        locale: 'en-us',
        description,
        slug: slug || undefined,
        content: createCompanionPost ? (fullContent || description) : undefined,
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
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 text-left"
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
              Every opportunity includes a hero banner and unique shareable link. Companion editorial posts are optional.
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{formError}</div>
            </div>
          )}

          {/* 1. HERO BANNER SECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Event Banner Image <span className="text-amber-700">*</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">16:9 Landscape Banner</span>
            </div>

            {/* Banner Live Preview */}
            <div className="relative w-full h-36 sm:h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs">
              <img
                src={currentEffectiveBanner}
                alt="Event Banner Preview"
                className="w-full h-full object-cover transition-transform group-hover:scale-102"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent flex items-end p-3.5">
                <div className="flex items-center justify-between w-full text-white text-xs">
                  <span className="font-semibold truncate max-w-[70%]">
                    {title || 'Opportunity Banner Preview'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-white/20 backdrop-blur-xs border border-white/30">
                    {opportunityType}
                  </span>
                </div>
              </div>
            </div>

            {/* Banner URL Input & File Upload */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <div className="relative flex-1">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="url"
                  value={bannerImage}
                  onChange={(e) => setBannerImage(e.target.value)}
                  placeholder="Paste banner image URL (or select preset below)..."
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600 shadow-2xs"
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />

              <button
                type="button"
                disabled={isUploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isUploadingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                )}
                <span>{isUploadingImage ? 'Uploading...' : 'Upload Image'}</span>
              </button>
            </div>

            {uploadError && (
              <p className="text-[11px] text-rose-600">{uploadError}</p>
            )}

            {/* Preset Banner Quick Selection */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Thematic Presets:</span>
              {EVENT_BANNER_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setBannerImage(preset.url)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                    bannerImage === preset.url
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. TITLE */}
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

          {/* 3. UNIQUE SHAREABLE LINK PREVIEW & CUSTOM SLUG */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Unique Shareable Link</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Canonical URL
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 shrink-0">/events/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                placeholder="custom-slug"
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-600"
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono truncate">
              Full Link: <code className="text-slate-800">{getEventShareUrl({ slug: previewSlug })}</code>
            </p>
          </div>

          {/* 4. TYPE & FUNDING */}
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

          {/* 5. LOCATION & DEADLINE */}
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

          {/* 6. APPLICATION PORTAL URL */}
          <div>
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

          {/* 7. DESCRIPTION */}
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

          {/* 8. COMPANION POST TOGGLE ("An 'Events & Grants' can but must not have a post") */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createCompanionPost}
                onChange={(e) => setCreateCompanionPost(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Create a companion editorial post / article for this opportunity
                </span>
                <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                  Optional. When unchecked, this opportunity is published directly as a standalone verified event with its unique shareable link and banner.
                </span>
              </div>
            </label>

            {createCompanionPost && (
              <div className="pt-3 border-t border-slate-200 space-y-3 bg-white p-3 rounded-lg border border-slate-100 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Editorial Silo / Vertical
                  </label>
                  <select
                    value={vertical}
                    onChange={(e) => setVertical(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-600 cursor-pointer"
                  >
                    <option value="tech">Tech & AI</option>
                    <option value="finance">Finance & FinTech</option>
                    <option value="founders-mindset">Founders Mindset</option>
                  </select>
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
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing Opportunity...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{createCompanionPost ? 'Publish Event & Post' : 'Publish Opportunity'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
