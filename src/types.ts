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

// --------------------------------------------------------------------
// AI SUBSYSTEM TYPES
// --------------------------------------------------------------------

export type PolicyLevel = 'green' | 'yellow' | 'red';

export type AiTaskStatus = 
  | 'queued' 
  | 'running' 
  | 'waiting_approval' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type AiTaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AiTask<TPayload = any, TResult = any> {
  id: string;
  task_type: string;
  priority: AiTaskPriority;
  status: AiTaskStatus;
  policy_level?: PolicyLevel;
  requested_by: string;
  assigned_agent: string;
  payload: TPayload;
  result?: TResult | null;
  error?: string | null;
  retry_count: number;
  idempotency_key?: string | null;
  approval_id?: string | null;
  metadata?: Record<string, any>;
  timeout_ms?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export type AiActionStatus = 
  | 'started' 
  | 'succeeded' 
  | 'failed' 
  | 'blocked_policy' 
  | 'waiting_approval';

export interface AiAction {
  id: string;
  task_id?: string | null;
  agent: string;
  action: string;
  status: AiActionStatus;
  policy_level: PolicyLevel;
  input_summary?: Record<string, any> | null;
  output_summary?: Record<string, any> | null;
  confidence?: number | null;
  reason?: string | null;
  target_entity?: string | null;
  target_entity_id?: string | null;
  reversible?: boolean;
  reversed_at?: string | null;
  error?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface AiApproval {
  id: string;
  task_id?: string | null;
  action_name: string;
  agent: string;
  policy_level: 'yellow' | 'red';
  status: 'pending' | 'approved' | 'rejected';
  description: string;
  payload: Record<string, any>;
  decided_by?: string | null;
  decision_reason?: string | null;
  created_at: string;
  decided_at?: string | null;
}

export interface AiAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  agent: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  is_dismissed: boolean;
  created_at: string;
}

export interface AiMemory {
  id: string;
  memory_type: string;
  key: string;
  value: Record<string, any>;
  confidence: number;
  source?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ResearchClaim {
  claim: string;
  evidence_basis: string;
  confidence: number;
}

export interface ResearchSource {
  title: string;
  url?: string;
  publisher?: string;
  credibility_score: number;
}

export interface ResearchEntity {
  name: string;
  type: 'company' | 'person' | 'technology' | 'institution' | 'regulatory_body' | 'market';
  context: string;
}

export interface ResearchDate {
  date_or_timeframe: string;
  significance: string;
}

export interface ArticleAngleProposal {
  title_proposal: string;
  angle: string;
  target_audience: string;
  suggested_vertical: ContentVertical;
}

export interface ResearchOutput {
  topic: string;
  summary: string;
  key_claims: ResearchClaim[];
  sources: ResearchSource[];
  important_entities: ResearchEntity[];
  relevant_dates: ResearchDate[];
  potential_article_angles: ArticleAngleProposal[];
  confidence: number;
  recommended_next_action: 'draft_article' | 'further_investigation' | 'archive_idea';
}
