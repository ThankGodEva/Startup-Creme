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
  Tag,
  Cpu,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react';
import { Post, PostComment, UserProfile, PostContentNode } from '../types';
import { updatePageSEO } from '../lib/seo';
import { normalizeImageUrl, getPostUrl } from '../lib/router';

interface ArticleViewProps {
  post: Post;
  comments: PostComment[];
  onBack: () => void;
  currentUser: UserProfile | null;
  onAddComment: (content: string) => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenAuth: () => void;
  relatedPosts?: Post[];
  onSelectPost?: (post: Post) => void;
}

// Helper to format inline markdown like bold, italics, and code
function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-cyan-800">$1</code>');
}

// Helper to render plain text / markdown with proper bullet lists, headings, and tables
function renderPlainTextContent(text: string) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentTableRows: string[][] | null = null;

  const flushList = (key: string | number) => {
    if (!currentList) return;
    if (currentList.type === 'ul') {
      blocks.push(
        <ul key={`list-${key}`} className="list-disc list-outside pl-6 my-5 space-y-2 text-slate-800 font-serif text-lg">
          {currentList.items.map((item, i) => (
            <li key={i} className="leading-relaxed pl-1">
              <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
            </li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <ol key={`list-${key}`} className="list-decimal list-outside pl-6 my-5 space-y-2 text-slate-800 font-serif text-lg">
          {currentList.items.map((item, i) => (
            <li key={i} className="leading-relaxed pl-1">
              <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
            </li>
          ))}
        </ol>
      );
    }
    currentList = null;
  };

  const flushTable = (key: string | number) => {
    if (!currentTableRows || currentTableRows.length === 0) {
      currentTableRows = null;
      return;
    }
    const [headerRow, ...bodyRows] = currentTableRows;
    blocks.push(
      <div key={`table-${key}`} className="my-8 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs bg-white">
        <table className="min-w-full divide-y divide-slate-200 border-collapse text-left">
          {headerRow && (
            <thead>
              <tr className="bg-slate-100/90 divide-x divide-slate-200">
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx} className="p-3.5 text-xs sm:text-sm font-bold text-slate-900 font-sans tracking-wide uppercase">
                    <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(cell.trim()) }} />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-200">
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className="divide-x divide-slate-200 hover:bg-slate-50/50 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-3.5 text-sm sm:text-base text-slate-800 font-sans align-top">
                    <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(cell.trim()) }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    currentTableRows = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(index);
      flushTable(index);
      return;
    }

    // Markdown Table row detection: | Col 1 | Col 2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList(index);
      // Check if it's a separator line like |---|---|
      const isSeparator = /^\|(\s*[-:]+\s*\|)+$/.test(trimmed);
      if (isSeparator) {
        return;
      }
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());
      if (!currentTableRows) {
        currentTableRows = [];
      }
      currentTableRows.push(cells);
      return;
    }

    flushTable(index);

    // Check bullet list: •, -, * or numbered 1.
    const bulletMatch = trimmed.match(/^([•\-\*]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const isNum = /^\d+\./.test(bulletMatch[1]);
      const listType = isNum ? 'ol' : 'ul';
      if (!currentList || currentList.type !== listType) {
        flushList(index);
        currentList = { type: listType, items: [] };
      }
      currentList.items.push(bulletMatch[2]);
      return;
    }

    flushList(index);

    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3 key={index} className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-8 mb-3">
          {trimmed.replace(/^###\s+/, '')}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={index} className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-10 mb-4 border-b border-slate-200 pb-2">
          {trimmed.replace(/^##\s+/, '')}
        </h2>
      );
    } else if (trimmed.startsWith('# ')) {
      blocks.push(
        <h1 key={index} className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-10 mb-4">
          {trimmed.replace(/^#\s+/, '')}
        </h1>
      );
    } else if (trimmed.startsWith('> ')) {
      blocks.push(
        <blockquote key={index} className="border-l-4 border-cyan-600 pl-4 italic text-slate-700 my-5 font-serif text-lg">
          {trimmed.replace(/^>\s+/, '')}
        </blockquote>
      );
    } else {
      blocks.push(
        <p key={index} className="mb-5 leading-relaxed font-serif text-lg text-slate-800">
          <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />
        </p>
      );
    }
  });

  flushList('end');
  flushTable('end');
  return blocks;
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
  relatedPosts = [],
  onSelectPost,
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

  // Helper to render inline text nodes with marks (bold, italic, strike, code, links)
  const renderInlineChild = (child: PostContentNode, cIdx: number): React.ReactNode => {
    if (!child) return null;
    let element: React.ReactNode = child.text || '';

    if (child.marks && child.marks.length > 0) {
      child.marks.forEach((mark, mIdx) => {
        if (mark.type === 'bold') {
          element = <strong key={`bold-${mIdx}`} className="font-bold text-slate-900">{element}</strong>;
        } else if (mark.type === 'italic') {
          element = <em key={`italic-${mIdx}`} className="italic">{element}</em>;
        } else if (mark.type === 'strike') {
          element = <s key={`strike-${mIdx}`} className="line-through text-slate-500">{element}</s>;
        } else if (mark.type === 'code') {
          element = <code key={`code-${mIdx}`} className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-cyan-800">{element}</code>;
        } else if (mark.type === 'link') {
          const href = mark.attrs?.href || '#';
          element = (
            <a 
              key={`link-${mIdx}`} 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-600 underline font-medium hover:text-cyan-700"
            >
              {element}
            </a>
          );
        }
      });
    }

    return <React.Fragment key={cIdx}>{element}</React.Fragment>;
  };

  // Helper to render Tiptap JSON content tree
  const renderContentNode = (node: PostContentNode, idx: number): React.ReactNode => {
    if (!node) return null;

    if (node.type === 'paragraph') {
      return (
        <p key={idx} className="mb-5 leading-relaxed text-slate-800 font-serif text-lg">
          {node.content?.map((child, cIdx) => renderInlineChild(child, cIdx))}
        </p>
      );
    }

    if (node.type === 'heading') {
      const level = node.attrs?.level || 2;
      const text = node.content?.map(c => c.text).join('') || '';
      if (level === 1) {
        return (
          <h1 key={idx} className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-10 mb-4">
            {node.content?.map((child, cIdx) => renderInlineChild(child, cIdx)) || text}
          </h1>
        );
      }
      if (level === 2) {
        return (
          <h2 key={idx} className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-10 mb-4 border-b border-slate-200 pb-3">
            {node.content?.map((child, cIdx) => renderInlineChild(child, cIdx)) || text}
          </h2>
        );
      }
      return (
        <h3 key={idx} className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-8 mb-3">
          {node.content?.map((child, cIdx) => renderInlineChild(child, cIdx)) || text}
        </h3>
      );
    }

    if (node.type === 'blockquote') {
      return (
        <blockquote key={idx} className="border-l-4 border-cyan-600 pl-4 italic text-slate-700 my-6 font-serif text-lg">
          {node.content?.map((child, cIdx) => {
            if (child.type === 'paragraph') {
              return (
                <div key={cIdx} className="mb-2 last:mb-0">
                  {child.content?.map((t, tIdx) => renderInlineChild(t, tIdx))}
                </div>
              );
            }
            return renderContentNode(child, cIdx);
          })}
        </blockquote>
      );
    }

    if (node.type === 'bulletList') {
      return (
        <ul key={idx} className="list-disc list-outside pl-6 mb-6 space-y-2 text-slate-800 font-serif text-lg">
          {node.content?.map((li, lIdx) => (
            <li key={lIdx} className="leading-relaxed pl-1">
              {li.content?.map((p, pIdx) => (
                <span key={pIdx}>
                  {p.content?.map((txt, tIdx) => renderInlineChild(txt, tIdx))}
                </span>
              ))}
            </li>
          ))}
        </ul>
      );
    }

    if (node.type === 'orderedList') {
      return (
        <ol key={idx} className="list-decimal list-outside pl-6 mb-6 space-y-2 text-slate-800 font-serif text-lg">
          {node.content?.map((li, lIdx) => (
            <li key={lIdx} className="leading-relaxed pl-1">
              {li.content?.map((p, pIdx) => (
                <span key={pIdx}>
                  {p.content?.map((txt, tIdx) => renderInlineChild(txt, tIdx))}
                </span>
              ))}
            </li>
          ))}
        </ol>
      );
    }

    if (node.type === 'table') {
      return (
        <div key={idx} className="my-8 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs bg-white">
          <table className="min-w-full divide-y divide-slate-200 border-collapse text-left">
            {node.content?.map((rowNode, rIdx) => renderContentNode(rowNode, rIdx))}
          </table>
        </div>
      );
    }

    if (node.type === 'tableRow') {
      return (
        <tr key={idx} className="divide-x divide-slate-200 hover:bg-slate-50/50 transition-colors">
          {node.content?.map((cellNode, cellIdx) => renderContentNode(cellNode, cellIdx))}
        </tr>
      );
    }

    if (node.type === 'tableHeader') {
      return (
        <th 
          key={idx} 
          colSpan={node.attrs?.colspan || 1} 
          rowSpan={node.attrs?.rowspan || 1}
          className="bg-slate-100/90 text-slate-900 font-bold p-3.5 border-b border-slate-200 text-xs sm:text-sm font-sans tracking-wide uppercase"
        >
          {node.content?.map((child, cIdx) => {
            if (child.type === 'paragraph') {
              return (
                <div key={cIdx} className="font-bold text-slate-900">
                  {child.content?.map((t, tIdx) => renderInlineChild(t, tIdx))}
                </div>
              );
            }
            return renderContentNode(child, cIdx);
          })}
        </th>
      );
    }

    if (node.type === 'tableCell') {
      return (
        <td 
          key={idx} 
          colSpan={node.attrs?.colspan || 1} 
          rowSpan={node.attrs?.rowspan || 1}
          className="p-3.5 border-b border-slate-200 text-slate-800 text-sm sm:text-base font-sans align-top"
        >
          {node.content?.map((child, cIdx) => {
            if (child.type === 'paragraph') {
              return (
                <div key={cIdx} className="my-0.5">
                  {child.content?.map((t, tIdx) => renderInlineChild(t, tIdx))}
                </div>
              );
            }
            return renderContentNode(child, cIdx);
          })}
        </td>
      );
    }

    if (node.type === 'image') {
      const src = node.attrs?.src || '';
      const alt = node.attrs?.alt || 'Article Image';
      return (
        <div key={idx} className="my-8 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <img 
            src={normalizeImageUrl(src)} 
            alt={alt} 
            className="w-full h-auto object-cover max-h-[500px]" 
          />
        </div>
      );
    }

    if (node.type === 'codeBlock') {
      return (
        <pre key={idx} className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-sm overflow-x-auto my-6">
          <code>
            {node.content?.map(c => c.text).join('')}
          </code>
        </pre>
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
        <div className="max-w-none text-slate-800">
          {typeof post.content === 'string' ? (
            post.content.trim().startsWith('<') ? (
              <div 
                className="font-serif text-lg leading-relaxed text-slate-800 space-y-5
                  [&_h1]:text-3xl sm:[&_h1]:text-4xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mt-10 [&_h1]:mb-4
                  [&_h2]:text-2xl sm:[&_h2]:text-3xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-slate-200 [&_h2]:pb-2
                  [&_h3]:text-xl sm:[&_h3]:text-2xl [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-8 [&_h3]:mb-3
                  [&_p]:mb-5 [&_p]:leading-relaxed
                  [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-6 [&_ul]:my-5 [&_ul]:space-y-2
                  [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-6 [&_ol]:my-5 [&_ol]:space-y-2
                  [&_li]:leading-relaxed [&_li]:text-slate-800 [&_li]:pl-1
                  [&_li>p]:inline [&_li>p]:m-0 [&_li>p]:leading-relaxed
                  [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-700 [&_blockquote]:my-6
                  [&_strong]:font-bold [&_strong]:text-slate-900
                  [&_a]:text-cyan-600 [&_a]:underline [&_a]:hover:text-cyan-700
                  [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 [&_img]:my-6 [&_img]:shadow-sm [&_img]:max-w-full [&_img]:h-auto
                  [&_table]:w-full [&_table]:border-collapse [&_table]:my-8 [&_table]:rounded-xl [&_table]:border [&_table]:border-slate-200 [&_table]:overflow-hidden [&_table]:shadow-2xs
                  [&_th]:bg-slate-100/90 [&_th]:text-slate-900 [&_th]:font-bold [&_th]:p-3.5 [&_th]:border [&_th]:border-slate-200 [&_th]:text-xs sm:[&_th]:text-sm [&_th]:uppercase [&_th]:tracking-wide [&_th]:font-sans [&_th]:text-left
                  [&_td]:p-3.5 [&_td]:border [&_td]:border-slate-200 [&_td]:text-slate-800 [&_td]:text-sm sm:[&_td]:text-base [&_td]:font-sans [&_td]:bg-white [&_td]:align-top
                  [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-cyan-800"
                dangerouslySetInnerHTML={{ __html: post.content }} 
              />
            ) : (
              <div className="font-serif text-lg leading-relaxed text-slate-800">
                {renderPlainTextContent(post.content)}
              </div>
            )
          ) : (
            <div className="space-y-5">
              {post.content?.content?.map((node, idx) => renderContentNode(node, idx))}
            </div>
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

        {/* Related Posts Section (5 Latest Tech or Finance links) */}
        {relatedPosts && relatedPosts.length > 0 && (
          <section className="mt-16 pt-10 border-t border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                {post.vertical === 'tech' ? (
                  <Cpu className="w-5 h-5 text-cyan-600" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                )}
                <h3 className="font-serif text-2xl font-bold text-slate-900">
                  Related posts
                </h3>
              </div>
              <span
                className={`text-xs font-mono font-bold uppercase px-2.5 py-0.5 rounded-full ${
                  post.vertical === 'tech'
                    ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                Latest {post.vertical === 'tech' ? 'Tech' : 'Finance'}
              </span>
            </div>

            <div className="space-y-3.5">
              {relatedPosts.slice(0, 5).map((related) => {
                const relatedUrl = getPostUrl(related);
                const isTech = related.vertical === 'tech';

                return (
                  <a
                    key={related.id}
                    href={relatedUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectPost?.(related);
                    }}
                    className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-200 text-left block cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <img
                        src={
                          normalizeImageUrl(related.cover_image) ||
                          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=300'
                        }
                        alt={related.title}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0 border border-slate-100 group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1 font-mono">
                          <span
                            className={`font-bold uppercase ${
                              isTech ? 'text-cyan-700' : 'text-emerald-700'
                            }`}
                          >
                            {related.vertical}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {related.reading_time_minutes} min read
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">
                            {new Date(related.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-serif text-base sm:text-lg font-bold text-slate-900 group-hover:text-cyan-700 transition-colors line-clamp-2 leading-snug">
                          {related.title}
                        </h4>
                        {related.excerpt && (
                          <p className="text-xs text-slate-600 line-clamp-1 mt-1 font-sans">
                            {related.excerpt}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 group-hover:text-cyan-700 transition-colors sm:self-center self-end flex-shrink-0">
                      <span>Read article</span>
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </article>
  );
};

export const ArticleLoadingSkeleton: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  return (
    <article className="min-h-screen bg-slate-50 text-slate-800 pb-20 animate-pulse">
      {/* Article Header Skeleton */}
      <div className="border-b border-slate-200 bg-slate-100/70 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Publications</span>
            </button>
          )}

          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-16 h-5 bg-slate-200 rounded"></div>
            <div className="w-4 h-4 text-slate-400">/</div>
            <div className="w-16 h-5 bg-slate-200 rounded"></div>
            <div className="w-4 h-4 text-slate-400">/</div>
            <div className="w-44 h-5 bg-slate-200 rounded"></div>
          </div>

          {/* Title skeleton */}
          <div className="space-y-3 mb-6">
            <div className="w-full h-10 sm:h-12 bg-slate-300 rounded-lg"></div>
            <div className="w-3/4 h-10 sm:h-12 bg-slate-300 rounded-lg"></div>
          </div>

          {/* Excerpt skeleton */}
          <div className="w-full h-16 bg-white border-l-4 border-cyan-600 rounded-r-lg p-3 mb-8 shadow-xs">
            <div className="w-full h-3.5 bg-slate-200 rounded mb-2"></div>
            <div className="w-4/5 h-3.5 bg-slate-200 rounded"></div>
          </div>

          {/* Author bar skeleton */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-slate-300"></div>
              <div className="space-y-2">
                <div className="w-32 h-4 bg-slate-300 rounded"></div>
                <div className="w-24 h-3 bg-slate-200 rounded"></div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-24 h-8 bg-slate-200 rounded-lg"></div>
              <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
              <div className="w-20 h-8 bg-slate-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Body content skeleton */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="w-full h-72 sm:h-96 bg-slate-200 rounded-xl mb-8"></div>
        <div className="space-y-4">
          <div className="w-full h-4 bg-slate-200 rounded"></div>
          <div className="w-full h-4 bg-slate-200 rounded"></div>
          <div className="w-5/6 h-4 bg-slate-200 rounded"></div>
          <div className="w-4/5 h-4 bg-slate-200 rounded"></div>
          <div className="w-2/3 h-7 bg-slate-300 rounded mt-8"></div>
          <div className="w-full h-4 bg-slate-200 rounded"></div>
          <div className="w-full h-4 bg-slate-200 rounded"></div>
          <div className="w-3/4 h-4 bg-slate-200 rounded"></div>
        </div>
      </div>
    </article>
  );
};
