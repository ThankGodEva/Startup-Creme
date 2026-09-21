import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Send, ShieldCheck, User, Mail, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CommentFormProps {
  postId: string;
  currentUser: UserProfile | null;
  onSubmitComment: (
    content: string,
    guestInfo?: { author_name: string; author_email: string }
  ) => Promise<boolean | void> | void;
  onOpenAuth?: () => void;
}

export const CommentForm: React.FC<CommentFormProps> = ({
  postId: _postId,
  currentUser,
  onSubmitComment,
  onOpenAuth,
}) => {
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; content?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const validateForm = (): boolean => {
    const newErrors: { name?: string; email?: string; content?: string } = {};

    if (!content.trim() || content.trim().length < 2) {
      newErrors.content = 'Comment must be at least 2 characters.';
    } else if (content.length > 3000) {
      newErrors.content = 'Comment cannot exceed 3,000 characters.';
    }

    if (!currentUser) {
      if (!authorName.trim() || authorName.trim().length < 2) {
        newErrors.name = 'Please provide your name or username (min 2 characters).';
      } else if (authorName.trim().length > 60) {
        newErrors.name = 'Name cannot exceed 60 characters.';
      }

      if (!authorEmail.trim()) {
        newErrors.email = 'Please provide your email address.';
      } else if (!validateEmail(authorEmail)) {
        newErrors.email = 'Please enter a valid email address.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const guestInfo = !currentUser
        ? {
            author_name: authorName.trim(),
            author_email: authorEmail.trim().toLowerCase(),
          }
        : undefined;

      await onSubmitComment(content.trim(), guestInfo);

      setContent('');
      if (!currentUser) {
        setAuthorName('');
        setAuthorEmail('');
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setErrors({ content: err?.message || 'Failed to submit comment. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs transition-all">
      {/* Form Header / Mode Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
        {currentUser ? (
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
              alt={currentUser.full_name}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full ring-2 ring-indigo-100 object-cover"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  Commenting as <span className="text-indigo-600 font-bold">{currentUser.full_name}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Community Member
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Your profile badge and avatar will appear with your comment.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-xs border border-slate-200">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Leave a Guest Comment</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Guest Mode
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">No account required. Join the editorial discussion instantly.</p>
              </div>
            </div>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <span>Have an account? Sign In</span>
              </button>
            )}
          </div>
        )}
      </div>

      {showSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Your comment has been posted successfully!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Guest Identity Fields: Name & Email */}
        {!currentUser && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Author Name */}
            <div>
              <label htmlFor="guest-author-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Name / Username <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="guest-author-name"
                  type="text"
                  value={authorName}
                  onChange={(e) => {
                    setAuthorName(e.target.value);
                    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                  }}
                  placeholder="e.g. Alex Morgan"
                  className={`w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border ${
                    errors.name ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500'
                  } rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all`}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Author Email */}
            <div>
              <label htmlFor="guest-author-email" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>
                  Email Address <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Never displayed publicly</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="guest-author-email"
                  type="email"
                  value={authorEmail}
                  onChange={(e) => {
                    setAuthorEmail(e.target.value);
                    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  placeholder="name@company.com"
                  className={`w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border ${
                    errors.email ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500'
                  } rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Comment Content Textarea */}
        <div>
          <label htmlFor="comment-content" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Your Comment / Analysis <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="comment-content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (errors.content) setErrors(prev => ({ ...prev, content: undefined }));
            }}
            placeholder="Share professional insights, market context, or analysis on this article..."
            rows={3}
            className={`w-full p-3 text-xs sm:text-sm bg-slate-50 border ${
              errors.content ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500'
            } rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-opacity-20 transition-all resize-y`}
          />
          {errors.content && (
            <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.content}
            </p>
          )}
        </div>

        {/* Form Footer: Privacy Guarantee & Submit Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {!currentUser ? (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>Privacy Protected:</strong> Email stays private. Auto-syncs to your profile if you register later.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Participating in verified editorial review</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {!currentUser && onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="sm:hidden text-xs text-indigo-600 font-semibold"
              >
                Sign In Instead
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{currentUser ? 'Post Comment' : 'Post as Guest'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
