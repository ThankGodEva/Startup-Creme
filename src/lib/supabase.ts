import { createClient, SupabaseClient } from '@supabase/supabase-js';

let runtimeUrl = '';
let runtimeKey = '';

// Helper to retrieve environment credentials
export function getSupabaseCredentials() {
  const url = 
    runtimeUrl ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || 
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
    (import.meta.env?.VITE_SUPABASE_URL as string) || 
    '';

  const anonKey = 
    runtimeKey ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || 
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
    (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || 
    '';

  const isConfigured = Boolean(
    url && 
    anonKey && 
    !url.includes('your-supabase-project') &&
    !anonKey.includes('your-supabase-anon-key')
  );

  return { url, anonKey, isConfigured };
}

let activeClient: SupabaseClient<any, any, any> | null = null;
let activeClientUrl: string | null = null;

export function getSupabaseClient(): SupabaseClient<any, any, any> {
  const { url, anonKey } = getSupabaseCredentials();

  if (!activeClient || (url && activeClientUrl !== url)) {
    activeClientUrl = url || 'https://placeholder.supabase.co';
    activeClient = createClient(
      url || 'https://placeholder.supabase.co',
      anonKey || 'placeholder-anon-key',
      {
        db: {
          schema: 'startupcreme',
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );
  }

  return activeClient;
}

export function setSupabaseCredentials(url: string, anonKey: string) {
  runtimeUrl = url.trim();
  runtimeKey = anonKey.trim();

  activeClientUrl = runtimeUrl;
  activeClient = createClient(runtimeUrl, runtimeKey, {
    db: {
      schema: 'startupcreme',
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseCredentials().isConfigured;
}

// Export a dynamic proxy so `supabase` always delegates to the active client
export const supabase = new Proxy({} as SupabaseClient<any, any, any>, {
  get(_target, prop) {
    const client = getSupabaseClient() as any;
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

