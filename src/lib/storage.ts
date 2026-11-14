import {
  Room,
  RoomMember,
  Deposit,
  Expense,
  ExpenseShare,
  Settlement,
  MonthlyRegisterSummary,
  MonthlyMemberSummary,
  UserRole,
} from '../types';
import { calculateSuggestedTransfers } from './settlement';
import { getSupabaseClient, ensureSupabaseSession } from './supabase';

const STORAGE_KEYS = {
  ROOM: 'simple_register_room_v2',
  MEMBERS: 'simple_register_members_v2',
  DEPOSITS: 'simple_register_deposits_v2',
  EXPENSES: 'simple_register_expenses_v2',
  SETTLEMENTS: 'simple_register_settlements_v2',
  ACTIVE_USER_ID: 'simple_register_active_user_v2',
  SELECTED_MONTH: 'simple_register_selected_month_v2',
  PENDING_SYNC: 'simple_register_pending_sync_v2',
  SYNCED_IDS: 'simple_register_synced_ids_v2',
  SYNC_STATUS: 'simple_register_sync_status_v2',
  DELETED_MEMBERS: 'simple_register_deleted_members_v2',
};

export const SEED_ROOM_ID = '2d87ab1f-e0f5-420b-9799-9bb215914da9';

export const LEGACY_MEMBER_ID_MAP: Record<string, string> = {
  'mem-1': '10159410-71a4-4bb5-9f62-3d35b3635461',
  'mem-2': 'c8769b44-bd02-4e38-a3db-0e5e922432b6',
  'mem-3': '47b18f25-7117-4c11-ba37-c27ffd8ec74c',
  'mem-4': '01b69b61-07b7-4eb9-ab98-7311d274d49a',
  'mem-5': '3cd56bea-1914-414f-86d8-1a7ca239b958',
  'authorized-admin': '10159410-71a4-4bb5-9f62-3d35b3635461',
};

export const SEED_MEMBERS: RoomMember[] = [
  {
    id: '10159410-71a4-4bb5-9f62-3d35b3635461',
    roomId: SEED_ROOM_ID,
    name: 'Noman',
    email: 'nomideveloper007@gmail.com',
    role: 'owner',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    phone: '+92 300 1234567',
  },
  {
    id: 'c8769b44-bd02-4e38-a3db-0e5e922432b6',
    roomId: SEED_ROOM_ID,
    name: 'Ali Hassan',
    email: 'ali@gmail.com',
    role: 'editor',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    phone: '+92 301 2345678',
  },
  {
    id: '47b18f25-7117-4c11-ba37-c27ffd8ec74c',
    roomId: SEED_ROOM_ID,
    name: 'Nabeel',
    email: 'nabeel@gmail.com',
    role: 'editor',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    phone: '+92 302 3456789',
  },
  {
    id: '01b69b61-07b7-4eb9-ab98-7311d274d49a',
    roomId: SEED_ROOM_ID,
    name: 'Faiz',
    email: 'faiz@gmail.com',
    role: 'editor',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    phone: '+92 303 4567890',
  },
  {
    id: '3cd56bea-1914-414f-86d8-1a7ca239b958',
    roomId: SEED_ROOM_ID,
    name: 'Arbab',
    email: 'arbab@gmail.com',
    role: 'editor',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    phone: '+92 304 5678901',
  },
  {
    id: '722aefd2-82a1-4992-9f19-89e7c5c36d94',
    roomId: SEED_ROOM_ID,
    name: 'Ali Raza',
    email: 'aliraza@room.com',
    role: 'viewer',
  },
];

export const SEED_ROOM: Room = {
  id: SEED_ROOM_ID,
  name: 'Room 501 Household Register',
  currency: 'PKR',
  monthlyContributionTarget: 15000,
  monthStartDay: 1,
  autoMonthRollover: true,
  walletCustodianId: '10159410-71a4-4bb5-9f62-3d35b3635461', // Noman (Owner) is the sole custodian of the Common Fund
  createdAt: '2026-01-01',
  description: 'Digital Notebook Register for Roommates',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(val: string | undefined | null): boolean {
  if (!val) return false;
  return UUID_REGEX.test(val);
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback below
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** "Monthly Starting Day" clamped for shorter months (31 becomes 28/29/30 where needed). */
export function clampRegisterStartDay(startDay: number, year: number, monthIndex: number): number {
  const requested = Math.min(Math.max(Math.trunc(Number(startDay)) || 1, 1), 31);
  return Math.min(requested, daysInMonth(year, monthIndex));
}

/**
 * Register month ('YYYY-MM') a record date belongs to, honouring the Monthly Starting Day.
 * With a starting day of 10, both 10 Nov and 9 Dec belong to '2026-11'.
 */
export function getRegisterMonth(dateStr: string, startDay: number = 1): string {
  const iso = String(dateStr || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso.slice(0, 7);

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  // On or after the starting day the register month is the calendar month itself,
  // before it the record still belongs to the register month that started last month.
  if (day >= clampRegisterStartDay(startDay, year, monthIndex)) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }
  const previous = new Date(year, monthIndex - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

/** First and last calendar date covered by a register month, e.g. 2026-11 → 10 Nov … 9 Dec. */
export function getRegisterMonthRange(
  month: string,
  startDay: number = 1
): { startDate: string; endDate: string } {
  const [yearStr, monthStr] = String(month || '').split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!year || Number.isNaN(monthIndex)) return { startDate: '', endDate: '' };

  const start = new Date(year, monthIndex, clampRegisterStartDay(startDay, year, monthIndex));
  const nextStart = new Date(year, monthIndex + 1, clampRegisterStartDay(startDay, year, monthIndex + 1));
  return { startDate: toIsoDate(start), endDate: toIsoDate(new Date(nextStart.getTime() - MS_PER_DAY)) };
}

function getPendingSyncIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addPendingSyncId(id: string): void {
  if (typeof window === 'undefined') return;
  const list = getPendingSyncIds();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(list));
  }
}

function removePendingSyncId(id: string): void {
  if (typeof window === 'undefined') return;
  const list = getPendingSyncIds().filter((item) => item !== id);
  localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(list));
}

/** Roommates removed on this device — prevents a stale sync snapshot from re-creating them. */
function getDeletedMemberIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_MEMBERS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addDeletedMemberId(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  const list = getDeletedMemberIds();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(STORAGE_KEYS.DELETED_MEMBERS, JSON.stringify(list));
  }
}

function removeDeletedMemberId(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  const list = getDeletedMemberIds().filter((item) => item !== id);
  localStorage.setItem(STORAGE_KEYS.DELETED_MEMBERS, JSON.stringify(list));
}

function resolveLegacyMemberId(id: string): string {
  return LEGACY_MEMBER_ID_MAP[id] || id;
}

export interface RegisterSyncStatus {
  lastSyncedAt: string | null;
  lastError: string | null;
  pendingCount: number;
}

interface SyncedIdSets {
  deposits: string[];
  expenses: string[];
  settlements: string[];
}

/** Ids previously confirmed to exist in Supabase — used to detect deletions made on other devices. */
function getSyncedIds(): SyncedIdSets {
  const empty: SyncedIdSets = { deposits: [], expenses: [], settlements: [] };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNCED_IDS);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      deposits: Array.isArray(parsed?.deposits) ? parsed.deposits : [],
      expenses: Array.isArray(parsed?.expenses) ? parsed.expenses : [],
      settlements: Array.isArray(parsed?.settlements) ? parsed.settlements : [],
    };
  } catch {
    return empty;
  }
}

function setSyncedIds(ids: SyncedIdSets): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SYNCED_IDS, JSON.stringify(ids));
}

export function getRegisterSyncStatus(): RegisterSyncStatus {
  const pendingCount = getPendingSyncIds().length;
  if (typeof window === 'undefined') return { lastSyncedAt: null, lastError: null, pendingCount };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      lastSyncedAt: parsed.lastSyncedAt || null,
      lastError: parsed.lastError || null,
      pendingCount,
    };
  } catch {
    return { lastSyncedAt: null, lastError: null, pendingCount };
  }
}

function setRegisterSyncStatus(update: { lastSyncedAt?: string | null; lastError?: string | null }): void {
  if (typeof window === 'undefined') return;
  const previous = getRegisterSyncStatus();
  localStorage.setItem(
    STORAGE_KEYS.SYNC_STATUS,
    JSON.stringify({
      lastSyncedAt: update.lastSyncedAt !== undefined ? update.lastSyncedAt : previous.lastSyncedAt,
      lastError: update.lastError !== undefined ? update.lastError : previous.lastError,
    })
  );
}

/** Keeps the local cache id in sync when a legacy (non-UUID) record is uploaded with a fresh UUID. */
function rewriteRecordId(storageKey: string, oldId: string, newId: string): void {
  if (typeof window === 'undefined' || oldId === newId) return;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify(list.map((record: any) => (record && record.id === oldId ? { ...record, id: newId } : record)))
    );
  } catch {
    // Cache rewrite is best-effort only
  }
}

/** Database records win, but local records that could not be uploaded are preserved. */
function mergeById<T extends { id: string }>(dbRecords: T[], localRecords: T[]): T[] {
  const merged = new Map<string, T>();
  localRecords.forEach((record) => merged.set(record.id, record));
  dbRecords.forEach((record) => merged.set(record.id, record));
  return Array.from(merged.values());
}

function sortRecordsByDate<T extends { createdAt?: string }>(records: T[], dateOf: (record: T) => string): T[] {
  return records.sort(
    (a, b) =>
      (dateOf(a) || '').localeCompare(dateOf(b) || '') ||
      (a.createdAt || '').localeCompare(b.createdAt || '')
  );
}

export function createExpenseShares(
  expenseId: string,
  amount: number,
  participantIds: string[],
  allMembers: RoomMember[]
): ExpenseShare[] {
  // Ensure at least 1 participant; fallback to all members if none provided
  const activeParticipants =
    participantIds && participantIds.length > 0 ? participantIds : allMembers.map((m) => m.id);

  const count = activeParticipants.length;
  const baseShare = Math.floor((amount / count) * 100) / 100;
  let allocated = 0;

  const participantSharesMap = new Map<string, number>();
  activeParticipants.forEach((pid, idx) => {
    let share = baseShare;
    if (idx === count - 1) {
      // Last participant absorbs any fractional cent difference so shares sum up exactly to total
      share = Math.round((amount - allocated) * 100) / 100;
    }
    allocated += share;
    participantSharesMap.set(pid, share);
  });

  return allMembers.map((m) => {
    const shareAmount = participantSharesMap.get(m.id) || 0;
    return {
      id: `share-${expenseId}-${m.id}`,
      expenseId,
      memberId: m.id,
      shareAmount,
    };
  });
}

// Initial Deposits (empty baseline)
const INITIAL_DEPOSITS: Deposit[] = [];

// Initial Expenses (empty baseline)
const INITIAL_EXPENSES: Expense[] = [];

// Broadcast channel + local listeners for realtime tab/device sync
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel('simple_room_register_channel');
}

const localSubscribers = new Set<(type: string) => void>();

export function subscribeToRegisterRealtime(callback: (type: string) => void): () => void {
  localSubscribers.add(callback);

  const storageHandler = (e: StorageEvent) => {
    if (e.key?.startsWith('simple_register_')) callback('STORAGE');
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }

  const bcHandler = (e: MessageEvent) => {
    if (e.data?.type) callback(e.data.type);
  };
  broadcastChannel?.addEventListener('message', bcHandler);

  // Subscribe to Supabase Realtime Postgres Changes for live cross-device sync
  const supabase = getSupabaseClient();
  let realtimeChannel: any = null;
  if (supabase) {
    realtimeChannel = supabase
      .channel('room_ledger_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          RegisterStorage.syncWithSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_shares' },
        () => {
          RegisterStorage.syncWithSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deposits' },
        () => {
          RegisterStorage.syncWithSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements' },
        () => {
          RegisterStorage.syncWithSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members' },
        () => {
          RegisterStorage.syncWithSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => {
          RegisterStorage.syncWithSupabase();
        }
      )
      .subscribe();
  }

  return () => {
    localSubscribers.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
    broadcastChannel?.removeEventListener('message', bcHandler);
    if (realtimeChannel && supabase) {
      supabase.removeChannel(realtimeChannel);
    }
  };
}

function notifyRealtime(type: string) {
  localSubscribers.forEach((cb) => {
    try {
      cb(type);
    } catch (err) {
      console.error('Subscriber callback error:', err);
    }
  });
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type, timestamp: Date.now() });
  }
}

/** Shared promise of the sync loop currently running, so callers never read a half-updated cache. */
let activeSync: Promise<boolean> | null = null;
/** Set when a sync is requested while one is already running — triggers exactly one extra pass. */
let rerunRequested = false;

export class RegisterStorage {
  /**
   * Two-way cloud synchronization with Supabase PostgreSQL database:
   * 1. Automatically migrates any unsynced local records (expenses, deposits, settlements) to Supabase.
   * 2. Pulls the authoritative Room, RoomMembers, Deposits, Expenses (with ExpenseShares), and Settlements from Supabase.
   * 3. Updates localStorage cache and notifies all UI components to re-render immediately.
   */
  static syncWithSupabase(): Promise<boolean> {
    if (!getSupabaseClient()) return Promise.resolve(false);

    if (activeSync) {
      // A pass is already running: ask it for one more pull so the caller ends up seeing their
      // change, and hand back the same promise instead of an immediate “already busy” result.
      rerunRequested = true;
      return activeSync;
    }

    const run = (async () => {
      let ok = false;
      do {
        rerunRequested = false;
        ok = await this.performSync();
      } while (rerunRequested);
      return ok;
    })();

    activeSync = run;
    const clear = () => {
      if (activeSync === run) activeSync = null;
    };
    void run.then(clear, clear);
    return run;
  }

  /** One full two-way sync pass; always driven by {@link syncWithSupabase}. */
  private static async performSync(): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      await ensureSupabaseSession();

      // 1. Fetch or create Room in Supabase
      let { data: dbRoom } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', SEED_ROOM_ID)
        .maybeSingle();

      if (!dbRoom) {
        const { data: firstRoom } = await supabase
          .from('rooms')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        dbRoom = firstRoom;
      }

      if (!dbRoom) {
        const { data: createdRoom } = await supabase
          .from('rooms')
          .insert({
            id: SEED_ROOM_ID,
            name: SEED_ROOM.name,
            currency: SEED_ROOM.currency,
            monthly_contribution_target: SEED_ROOM.monthlyContributionTarget,
          })
          .select()
          .single();
        dbRoom = createdRoom;
      }

      if (!dbRoom) return false;
      const roomId: string = dbRoom.id;

      // 2. Fetch active Room Members from Supabase
      let { data: dbMembers, error: membersError } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true });

      // Ids Supabase still knows about, captured before tombstones are filtered out below.
      const activeDbMemberIds = new Set<string>((dbMembers || []).map((member: any) => member.id));

      // Roommates deleted on this device must never be re-created by an older snapshot
      const deletedMemberIds = getDeletedMemberIds();
      if (deletedMemberIds.length > 0 && dbMembers) {
        dbMembers = dbMembers.filter((member: any) => !deletedMemberIds.includes(member.id));
      }

      if (!dbMembers || dbMembers.length === 0) {
        // Seed initial members into Supabase if room has none
        for (const seedMem of SEED_MEMBERS) {
          if (deletedMemberIds.includes(seedMem.id)) continue;
          await supabase.from('room_members').upsert(
            {
              id: seedMem.id,
              room_id: roomId,
              name: seedMem.name,
              email: seedMem.email,
              role: seedMem.role,
              is_active: true,
            },
            { onConflict: 'room_id,email' }
          );
        }
        const refreshed = await supabase
          .from('room_members')
          .select('*')
          .eq('room_id', roomId)
          .eq('is_active', true)
          .order('joined_at', { ascending: true });
        dbMembers = refreshed.data || [];
      }

      // Tombstones only matter while Supabase still has the row. Once it is deleted (or archived)
      // they are dropped, otherwise a roommate added again later would stay invisible forever.
      if (!membersError && activeDbMemberIds.size > 0 && deletedMemberIds.length > 0) {
        deletedMemberIds
          .filter((id) => !activeDbMemberIds.has(id))
          .forEach((id) => removeDeletedMemberId(id));
      }

      // Build comprehensive Member ID lookup map (legacy 'mem-1'..'mem-5' + email/name matches -> Supabase UUID)
      const memberIdMap = new Map<string, string>();
      Object.entries(LEGACY_MEMBER_ID_MAP).forEach(([oldId, newUuid]) => {
        memberIdMap.set(oldId, newUuid);
      });

      const localMembersRaw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.MEMBERS) : null;
      const localMembers: RoomMember[] = localMembersRaw ? JSON.parse(localMembersRaw) : [];

      (dbMembers || []).forEach((dbm: any) => {
        memberIdMap.set(dbm.id, dbm.id);
      });

      for (const lm of localMembers) {
        if (memberIdMap.has(lm.id) && (dbMembers || []).some((d: any) => d.id === memberIdMap.get(lm.id))) {
          continue;
        }
        const matched =
          (dbMembers || []).find((d: any) => d.id === lm.id) ||
          (dbMembers || []).find((d: any) => (d.email || '').toLowerCase() === (lm.email || '').toLowerCase()) ||
          (dbMembers || []).find((d: any) => (d.name || '').trim().toLowerCase() === (lm.name || '').trim().toLowerCase());
        if (matched) {
          memberIdMap.set(lm.id, matched.id);
        }
      }

      const ownerDbMember =
        (dbMembers || []).find((d: any) => d.role === 'owner') || (dbMembers || [])[0];
      const fallbackMemberId = ownerDbMember?.id || SEED_MEMBERS[0].id;

      // 3. Work out which local records still have to be uploaded to Supabase.
      //    A record is uploaded when:
      //      - it was created/edited on this device and never acknowledged (pending queue), or
      //      - Supabase does not have it yet and this device never saw it there either
      //        (data captured while the app was still running on localStorage only).
      //    A record that Supabase did have earlier and no longer has was deleted from another
      //    device, so it is dropped locally instead of being resurrected.
      const [dbDepositIdsRes, dbExpenseIdsRes, dbSettlementIdsRes] = await Promise.all([
        supabase.from('deposits').select('id').eq('room_id', roomId),
        supabase.from('expenses').select('id').eq('room_id', roomId),
        supabase.from('settlements').select('id').eq('room_id', roomId),
      ]);

      const idsFetched = !dbDepositIdsRes.error && !dbExpenseIdsRes.error && !dbSettlementIdsRes.error;
      if (!idsFetched) {
        console.error('[Supabase sync] could not read existing record ids:', {
          deposits: dbDepositIdsRes.error,
          expenses: dbExpenseIdsRes.error,
          settlements: dbSettlementIdsRes.error,
        });
      }

      const dbDepositIds = new Set<string>((dbDepositIdsRes.data || []).map((r: any) => r.id));
      const dbExpenseIds = new Set<string>((dbExpenseIdsRes.data || []).map((r: any) => r.id));
      const dbSettlementIds = new Set<string>((dbSettlementIdsRes.data || []).map((r: any) => r.id));

      const knownIds = getSyncedIds();
      const pendingSyncIds = getPendingSyncIds();
      const localDeposits = this.getDeposits();
      const localExpenses = this.getExpenses();
      const localSettlements = this.getSettlements();

      const needsPush = (id: string, dbIds: Set<string>, known: string[]): boolean => {
        if (!isUuid(id)) return true;
        if (pendingSyncIds.includes(id)) return true;
        return idsFetched && !dbIds.has(id) && !known.includes(id);
      };
      const deletedRemotely = (id: string, dbIds: Set<string>, known: string[]): boolean =>
        idsFetched && isUuid(id) && !dbIds.has(id) && known.includes(id);

      const localDepositsKept = localDeposits.filter(
        (d) => !deletedRemotely(d.id, dbDepositIds, knownIds.deposits)
      );
      const localExpensesKept = localExpenses.filter(
        (e) => !deletedRemotely(e.id, dbExpenseIds, knownIds.expenses)
      );
      const localSettlementsKept = localSettlements.filter(
        (s) => !deletedRemotely(s.id, dbSettlementIds, knownIds.settlements)
      );

      const unsyncedDeposits = localDepositsKept.filter((d) => needsPush(d.id, dbDepositIds, knownIds.deposits));
      const unsyncedExpenses = localExpensesKept.filter((e) => needsPush(e.id, dbExpenseIds, knownIds.expenses));
      const unsyncedSettlements = localSettlementsKept.filter((s) =>
        needsPush(s.id, dbSettlementIds, knownIds.settlements)
      );

      const syncErrors: string[] = [];
      const logSyncError = (scope: string, error: { message?: string } | null) => {
        const message = `${scope}: ${error?.message || 'unknown error'}`;
        if (!syncErrors.includes(message)) syncErrors.push(message);
        console.error('[Supabase sync]', message);
      };

      // Ensure any custom local member referenced by unsynced data exists in Supabase room_members
      if (unsyncedDeposits.length > 0 || unsyncedExpenses.length > 0 || unsyncedSettlements.length > 0) {
        for (const lm of localMembers) {
          if (deletedMemberIds.includes(lm.id)) continue;
          if (!memberIdMap.has(lm.id)) {
            const newId = isUuid(lm.id) ? lm.id : generateUuid();
            const cleanEmail = (lm.email || `${lm.name.toLowerCase().replace(/\s+/g, '.')}@gmail.com`).toLowerCase();
            const { data: insertedMem, error: memberErr } = await supabase
              .from('room_members')
              .upsert(
                {
                  id: newId,
                  room_id: roomId,
                  name: lm.name,
                  email: cleanEmail,
                  role: lm.role || 'viewer',
                  is_active: true,
                },
                { onConflict: 'room_id,email' }
              )
              .select()
              .maybeSingle();
            if (memberErr) {
              logSyncError(`member ${lm.name}`, memberErr);
            }
            if (insertedMem?.id) {
              memberIdMap.set(lm.id, insertedMem.id);
              dbMembers = [...(dbMembers || []), insertedMem];
            }
          }
        }
      }

      // Push unsynced Deposits to Supabase
      for (const dep of unsyncedDeposits) {
        const targetId = isUuid(dep.id) ? dep.id : generateUuid();
        const resolvedMemberId =
          memberIdMap.get(dep.memberId) ||
          memberIdMap.get(resolveLegacyMemberId(dep.memberId)) ||
          fallbackMemberId;
        const resolvedCreatedBy =
          memberIdMap.get(dep.createdBy) ||
          memberIdMap.get(resolveLegacyMemberId(dep.createdBy)) ||
          resolvedMemberId;

        const { error } = await supabase.from('deposits').upsert(
          {
            id: targetId,
            room_id: roomId,
            member_id: resolvedMemberId,
            amount: dep.amount,
            deposit_date: dep.depositDate,
            payment_method: dep.paymentMethod || 'Cash',
            notes: dep.notes || null,
            created_by: isUuid(resolvedCreatedBy) ? resolvedCreatedBy : null,
          },
          { onConflict: 'id' }
        );

        if (error) {
          logSyncError(`deposit ${dep.id}`, error);
        } else {
          removePendingSyncId(dep.id);
          rewriteRecordId(STORAGE_KEYS.DEPOSITS, dep.id, targetId);
        }
      }

      // Convert dbMembers to RoomMember[] for share calculation
      const mappedMembers: RoomMember[] = (dbMembers || [])
        .filter((m: any) => !deletedMemberIds.includes(m.id))
        .map((m: any) => ({
          id: m.id,
          roomId: m.room_id,
          name: m.name,
          email: m.email,
          role: (m.role === 'admin' ? 'owner' : m.role === 'member' ? 'viewer' : m.role) as UserRole,
          joinedAt: m.joined_at ? String(m.joined_at).slice(0, 10) : undefined,
          isActive: m.is_active,
        }));

      // Sort so Owner (Noman) is always first, then by joined_at
      mappedMembers.sort((a, b) => {
        if (a.role === 'owner' && b.role !== 'owner') return -1;
        if (a.role !== 'owner' && b.role === 'owner') return 1;
        return 0;
      });

      // Push unsynced Expenses & ExpenseShares to Supabase
      for (const exp of unsyncedExpenses) {
        const targetId = isUuid(exp.id) ? exp.id : generateUuid();
        const resolvedPaidBy =
          memberIdMap.get(exp.paidByMemberId) ||
          memberIdMap.get(resolveLegacyMemberId(exp.paidByMemberId)) ||
          fallbackMemberId;
        const resolvedCreatedBy =
          memberIdMap.get(exp.createdBy) ||
          memberIdMap.get(resolveLegacyMemberId(exp.createdBy)) ||
          resolvedPaidBy;

        const rawParticipants =
          exp.participantMemberIds && exp.participantMemberIds.length > 0
            ? exp.participantMemberIds
            : exp.shares && exp.shares.some((s) => s.shareAmount > 0)
            ? exp.shares.filter((s) => s.shareAmount > 0).map((s) => s.memberId)
            : mappedMembers.map((m) => m.id);

        const resolvedParticipants = Array.from(
          new Set(
            rawParticipants
              .map((pid) => memberIdMap.get(pid) || memberIdMap.get(resolveLegacyMemberId(pid)) || pid)
              .filter((pid) => mappedMembers.some((m) => m.id === pid))
          )
        );

        const finalParticipants =
          resolvedParticipants.length > 0 ? resolvedParticipants : mappedMembers.map((m) => m.id);

        const { error: expErr } = await supabase.from('expenses').upsert(
          {
            id: targetId,
            room_id: roomId,
            description: exp.description,
            amount: exp.amount,
            expense_date: exp.expenseDate,
            category: 'Household',
            paid_by_member_id: resolvedPaidBy,
            payment_source:
              exp.paymentSource === 'common_fund' || (exp as any).paymentSource === 'common_wallet'
                ? 'common_wallet'
                : 'personal_pocket',
            notes: exp.notes || null,
            created_by: isUuid(resolvedCreatedBy) ? resolvedCreatedBy : null,
          },
          { onConflict: 'id' }
        );

        if (expErr) {
          logSyncError(`expense ${exp.id}`, expErr);
          continue;
        }

        removePendingSyncId(exp.id);
        rewriteRecordId(STORAGE_KEYS.EXPENSES, exp.id, targetId);
        const computedShares = createExpenseShares(targetId, exp.amount, finalParticipants, mappedMembers);
        const { error: shareDeleteErr } = await supabase
          .from('expense_shares')
          .delete()
          .eq('expense_id', targetId);
        if (shareDeleteErr) {
          logSyncError(`expense shares (reset) ${exp.id}`, shareDeleteErr);
        }
        const { error: shareInsertErr } = await supabase.from('expense_shares').insert(
          computedShares.map((s) => ({
            expense_id: targetId,
            member_id: s.memberId,
            share_amount: s.shareAmount,
          }))
        );
        if (shareInsertErr) {
          logSyncError(`expense shares ${exp.id}`, shareInsertErr);
        }
      }

      // Push unsynced Settlements to Supabase
      for (const set of unsyncedSettlements) {
        const targetId = isUuid(set.id) ? set.id : generateUuid();
        const payerId =
          memberIdMap.get(set.payerMemberId) ||
          memberIdMap.get(resolveLegacyMemberId(set.payerMemberId));
        const payeeId =
          memberIdMap.get(set.payeeMemberId) ||
          memberIdMap.get(resolveLegacyMemberId(set.payeeMemberId));

        if (payerId && payeeId && payerId !== payeeId) {
          const { error: setErr } = await supabase.from('settlements').upsert(
            {
              id: targetId,
              room_id: roomId,
              payer_member_id: payerId,
              payee_member_id: payeeId,
              amount: set.amount,
              settlement_date: set.settlementDate,
              payment_method: 'Raast',
              notes: set.notes || null,
            },
            { onConflict: 'id' }
          );
          if (setErr) {
            logSyncError(`settlement ${set.id}`, setErr);
          } else {
            removePendingSyncId(set.id);
            rewriteRecordId(STORAGE_KEYS.SETTLEMENTS, set.id, targetId);
          }
        }
      }

      // 4. Fetch all authoritative records from Supabase
      const [depositsRes, expensesRes, settlementsRes] = await Promise.all([
        supabase
          .from('deposits')
          .select('*')
          .eq('room_id', roomId)
          .order('deposit_date', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('expenses')
          .select('*, expense_shares(*)')
          .eq('room_id', roomId)
          .order('expense_date', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('settlements')
          .select('*')
          .eq('room_id', roomId)
          .order('settlement_date', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      const currentLocalRoom = this.getRoom();
      const syncStartDay = Number(currentLocalRoom.monthStartDay) || 1;
      const syncedRoom: Room = {
        id: dbRoom.id,
        name: dbRoom.name || SEED_ROOM.name,
        currency: dbRoom.currency || 'PKR',
        monthlyContributionTarget: Number(dbRoom.monthly_contribution_target) || 15000,
        monthStartDay:
          typeof dbRoom.month_start_day === 'number'
            ? Number(dbRoom.month_start_day)
            : currentLocalRoom.monthStartDay || 1,
        autoMonthRollover: true,
        walletCustodianId: dbRoom.wallet_custodian_id || ownerDbMember?.id || SEED_MEMBERS[0].id,
        createdAt: dbRoom.created_at ? String(dbRoom.created_at).slice(0, 10) : '2026-01-01',
        description: 'Digital Notebook Register for Roommates',
      };

      const syncedDeposits: Deposit[] = (depositsRes.data || []).map((d: any) => ({
        id: d.id,
        roomId: d.room_id,
        memberId: d.member_id,
        amount: Number(d.amount),
        depositDate: d.deposit_date,
        month: getRegisterMonth(String(d.deposit_date), syncStartDay),
        paymentMethod: d.payment_method || 'Cash',
        notes: d.notes || undefined,
        createdAt: d.created_at || new Date().toISOString(),
        createdBy: d.created_by || d.member_id,
      }));

      const syncedExpenses: Expense[] = (expensesRes.data || []).map((e: any) => {
        const rawShares: any[] = Array.isArray(e.expense_shares) ? e.expense_shares : [];
        const dbShares: ExpenseShare[] = rawShares.map((s: any) => ({
          id: s.id || `share-${e.id}-${s.member_id}`,
          expenseId: e.id,
          memberId: s.member_id,
          shareAmount: Number(s.share_amount),
        }));

        const activeParticipantIds = dbShares
          .filter((s) => s.shareAmount > 0)
          .map((s) => s.memberId);

        const participantMemberIds =
          activeParticipantIds.length > 0 ? activeParticipantIds : mappedMembers.map((m) => m.id);

        const shares: ExpenseShare[] =
          dbShares.length > 0
            ? mappedMembers.map((m) => {
                const found = dbShares.find((s) => s.memberId === m.id);
                return (
                  found || {
                    id: `share-${e.id}-${m.id}`,
                    expenseId: e.id,
                    memberId: m.id,
                    shareAmount: 0,
                  }
                );
              })
            : createExpenseShares(e.id, Number(e.amount), participantMemberIds, mappedMembers);

        return {
          id: e.id,
          roomId: e.room_id,
          description: e.description,
          amount: Number(e.amount),
          expenseDate: e.expense_date,
          month: getRegisterMonth(String(e.expense_date), syncStartDay),
          paidByMemberId: e.paid_by_member_id,
          paymentSource:
            e.payment_source === 'common_wallet' || e.payment_source === 'common_fund'
              ? 'common_fund'
              : 'personal_pocket',
          notes: e.notes || undefined,
          participantMemberIds,
          shares,
          createdAt: e.created_at || new Date().toISOString(),
          createdBy: e.created_by || e.paid_by_member_id,
        };
      });

      const syncedSettlements: Settlement[] = (settlementsRes.data || []).map((s: any) => ({
        id: s.id,
        roomId: s.room_id,
        month: getRegisterMonth(String(s.settlement_date), syncStartDay),
        payerMemberId: s.payer_member_id,
        payeeMemberId: s.payee_member_id,
        amount: Number(s.amount),
        settlementDate: s.settlement_date,
        notes: s.notes || undefined,
        createdAt: s.created_at || new Date().toISOString(),
        createdBy: s.created_by || s.payer_member_id,
      }));

      // 5. Merge every record that could not be uploaded back into the cache so a failed
      //    upload (offline, RLS, foreign key, ...) never removes data from this device.
      const stillPendingIds = new Set(getPendingSyncIds());
      const pendingLocalDeposits = localDepositsKept.filter((d) => stillPendingIds.has(d.id));
      const pendingLocalExpenses = localExpensesKept.filter((e) => stillPendingIds.has(e.id));
      const pendingLocalSettlements = localSettlementsKept.filter((s) => stillPendingIds.has(s.id));

      const finalDeposits = sortRecordsByDate(
        mergeById(syncedDeposits, pendingLocalDeposits),
        (d) => d.depositDate || ''
      );
      const finalExpenses = sortRecordsByDate(
        mergeById(syncedExpenses, pendingLocalExpenses),
        (e) => e.expenseDate || ''
      );
      const finalSettlements = sortRecordsByDate(
        mergeById(syncedSettlements, pendingLocalSettlements),
        (s) => s.settlementDate || ''
      );

      // 6. Persist canonical state to localStorage cache
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.ROOM, JSON.stringify(syncedRoom));
        if (mappedMembers.length > 0) {
          localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(mappedMembers));
        }
        localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(finalDeposits));
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(finalExpenses));
        localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(finalSettlements));

        setSyncedIds({
          deposits: syncedDeposits.map((d) => d.id),
          expenses: syncedExpenses.map((e) => e.id),
          settlements: syncedSettlements.map((s) => s.id),
        });

        const currentActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
        if (currentActiveId && LEGACY_MEMBER_ID_MAP[currentActiveId]) {
          localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, LEGACY_MEMBER_ID_MAP[currentActiveId]);
        }
      }

      setRegisterSyncStatus({
        lastSyncedAt: new Date().toISOString(),
        lastError: syncErrors.length > 0 ? syncErrors[0] : null,
      });

      notifyRealtime('SUPABASE_SYNCED');
      return syncErrors.length === 0;
    } catch (err: any) {
      const message = err?.message || String(err);
      console.error('Supabase sync error:', err);
      setRegisterSyncStatus({ lastError: message });
      return false;
    }
  }

  static getRoom(): Room {
    if (typeof window === 'undefined') return SEED_ROOM;
    const raw = localStorage.getItem(STORAGE_KEYS.ROOM);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ROOM, JSON.stringify(SEED_ROOM));
      return SEED_ROOM;
    }
    const parsed: Room = JSON.parse(raw);
    if (!isUuid(parsed.id)) {
      parsed.id = SEED_ROOM_ID;
    }
    if (!parsed.walletCustodianId || !isUuid(parsed.walletCustodianId)) {
      const members = this.getMembers();
      const owner = members.find((m) => m.role === 'owner') || members[0];
      parsed.walletCustodianId = owner?.id || SEED_MEMBERS[0].id;
      localStorage.setItem(STORAGE_KEYS.ROOM, JSON.stringify(parsed));
    }
    return parsed;
  }

  static getCustodian(): RoomMember {
    const room = this.getRoom();
    const members = this.getMembers();
    if (room.walletCustodianId) {
      const found = members.find((m) => m.id === room.walletCustodianId);
      if (found) return found;
    }
    const owner = members.find((m) => m.role === 'owner');
    return owner || members[0] || SEED_MEMBERS[0];
  }

  static updateRoom(updates: Partial<Room>): Room {
    const room = this.getRoom();
    const updated = { ...room, ...updates };
    localStorage.setItem(STORAGE_KEYS.ROOM, JSON.stringify(updated));
    notifyRealtime('ROOM_UPDATED');

    const supabase = getSupabaseClient();
    if (supabase) {
      ensureSupabaseSession().then(async () => {
        const baseUpdate = {
          name: updated.name,
          monthly_contribution_target: updated.monthlyContributionTarget,
          updated_at: new Date().toISOString(),
        };
        // The Monthly Starting Day is shared with the whole household when the rooms table has the
        // month_start_day column; older databases just keep it per device.
        const { error } = await supabase
          .from('rooms')
          .update({ ...baseUpdate, month_start_day: updated.monthStartDay })
          .eq('id', updated.id);
        if (error) {
          if (error.code !== '42703') {
            console.warn('[Supabase sync] room update failed:', error.code, error.message);
          }
          await supabase.from('rooms').update(baseUpdate).eq('id', updated.id);
        }
        await this.syncWithSupabase();
      });
    }

    return updated;
  }

  static getMembers(): RoomMember[] {
    if (typeof window === 'undefined') return SEED_MEMBERS;
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(SEED_MEMBERS));
      return SEED_MEMBERS;
    }
    const parsed: RoomMember[] = JSON.parse(raw);
    if (parsed.length > 0 && parsed[0].name === 'Ali Khan') {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(SEED_MEMBERS));
      return SEED_MEMBERS;
    }
    let updated = false;
    const migrated = parsed.map((m) => {
      let next = m;
      if (LEGACY_MEMBER_ID_MAP[m.id]) {
        updated = true;
        next = { ...next, id: LEGACY_MEMBER_ID_MAP[m.id], roomId: SEED_ROOM_ID };
      }
      if (next.email && next.email.endsWith('@room.internal')) {
        updated = true;
        next = { ...next, email: next.email.replace('@room.internal', '@gmail.com') };
      }
      return next;
    });
    if (updated) {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(migrated));
    }
    return migrated;
  }

  static updateMember(memberId: string, updates: Partial<RoomMember>): RoomMember {
    const resolvedId = resolveLegacyMemberId(memberId);
    const members = this.getMembers();
    const idx = members.findIndex((m) => m.id === resolvedId || m.id === memberId);
    if (idx === -1) throw new Error('Member not found');
    const updated = { ...members[idx], ...updates };
    members[idx] = updated;
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    notifyRealtime('MEMBERS_UPDATED');

    const supabase = getSupabaseClient();
    if (supabase && isUuid(updated.id)) {
      ensureSupabaseSession().then(async () => {
        await supabase
          .from('room_members')
          .update({
            name: updated.name,
            email: updated.email,
            role: updated.role,
          })
          .eq('id', updated.id);
        await this.syncWithSupabase();
      });
    }

    return updated;
  }

  /**
   * Adds a roommate. One email can only ever belong to one roommate (case-insensitive), both
   * locally and in Supabase — duplicates return an error instead of silently overwriting someone.
   */
  static async addMember(
    name: string,
    role: UserRole = 'viewer',
    email?: string
  ): Promise<{ member?: RoomMember; error?: string }> {
    const cleanName = name.trim();
    if (!cleanName) return { error: 'Please enter a roommate name.' };

    const cleanEmail = (
      email && email.trim() ? email.trim() : `${cleanName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`
    ).toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { error: `"${cleanEmail}" is not a valid email address.` };
    }

    const members = this.getMembers();
    const duplicate = members.find((m) => (m.email || '').trim().toLowerCase() === cleanEmail);
    if (duplicate) {
      return {
        error: `"${cleanEmail}" is already linked to ${duplicate.name}. One email can only be used by one roommate.`,
      };
    }

    const room = this.getRoom();
    const roomId = room.id || SEED_ROOM_ID;
    const supabase = getSupabaseClient();

    if (supabase) {
      await ensureSupabaseSession();

      const { data: existingRow } = await supabase
        .from('room_members')
        .select('id, name, email, is_active')
        .eq('room_id', roomId)
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingRow && existingRow.is_active !== false) {
        return {
          error: `"${cleanEmail}" already exists in Supabase as ${existingRow.name}. One email can only be used by one roommate.`,
        };
      }

      if (existingRow && existingRow.is_active === false) {
        // Previously removed roommate: revive the same row so their history stays linked.
        const { error: reviveError } = await supabase
          .from('room_members')
          .update({ name: cleanName, role, is_active: true })
          .eq('id', existingRow.id);
        if (reviveError) {
          return { error: `Supabase rejected the update: ${reviveError.message}` };
        }
        const revived: RoomMember = {
          id: existingRow.id,
          roomId,
          name: cleanName,
          email: cleanEmail,
          role,
          joinedAt: new Date().toISOString().slice(0, 10),
          isActive: true,
        };
        members.push(revived);
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
        removeDeletedMemberId(existingRow.id);
        notifyRealtime('MEMBERS_UPDATED');
        void this.syncWithSupabase();
        return { member: revived };
      }
    }

    let memberId = generateUuid();
    if (supabase) {
      const { data: savedMember, error } = await supabase
        .from('room_members')
        .insert({
          id: memberId,
          room_id: roomId,
          name: cleanName,
          email: cleanEmail,
          role,
          is_active: true,
        })
        .select()
        .maybeSingle();

      if (error) {
        // Never create a local-only roommate: other devices would never see them.
        console.error('[Supabase sync] member add failed:', error.code, error.message);
        if (error.code === '23505') {
          return { error: `"${cleanEmail}" is already registered in Supabase.` };
        }
        return { error: `Could not save the roommate to Supabase: ${error.message}` };
      }
      if (savedMember?.id) {
        memberId = savedMember.id;
      }
    }

    const newMember: RoomMember = {
      id: memberId,
      roomId,
      name: cleanName,
      email: cleanEmail,
      role,
      joinedAt: new Date().toISOString().slice(0, 10),
      isActive: true,
    };
    members.push(newMember);
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    removeDeletedMemberId(newMember.id);
    notifyRealtime('MEMBERS_UPDATED');
    void this.syncWithSupabase();

    return { member: newMember };
  }

  /**
   * Removes a roommate. The Supabase row is deleted for real; if the roommate already has
   * deposits/expenses/settlements the row is archived (is_active = false) so household history
   * stays intact. Their login credentials are revoked in both cases.
   */
  static async removeMember(
    memberId: string
  ): Promise<{ deleted: boolean; deactivated: boolean; error?: string }> {
    const resolvedId = resolveLegacyMemberId(memberId);
    const members = this.getMembers();
    const target = members.find((m) => m.id === resolvedId || m.id === memberId);
    if (!target) return { deleted: false, deactivated: false, error: 'Roommate not found.' };

    const room = this.getRoom();
    const filtered = members.filter((m) => m.id !== target.id);
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(filtered));
    addDeletedMemberId(target.id);

    if (this.getActiveUserId() === target.id && filtered.length > 0) {
      this.setActiveUserId(filtered[0].id);
    }
    if (room.walletCustodianId === target.id && filtered.length > 0) {
      const nextCustodian = filtered.find((m) => m.role === 'owner') || filtered[0];
      this.updateRoom({ walletCustodianId: nextCustodian.id });
    }
    notifyRealtime('MEMBERS_UPDATED');

    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        deleted: false,
        deactivated: false,
        error: 'Supabase is not configured, so the roommate was only removed from this device.',
      };
    }

    await ensureSupabaseSession();

    // Revoke the login straight away: the password hash is stored in avatar_url.
    await supabase.from('room_members').update({ avatar_url: null }).eq('id', target.id);

    // Ledger rows keep the money history, but the "who recorded it" pointers must not block the
    // removal (created_by / performed_by have no ON DELETE rule, so they default to NO ACTION).
    const detachResults = await Promise.all([
      supabase.from('wallet_transactions').update({ performed_by: null }).eq('performed_by', target.id),
      supabase.from('deposits').update({ created_by: null }).eq('created_by', target.id),
      supabase.from('expenses').update({ created_by: null }).eq('created_by', target.id),
      supabase.from('settlements').update({ created_by: null }).eq('created_by', target.id),
    ]);
    const detachError = detachResults.find((result) => result.error)?.error;
    if (detachError) {
      console.error('[Supabase sync] could not detach member references:', detachError.code, detachError.message);
    }

    const { error: deleteError } = await supabase.from('room_members').delete().eq('id', target.id);
    if (!deleteError) {
      await this.syncWithSupabase();
      return { deleted: true, deactivated: false };
    }

    if (deleteError.code !== '23503') {
      console.error('[Supabase sync] member delete failed:', deleteError.code, deleteError.message);
      await this.syncWithSupabase();
      return {
        deleted: false,
        deactivated: false,
        error: `Supabase could not delete the roommate: ${deleteError.message}`,
      };
    }

    // 23503 = foreign key: deposits/expenses/settlements reference this roommate.
    const { error: archiveError } = await supabase
      .from('room_members')
      .update({ is_active: false, avatar_url: null })
      .eq('id', target.id);

    await this.syncWithSupabase();

    if (archiveError) {
      return {
        deleted: false,
        deactivated: false,
        error: `Supabase could not archive the roommate: ${archiveError.message}`,
      };
    }
    return { deleted: false, deactivated: true };
  }

  static updateAllMemberNames(names: string[]): RoomMember[] {
    const members = this.getMembers();
    const changed: RoomMember[] = [];
    names.forEach((name, idx) => {
      if (members[idx] && name.trim() && members[idx].name !== name.trim()) {
        members[idx].name = name.trim();
        changed.push(members[idx]);
      }
    });
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    notifyRealtime('MEMBERS_UPDATED');

    const supabase = getSupabaseClient();
    if (supabase && changed.length > 0) {
      ensureSupabaseSession().then(async () => {
        for (const m of changed) {
          if (isUuid(m.id)) {
            await supabase.from('room_members').update({ name: m.name }).eq('id', m.id);
          }
        }
        await this.syncWithSupabase();
      });
    }

    return members;
  }

  static getActiveUserId(): string {
    if (typeof window === 'undefined') return SEED_MEMBERS[0].id;
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
    if (stored) {
      const resolved = resolveLegacyMemberId(stored);
      if (resolved !== stored) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, resolved);
      }
      return resolved;
    }
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, SEED_MEMBERS[0].id);
    return SEED_MEMBERS[0].id;
  }

  static setActiveUserId(id: string): void {
    if (typeof window !== 'undefined') {
      const resolved = resolveLegacyMemberId(id);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, resolved);
      notifyRealtime('USER_CHANGED');
    }
  }

  /** The room's Monthly Starting Day, clamped to a valid 1–31 range. */
  static getMonthStartDay(): number {
    const startDay = Number(this.getRoom().monthStartDay);
    return Math.min(Math.max(Math.trunc(startDay) || 1, 1), 31);
  }

  /** Register month ('YYYY-MM') of a record date using the room's Monthly Starting Day. */
  static getRegisterMonthFor(dateStr: string): string {
    return getRegisterMonth(dateStr, this.getMonthStartDay());
  }

  /**
   * Automatic Month Transition Logic:
   * The register month starts on the configured Monthly Starting Day, so it rolls over on the day
   * before that date (9 Nov → December starts when the starting day is 10; 30 Nov when it is 1).
   * On the rollover day the upcoming register month is started automatically.
   */
  static getEffectiveAutoMonth(): {
    month: string;
    isLastDay: boolean;
    isAutoStarted: boolean;
    currentCalendarMonth: string;
    nextMonth: string;
    lastDateOfMonth: number;
    todayDate: number;
    isSimulated: boolean;
  } {
    let now = new Date();
    let isSimulated = false;

    if (typeof window !== 'undefined') {
      const simulated = localStorage.getItem('simple_register_simulated_date');
      if (simulated) {
        const parsed = new Date(simulated);
        if (!isNaN(parsed.getTime())) {
          now = parsed;
          isSimulated = true;
        }
      }
    }

    const year = now.getFullYear();
    const monthIndex = now.getMonth(); // 0-based
    const todayDate = now.getDate();
    const startDay = this.getMonthStartDay();

    // Register month that today belongs to, and the one that starts tomorrow.
    const currentCalendarMonth = getRegisterMonth(toIsoDate(now), startDay);
    const tomorrow = new Date(year, monthIndex, todayDate + 1);
    const nextMonth = getRegisterMonth(toIsoDate(tomorrow), startDay);

    // A rollover happens when the register month changes tomorrow (its last day is today).
    const isLastDay = nextMonth !== currentCalendarMonth;
    const { endDate } = getRegisterMonthRange(currentCalendarMonth, startDay);
    const lastDateOfMonth = Number(String(endDate).slice(8, 10)) || todayDate;

    return {
      month: isLastDay ? nextMonth : currentCalendarMonth,
      isLastDay,
      isAutoStarted: isLastDay,
      currentCalendarMonth,
      nextMonth,
      lastDateOfMonth,
      todayDate,
      isSimulated,
    };
  }

  static getSelectedMonth(): string {
    const autoInfo = this.getEffectiveAutoMonth();
    if (typeof window === 'undefined') return autoInfo.month;

    const AUTO_APPLIED_KEY = 'simple_register_last_auto_month';
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_MONTH);
    const lastApplied = localStorage.getItem(AUTO_APPLIED_KEY);

    // Advance only once per rollover (when the auto month itself changes),
    // so users can still browse/edit older months without being pulled forward.
    if (!stored || lastApplied !== autoInfo.month) {
      localStorage.setItem(AUTO_APPLIED_KEY, autoInfo.month);
      if (!stored || stored < autoInfo.month) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_MONTH, autoInfo.month);
        return autoInfo.month;
      }
    }
    return stored;
  }

  static setSelectedMonth(month: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SELECTED_MONTH, month);
      notifyRealtime('MONTH_CHANGED');
    }
  }

  static getDeposits(): Deposit[] {
    if (typeof window === 'undefined') return [...INITIAL_DEPOSITS];
    const raw = localStorage.getItem(STORAGE_KEYS.DEPOSITS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(INITIAL_DEPOSITS));
      // Return a copy: callers push into this list, and mutating the shared baseline would leak
      // records back after "Reset All" or after the cache is cleared.
      return [...INITIAL_DEPOSITS];
    }
    const list: Deposit[] = JSON.parse(raw);
    // The register month always follows the current Monthly Starting Day, so changing the setting
    // immediately re-files existing records (a 5 Nov deposit belongs to the 10 → 9 October month).
    const startDay = this.getMonthStartDay();
    const cleanList = list
      .filter((d) => !d.id.startsWith('dep-nov-') && !d.id.startsWith('dep-oct-'))
      .map((d) => ({
        ...d,
        memberId: resolveLegacyMemberId(d.memberId),
        createdBy: resolveLegacyMemberId(d.createdBy),
        month: getRegisterMonth(d.depositDate, startDay),
      }));
    return cleanList;
  }

  static addDeposit(data: {
    memberId: string;
    amount: number;
    depositDate: string;
    notes?: string;
    createdBy: string;
  }): Deposit {
    const room = this.getRoom();
    const deposits = this.getDeposits();
    const month = this.getRegisterMonthFor(data.depositDate);
    const resolvedMemberId = resolveLegacyMemberId(data.memberId);
    const resolvedCreatedBy = resolveLegacyMemberId(data.createdBy);

    const newDeposit: Deposit = {
      id: generateUuid(),
      roomId: room.id || SEED_ROOM_ID,
      memberId: resolvedMemberId,
      amount: data.amount,
      depositDate: data.depositDate,
      month,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      createdBy: resolvedCreatedBy,
    };

    deposits.unshift(newDeposit);
    localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(deposits));
    addPendingSyncId(newDeposit.id);
    notifyRealtime('DEPOSIT_ADDED');

    // Upload through the shared sync path: it maps every local member id to its Supabase id
    // (and creates missing members) before inserting, then keeps the record pending on error.
    void this.syncWithSupabase();

    return newDeposit;
  }

  static deleteDeposit(id: string): void {
    removePendingSyncId(id);
    const deposits = this.getDeposits().filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(deposits));
    notifyRealtime('DEPOSIT_DELETED');

    const supabase = getSupabaseClient();
    if (supabase && isUuid(id)) {
      ensureSupabaseSession().then(async () => {
        await supabase.from('wallet_transactions').delete().eq('reference_id', id);
        await supabase.from('deposits').delete().eq('id', id);
        await this.syncWithSupabase();
      });
    }
  }

  static getExpenses(): Expense[] {
    if (typeof window === 'undefined') return [...INITIAL_EXPENSES];
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
      // Same reason as getDeposits(): never hand the shared baseline array to a caller.
      return [...INITIAL_EXPENSES];
    }
    const list: Expense[] = JSON.parse(raw);
    const startDay = this.getMonthStartDay();
    const cleanList = list
      .filter((e) => !e.id.startsWith('exp-nov-') && !e.id.startsWith('exp-oct-'))
      .map((e) => ({
        ...e,
        month: getRegisterMonth(e.expenseDate, startDay),
        paidByMemberId: resolveLegacyMemberId(e.paidByMemberId),
        createdBy: resolveLegacyMemberId(e.createdBy),
        participantMemberIds: e.participantMemberIds
          ? e.participantMemberIds.map((pid) => resolveLegacyMemberId(pid))
          : undefined,
        shares: (e.shares || []).map((s) => ({
          ...s,
          memberId: resolveLegacyMemberId(s.memberId),
        })),
      }));
    return cleanList.sort(
      (a, b) =>
        (a.expenseDate || '').localeCompare(b.expenseDate || '') ||
        (a.createdAt || '').localeCompare(b.createdAt || '')
    );
  }

  static addExpense(data: {
    description: string;
    amount: number;
    expenseDate: string;
    paidByMemberId: string;
    paymentSource: 'common_fund' | 'personal_pocket';
    notes?: string;
    participantMemberIds?: string[];
    createdBy: string;
  }): Expense {
    const room = this.getRoom();
    const members = this.getMembers();
    const id = generateUuid();
    const month = this.getRegisterMonthFor(data.expenseDate);
    const resolvedPaidBy = resolveLegacyMemberId(data.paidByMemberId);
    const resolvedCreatedBy = resolveLegacyMemberId(data.createdBy);
    const participantIds =
      data.participantMemberIds && data.participantMemberIds.length > 0
        ? data.participantMemberIds.map((pid) => resolveLegacyMemberId(pid))
        : members.map((m) => m.id);
    const shares = createExpenseShares(id, data.amount, participantIds, members);

    const newExpense: Expense = {
      ...data,
      id,
      roomId: room.id || SEED_ROOM_ID,
      month,
      paidByMemberId: resolvedPaidBy,
      createdBy: resolvedCreatedBy,
      participantMemberIds: participantIds,
      shares,
      createdAt: new Date().toISOString(),
    };

    const expenses = this.getExpenses();
    expenses.push(newExpense);
    expenses.sort(
      (a, b) =>
        (a.expenseDate || '').localeCompare(b.expenseDate || '') ||
        (a.createdAt || '').localeCompare(b.createdAt || '')
    );
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    addPendingSyncId(newExpense.id);
    notifyRealtime('EXPENSE_ADDED');

    // Upload through the shared sync path so member ids, shares and the wallet trigger stay
    // consistent with Supabase and the record is never dropped when an insert fails.
    void this.syncWithSupabase();

    return newExpense;
  }

  static updateExpense(
    id: string,
    updates: Partial<Expense> & { participantMemberIds?: string[] }
  ): Expense {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Expense not found');

    const prev = expenses[idx];
    const amount = updates.amount !== undefined ? updates.amount : prev.amount;
    const members = this.getMembers();
    const participantIds =
      updates.participantMemberIds !== undefined
        ? updates.participantMemberIds.map((pid) => resolveLegacyMemberId(pid))
        : prev.participantMemberIds || members.map((m) => m.id);
    const shares = createExpenseShares(id, amount, participantIds, members);
    const month = this.getRegisterMonthFor(updates.expenseDate || prev.expenseDate);

    const updated: Expense = {
      ...prev,
      ...updates,
      paidByMemberId: updates.paidByMemberId
        ? resolveLegacyMemberId(updates.paidByMemberId)
        : prev.paidByMemberId,
      month,
      participantMemberIds: participantIds,
      shares,
    };
    expenses[idx] = updated;
    expenses.sort(
      (a, b) =>
        (a.expenseDate || '').localeCompare(b.expenseDate || '') ||
        (a.createdAt || '').localeCompare(b.createdAt || '')
    );
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    addPendingSyncId(id);
    notifyRealtime('EXPENSE_UPDATED');

    // Re-upload the updated row (including recomputed shares) through the sync path
    void this.syncWithSupabase();

    return updated;
  }

  static deleteExpense(id: string): void {
    removePendingSyncId(id);
    const expenses = this.getExpenses().filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    notifyRealtime('EXPENSE_DELETED');

    const supabase = getSupabaseClient();
    if (supabase && isUuid(id)) {
      ensureSupabaseSession().then(async () => {
        await supabase.from('wallet_transactions').delete().eq('reference_id', id);
        await supabase.from('expense_shares').delete().eq('expense_id', id);
        await supabase.from('expenses').delete().eq('id', id);
        await this.syncWithSupabase();
      });
    }
  }

  static getSettlements(): Settlement[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.SETTLEMENTS);
    if (!raw) return [];
    const list: Settlement[] = JSON.parse(raw);
    const startDay = this.getMonthStartDay();
    return list.map((s) => ({
      ...s,
      month: getRegisterMonth(s.settlementDate, startDay),
      payerMemberId: resolveLegacyMemberId(s.payerMemberId),
      payeeMemberId: resolveLegacyMemberId(s.payeeMemberId),
      createdBy: resolveLegacyMemberId(s.createdBy),
    }));
  }

  static addSettlement(data: {
    month: string;
    payerMemberId: string;
    payeeMemberId: string;
    amount: number;
    settlementDate: string;
    notes?: string;
    createdBy: string;
  }): Settlement {
    const room = this.getRoom();
    const settlements = this.getSettlements();
    const newSettlement: Settlement = {
      ...data,
      id: generateUuid(),
      roomId: room.id || SEED_ROOM_ID,
      month: this.getRegisterMonthFor(data.settlementDate),
      payerMemberId: resolveLegacyMemberId(data.payerMemberId),
      payeeMemberId: resolveLegacyMemberId(data.payeeMemberId),
      createdBy: resolveLegacyMemberId(data.createdBy),
      createdAt: new Date().toISOString(),
    };
    settlements.unshift(newSettlement);
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));
    addPendingSyncId(newSettlement.id);
    notifyRealtime('SETTLEMENT_ADDED');

    void this.syncWithSupabase();

    return newSettlement;
  }

  static deleteSettlement(id: string): void {
    removePendingSyncId(id);
    const settlements = this.getSettlements().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));
    notifyRealtime('SETTLEMENT_DELETED');

    const supabase = getSupabaseClient();
    if (supabase && isUuid(id)) {
      ensureSupabaseSession().then(async () => {
        await supabase.from('settlements').delete().eq('id', id);
        await this.syncWithSupabase();
      });
    }
  }

  /**
   * Strict Owner/Custodian Settlement Model:
   * Noman (the Owner & Custodian) is the sole custodian of the Common Fund.
   */
  static calculateMonthlySummary(selectedMonth: string): MonthlyRegisterSummary {
    const members = this.getMembers();
    const custodian = this.getCustodian();

    const allDeposits = this.getDeposits().filter((d) => d.month === selectedMonth);
    const allExpenses = this.getExpenses().filter((e) => e.month === selectedMonth);
    const allSettlements = this.getSettlements().filter((s) => s.month === selectedMonth);

    // 1. Opening carry-over from earlier months (Common Fund balance before this month)
    const previousDeposits = this.getDeposits().filter((d) => d.month < selectedMonth);
    const previousCommonFundExpenses = this.getExpenses()
      .filter(
        (e) =>
          e.month < selectedMonth &&
          (e.paymentSource === 'common_fund' || (e as any).paymentSource === 'common_wallet')
      )
      .reduce((acc, e) => acc + e.amount, 0);
    const previousDepositsTotal = previousDeposits.reduce((acc, d) => acc + d.amount, 0);

    // Historical settlements collected into or disbursed from the Common Wallet by Custodian
    const previousSettlementsIn = this.getSettlements()
      .filter((s) => s.month < selectedMonth && s.payeeMemberId === custodian.id)
      .reduce((acc, s) => acc + s.amount, 0);
    const previousSettlementsOut = this.getSettlements()
      .filter((s) => s.month < selectedMonth && s.payerMemberId === custodian.id)
      .reduce((acc, s) => acc + s.amount, 0);

    const openingCarryOverBalance =
      Math.round(
        (previousDepositsTotal -
          previousCommonFundExpenses +
          previousSettlementsIn -
          previousSettlementsOut) *
          100
      ) / 100;

    // 2. Totals for the selected month
    const totalDeposited = allDeposits.reduce((acc, d) => acc + d.amount, 0);
    let commonFundExpenses = 0;
    let personalExpenses = 0;
    allExpenses.forEach((exp) => {
      if (exp.paymentSource === 'common_fund' || (exp as any).paymentSource === 'common_wallet') {
        commonFundExpenses += exp.amount;
      } else {
        personalExpenses += exp.amount;
      }
    });
    const totalExpenses = commonFundExpenses + personalExpenses;

    // Current month settlements collected by Custodian into Common Wallet
    const currentSettlementsIn = allSettlements
      .filter((s) => s.payeeMemberId === custodian.id)
      .reduce((acc, s) => acc + s.amount, 0);
    // Current month settlements disbursed by Custodian to reimburse members
    const currentSettlementsOut = allSettlements
      .filter((s) => s.payerMemberId === custodian.id)
      .reduce((acc, s) => acc + s.amount, 0);

    // Common Wallet Cash after expenses and custodian settlements
    const commonFundBalance =
      Math.round(
        (openingCarryOverBalance +
          totalDeposited -
          commonFundExpenses +
          currentSettlementsIn -
          currentSettlementsOut) *
          100
      ) / 100;

    // 3. Build per-member summaries
    const memberSummaries: MonthlyMemberSummary[] = members.map((member) => {
      const isCustodian = member.id === custodian.id;

      const memberDeposits = allDeposits
        .filter((d) => d.memberId === member.id)
        .reduce((acc, d) => acc + d.amount, 0);

      const personalPocketPaid = allExpenses
        .filter(
          (e) => e.paidByMemberId === member.id && e.paymentSource === 'personal_pocket'
        )
        .reduce((acc, e) => acc + e.amount, 0);

      // Sum of this member's allocated expense shares (both common and personal expenses)
      let expenseShare = 0;
      allExpenses.forEach((exp) => {
        const share = exp.shares ? exp.shares.find((sh) => sh.memberId === member.id) : undefined;
        if (share) {
          expenseShare += share.shareAmount;
        } else if (exp.participantMemberIds && exp.participantMemberIds.length > 0) {
          if (exp.participantMemberIds.includes(member.id)) {
            expenseShare += exp.amount / exp.participantMemberIds.length;
          }
        } else {
          expenseShare += exp.amount / (members.length || 1);
        }
      });

      const settlementsPaid = allSettlements
        .filter((s) => s.payerMemberId === member.id)
        .reduce((acc, s) => acc + s.amount, 0);
      const settlementsReceived = allSettlements
        .filter((s) => s.payeeMemberId === member.id)
        .reduce((acc, s) => acc + s.amount, 0);

      let rawNet: number;
      if (isCustodian) {
        rawNet = memberDeposits + personalPocketPaid - expenseShare;
      } else {
        rawNet =
          memberDeposits + personalPocketPaid - expenseShare + settlementsPaid - settlementsReceived;
      }

      const netBalance = Math.round(rawNet * 100) / 100;

      let status: 'pays' | 'receives' | 'settled' = 'settled';
      let amountToPay = 0;
      let amountToReceive = 0;
      if (netBalance < -0.01) {
        status = 'pays';
        amountToPay = Math.abs(netBalance);
      } else if (netBalance > 0.01) {
        status = 'receives';
        amountToReceive = netBalance;
      }

      return {
        member,
        totalDeposited: Math.round(memberDeposits * 100) / 100,
        personalExpensesPaid: Math.round(personalPocketPaid * 100) / 100,
        totalExpenseShare: Math.round(expenseShare * 100) / 100,
        netBalance,
        amountToPay,
        amountToReceive,
        status,
      } as MonthlyMemberSummary;
    });

    // 4. Strict Owner-centric suggested transfers
    const suggestedTransfers = calculateSuggestedTransfers(memberSummaries, custodian.id);

    return {
      month: selectedMonth,
      totalDeposited: Math.round(totalDeposited * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      commonFundExpenses: Math.round(commonFundExpenses * 100) / 100,
      personalExpenses: Math.round(personalExpenses * 100) / 100,
      commonFundBalance,
      openingCarryOverBalance,
      memberSummaries,
      suggestedTransfers,
    } as MonthlyRegisterSummary;
  }

  static resetToDefault(): void {
    const room = this.getRoom();
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(INITIAL_DEPOSITS));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
      localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, SEED_MEMBERS[0].id);
      notifyRealtime('RESET');
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      ensureSupabaseSession().then(async () => {
        const roomId = room.id || SEED_ROOM_ID;
        await supabase.from('wallet_transactions').delete().eq('room_id', roomId);
        await supabase.from('settlements').delete().eq('room_id', roomId);
        await supabase.from('expenses').delete().eq('room_id', roomId);
        await supabase.from('deposits').delete().eq('room_id', roomId);
        await this.syncWithSupabase();
      });
    }
  }
}
