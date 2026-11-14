import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL_KEY = 'room_expense_supabase_url';
const SUPABASE_ANON_KEY = 'room_expense_supabase_key';

export const DEFAULT_SUPABASE_URL = 'https://eedialyavhrdipbrbjif.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_QO8PD9OMO6kIWnjVc_c4Lg__0nB3ROt';

export function getStoredSupabaseConfig(): { url: string; key: string } {
  const envUrl =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const envKey =
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(SUPABASE_URL_KEY) || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(SUPABASE_ANON_KEY) || '' : '';

  return {
    url: storedUrl || envUrl || DEFAULT_SUPABASE_URL,
    key: storedKey || envKey || DEFAULT_SUPABASE_KEY,
  };
}

export function saveSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(SUPABASE_URL_KEY, url.trim());
    else localStorage.removeItem(SUPABASE_URL_KEY);

    if (key) localStorage.setItem(SUPABASE_ANON_KEY, key.trim());
    else localStorage.removeItem(SUPABASE_ANON_KEY);
  }
}

let cachedClient: SupabaseClient | null = null;
let sessionInitPromise: Promise<boolean> | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.url || !config.key) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Ensures the Supabase client has an active authenticated session so that
 * PostgreSQL Row-Level Security (RLS) policies (`auth.uid() IS NOT NULL`)
 * succeed on every device (laptop, mobile, PWA) for both Owner and Roommates.
 */
export async function ensureSupabaseSession(): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  if (sessionInitPromise) {
    return sessionInitPromise;
  }

  sessionInitPromise = (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;

      // A cached session can exist with an already expired access token, which makes every
      // request fail with 401 while the app thinks it is signed in. Validate, then refresh.
      if (session?.user && Date.now() < expiresAtMs - 60_000) {
        return true;
      }

      if (session?.refresh_token) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session) {
          return true;
        }
        if (refreshError) {
          console.warn('Supabase session refresh failed:', refreshError.message);
        }
      }

      // Sign in with the authorized household database account so RLS policies pass
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'nomideveloper007@gmail.com',
        password: 'noman123',
      });

      if (error || !data?.session) {
        console.warn('Supabase sign-in failed, continuing without a session:', error?.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Failed to establish Supabase RLS session:', err);
      return false;
    } finally {
      sessionInitPromise = null;
    }
  })();

  return sessionInitPromise;
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    const testClient = createClient(url, key);
    const { error } = await testClient.from('rooms').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST205') {
        return {
          success: true,
          message: 'Connected to Supabase! (Database tables need to be created by running supabase/schema.sql in the Supabase SQL Editor).',
        };
      }
      if (error.code !== 'PGRST116') {
        return { success: false, message: error.message };
      }
    }
    return { success: true, message: 'Successfully connected to Supabase database!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}
