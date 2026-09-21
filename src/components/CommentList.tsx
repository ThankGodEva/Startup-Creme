import React from 'react';
import { PostComment } from '../types';
import { CheckCircle2, User, Clock, MessageSquare } from 'lucide-react';

interface CommentListProps {
  comments: PostComment[];
  title?: string;
}

export const CommentList: React.FC<CommentListProps> = ({
  comments,
  title = 'Editorial Discussion',
}) => {
  const getInitials = (name: string): string => {
    if (!name) return 'GC';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatCommentDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Recently';

      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-2 pb-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
          <span>{title} ({comments.length})</span>
        </h4>
      </div>

      {comments.length === 0 ? (
        <div className="text-center py-10 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2.5 text-slate-400 shadow-2xs">
            <MessageSquare className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No comments yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Be the first to share your perspectives or analysis on this publication! Guests and members welcome.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {comments.map((comment) => {
            const isRegisteredUser = Boolean(comment.user_id && comment.user_id !== 'user-anon');
            const initials = getInitials(comment.author_name);

            return (
              <div
                key={comment.id}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs transition-all hover:border-slate-300"
              >
                {/* Commenter Header */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    {/* Avatar or Initials Fallback */}
                    {comment.author_avatar ? (
                      <img
                        src={comment.author_avatar}
                        alt={comment.author_name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                        onError={(e) => {
                          // Fallback to initials avatar on broken image link
                          (e.target as HTMLElement).style.display = 'none';
                          const fallback = (e.target as HTMLElement).nextElementSibling;
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                        isRegisteredUser
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                      style={{ display: comment.author_avatar ? 'none' : 'flex' }}
                    >
                      {initials}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          {comment.author_name}
                        </span>

                        {/* Status Badges */}
                        {isRegisteredUser ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Community Member</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>Guest Commenter</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString()}>
                          {formatCommentDate(comment.created_at)}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comment Content (Protected: Never displays author_email) */}
                <div className="pl-11 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
                  {comment.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
