import { z } from 'zod';

export const ResearchInputSchema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters').max(300),
  vertical: z.enum(['finance', 'tech']).optional(),
  depth: z.enum(['brief', 'standard', 'deep']).optional().default('standard'),
  focus_areas: z.array(z.string()).optional().default([]),
  target_locale: z.string().optional().default('en-us')
});

export type ResearchInput = z.input<typeof ResearchInputSchema>;

export const ResearchClaimSchema = z.object({
  claim: z.string().min(5),
  evidence_basis: z.string().min(5),
  confidence: z.number().min(0).max(1)
});

export const ResearchSourceSchema = z.object({
  title: z.string().min(2),
  url: z.string().url().optional(),
  publisher: z.string().optional(),
  credibility_score: z.number().min(0).max(1)
});

export const ResearchEntitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['company', 'person', 'technology', 'institution', 'regulatory_body', 'market']),
  context: z.string()
});

export const ResearchDateSchema = z.object({
  date_or_timeframe: z.string().min(2),
  significance: z.string().min(5)
});

export const ArticleAngleProposalSchema = z.object({
  title_proposal: z.string().min(10),
  angle: z.string().min(10),
  target_audience: z.string().min(5),
  suggested_vertical: z.enum(['finance', 'tech'])
});

export const ResearchOutputSchema = z.object({
  topic: z.string(),
  summary: z.string().min(20),
  key_claims: z.array(ResearchClaimSchema).min(1, 'At least one substantiated claim is required'),
  sources: z.array(ResearchSourceSchema).min(1, 'At least one verified source is required'),
  important_entities: z.array(ResearchEntitySchema),
  relevant_dates: z.array(ResearchDateSchema),
  potential_article_angles: z.array(ArticleAngleProposalSchema).min(1),
  confidence: z.number().min(0).max(1),
  recommended_next_action: z.enum(['draft_article', 'further_investigation', 'archive_idea'])
});

export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;
