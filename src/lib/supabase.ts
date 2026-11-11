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
