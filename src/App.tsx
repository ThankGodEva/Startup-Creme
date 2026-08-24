import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DualHero } from './components/DualHero';
import { ArticleCard } from './components/ArticleCard';
import { ArticleView, ArticleLoadingSkeleton } from './components/ArticleView';
import { DiscussionForum } from './components/DiscussionForum';
import { TopicDetail } from './components/TopicDetail';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { BookmarksDrawer } from './components/BookmarksDrawer';
import { Footer } from './components/Footer';
import { LegalPage, LegalDocType } from './components/LegalPage';

import { store } from './lib/store';
import { Post, DiscussionTopic, UserProfile, ContentVertical } from './types';
import { getPostUrl, getTopicUrl, getTabUrl, VALID_LOCALES, NavigationTab } from './lib/router';
import { TrendingUp, Cpu, MessageSquare, Sparkles, SlidersHorizontal, ArrowRight, BarChart2, ThumbsUp } from 'lucide-react';

export default function App() {
  const [, setTick] = useState(0);

  // App State
  const [currentLocale, setCurrentLocale] = useState('en-us');
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<DiscussionTopic | null>(null);
  const [loadingArticleSlug, setLoadingArticleSlug] = useState<string | null>(null);
  const [loadingTopicSlug, setLoadingTopicSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBookmarksDrawer, setShowBookmarksDrawer] = useState(false);

  // Sync React state with URL path
  const syncStateFromUrl = useCallback(() => {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);

    if (parts.length === 0) {
      setActiveTab('home');
      setSelectedPost(null);
      setSelectedTopic(null);
      setLoadingArticleSlug(null);
      setLoadingTopicSlug(null);
      return;
    }

    if (parts[0] === 'admin') {
      setActiveTab('admin');
      setSelectedPost(null);
      setSelectedTopic(null);
      setLoadingArticleSlug(null);
      setLoadingTopicSlug(null);
      return;
    }

    if (parts[0] === 'privacy' || parts[0] === 'privacy-policy') {
      setActiveTab('privacy');
      setSelectedPost(null);
      setSelectedTopic(null);
      setLoadingArticleSlug(null);
      setLoadingTopicSlug(null);
      return;
    }

    if (parts[0] === 'terms' || parts[0] === 'terms-of-service' || parts[0] === 'terms-of-editorial-service') {
      setActiveTab('terms');
      setSelectedPost(null);
      setSelectedTopic(null);
      setLoadingArticleSlug(null);
      setLoadingTopicSlug(null);
      return;
    }

    let loc = 'en-us';
    let rest = parts;
    if (VALID_LOCALES.includes(parts[0])) {
      loc = parts[0];
      rest = parts.slice(1);
    }
    setCurrentLocale(loc);

    if (rest.length === 0) {
      setActiveTab('home');
      setSelectedPost(null);
      setSelectedTopic(null);
      setLoadingArticleSlug(null);
      setLoadingTopicSlug(null);
      return;
    }

    const first = rest[0]; // 'finance', 'tech', 'discussions', 'discussion', 'privacy', 'terms'

    if (rest.length === 1) {
      if (first === 'finance') {
        setActiveTab('finance');
        setSelectedPost(null);
        setSelectedTopic(null);
        setLoadingArticleSlug(null);
        setLoadingTopicSlug(null);
      } else if (first === 'tech') {
        setActiveTab('tech');
        setSelectedPost(null);
        setSelectedTopic(null);
        setLoadingArticleSlug(null);
        setLoadingTopicSlug(null);
      } else if (first === 'discussions' || first === 'discussion') {
        setActiveTab('discussion');
        setSelectedPost(null);
        setSelectedTopic(null);
        setLoadingArticleSlug(null);
        setLoadingTopicSlug(null);
      } else if (first === 'privacy' || first === 'privacy-policy') {
        setActiveTab('privacy');
        setSelectedPost(null);
        setSelectedTopic(null);
        setLoadingArticleSlug(null);
        setLoadingTopicSlug(null);
      } else if (first === 'terms' || first === 'terms-of-service' || first === 'terms-of-editorial-service') {
        setActiveTab('terms');
        setSelectedPost(null);
        setSelectedTopic(null);
        setLoadingArticleSlug(null);
        setLoadingTopicSlug(null);
      } else {
        const post = store.getPostBySlug(first);
        if (post) {
          setSelectedPost(post);
          setActiveTab(post.vertical);
          setSelectedTopic(null);
          setLoadingArticleSlug(null);
          setLoadingTopicSlug(null);
        } else {
          setLoadingArticleSlug(first);
          setSelectedTopic(null);
          store.fetchPostBySlug(first, loc).then(fetched => {
            if (fetched) {
              setSelectedPost(fetched);
              setActiveTab(fetched.vertical);
            }
            setLoadingArticleSlug(null);
          });
        }
      }
      return;
    }

    if (rest.length >= 2) {
      const slug = rest[1];
      if (first === 'discussions' || first === 'discussion') {
        const topic = store.getDiscussionTopicBySlug(slug);
        if (topic) {
          setSelectedTopic(topic);
          setActiveTab('discussion');
          setSelectedPost(null);
          setLoadingArticleSlug(null);
          setLoadingTopicSlug(null);
        } else {
          setLoadingTopicSlug(slug);
          setSelectedPost(null);
          store.fetchTopicBySlug(slug).then(fetched => {
            if (fetched) {
              setSelectedTopic(fetched);
              setActiveTab('discussion');
            } else {
              setActiveTab('discussion');
            }
            setLoadingTopicSlug(null);
          });
        }
      } else if (first === 'privacy' || first === 'privacy-policy') {
        setActiveTab('privacy');
        setSelectedPost(null);
        setSelectedTopic(null);
        setLoadingArticleSlug(null);
        setLoadingTopicSlug(null);
      } else if (first === 'terms' || first === 'terms-of-service' || first === 'terms-of-editorial-service') {
        setActiveTab('terms');
        setSelectedPost(null);
        setSelectedTopic(null);
        setLoadingArticleSlug(null);
        setLoadingTopicSlug(null);
      } else {
        const post = store.getPostBySlug(slug, loc, first as ContentVertical) || store.getPostBySlug(slug);
        if (post) {
          setSelectedPost(post);
          setActiveTab(post.vertical);
          setSelectedTopic(null);
          setLoadingArticleSlug(null);
          setLoadingTopicSlug(null);
        } else {
          setLoadingArticleSlug(slug);
          setSelectedTopic(null);
          const targetVertical = (first === 'finance' || first === 'tech') ? (first as ContentVertical) : undefined;
          store.fetchPostBySlug(slug, loc, targetVertical).then(fetched => {
            if (fetched) {
              setSelectedPost(fetched);
              setActiveTab(fetched.vertical);
            } else {
              if (first === 'finance' || first === 'tech') {
                setActiveTab(first);
              } else {
                setActiveTab('home');
              }
            }
            setLoadingArticleSlug(null);
          });
        }
      }
    }
  }, []);

  // Subscribe to store updates & listen to popstate
  useEffect(() => {
    syncStateFromUrl();

    const handlePopState = () => {
      syncStateFromUrl();
    };

    window.addEventListener('popstate', handlePopState);

    const unsubscribe = store.subscribe(() => {
      setTick(t => t + 1);
      syncStateFromUrl();
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      unsubscribe();
    };
  }, [syncStateFromUrl]);

  const currentUser = store.getCurrentUser();
  const allPosts = store.getAllPosts();
  const publishedPosts = store.getPosts(currentLocale, undefined, 'published');
  const financePosts = store.getPosts(currentLocale, 'finance', 'published');
  const techPosts = store.getPosts(currentLocale, 'tech', 'published');
  const topics = store.getDiscussionTopics();
  const top3Topics = [...topics]
    .sort((a, b) => ((b.upvotes - b.downvotes) + b.comment_count * 2) - ((a.upvotes - a.downvotes) + a.comment_count * 2))
    .slice(0, 3);

  // Bookmarked items
  const bookmarkedPosts = allPosts.filter(p => store.isBookmarked(p.id));

  // Navigation handlers with browser URL updates
  const handleTabChange = (tab: NavigationTab) => {
    setActiveTab(tab);
    setSelectedPost(null);
    setSelectedTopic(null);
    const targetUrl = getTabUrl(tab, currentLocale);
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPost = (post: Post) => {
    setSelectedPost(post);
    setSelectedTopic(null);
    setActiveTab(post.vertical);
    const targetUrl = getPostUrl(post);
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTopic = (topic: DiscussionTopic) => {
    setSelectedTopic(topic);
    setSelectedPost(null);
    setActiveTab('discussion');
    const targetUrl = getTopicUrl(topic, currentLocale);
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLocaleChange = (loc: string) => {
    setCurrentLocale(loc);
    if (selectedPost) {
      const targetUrl = getPostUrl({ ...selectedPost, locale: loc });
      window.history.pushState({}, '', targetUrl);
    } else if (selectedTopic) {
      const targetUrl = getTopicUrl(selectedTopic, loc);
      window.history.pushState({}, '', targetUrl);
    } else {
      const targetUrl = getTabUrl(activeTab, loc);
      window.history.pushState({}, '', targetUrl);
    }
  };

  const handleBack = () => {
    setSelectedPost(null);
    setSelectedTopic(null);
    const targetUrl = getTabUrl(activeTab === 'admin' ? 'home' : activeTab, currentLocale);
    window.history.pushState({}, '', targetUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filtered posts for search
  const searchedPosts = searchQuery.trim()
    ? publishedPosts.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : null;

  // Compute 5 latest related posts for current article vertical
  const getRelatedPostsForArticle = (currentPost: Post): Post[] => {
    const primary = store
      .getPosts(currentLocale, currentPost.vertical, 'published')
      .filter(p => p.id !== currentPost.id && p.slug !== currentPost.slug);

    if (primary.length >= 5) {
      return primary.slice(0, 5);
    }

    const fallback = store
      .getAllPosts()
      .filter(
        p =>
          (p.vertical === currentPost.vertical || p.dual_silo) &&
          p.status === 'published' &&
          p.id !== currentPost.id &&
          p.slug !== currentPost.slug &&
          !primary.some(pr => pr.id === p.id)
      );

    return [...primary, ...fallback].slice(0, 5);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Main Header */}
      <Header
        currentLocale={currentLocale}
        onLocaleChange={handleLocaleChange}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        currentUser={currentUser}
        onOpenAuth={() => setShowAuthModal(true)}
        onSwitchRole={(role) => store.switchDemoRole(role)}
        bookmarkedCount={bookmarkedPosts.length}
        onOpenBookmarks={() => setShowBookmarksDrawer(true)}
        searchQuery={searchQuery}
        onSearchChange={(q) => setSearchQuery(q)}
      />

      {/* Main Dynamic Router Content */}
      <main className="flex-1">
        {/* ARTICLE DETAILED VIEW */}
        {selectedPost ? (
          <ArticleView
            post={selectedPost}
            comments={store.getPostComments(selectedPost.id)}
            onBack={handleBack}
            currentUser={currentUser}
            onAddComment={(content) => store.addPostComment(selectedPost.id, content)}
            isBookmarked={store.isBookmarked(selectedPost.id)}
            onToggleBookmark={() => store.toggleBookmark(selectedPost.id)}
            onOpenAuth={() => setShowAuthModal(true)}
            relatedPosts={getRelatedPostsForArticle(selectedPost)}
            onSelectPost={handleSelectPost}
          />
        ) : loadingArticleSlug ? (
          <ArticleLoadingSkeleton onBack={handleBack} />
        ) : selectedTopic ? (
          /* FORUM TOPIC DETAILED VIEW */
          <TopicDetail
            topic={selectedTopic}
            comments={store.getTopicComments(selectedTopic.id)}
            onBack={handleBack}
            currentUser={currentUser}
            onVoteTopic={(type) => store.voteTopic(selectedTopic.id, type)}
            userTopicVote={store.getUserTopicVote(selectedTopic.id)}
            onVotePoll={(pollId, optionId) => store.votePoll(pollId, optionId)}
            userPollVote={selectedTopic.poll ? store.getUserPollVote(selectedTopic.poll.id) : undefined}
            onAddComment={(content, parentId) => store.addDiscussionComment(selectedTopic.id, content, parentId)}
            onVoteComment={(commentId, type) => store.voteComment(commentId, selectedTopic.id, type)}
            getUserCommentVote={(commentId) => store.getUserCommentVote(commentId)}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        ) : loadingTopicSlug ? (
          <ArticleLoadingSkeleton onBack={handleBack} />
        ) : activeTab === 'discussion' ? (
          /* FORUM TOPICS LIST VIEW */
          <DiscussionForum
            topics={topics}
            onSelectTopic={handleSelectTopic}
            currentUser={currentUser}
            onCreateTopic={(data) => store.createDiscussionTopic(data)}
            onVoteTopic={(topicId, type) => store.voteTopic(topicId, type)}
            getUserTopicVote={(topicId) => store.getUserTopicVote(topicId)}
            onVotePoll={(pollId, optionId) => store.votePoll(pollId, optionId)}
            getUserPollVote={(pollId) => store.getUserPollVote(pollId)}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        ) : activeTab === 'admin' ? (
          /* ADMIN CMS DASHBOARD */
          <AdminDashboard
            currentUser={currentUser}
            posts={allPosts}
            topics={topics}
            onSavePost={(post) => store.savePost(post)}
            onDeletePost={(id) => store.deletePost(id)}
            onTogglePostStatus={(id) => store.togglePostStatus(id)}
            onDeleteTopic={(id) => store.deleteTopic(id)}
            onSwitchRole={(role) => store.switchDemoRole(role)}
          />
        ) : activeTab === 'finance' ? (
          /* FINANCE SILO PAGE (/[locale]/finance) */
          <div className="max-w-7xl mx-auto px-4 py-10">
            <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 font-bold uppercase tracking-wider mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Topical Silo • <code className="text-slate-600 font-mono">/{currentLocale}/finance</code></span>
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-slate-900">
                  Finance, Macro Economics & Capital Markets
                </h1>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {financePosts.length > 0 ? (
                financePosts.map(post => (
                  <ArticleCard
                    key={post.id}
                    post={post}
                    onSelect={handleSelectPost}
                    isBookmarked={store.isBookmarked(post.id)}
                    onToggleBookmark={(id, e) => {
                      e.stopPropagation();
                      store.toggleBookmark(id);
                    }}
                  />
                ))
              ) : (
                <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-10 text-center">
                  <TrendingUp className="w-8 h-8 text-emerald-600 mx-auto mb-3 opacity-60" />
                  <h3 className="font-serif text-lg font-bold text-slate-800 mb-1">No Finance Publications Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    Sample articles have been cleared. Articles created in the Admin panel will be published directly here and saved to Supabase.
                  </p>
                  <button
                    onClick={() => handleTabChange('admin')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    <span>Create Finance Article in Admin</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'tech' ? (
          /* TECH SILO PAGE (/[locale]/tech) */
          <div className="max-w-7xl mx-auto px-4 py-10">
            <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-700 font-bold uppercase tracking-wider mb-2">
                  <Cpu className="w-4 h-4" />
                  <span>Topical Silo • <code className="text-slate-600 font-mono">/{currentLocale}/tech</code></span>
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-slate-900">
                  Technology, Autonomous Systems & Hardware
                </h1>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {techPosts.length > 0 ? (
                techPosts.map(post => (
                  <ArticleCard
                    key={post.id}
                    post={post}
                    onSelect={handleSelectPost}
                    isBookmarked={store.isBookmarked(post.id)}
                    onToggleBookmark={(id, e) => {
                      e.stopPropagation();
                      store.toggleBookmark(id);
                    }}
                  />
                ))
              ) : (
                <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-10 text-center">
                  <Cpu className="w-8 h-8 text-cyan-600 mx-auto mb-3 opacity-60" />
                  <h3 className="font-serif text-lg font-bold text-slate-800 mb-1">No Tech Publications Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    Sample articles have been cleared. Articles created in the Admin panel will be published directly here and saved to Supabase.
                  </p>
                  <button
                    onClick={() => handleTabChange('admin')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    <span>Create Tech Article in Admin</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (activeTab === 'privacy' || activeTab === 'terms') ? (
          /* LEGAL PAGES (Privacy Policy / Terms of Service) */
          <LegalPage
            initialDoc={activeTab}
            currentLocale={currentLocale}
            onNavigateHome={() => handleTabChange('home')}
            onSelectDoc={(doc) => handleTabChange(doc)}
          />
        ) : (
          /* HOME PORTAL (/[locale]) */
          <div>
            {/* Dual Hero Banner */}
            {!searchQuery && (
              <DualHero
                currentLocale={currentLocale}
                onSelectSilo={(silo) => handleTabChange(silo)}
                onOpenDiscussion={() => handleTabChange('discussion')}
              />
            )}

            <div className="max-w-7xl mx-auto px-4 py-12">
              {/* Search Results if query exists */}
              {searchedPosts ? (
                <div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900 mb-6">
                    Search Results for "{searchQuery}" ({searchedPosts.length})
                  </h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchedPosts.map(post => (
                      <ArticleCard
                        key={post.id}
                        post={post}
                        onSelect={handleSelectPost}
                        isBookmarked={store.isBookmarked(post.id)}
                        onToggleBookmark={(id, e) => {
                          e.stopPropagation();
                          store.toggleBookmark(id);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-16">
                  {/* Lead Featured Article */}
                  {publishedPosts.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-3">
                        <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-cyan-600" />
                          <span>Lead Publication</span>
                        </h2>
                        <span className="text-xs font-mono text-slate-500 uppercase font-bold">Featured Intelligence</span>
                      </div>

                      <ArticleCard
                        post={publishedPosts[0]}
                        onSelect={handleSelectPost}
                        isBookmarked={store.isBookmarked(publishedPosts[0].id)}
                        onToggleBookmark={(id, e) => {
                          e.stopPropagation();
                          store.toggleBookmark(id);
                        }}
                        variant="featured"
                      />
                    </section>
                  )}

                  {/* Finance Intelligence Grid */}
                  <section>
                    <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                        <h2 className="font-serif text-2xl font-bold text-slate-900">
                          Finance & Capital Markets
                        </h2>
                      </div>
                      <button
                        onClick={() => handleTabChange('finance')}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                      >
                        <span>Explore Finance (/{currentLocale}/finance)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {financePosts.length > 0 ? (
                        financePosts.map(post => (
                          <ArticleCard
                            key={post.id}
                            post={post}
                            onSelect={handleSelectPost}
                            isBookmarked={store.isBookmarked(post.id)}
                            onToggleBookmark={(id, e) => {
                              e.stopPropagation();
                              store.toggleBookmark(id);
                            }}
                          />
                        ))
                      ) : (
                        <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center">
                          <p className="text-xs text-slate-500">No finance articles published yet. Create an article in the Admin panel to publish to Supabase.</p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Tech Systems Grid */}
                  <section>
                    <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-600"></span>
                        <h2 className="font-serif text-2xl font-bold text-slate-900">
                          Technology & Deep Architecture
                        </h2>
                      </div>
                      <button
                        onClick={() => handleTabChange('tech')}
                        className="text-xs font-bold text-cyan-700 hover:text-cyan-800 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Explore Tech (/{currentLocale}/tech)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {techPosts.length > 0 ? (
                        techPosts.map(post => (
                          <ArticleCard
                            key={post.id}
                            post={post}
                            onSelect={handleSelectPost}
                            isBookmarked={store.isBookmarked(post.id)}
                            onToggleBookmark={(id, e) => {
                              e.stopPropagation();
                              store.toggleBookmark(id);
                            }}
                          />
                        ))
                      ) : (
                        <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center">
                          <p className="text-xs text-slate-500">No tech articles published yet. Create an article in the Admin panel to publish to Supabase.</p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Top Forum Discussions (Community Executive Discussions) */}
                  {top3Topics.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                          <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-purple-600" />
                            <span>Top Forum Discussions</span>
                          </h2>
                        </div>
                        <button
                          onClick={() => handleTabChange('discussion')}
                          className="text-xs font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>Explore Forum (/discussion)</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid md:grid-cols-3 gap-6">
                        {top3Topics.map((t) => {
                          const vote = store.getUserTopicVote(t.id);
                          const score = t.upvotes - t.downvotes;
                          return (
                            <div
                              key={t.id}
                              className="group bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-500 mb-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-bold uppercase text-[10px]">
                                    {t.category}
                                  </span>
                                  {t.poll && (
                                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] flex items-center gap-1 font-bold">
                                      <BarChart2 className="w-3 h-3 text-amber-700" />
                                      <span>Poll</span>
                                    </span>
                                  )}
                                  <span className="text-slate-400 font-sans text-[11px] ml-auto">
                                    {new Date(t.created_at).toLocaleDateString()}
                                  </span>
                                </div>

                                <h3
                                  onClick={() => handleSelectTopic(t)}
                                  className="font-serif text-base font-bold text-slate-900 group-hover:text-purple-700 transition-colors mb-2.5 line-clamp-2 cursor-pointer leading-snug"
                                >
                                  {t.title}
                                </h3>

                                <p className="text-xs text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                                  {t.content}
                                </p>
                              </div>

                              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <span className="font-semibold text-slate-700 text-xs truncate max-w-[120px]">{t.author_name}</span>

                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!currentUser) setShowAuthModal(true);
                                        else store.voteTopic(t.id, 'up');
                                      }}
                                      className={`hover:text-emerald-600 transition-colors cursor-pointer ${
                                        vote === 'up' ? 'text-emerald-600 font-bold' : 'text-slate-400'
                                      }`}
                                      title="Upvote topic"
                                    >
                                      <ThumbsUp className="w-3 h-3" />
                                    </button>
                                    <span className="font-mono text-[11px] font-bold text-slate-800">{score}</span>
                                  </div>

                                  <button
                                    onClick={() => handleSelectTopic(t)}
                                    className="flex items-center gap-1 font-medium text-slate-600 hover:text-purple-700 transition-colors cursor-pointer"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
                                    <span className="font-mono text-xs">{t.comment_count}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer 
        currentLocale={currentLocale} 
        onTabChange={handleTabChange} 
        onOpenAuth={() => setShowAuthModal(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSelectUser={(u) => store.setCurrentUser(u)}
      />

      {/* Bookmarks Drawer */}
      <BookmarksDrawer
        isOpen={showBookmarksDrawer}
        onClose={() => setShowBookmarksDrawer(false)}
        bookmarkedPosts={bookmarkedPosts}
        onSelectPost={handleSelectPost}
        onRemoveBookmark={(id) => store.toggleBookmark(id)}
      />
    </div>
  );
}
