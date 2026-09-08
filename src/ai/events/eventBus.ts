import crypto from 'crypto';
import { CorrelationMetadata } from '../server/automationContract';

export type AIEventType = 
  | 'task.created'
  | 'task.started'
  | 'task.waiting_approval'
  | 'task.completed'
  | 'task.failed'
  | 'approval.decided';

export interface AIEvent<TData = any> {
  id: string;
  event: AIEventType;
  timestamp: string;
  correlation?: CorrelationMetadata;
  data: TData;
}

export type EventListener<T = any> = (event: AIEvent<T>) => void | Promise<void>;

export interface WebhookDeliveryRecord {
  id: string;
  eventId: string;
  eventType: AIEventType;
  targetUrl: string;
  attempts: number;
  status: 'delivered' | 'failed';
  httpStatus?: number;
  error?: string;
  timestamp: string;
}

export class AIEventBus {
  private static instance: AIEventBus;
  private listeners: Map<AIEventType, Set<EventListener>> = new Map();
  private deliveryHistory: WebhookDeliveryRecord[] = [];
  private maxHistory = 100;

  private constructor() {}

  public static getInstance(): AIEventBus {
    if (!AIEventBus.instance) {
      AIEventBus.instance = new AIEventBus();
    }
    return AIEventBus.instance;
  }

  public subscribe(eventType: AIEventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  public emit<T = any>(
    eventType: AIEventType, 
    data: T, 
    correlation?: CorrelationMetadata,
    customWebhookUrl?: string
  ): AIEvent<T> {
    const event: AIEvent<T> = {
      id: crypto.randomUUID(),
      event: eventType,
      timestamp: new Date().toISOString(),
      correlation,
      data
    };

    // 1. Notify in-process subscribers asynchronously
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        Promise.resolve().then(() => handler(event)).catch(err => {
          console.warn(`[AIEventBus] In-process listener error on '${eventType}':`, err?.message);
        });
      }
    }

    // 2. Outbound Webhook Delivery (if configured globally or per-task)
    const targetWebhookUrl = customWebhookUrl || process.env.STARTUPCREME_WEBHOOK_URL;
    if (targetWebhookUrl) {
      this.dispatchWebhook(targetWebhookUrl, event).catch(() => {});
    }

    return event;
  }

  private async dispatchWebhook(targetUrl: string, event: AIEvent, attempt = 1, maxAttempts = 3): Promise<void> {
    const payload = JSON.stringify(event);
    const secret = process.env.STARTUPCREME_WEBHOOK_SECRET || 'startupcreme_webhook_secret_default';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-StartupCreme-Event': event.event,
          'X-StartupCreme-Signature': `sha256=${signature}`,
          'X-StartupCreme-Event-Id': event.id
        },
        body: payload,
        signal: controller.signal
      });
      clearTimeout(timeout);

      this.recordDelivery({
        id: crypto.randomUUID(),
        eventId: event.id,
        eventType: event.event,
        targetUrl,
        attempts: attempt,
        status: res.ok ? 'delivered' : 'failed',
        httpStatus: res.status,
        error: res.ok ? undefined : `HTTP ${res.status}: ${res.statusText}`,
        timestamp: new Date().toISOString()
      });

      if (!res.ok && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 500;
        setTimeout(() => this.dispatchWebhook(targetUrl, event, attempt + 1, maxAttempts), delay);
      }
    } catch (err: any) {
      this.recordDelivery({
        id: crypto.randomUUID(),
        eventId: event.id,
        eventType: event.event,
        targetUrl,
        attempts: attempt,
        status: 'failed',
        error: err?.message || 'Network error',
        timestamp: new Date().toISOString()
      });

      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 500;
        setTimeout(() => this.dispatchWebhook(targetUrl, event, attempt + 1, maxAttempts), delay);
      }
    }
  }

  private recordDelivery(record: WebhookDeliveryRecord) {
    this.deliveryHistory.unshift(record);
    if (this.deliveryHistory.length > this.maxHistory) {
      this.deliveryHistory = this.deliveryHistory.slice(0, this.maxHistory);
    }
  }

  public getDeliveryHistory(): WebhookDeliveryRecord[] {
    return this.deliveryHistory;
  }

  public getWebhookStats() {
    const total = this.deliveryHistory.length;
    const delivered = this.deliveryHistory.filter(d => d.status === 'delivered').length;
    const failed = this.deliveryHistory.filter(d => d.status === 'failed').length;
    return {
      totalDispatched: total,
      deliveredCount: delivered,
      failedCount: failed,
      recentDeliveries: this.deliveryHistory.slice(0, 10)
    };
  }
}

export const eventBus = AIEventBus.getInstance();
