import { AiMemory } from '../../types';

export type MemoryCategory = 
  | 'editorial_rule'
  | 'audience_insight'
  | 'preferred_topic'
  | 'high_performing_pattern'
  | 'low_performing_pattern'
  | 'rejected_idea'
  | 'known_entity'
  | 'seo_opportunity'
  | 'strategic_decision';

export interface SetMemoryInput {
  memoryType: MemoryCategory;
  key: string;
  value: Record<string, any>;
  confidence?: number;
  source?: string;
  tags?: string[];
}

export class MemoryStore {
  private static instance: MemoryStore;
  private memories: Map<string, AiMemory> = new Map();

  private constructor() {
    this.seedDefaultMemory();
  }

  public static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  private seedDefaultMemory() {
    const defaults: SetMemoryInput[] = [
      {
        memoryType: 'editorial_rule',
        key: 'headline_standards',
        value: {
          rule: 'Avoid sensationalist buzzwords ("shocking", "game-changer"). Use precise technical and financial framing.',
          enforcement: 'strict'
        },
        source: 'Editorial Constitution v1',
        tags: ['editorial', 'quality', 'headlines']
      },
      {
        memoryType: 'audience_insight',
        key: 'core_readership_profile',
        value: {
          primary: 'Series A+ tech founders and venture investors seeking macro and architecture clarity.',
          preferredDepth: 'analytical_deep_dive',
          readingTimeTarget: '5-8 minutes'
        },
        source: 'StartupCrème Audience Benchmark 2026',
        tags: ['audience', 'distribution']
      },
      {
        memoryType: 'preferred_topic',
        key: 'ai_infrastructure_finops',
        value: {
          description: 'LLM token optimization, open weights vs proprietary APIs, GPU cluster unit economics.',
          vertical: 'tech',
          priority: 'high'
        },
        source: 'Editorial Planning 2026',
        tags: ['tech', 'ai', 'cloud']
      },
      {
        memoryType: 'preferred_topic',
        key: 'african_fintech_crossborder',
        value: {
          description: 'Pan-African settlement systems, stablecoin rails, regulatory compliance across Nigeria, Kenya, South Africa, Egypt.',
          vertical: 'finance',
          priority: 'high'
        },
        source: 'Regional Editorial Strategy',
        tags: ['finance', 'africa', 'fintech']
      }
    ];

    defaults.forEach(d => this.set(d));
  }

  public set(input: SetMemoryInput): AiMemory {
    const memoryKey = `${input.memoryType}:${input.key}`;
    const now = new Date().toISOString();
    const existing = this.memories.get(memoryKey);

    const memory: AiMemory = {
      id: existing?.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      memory_type: input.memoryType,
      key: input.key,
      value: input.value,
      confidence: input.confidence ?? 1.0,
      source: input.source || 'system',
      tags: input.tags || [],
      created_at: existing?.created_at || now,
      updated_at: now
    };

    this.memories.set(memoryKey, memory);
    return memory;
  }

  public get(memoryType: MemoryCategory, key: string): AiMemory | undefined {
    return this.memories.get(`${memoryType}:${key}`);
  }

  public listByType(memoryType: MemoryCategory): AiMemory[] {
    return Array.from(this.memories.values()).filter(m => m.memory_type === memoryType);
  }

  public search(query: string, memoryType?: MemoryCategory): AiMemory[] {
    const q = query.toLowerCase().trim();
    return Array.from(this.memories.values()).filter(m => {
      const matchesType = !memoryType || m.memory_type === memoryType;
      const matchesText = m.key.toLowerCase().includes(q) || 
                          m.tags.some(t => t.toLowerCase().includes(q)) || 
                          JSON.stringify(m.value).toLowerCase().includes(q);
      return matchesType && matchesText;
    });
  }

  public listAll(): AiMemory[] {
    return Array.from(this.memories.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }
}

export const memoryStore = MemoryStore.getInstance();
