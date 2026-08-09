import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  Bookmark, 
  Share2, 
  Check, 
  MessageCircle, 
  Send, 
  Sparkles, 
  User,
  Globe,
  Tag
} from 'lucide-react';
import { Post, PostComment, UserProfile, PostContentNode } from '../types';
import { updatePageSEO } from '../lib/seo';
import { normalizeImageUrl } from '../lib/router';

interface ArticleViewProps {
  post: Post;
  comments: PostComment[];
  onBack: () => void;
  currentUser: UserProfile | null;
  onAddComment: (content: string) => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenAuth: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  post,
  comments,
  onBack,
  currentUser,
  onAddComment,
  isBookmarked,
  onToggleBookmark,
  onOpenAuth,
}) => {
  const [commentInput, setCommentInput] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    updatePageSEO({
      title: post.title,
      description: post.excerpt || post.meta_description,
      canonicalUrl: post.canonical_url,
      ogImage: normalizeImageUrl(post.cover_image),
      type: 'article',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [post]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(commentInput.trim());
    setCommentInput('');
  };

  const isFinance = post.vertical === 'finance';

  // Helper to render Tiptap JSON or string content
  const renderContentNode = (node: PostContentNode, idx: number) => {
    if (!node) return null;

    if (node.type === 'paragraph') {
      return (
        <p key={idx} className="mb-5 leading-relaxed text-slate-800 font-serif text-lg">
          {node.content?.map((child, cIdx) => (
            <span key={cIdx}>{child.text}</span>
          ))}
        </p>
      );
    }

    if (node.type === 'heading') {
      const level = node.attrs?.level || 2;
      const text = node.content?.map(c => c.text).join('') || '';
      if (level === 2) {
        return (
          <h2 key={idx} className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-10 mb-4 border-b border-slate-200 pb-3">
            {text}
          </h2>
        );
      }
      return (
        <h3 key={idx} className="font-serif text-xl font-bold text-slate-900 mt-8 mb-3">
          {text}
        </h3>
      );
    }

    if (node.type === 'bulletList') {
      return (
        <ul key={idx} className="list-disc list-inside mb-6 space-y-2 text-slate-800 font-serif text-base pl-2">
          {node.content?.map((li, lIdx) => (
            <li key={lIdx} className="leading-relaxed">
              {li.content?.map((p, pIdx) => (
                <span key={pIdx}>
                  {p.content?.map((txt, tIdx) => txt.text).join('')}
                </span>
              ))}
            </li>
          ))}
        </ul>
      );
    }

    return null;
  };

  return (
    <article className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Article Header & SEO Silo Breadcrumbs */}
      <div className="border-b border-slate-200 bg-slate-100/70 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Publications</span>
          </button>

          {/* Silo Breadcrumb Path */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono mb-4 text-slate-600">
            <span className="flex items-center gap-1 text-slate-800 font-medium">
              <Globe className="w-3.5 h-3.5" />
            </span>
            <a
              href={`/${post.locale || 'en-us'}`}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', `/${post.locale || 'en-us'}`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-cyan-700 font-bold hover:underline"
            >
              /{post.locale || 'en-us'}
            </a>
            <span>/</span>
            <a
              href={`/${post.locale || 'en-us'}/${post.vertical}`}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', `/${post.locale || 'en-us'}/${post.vertical}`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] ${
                isFinance
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                  : 'bg-cyan-100 text-cyan-900 border border-cyan-300 hover:bg-cyan-200'
              }`}
            >
              {post.vertical}
            </a>
            <span>/</span>
            <span className="text-slate-700 font-semibold truncate max-w-[280px] bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">{post.slug}</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
            {post.title}
          </h1>

          <p className="text-slate-700 font-serif text-lg sm:text-xl leading-relaxed mb-8 border-l-4 border-cyan-600 pl-4 py-1 bg-white rounded-r-lg shadow-xs">
            {post.excerpt}
          </p>

          {/* Author Bio Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
            <div className="flex items-center gap-3">
              <img
                src={post.author_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                alt={post.author_name}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-200"
              />
              <div>
                <div className="text-sm font-bold text-slate-900">{post.author_name}</div>
                <div className="text-xs text-slate-500">{post.author_role} • Published {new Date(post.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-700 font-mono flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-cyan-600" />
                <span>{post.reading_time_minutes} min read</span>
              </div>

              <button
                onClick={onToggleBookmark}
                className={`p-2 rounded-lg border transition-colors ${
                  isBookmarked
                    ? 'bg-cyan-100 border-cyan-300 text-cyan-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Bookmark article"
              >
                <Bookmark className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold transition-colors shadow-xs"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedUrl ? 'Link Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Cover Image */}
        {post.cover_image && (
          <div className="mb-10 rounded-2xl overflow-hidden border border-slate-200 shadow-md">
            <img
              src={normalizeImageUrl(post.cover_image)}
              alt={post.title}
              className="w-full max-h-[460px] object-cover"
            />
          </div>
        )}

        {/* Render Content */}
        <div className="prose prose-slate max-w-none text-slate-800">
          {typeof post.content === 'string' ? (
            post.content.trim().startsWith('<') ? (
              <div 
                className="space-y-4 font-serif text-lg leading-relaxed text-slate-800 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-slate-200 [&_h2]:pb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-2 [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-700"
                dangerouslySetInnerHTML={{ __html: post.content }} 
              />
            ) : (
              <div className="space-y-4 font-serif text-lg leading-relaxed whitespace-pre-line text-slate-800">
                {post.content}
              </div>
            )
          ) : (
            post.content?.content?.map((node, idx) => renderContentNode(node, idx))
          )}
        </div>

        {/* Tags */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-2">
          <Tag className="w-4 h-4 text-slate-500 mr-1" />
          {post.tags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-700 font-semibold shadow-xs">
              #{tag}
            </span>
          ))}
        </div>

        {/* Article Comments Section */}
        <section className="mt-16 pt-10 border-t border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-cyan-600" />
              <span>Editorial Comments ({comments.length})</span>
            </h3>
          </div>

          {/* Comment Input */}
          <div className="mb-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            {currentUser ? (
              <form onSubmit={handleCommentSubmit} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <img
                    src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                    alt={currentUser.full_name}
                    className="w-6 h-6 rounded-full"
                  />
                  <span>Commenting as {currentUser.full_name}</span>
                </div>
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Share professional insights or analysis on this article..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post Comment</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-slate-600 mb-3">Sign in to participate in editorial analysis and post comments.</p>
                <button
                  onClick={onOpenAuth}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-xs shadow-xs"
                >
                  Sign In to Comment
                </button>
              </div>
            )}
          </div>

          {/* Comment List */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-mono">
                No comments yet. Be the first to share analysis on this publication!
              </div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={c.author_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                        alt={c.author_name}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900">{c.author_name}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans pl-9">
                    {c.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </article>
  );
};
