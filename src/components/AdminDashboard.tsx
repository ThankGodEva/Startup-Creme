import React, { useState } from 'react';
import { 
  ShieldAlert, 
  FileText, 
  MessageSquare, 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Globe, 
  Search, 
  Code, 
  Save, 
  Eye, 
  Sparkles,
  LayoutGrid,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Post, DiscussionTopic, UserProfile, ContentVertical, PublicationStatus } from '../types';
import { generateSitemapXML, generateRobotsTxt } from '../lib/seo';
import { store } from '../lib/store';
import { ArticleEditorPage } from './ArticleEditorPage';

interface AdminDashboardProps {
  currentUser: UserProfile | null;
  posts: Post[];
  topics: DiscussionTopic[];
  onSavePost: (post: Partial<Post>) => Promise<{ success: boolean; post: Post; error?: string }>;
  onDeletePost: (id: string) => void;
  onTogglePostStatus: (id: string) => void;
  onDeleteTopic: (topicId: string) => void;
  onSwitchRole: (role: 'admin' | 'user' | 'guest') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  posts,
  topics,
  onSavePost,
  onDeletePost,
  onTogglePostStatus,
  onDeleteTopic,
  onSwitchRole,
}) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'discussions' | 'seo'>('posts');
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [verticalFilter, setVerticalFilter] = useState<'all' | ContentVertical>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PublicationStatus>('all');

  // Supabase Article Seeding State
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sitemap & Robots State
  const [copiedSitemap, setCopiedSitemap] = useState(false);

  const handleSeedArticles = async () => {
    setSeeding(true);
    setSeedResult(null);
    const res = await store.seedStaticArticlesToSupabase();
    setSeedResult(res);
    setSeeding(false);
  };

  const handleDeleteAllSamplePosts = async () => {
    setSeeding(true);
    setSeedResult(null);
    const res = await store.deleteAllSamplePosts();
    setSeedResult(res);
    setSeeding(false);
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
          <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-xs text-slate-600 mb-6">
            Only users with the <code className="text-amber-700 font-bold font-mono">admin</code> role in the <code className="text-cyan-700 font-bold font-mono">startupcreme.users</code> table can view the editorial CMS.
          </p>
          <button
            onClick={() => onSwitchRole('admin')}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-xs"
          >
            Switch Active Role to Admin (Demo)
          </button>
        </div>
      </div>
    );
  }

  if (editingPost) {
    return (
      <ArticleEditorPage
        post={editingPost}
        currentUser={currentUser}
        onSave={async (postData) => {
          const res = await onSavePost(postData);
          if (res && !res.success && res.error) {
            return { success: false, error: res.error };
          }
          setEditingPost(null);
          return { success: true };
        }}
        onCancel={() => setEditingPost(null)}
      />
    );
  }

  // Filter Posts
  const filteredPosts = posts.filter(p => {
    const matchesSearch = !searchQuery || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVert = verticalFilter === 'all' || p.vertical === verticalFilter;
    const matchesStat = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesVert && matchesStat;
  });

  const handleCreateNew = () => {
    setEditingPost({
      title: '',
      slug: '',
      locale: 'en-us',
      vertical: 'finance',
      excerpt: '',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Section Heading Title' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Enter comprehensive financial or technology editorial body here...' }]
          }
        ]
      },
      status: 'draft',
      meta_description: '',
      canonical_url: '',
      cover_image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200',
      author_name: currentUser.full_name,
      author_role: 'Principal Editor',
      author_avatar: currentUser.avatar_url,
      dual_silo: false,
      silo_badge: 'Editorial Lead',
      tags: ['Finance', 'Tech'],
      reading_time_minutes: 5,
      word_count: 750,
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost?.title || !editingPost.slug) return;
    onSavePost(editingPost);
    setEditingPost(null);
  };

  const sitemapXML = generateSitemapXML(posts, topics);
  const robotsTxt = generateRobotsTxt();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200 py-8 px-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-700 font-bold uppercase tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span>Editorial CMS & Moderation Control • <code className="text-slate-700">/admin</code></span>
            </div>
            <h1 className="font-serif text-3xl font-extrabold text-slate-900">StartupCrème Administration</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Article</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Seed Result Alert */}
        {seedResult && (
          <div className={`mb-6 p-4 rounded-xl text-xs flex items-center justify-between gap-3 border ${
            seedResult.success 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2">
              {seedResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span className="font-semibold">{seedResult.message}</span>
            </div>
            <button 
              onClick={() => setSeedResult(null)}
              className="text-[11px] underline hover:no-underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-4 mb-8">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'posts'
                ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-cyan-600" />
            <span>Articles & Posts ({posts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('discussions')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'discussions'
                ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-teal-600" />
            <span>Discussion Moderation ({topics.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('seo')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'seo'
                ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>SEO Sitemap & Robots.txt</span>
          </button>
        </div>

        {/* POSTS TAB */}
        {activeTab === 'posts' && (
          <div>
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title or slug..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={verticalFilter}
                  onChange={(e) => setVerticalFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white"
                >
                  <option value="all">All Verticals</option>
                  <option value="finance">Finance</option>
                  <option value="tech">Tech</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Posts Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-mono text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-4">Article Title & Slug</th>
                      <th className="p-4">Vertical & Locale</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Author</th>
                      <th className="p-4">Updated</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPosts.map(post => (
                      <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 text-sm max-w-xs truncate">{post.title}</div>
                          <div className="font-mono text-[11px] text-slate-500">/{post.slug}</div>
                        </td>
                        <td className="p-4 font-mono">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mr-1.5 ${
                            post.vertical === 'finance' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                          }`}>
                            {post.vertical}
                          </span>
                          <span className="text-slate-500">/{post.locale}</span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => onTogglePostStatus(post.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 transition-colors ${
                              post.status === 'published'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                            }`}
                          >
                            {post.status === 'published' ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-amber-600" />}
                            <span className="capitalize">{post.status}</span>
                          </button>
                        </td>
                        <td className="p-4 font-medium text-slate-800">{post.author_name}</td>
                        <td className="p-4 text-slate-500 font-mono text-[11px]">
                          {new Date(post.updated_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingPost(post)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                              title="Edit post"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeletePost(post.id)}
                              className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200"
                              title="Delete post"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DISCUSSIONS MODERATION TAB */}
        {activeTab === 'discussions' && (
          <div className="space-y-4">
            <h3 className="font-serif text-xl font-bold text-slate-900 mb-4">Forum Topics Moderation</h3>
            {topics.map(t => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4 shadow-xs">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1">
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-bold uppercase text-[10px]">{t.category}</span>
                    <span>By {t.author_name}</span>
                  </div>
                  <h4 className="font-serif text-base font-bold text-slate-900">{t.title}</h4>
                </div>

                <button
                  onClick={() => onDeleteTopic(t.id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Topic</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* SEO TAB */}
        {activeTab === 'seo' && (
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <h3 className="font-serif text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" />
                <span>Auto-Generated XML Sitemap</span>
              </h3>
              <p className="text-xs text-slate-600 mb-4">
                Structured for Google Topical Authority siloing across locales, published posts, and discussion topics.
              </p>

              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-80">
                {sitemapXML}
              </pre>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <h3 className="font-serif text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-600" />
                <span>robots.txt Configuration</span>
              </h3>

              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-cyan-300">
                {robotsTxt}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
