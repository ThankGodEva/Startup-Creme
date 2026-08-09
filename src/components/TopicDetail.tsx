import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  CornerDownRight, 
  Send, 
  CheckCircle2, 
  Tag, 
  BarChart2, 
  Clock, 
  User,
  Share2
} from 'lucide-react';
import { DiscussionTopic, DiscussionComment, UserProfile } from '../types';
import { PollWidget } from './PollWidget';

interface TopicDetailProps {
  topic: DiscussionTopic;
  comments: DiscussionComment[];
  onBack: () => void;
  currentUser: UserProfile | null;
  onVoteTopic: (type: 'up' | 'down') => void;
  userTopicVote: 'up' | 'down' | null;
  onVotePoll: (pollId: string, optionId: string) => void;
  userPollVote: string | undefined;
  onAddComment: (content: string, parentId?: string | null) => void;
  onVoteComment: (commentId: string, type: 'up' | 'down') => void;
  getUserCommentVote: (commentId: string) => 'up' | 'down' | null;
  onOpenAuth: () => void;
}

export const TopicDetail: React.FC<TopicDetailProps> = ({
  topic,
  comments,
  onBack,
  currentUser,
  onVoteTopic,
  userTopicVote,
  onVotePoll,
  userPollVote,
  onAddComment,
  onVoteComment,
  getUserCommentVote,
  onOpenAuth,
}) => {
  const [commentInput, setCommentInput] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');

  const handleMainCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(commentInput.trim(), null);
    setCommentInput('');
  };

  const handleReplySubmit = (parentId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim()) return;
    onAddComment(replyInput.trim(), parentId);
    setReplyInput('');
    setReplyParentId(null);
  };

  const poll = topic.poll;
  const totalPollVotes = poll ? poll.total_votes : 0;

  // Render threaded comment tree
  const renderComment = (comment: DiscussionComment, depth = 0) => {
    const commentVote = getUserCommentVote(comment.id);
    const isReplying = replyParentId === comment.id;

    return (
      <div 
        key={comment.id} 
        className={`bg-white border border-slate-200 rounded-xl p-4 transition-all shadow-xs ${
          depth > 0 ? 'ml-4 sm:ml-8 border-l-2 border-l-teal-600 mt-3' : 'mt-4'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <img
              src={comment.author_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
              alt={comment.author_name}
              className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200"
            />
            <span className="text-xs font-bold text-slate-900">{comment.author_name}</span>
            <span className="text-[10px] text-slate-500">{comment.author_handle}</span>
            <span className="text-[10px] text-slate-400">• {new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Comment Content */}
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans mb-3 pl-8">
          {comment.content}
        </p>

        {/* Action Controls */}
        <div className="flex items-center gap-4 text-xs text-slate-500 pl-8">
          {/* Vote Buttons */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            <button
              onClick={() => onVoteComment(comment.id, 'up')}
              className={`p-1 rounded hover:text-emerald-600 transition-colors ${
                commentVote === 'up' ? 'text-emerald-600 font-bold bg-emerald-100' : 'text-slate-500'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold text-slate-800">{comment.upvotes - comment.downvotes}</span>
            <button
              onClick={() => onVoteComment(comment.id, 'down')}
              className={`p-1 rounded hover:text-rose-600 transition-colors ${
                commentVote === 'down' ? 'text-rose-600 font-bold bg-rose-100' : 'text-slate-500'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reply Toggle */}
          <button
            onClick={() => {
              if (!currentUser) {
                onOpenAuth();
              } else {
                setReplyParentId(isReplying ? null : comment.id);
              }
            }}
            className="flex items-center gap-1 text-[11px] hover:text-teal-700 transition-colors font-semibold"
          >
            <CornerDownRight className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>
        </div>

        {/* Nested Reply Form */}
        {isReplying && (
          <form onSubmit={(e) => handleReplySubmit(comment.id, e)} className="mt-3 pl-8 space-y-2">
            <textarea
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              placeholder={`Replying to ${comment.author_name}...`}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReplyParentId(null)}
                className="px-3 py-1 rounded text-xs text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
              >
                Send Reply
              </button>
            </div>
          </form>
        )}

        {/* Nested Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-3">
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-slate-800">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Back to Forum Topics</span>
      </button>

      {/* Main Topic Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-8">
        {/* Category & Tag Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <span className="px-3 py-1 rounded-full text-xs font-mono uppercase font-bold bg-teal-100 border border-teal-300 text-teal-900">
            {topic.category} Category
          </span>
          <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
            /discussions/{topic.slug}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight mb-4">
          {topic.title}
        </h1>

        {/* Author Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <img
              src={topic.author_avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100'}
              alt={topic.author_name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200"
            />
            <div>
              <div className="text-sm font-bold text-slate-900">{topic.author_name}</div>
              <div className="text-xs text-slate-500">{topic.author_handle} • {new Date(topic.created_at).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Voting Box */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <button
              onClick={() => {
                if (!currentUser) onOpenAuth();
                else onVoteTopic('up');
              }}
              className={`p-1.5 rounded hover:text-emerald-600 transition-colors ${
                userTopicVote === 'up' ? 'text-emerald-600 bg-emerald-100 font-bold' : 'text-slate-500'
              }`}
              title="Upvote topic"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>

            <div className="font-mono text-sm font-bold text-slate-900 min-w-[24px] text-center">
              {topic.upvotes - topic.downvotes}
            </div>

            <button
              onClick={() => {
                if (!currentUser) onOpenAuth();
                else onVoteTopic('down');
              }}
              className={`p-1.5 rounded hover:text-rose-600 transition-colors ${
                userTopicVote === 'down' ? 'text-rose-600 bg-rose-100 font-bold' : 'text-slate-500'
              }`}
              title="Downvote topic"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Topic Body */}
        <div className="prose prose-slate max-w-none text-slate-800 font-sans text-sm sm:text-base leading-relaxed whitespace-pre-line mb-8">
          {topic.content}
        </div>

        {/* Attached Poll */}
        {poll && (
          <PollWidget
            poll={poll}
            userPollVote={userPollVote}
            onVotePoll={onVotePoll}
            currentUser={currentUser}
            onOpenAuth={onOpenAuth}
          />
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
          <Tag className="w-3.5 h-3.5 text-slate-400 mr-1 self-center" />
          {topic.tags.map(t => (
            <span key={t} className="px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* Discussion Thread Comments */}
      <section>
        <h3 className="font-serif text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-teal-600" />
          <span>Threaded Replies ({topic.comment_count})</span>
        </h3>

        {/* New Comment Box */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
          {currentUser ? (
            <form onSubmit={handleMainCommentSubmit} className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-800 font-semibold">
                <img
                  src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                  alt={currentUser.full_name}
                  className="w-6 h-6 rounded-full"
                />
                <span>Reply to Topic as {currentUser.full_name}</span>
              </div>
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Write a thoughtful reply or analysis..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Comment</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-slate-600 mb-2">Sign in to participate in discussion threads.</p>
              <button
                onClick={onOpenAuth}
                className="px-4 py-1.5 rounded-lg bg-teal-600 text-white font-bold text-xs shadow-xs"
              >
                Sign In to Reply
              </button>
            </div>
          )}
        </div>

        {/* Comment Tree */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs font-mono">
              No replies yet. Start the conversation!
            </div>
          ) : (
            comments.map(c => renderComment(c))
          )}
        </div>
      </section>
    </div>
  );
};
