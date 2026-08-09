import React, { useState } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  ThumbsUp, 
  ThumbsDown, 
  BarChart2, 
  Sparkles, 
  Filter, 
  Tag, 
  Flame, 
  X,
  TrendingUp,
  Cpu,
  Building2,
  Globe
} from 'lucide-react';
import { DiscussionTopic, DiscussionCategory, UserProfile } from '../types';
import { getTopicUrl } from '../lib/router';
import { PollWidget } from './PollWidget';

interface DiscussionForumProps {
  topics: DiscussionTopic[];
  onSelectTopic: (topic: DiscussionTopic) => void;
  currentUser: UserProfile | null;
  onCreateTopic: (data: {
    title: string;
    content: string;
    category: DiscussionCategory;
    tags: string[];
    pollQuestion?: string;
    pollOptions?: string[];
  }) => void;
  onVoteTopic: (topicId: string, type: 'up' | 'down') => void;
  getUserTopicVote: (topicId: string) => 'up' | 'down' | null;
  onVotePoll?: (pollId: string, optionId: string) => void;
  getUserPollVote?: (pollId: string) => string | undefined;
  onOpenAuth: () => void;
}

export const DiscussionForum: React.FC<DiscussionForumProps> = ({
  topics,
  onSelectTopic,
  currentUser,
  onCreateTopic,
  onVoteTopic,
  getUserTopicVote,
  onVotePoll,
  getUserPollVote,
  onOpenAuth,
}) => {
  const [activeCategory, setActiveCategory] = useState<DiscussionCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'top' | 'comments'>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Modal Form State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<DiscussionCategory>('general');
  const [newTagsStr, setNewTagsStr] = useState('');
  const [enablePoll, setEnablePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);

  const handleAddPollOption = () => {
    if (pollOpts.length < 5) {
      setPollOpts([...pollOpts, '']);
    }
  };

  const handlePollOptChange = (idx: number, val: string) => {
    const updated = [...pollOpts];
    updated[idx] = val;
    setPollOpts(updated);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const tags = newTagsStr
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    onCreateTopic({
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      tags: tags.length > 0 ? tags : [newCategory],
      pollQuestion: enablePoll && pollQuestion.trim() ? pollQuestion.trim() : undefined,
      pollOptions: enablePoll ? pollOpts.filter(o => o.trim()) : undefined,
    });

    // Reset Form
    setNewTitle('');
    setNewContent('');
    setNewTagsStr('');
    setEnablePoll(false);
    setPollQuestion('');
    setPollOpts(['', '']);
    setShowCreateModal(false);
  };

  // Filter & Sort
  const filteredTopics = topics
    .filter(t => {
      const matchesCat = activeCategory === 'all' || t.category === activeCategory;
      const matchesSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'top') {
        return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
      }
      if (sortBy === 'comments') {
        return b.comment_count - a.comment_count;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Forum Header Banner */}
      <div className="bg-gradient-to-r from-teal-50 via-slate-100 to-cyan-50 border-b border-slate-200 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-teal-700 uppercase tracking-wider mb-2 font-bold">
              <MessageSquare className="w-4 h-4" />
              <span>StartupCrème Community Forum • <code className="text-slate-700">/discussion</code></span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Finance & Tech Executive Discussions
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed font-sans">
              Engage with venture capitalists, software architects, and founders. Vote on polls, analyze infrastructure unit economics, and post multi-threaded replies.
            </p>
          </div>

          <button
            onClick={() => {
              if (!currentUser) onOpenAuth();
              else setShowCreateModal(true);
            }}
            className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Start New Discussion Topic</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Filters Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeCategory === 'all'
                  ? 'bg-teal-100 text-teal-900 border border-teal-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>All Categories</span>
            </button>
            <button
              onClick={() => setActiveCategory('finance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeCategory === 'finance'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Finance</span>
            </button>
            <button
              onClick={() => setActiveCategory('tech')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeCategory === 'tech'
                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 shadow-xs'
                  : 'text-slate-600 hover:text-cyan-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Tech</span>
            </button>
            <button
              onClick={() => setActiveCategory('startup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeCategory === 'startup'
                  ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-xs'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Startup</span>
            </button>
            <button
              onClick={() => setActiveCategory('general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeCategory === 'general'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <span>General</span>
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search forum..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500"
              />
            </div>

            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setSortBy('latest')}
                className={`px-2.5 py-1 rounded font-medium ${sortBy === 'latest' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'}`}
              >
                Latest
              </button>
              <button
                onClick={() => setSortBy('top')}
                className={`px-2.5 py-1 rounded font-medium ${sortBy === 'top' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'}`}
              >
                Top Voted
              </button>
              <button
                onClick={() => setSortBy('comments')}
                className={`px-2.5 py-1 rounded font-medium ${sortBy === 'comments' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'}`}
              >
                Replies
              </button>
            </div>
          </div>
        </div>

        {/* Topic List Cards */}
        <div className="space-y-4">
          {filteredTopics.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-500 font-mono text-xs">
              No discussion topics found matching criteria. Be the first to start a topic!
            </div>
          ) : (
            filteredTopics.map((t) => {
              const vote = getUserTopicVote(t.id);
              const score = t.upvotes - t.downvotes;

              return (
                <div
                  key={t.id}
                  className="group bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 sm:p-6 transition-all shadow-xs flex items-start gap-4"
                >
                  {/* Upvote Box */}
                  <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-2 shrink-0 w-12">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!currentUser) onOpenAuth();
                        else onVoteTopic(t.id, 'up');
                      }}
                      className={`p-1 rounded hover:text-emerald-600 transition-colors ${
                        vote === 'up' ? 'text-emerald-600 font-bold bg-emerald-100' : 'text-slate-500'
                      }`}
                      title="Upvote topic"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-xs font-bold text-slate-800 py-1">
                      {score}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!currentUser) onOpenAuth();
                        else onVoteTopic(t.id, 'down');
                      }}
                      className={`p-1 rounded hover:text-rose-600 transition-colors ${
                        vote === 'down' ? 'text-rose-600 font-bold bg-rose-100' : 'text-slate-500'
                      }`}
                      title="Downvote topic"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Main Card Information */}
                  <div className="flex-1 min-w-0">
                    <a 
                      href={getTopicUrl(t)}
                      onClick={(e) => {
                        e.preventDefault();
                        onSelectTopic(t);
                      }}
                      className="block text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-300 font-bold uppercase text-[10px]">
                          {t.category}
                        </span>
                        {t.poll && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] flex items-center gap-1 font-bold">
                            <BarChart2 className="w-3 h-3 text-amber-700" />
                            <span>Poll Attached</span>
                          </span>
                        )}
                        <span className="text-slate-400">•</span>
                        <span>Posted by <strong className="text-slate-700">{t.author_name}</strong> ({t.author_handle})</span>
                        <span className="text-slate-400">•</span>
                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>

                      <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors mb-2 leading-snug">
                        {t.title}
                      </h3>

                      <p className="text-slate-600 text-xs sm:text-sm line-clamp-2 leading-relaxed mb-4">
                        {t.content}
                      </p>
                    </a>

                    {/* Attached Poll */}
                    {t.poll && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <PollWidget
                          poll={t.poll}
                          userPollVote={getUserPollVote ? getUserPollVote(t.poll.id) : undefined}
                          onVotePoll={(pollId, optionId) => {
                            if (onVotePoll) onVotePoll(pollId, optionId);
                          }}
                          currentUser={currentUser}
                          onOpenAuth={onOpenAuth}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap gap-1.5">
                        {t.tags.map(tag => (
                          <span key={tag} className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <a 
                        href={getTopicUrl(t)}
                        onClick={(e) => {
                          e.preventDefault();
                          onSelectTopic(t);
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700 cursor-pointer transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                        <span>{t.comment_count} Replies</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Topic Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative my-8 text-slate-800">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 rounded-lg bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="font-serif text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              <span>Create Forum Topic</span>
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Topics support formatted content and optional attached interactive polls.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Topic Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. What is your startup's true GPU inference cost per 1M tokens?"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as DiscussionCategory)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white"
                  >
                    <option value="finance">Finance</option>
                    <option value="tech">Tech</option>
                    <option value="startup">Startup</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={newTagsStr}
                    onChange={(e) => setNewTagsStr(e.target.value)}
                    placeholder="e.g. GPU, Infrastructure, Unit Economics"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Topic Body & Analysis *</label>
                <textarea
                  required
                  rows={5}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Provide context, data points, or questions for the community..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white font-sans"
                />
              </div>

              {/* Poll Builder Toggle */}
              <div className="border-t border-slate-200 pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-teal-700">
                  <input
                    type="checkbox"
                    checked={enablePoll}
                    onChange={(e) => setEnablePoll(e.target.checked)}
                    className="rounded bg-slate-50 border-slate-300 text-teal-600 focus:ring-0"
                  />
                  <BarChart2 className="w-4 h-4" />
                  <span>Attach an Interactive Community Poll to this topic</span>
                </label>

                {enablePoll && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Poll Question</label>
                      <input
                        type="text"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="e.g. Which Cloud Provider has the best GPU availability?"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Poll Options</label>
                      <div className="space-y-2">
                        {pollOpts.map((opt, idx) => (
                          <input
                            key={idx}
                            type="text"
                            value={opt}
                            onChange={(e) => handlePollOptChange(idx, e.target.value)}
                            placeholder={`Option ${idx + 1}`}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-900"
                          />
                        ))}
                      </div>

                      {pollOpts.length < 5 && (
                        <button
                          type="button"
                          onClick={handleAddPollOption}
                          className="mt-2 text-[11px] text-teal-700 font-bold hover:underline"
                        >
                          + Add Another Option
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs"
                >
                  Publish Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
