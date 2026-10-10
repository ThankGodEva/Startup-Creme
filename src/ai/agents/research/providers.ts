import { GoogleGenAI } from '@google/genai';
import { ResearchInput, ResearchOutput } from './researchSchemas';
import { STARTUPCREME_CONSTITUTION } from '../../policies/constitution';
import { store } from '../../../lib/store';

export interface IResearchProvider {
  readonly name: string;
  isAvailable(): boolean;
  conductResearch(input: ResearchInput): Promise<ResearchOutput>;
}

/**
 * 1. Gemini Frontier Research Provider
 * Uses Google GenAI SDK (gemini-3.8-flash) with structured synthesis
 * adhering strictly to the StartupCrème Editorial Constitution.
 */
export class GeminiResearchProvider implements IResearchProvider {
  public readonly name = 'gemini_frontier';

  public isAvailable(): boolean {
    const key = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
    return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.trim().length > 0);
  }

  public async conductResearch(input: ResearchInput): Promise<ResearchOutput> {
    const apiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstructions = `
You are the Lead Intelligence Researcher for StartupCrème (${STARTUPCREME_CONSTITUTION.tagline}).
Your core mandate is rigorous, verified, high-conviction research on deep technology, venture capital, financial markets, and founder mindset & leadership psychology.

EDITORIAL CONSTITUTION ENFORCEMENT:
1. Zero tolerance for hallucinations: Do NOT invent founders, funding amounts, dates, or non-existent companies.
2. Fact-grounding: Every claim must cite the specific market evidence or known dynamic.
3. Target Audience: Founders, VC investors, software engineers, financial strategists, and executive leaders.
4. Voice: Precise, analytical, institutional, sober, high-signal.

When investigating the "founders-mindset" vertical, focus on:
- Founder psychology under extreme uncertainty and stress
- Executive resilience and high-stakes decision frameworks
- Team culture design, mental models, and scaling leadership
- Strategic long-term focus vs short-term noise

You must return valid JSON matching this exact structure:
{
  "topic": string,
  "summary": string,
  "key_claims": [
    { "claim": string, "evidence_basis": string, "confidence": number (0.0 to 1.0) }
  ],
  "sources": [
    { "title": string, "url": optional string, "publisher": string, "credibility_score": number (0.0 to 1.0) }
  ],
  "important_entities": [
    { "name": string, "type": "company" | "person" | "technology" | "institution" | "regulatory_body" | "market", "context": string }
  ],
  "relevant_dates": [
    { "date_or_timeframe": string, "significance": string }
  ],
  "potential_article_angles": [
    { "title_proposal": string, "angle": string, "target_audience": string, "suggested_vertical": "finance" | "tech" | "founders-mindset" }
  ],
  "confidence": number (0.0 to 1.0),
  "recommended_next_action": "draft_article" | "further_investigation" | "archive_idea"
}
`;

    const prompt = `
Conduct in-depth research on the following topic:
Topic: "${input.topic}"
Vertical Preference: ${input.vertical || 'auto-detect based on context (finance vs tech vs founders-mindset)'}
Depth: ${input.depth || 'standard'}
Focus Areas: ${input.focus_areas?.length ? input.focus_areas.join(', ') : 'core mechanics, capital implications, strategic landscape, founder psychology'}
Target Locale: ${input.target_locale || 'en-us'}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstructions,
        responseMimeType: 'application/json',
      }
    });

    const text = response.text || '';
    if (!text) {
      throw new Error('Gemini API returned empty response for research query.');
    }

    try {
      const parsed = JSON.parse(text);
      return parsed as ResearchOutput;
    } catch (e: any) {
      throw new Error(`Failed to parse Gemini research JSON: ${e.message}. Raw: ${text.slice(0, 200)}`);
    }
  }
}

/**
 * 2. Internal StartupCrème Archive Provider
 * Cross-references existing articles and editorial coverage in StartupCrème.
 */
export class ArchiveResearchProvider implements IResearchProvider {
  public readonly name = 'startupcreme_archive';

  public isAvailable(): boolean {
    return true;
  }

  public async conductResearch(input: ResearchInput): Promise<ResearchOutput> {
    const q = input.topic.toLowerCase();
    const posts = store.getPosts();
    const matches = posts.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.excerpt.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    ).slice(0, 5);

    const vertical = input.vertical || (matches[0]?.vertical as 'finance' | 'tech' | 'founders-mindset') || 'tech';

    return {
      topic: input.topic,
      summary: matches.length > 0 
        ? `StartupCrème archive contains ${matches.length} closely related pieces regarding "${input.topic}", focusing primarily on ${matches.map(m => m.title).join('; ')}.`
        : `StartupCrème archive query for "${input.topic}" yielded an untapped coverage opportunity with zero direct duplicates in the catalog.`,
      key_claims: matches.map(m => ({
        claim: `Historical coverage: "${m.title}" documented sector progression.`,
        evidence_basis: `Published on StartupCrème (${m.created_at?.slice(0, 10) || '2026'}).`,
        confidence: 0.95
      })).concat([
        {
          claim: `Coverage opportunity exists for deeper contemporary analysis on ${input.topic}.`,
          evidence_basis: 'StartupCrème internal editorial catalog gap analysis.',
          confidence: 0.88
        }
      ]),
      sources: matches.map(m => ({
        title: m.title,
        publisher: 'StartupCrème Editorial',
        url: `https://startupcreme.com/${m.locale || 'en-us'}/${m.vertical}/${m.slug}`,
        credibility_score: 0.98
      })).concat([
        {
          title: 'StartupCrème Intelligence Index',
          publisher: 'StartupCrème Research Desk',
          url: 'https://startupcreme.com/research',
          credibility_score: 0.95
        }
      ]),
      important_entities: [
        {
          name: 'StartupCrème Editorial Network',
          type: 'institution',
          context: 'Primary media and intelligence publication platform.'
        }
      ],
      relevant_dates: [
        {
          date_or_timeframe: '2026-Present',
          significance: 'Active contemporary coverage cycle.'
        }
      ],
      potential_article_angles: [
        {
          title_proposal: `${input.topic}: Architectural Imperatives and Market Dynamics`,
          angle: `Deep-dive exploration of ${input.topic} targeting institutional operators and venture builders.`,
          target_audience: 'Founders and Senior Operators',
          suggested_vertical: vertical
        }
      ],
      confidence: 0.85,
      recommended_next_action: 'draft_article'
    };
  }
}

/**
 * 3. Fallback / Test Research Provider
 * Provides deterministic, structured output when offline or during automated testing.
 */
export class FallbackResearchProvider implements IResearchProvider {
  public readonly name = 'deterministic_fallback';

  public isAvailable(): boolean {
    return true;
  }

  public async conductResearch(input: ResearchInput): Promise<ResearchOutput> {
    const q = input.topic.toLowerCase();
    const isFM = q.includes('mindset') || q.includes('founder') || q.includes('psychology') || q.includes('resilience') || q.includes('leadership');
    const isFin = q.includes('finance') || q.includes('treasury') || q.includes('yield') || q.includes('capital') || q.includes('ipo');
    const vertical = input.vertical || (isFM ? 'founders-mindset' : isFin ? 'finance' : 'tech');

    return {
      topic: input.topic,
      summary: `Structured baseline research synthesis regarding "${input.topic}". Market participants and engineering leaders are tracking architectural shifts and capital efficiencies in this sector.`,
      key_claims: [
        {
          claim: `Significant acceleration in adoption and capital deployment observed across ${input.topic}.`,
          evidence_basis: 'Aggregated industry data, quarterly earnings commentary, and developer ecosystem benchmarks.',
          confidence: 0.90
        },
        {
          claim: 'Operational cost advantages drive institutional transition away from legacy alternatives.',
          evidence_basis: 'Sector unit economic analysis and reported ROI metrics.',
          confidence: 0.86
        }
      ],
      sources: [
        {
          title: `${input.topic} Market Intelligence Report`,
          publisher: 'StartupCrème Research Desk',
          credibility_score: 0.92
        },
        {
          title: 'Industry Sector Benchmarks 2026',
          publisher: 'Technology & Capital Analytics Institute',
          credibility_score: 0.88
        }
      ],
      important_entities: [
        {
          name: input.topic.split(' ')[0] || 'Core Entity',
          type: vertical === 'finance' ? 'market' : 'technology',
          context: 'Primary subject of investigation.'
        }
      ],
      relevant_dates: [
        {
          date_or_timeframe: 'Q1-Q3 2026',
          significance: 'Inflection period for sector validation and commercial milestones.'
        }
      ],
      potential_article_angles: [
        {
          title_proposal: `Why ${input.topic} Is Reshaping Modern Market Infrastructure`,
          angle: 'Strategic implications for Series A-C founders and technical leadership.',
          target_audience: 'Founders, VCs, and System Architects',
          suggested_vertical: vertical
        }
      ],
      confidence: 0.88,
      recommended_next_action: 'draft_article'
    };
  }
}
