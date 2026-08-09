import React from 'react';
import { Clock, Bookmark, ArrowUpRight, Sparkles } from 'lucide-react';
import { Post } from '../types';
import { getPostUrl, normalizeImageUrl } from '../lib/router';

interface ArticleCardProps {
  post: Post;
  onSelect: (post: Post) => void;
  isBookmarked: boolean;
  onToggleBookmark: (postId: string, e: React.MouseEvent) => void;
  variant?: 'featured' | 'standard' | 'compact';
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  post,
  onSelect,
  isBookmarked,
  onToggleBookmark,
  variant = 'standard',
}) => {
  const isFinance = post.vertical === 'finance';
  const postUrl = getPostUrl(post);

  if (variant === 'featured') {
    return (
      <a
        href={postUrl}
        onClick={(e) => {
          e.preventDefault();
          onSelect(post);
        }}
        className="group relative rounded-2xl bg-white border border-slate-200 hover:border-slate-300 overflow-hidden cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md grid md:grid-cols-12 items-stretch block text-left"
      >
        <div className="md:col-span-7 relative min-h-[260px] overflow-hidden">
          <img
            src={normalizeImageUrl(post.cover_image) || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200'}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase shadow-sm ${
                isFinance
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-900'
                  : 'bg-cyan-100 border border-cyan-300 text-cyan-900'
              }`}
            >
              {post.vertical}
            </span>
            {post.dual_silo && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-purple-100 border border-purple-300 text-purple-900 flex items-center gap-1 shadow-sm font-semibold">
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span>Dual Silo</span>
              </span>
            )}
          </div>
        </div>

        <div className="md:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-white">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3 font-sans">
              <span className="flex items-center gap-1 font-medium text-slate-600">
                <Clock className="w-3.5 h-3.5" />
                {post.reading_time_minutes} min read
              </span>
              <span className="text-[11px] text-slate-400">
                {new Date(post.created_at).toLocaleDateString()}
              </span>
            </div>

            <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 group-hover:text-cyan-700 transition-colors mb-3 leading-snug">
              {post.title}
            </h3>

            <p className="text-slate-600 text-xs sm:text-sm line-clamp-3 leading-relaxed mb-6">
              {post.excerpt}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2.5">
                <img
                  src={post.author_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                  alt={post.author_name}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200"
                />
                <div>
                  <div className="text-xs font-bold text-slate-800">{post.author_name}</div>
                  <div className="text-[10px] text-slate-500">{post.author_role}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleBookmark(post.id, e);
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    isBookmarked ? 'bg-cyan-100 text-cyan-800 border border-cyan-300' : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                  title="Bookmark article"
                >
                  <Bookmark className="w-4 h-4 fill-current" />
                </button>
                <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={postUrl}
      onClick={(e) => {
        e.preventDefault();
        onSelect(post);
      }}
      className="group rounded-xl bg-white border border-slate-200 hover:border-slate-300 overflow-hidden cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between block text-left"
    >
      <div>
        {/* Cover Image */}
        <div className="relative h-44 overflow-hidden bg-slate-100">
          <img
            src={normalizeImageUrl(post.cover_image) || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800'}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shadow-xs ${
                isFinance
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-900'
                  : 'bg-cyan-100 border border-cyan-300 text-cyan-900'
              }`}
            >
              {post.vertical}
            </span>
            {post.dual_silo && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-100 border border-purple-300 text-purple-900 font-semibold shadow-xs">
                Dual Silo
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2 font-sans">
            <span className="text-[11px] text-slate-400">
              {new Date(post.created_at).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {post.reading_time_minutes} min
            </span>
          </div>

          <h3 className="font-serif text-base font-bold text-slate-900 group-hover:text-cyan-700 transition-colors mb-2 leading-snug line-clamp-2">
            {post.title}
          </h3>

          <p className="text-slate-600 text-xs line-clamp-3 leading-relaxed mb-4">
            {post.excerpt}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={post.author_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
            alt={post.author_name}
            className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200"
          />
          <span className="text-xs text-slate-700 font-semibold truncate max-w-[120px]">{post.author_name}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleBookmark(post.id, e);
          }}
          className={`p-1.5 rounded-lg transition-colors ${
            isBookmarked ? 'bg-cyan-100 text-cyan-800 border border-cyan-300' : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Bookmark article"
        >
          <Bookmark className="w-3.5 h-3.5 fill-current" />
        </button>
      </div>
    </a>
  );
};
