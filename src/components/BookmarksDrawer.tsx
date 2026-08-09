import React from 'react';
import { X, Bookmark, ArrowRight, Trash2 } from 'lucide-react';
import { Post } from '../types';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarkedPosts: Post[];
  onSelectPost: (post: Post) => void;
  onRemoveBookmark: (postId: string) => void;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  isOpen,
  onClose,
  bookmarkedPosts,
  onSelectPost,
  onRemoveBookmark,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div className="bg-white border-l border-slate-200 w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl relative text-slate-800">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
            <div className="flex items-center gap-2 font-serif text-lg font-bold text-slate-900">
              <Bookmark className="w-5 h-5 text-cyan-600 fill-current" />
              <span>Saved Articles ({bookmarkedPosts.length})</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-900 rounded-lg bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-160px)] pr-1">
            {bookmarkedPosts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-mono text-xs">
                No saved articles yet. Click the bookmark icon on any article to save it for reading later.
              </div>
            ) : (
              bookmarkedPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors flex items-start justify-between gap-3 shadow-2xs"
                >
                  <div
                    onClick={() => {
                      onSelectPost(post);
                      onClose();
                    }}
                    className="cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mb-1">
                      <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                        post.vertical === 'finance' ? 'bg-emerald-100 text-emerald-900' : 'bg-cyan-100 text-cyan-900'
                      }`}>
                        {post.vertical}
                      </span>
                      <span>/{post.locale}</span>
                    </div>
                    <h4 className="font-serif text-sm font-bold text-slate-900 hover:text-cyan-600 transition-colors line-clamp-2">
                      {post.title}
                    </h4>
                  </div>

                  <button
                    onClick={() => onRemoveBookmark(post.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200/60 transition-colors"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
