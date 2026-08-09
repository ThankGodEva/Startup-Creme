export type ContentVertical = 'finance' | 'tech';
export type PublicationStatus = 'draft' | 'published' | 'outdated_translation';
export type DiscussionCategory = 'finance' | 'tech' | 'startup' | 'general';
export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface PostContentNode {
  type: string;
  content?: PostContentNode[];
  text?: string;
  attrs?: Record<string, any>;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
}

export interface PostContent {
  type: 'doc';
  content: PostContentNode[];
}

export interface Post {
  id: string;
  slug: string;
  locale: string; // e.g. 'en-us', 'en-gb', 'de-de', 'ja-jp', 'fr-fr'
  vertical: ContentVertical;
  title: string;
  excerpt: string;
  content: PostContent | string; // Native Tiptap JSON or string content
  status: PublicationStatus;
  meta_description?: string;
  canonical_url?: string;
  cover_image?: string;
  author_name: string;
  author_role: string;
  author_avatar?: string;
  dual_silo: boolean;
  silo_badge?: string;
  tags: string[];
  reading_time_minutes: number;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DiscussionTopic {
  id: string;
  slug: string;
  title: string;
  content: string;
  category: DiscussionCategory;
  user_id: string;
  author_name: string;
  author_handle?: string;
  author_avatar?: string;
  upvotes: number;
  downvotes: number;
  tags: string[];
  comment_count: number;
  created_at: string;
  updated_at: string;
  poll?: DiscussionPoll;
}

export interface DiscussionTopicVote {
  id: string;
  topic_id: string;
  user_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface DiscussionComment {
  id: string;
  topic_id: string;
  parent_id?: string | null;
  user_id: string;
  author_name: string;
  author_handle?: string;
  author_avatar?: string;
  content: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
  replies?: DiscussionComment[];
}

export interface DiscussionCommentVote {
  id: string;
  comment_id: string;
  user_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface DiscussionPollOption {
  id: string;
  poll_id: string;
  option_text: string;
  votes: number;
}

export interface DiscussionPoll {
  id: string;
  topic_id: string;
  question: string;
  total_votes: number;
  created_at: string;
  options: DiscussionPollOption[];
}

export interface DiscussionPollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}
