import { getSupabaseClient } from './supabase';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export interface MemberCredential {
  memberId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
}

const AUTH_STORAGE_KEYS = {
  SESSION: 'room_register_auth_session',
  SINGLE_ACCOUNT_EMAIL: 'room_register_single_account_email',
  SINGLE_ACCOUNT_HASH: 'room_register_single_account_hash',
  SINGLE_ACCOUNT_NAME: 'room_register_single_account_name',
  MEMBER_CREDENTIALS: 'room_register_member_credentials_v1',
};

// Pure JavaScript SHA-256 implementation (works in all non-secure contexts like HTTP / mobile LAN)
function sha256PureJs(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number;
  let j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = candidate << 1; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  let str = unescape(encodeURIComponent(ascii));
  str += '\x80';
  while ((str[lengthProperty] % 64) - 56) str += '\x00';
  for (i = 0; i < str[lengthProperty]; i++) {
    j = str.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength | 0;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : ((w[i - 16] + s0 + w[i - 7] + s1) | 0);

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 =
        ((((hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25))) | 0) +
          ((ch + k[i] + w[i]) | 0)) | 0);
      const temp2 =
        ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// Cryptographic SHA-256 hashing using Web Crypto API with pure JS fallback for non-secure contexts (HTTP / LAN)
async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto?.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to pure JS fallback
    }
  }
  return sha256PureJs(message);
}

const DEFAULT_AUTHORIZED_EMAIL = 'nomideveloper007@gmail.com';
const DEFAULT_AUTHORIZED_HASH = '6dac755f6d0a47aa8522b53b9b470bd46d60118edd044b48636b3ec9930c1a52'; // sha256('noman123')
const DEFAULT_AUTHORIZED_NAME = 'Noman';

export class AuthService {
  /**
   * Check if single account credentials have been established
   */
  static isSingleAccountConfigured(): boolean {
    return true;
  }

  /**
   * Returns the registered single authorized email, if configured
   */
  static getAuthorizedEmail(): string {
    if (typeof window === 'undefined') return DEFAULT_AUTHORIZED_EMAIL;
    return localStorage.getItem(AUTH_STORAGE_KEYS.SINGLE_ACCOUNT_EMAIL) || DEFAULT_AUTHORIZED_EMAIL;
  }

  /**
   * Get the currently logged in session, if any
   */
  static getCurrentUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEYS.SESSION) || localStorage.getItem(AUTH_STORAGE_KEYS.SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Initialize or set the single authorized account credentials
   * Public registration is disabled; only this master account is authorized.
   */
  static async setupSingleAccount(
    email: string,
    password: string,
    name: string = 'Household Admin'
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }

    try {
      const hash = await sha256(password);
      localStorage.setItem(AUTH_STORAGE_KEYS.SINGLE_ACCOUNT_EMAIL, cleanEmail);
      localStorage.setItem(AUTH_STORAGE_KEYS.SINGLE_ACCOUNT_HASH, hash);
      localStorage.setItem(AUTH_STORAGE_KEYS.SINGLE_ACCOUNT_NAME, name.trim() || 'Household Admin');

      const user: AuthUser = {
        id: 'authorized-admin',
        email: cleanEmail,
        name: name.trim() || 'Household Admin',
      };

      // Persist session
      localStorage.setItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(user));
      return { success: true, user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to initialize account credentials.' };
    }
  }

  /**
   * Roommate member credentials storage and lookup
   */
  static getMemberCredentialsMap(): Record<string, MemberCredential> {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.MEMBER_CREDENTIALS);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  static getAllMemberCredentials(): MemberCredential[] {
    const map = this.getMemberCredentialsMap();
    return Object.values(map);
  }

  static async saveMemberCredentials(
    memberId: string,
    name: string,
    email: string,
    password: string,
    role: string = 'viewer'
  ): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const hash = await sha256(password);
    const map = this.getMemberCredentialsMap();
    map[cleanEmail] = {
      memberId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash: hash,
      role,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEYS.MEMBER_CREDENTIALS, JSON.stringify(map));
    }
  }

  static updateMemberRole(email: string, role: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const map = this.getMemberCredentialsMap();
    if (map[cleanEmail]) {
      map[cleanEmail].role = role;
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_STORAGE_KEYS.MEMBER_CREDENTIALS, JSON.stringify(map));
      }
    }
  }

  static removeMemberCredentials(email: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const map = this.getMemberCredentialsMap();
    delete map[cleanEmail];
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEYS.MEMBER_CREDENTIALS, JSON.stringify(map));
    }
  }

  /**
   * Authenticate any authorized user (Owner or registered Roommate)
   */
  static async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Supabase Auth if client is configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (!error && data.user) {
          // Check role from room_members table first, then metadata
          let resolvedRole = data.user.user_metadata?.role;
          try {
            const { data: memData } = await supabase
              .from('room_members')
              .select('role')
              .eq('email', cleanEmail)
              .maybeSingle();
            if (memData?.role) resolvedRole = memData.role;
          } catch {
            // fallback to metadata
          }

          const user: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
            role: resolvedRole || 'viewer',
          };
          localStorage.setItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(user));
          return { success: true, user };
        }
      } catch (err: any) {
        console.warn('Supabase auth attempt failed, falling back to local verification:', err);
      }
    }

    // 2. Check local Master Owner Account
    const storedEmail =
      localStorage.getItem(AUTH_STORAGE_KEYS.SINGLE_ACCOUNT_EMAIL) || DEFAULT_AUTHORIZED_EMAIL;
    const storedHash =
      localStorage.getItem(AUTH_STORAGE_KEYS.SINGLE_ACCOUNT_HASH) || DEFAULT_AUTHORIZED_HASH;
    const storedName =
      localStorage.getItem(AUTH_STORAGE_KEYS.SINGLE_ACCOUNT_NAME) || DEFAULT_AUTHORIZED_NAME;

    const enteredHash = await sha256(password);

    if (cleanEmail === storedEmail.toLowerCase()) {
      if (enteredHash !== storedHash) {
        return {
          success: false,
          error: 'Invalid password. Please check your credentials and try again.',
        };
      }

      const user: AuthUser = {
        id: 'authorized-admin',
        email: storedEmail,
        name: storedName,
        role: 'owner',
      };

      localStorage.setItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(user));
      return { success: true, user };
    }

    // 3. Check registered Roommate Member accounts
    const credentialsMap = this.getMemberCredentialsMap();
    const memberCred = credentialsMap[cleanEmail];

    if (memberCred) {
      if (enteredHash !== memberCred.passwordHash) {
        return {
          success: false,
          error: 'Invalid password. Please check your credentials and try again.',
        };
      }

      const user: AuthUser = {
        id: memberCred.memberId,
        email: memberCred.email,
        name: memberCred.name,
        role: memberCred.role,
      };

      localStorage.setItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(user));
      return { success: true, user };
    }

    return {
      success: false,
      error: `No account found for "${cleanEmail}". Please check your email or ask the admin to add your roommate account.`,
    };
  }

  /**
   * Update credentials for the single authorized account
   */
  static async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'New password must be at least 4 characters long.' };
    }

    const storedHash =
      localStorage.getItem(AUTH_STORAGE_KEYS.SINGLE_ACCOUNT_HASH) || DEFAULT_AUTHORIZED_HASH;
    const currentHash = await sha256(currentPassword);
    if (currentHash !== storedHash) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    const newHash = await sha256(newPassword);
    localStorage.setItem(AUTH_STORAGE_KEYS.SINGLE_ACCOUNT_HASH, newHash);
    return { success: true };
  }

  /**
   * Log out of the single authorized account
   */
  static async logout(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
      sessionStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
    }
  }
}
