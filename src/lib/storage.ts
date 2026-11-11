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

const STORAGE_KEYS = {
  ROOM: 'simple_register_room_v2',
  MEMBERS: 'simple_register_members_v2',
  DEPOSITS: 'simple_register_deposits_v2',
  EXPENSES: 'simple_register_expenses_v2',
  SETTLEMENTS: 'simple_register_settlements_v2',
  ACTIVE_USER_ID: 'simple_register_active_user_v2',
  SELECTED_MONTH: 'simple_register_selected_month_v2',
};

export const SEED_ROOM_ID = 'room-register-001';

export const SEED_MEMBERS: RoomMember[] = [
  {
    id: 'mem-1',
    roomId: SEED_ROOM_ID,
    name: 'Noman',
    email: 'nomideveloper007@gmail.com',
    role: 'owner',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    phone: '+92 300 1234567',
  },
  {
    id: 'mem-2',
    roomId: SEED_ROOM_ID,
    name: 'Ali Hassan',
    email: 'ali@room.internal',
    role: 'editor',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    phone: '+92 301 2345678',
  },
  {
    id: 'mem-3',
    roomId: SEED_ROOM_ID,
    name: 'Nabeel',
    email: 'nabeel@room.internal',
    role: 'editor',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    phone: '+92 302 3456789',
  },
  {
    id: 'mem-4',
    roomId: SEED_ROOM_ID,
    name: 'Faiz',
    email: 'faiz@room.internal',
    role: 'editor',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    phone: '+92 303 4567890',
  },
  {
    id: 'mem-5',
    roomId: SEED_ROOM_ID,
    name: 'Arbab',
    email: 'arbab@room.internal',
    role: 'editor',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    phone: '+92 304 5678901',
  },
];

export const SEED_ROOM: Room = {
  id: SEED_ROOM_ID,
  name: 'Room 501 Household Register',
  currency: 'PKR',
  monthlyContributionTarget: 15000,
  monthStartDay: 1,
  autoMonthRollover: true,
  walletCustodianId: 'mem-1', // Noman (Owner) is the sole custodian of the Common Fund
  createdAt: '2026-01-01',
  description: 'Digital Notebook Register for 5 Roommates',
};

export function createExpenseShares(
  expenseId: string,
  amount: number,
  participantIds: string[],
  allMembers: RoomMember[]
): ExpenseShare[] {
  // Ensure at least 1 participant; fallback to all members if none provided
  const activeParticipants = participantIds && participantIds.length > 0
    ? participantIds
    : allMembers.map((m) => m.id);

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

// Broadcast channel for realtime tab/device sync
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel('simple_room_register_channel');
}

export function subscribeToRegisterRealtime(callback: (type: string) => void): () => void {
  if (!broadcastChannel) {
    const storageHandler = (e: StorageEvent) => {
      if (e.key?.startsWith('simple_register_')) callback('STORAGE');
    };
    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }

  const handler = (e: MessageEvent) => {
    if (e.data?.type) callback(e.data.type);
  };
  broadcastChannel.addEventListener('message', handler);

  const storageHandler = (e: StorageEvent) => {
    if (e.key?.startsWith('simple_register_')) callback('STORAGE');
  };
  window.addEventListener('storage', storageHandler);

  return () => {
    broadcastChannel?.removeEventListener('message', handler);
    window.removeEventListener('storage', storageHandler);
  };
}

function notifyRealtime(type: string) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type, timestamp: Date.now() });
  }
}

export class RegisterStorage {
  static getRoom(): Room {
    if (typeof window === 'undefined') return SEED_ROOM;
    const raw = localStorage.getItem(STORAGE_KEYS.ROOM);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ROOM, JSON.stringify(SEED_ROOM));
      return SEED_ROOM;
    }
    const parsed: Room = JSON.parse(raw);
    if (!parsed.walletCustodianId) {
      const members = this.getMembers();
      const owner = members.find((m) => m.role === 'owner') || members[0];
      parsed.walletCustodianId = owner?.id || 'mem-1';
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
    return parsed;
  }

  static updateMember(memberId: string, updates: Partial<RoomMember>): RoomMember {
    const members = this.getMembers();
    const idx = members.findIndex((m) => m.id === memberId);
    if (idx === -1) throw new Error('Member not found');
    const updated = { ...members[idx], ...updates };
    members[idx] = updated;
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    notifyRealtime('MEMBERS_UPDATED');
    return updated;
  }

  static addMember(name: string, role: UserRole = 'viewer', email?: string): RoomMember {
    const members = this.getMembers();
    const cleanEmail =
      email && email.trim()
        ? email.trim().toLowerCase()
        : `${name.toLowerCase().replace(/\s+/g, '.')}@room.internal`;

    const newMember: RoomMember = {
      id: `mem-${Date.now()}`,
      roomId: SEED_ROOM_ID,
      name: name.trim(),
      email: cleanEmail,
      role,
      joinedAt: new Date().toISOString().slice(0, 10),
      isActive: true,
    };
    members.push(newMember);
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    notifyRealtime('MEMBERS_UPDATED');
    return newMember;
  }

  static removeMember(memberId: string): RoomMember[] {
    const members = this.getMembers();
    const filtered = members.filter((m) => m.id !== memberId);
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(filtered));
    if (this.getActiveUserId() === memberId && filtered.length > 0) {
      this.setActiveUserId(filtered[0].id);
    }
    notifyRealtime('MEMBERS_UPDATED');
    return filtered;
  }

  static updateAllMemberNames(names: string[]): RoomMember[] {
    const members = this.getMembers();
    names.forEach((name, idx) => {
      if (members[idx] && name.trim()) {
        members[idx].name = name.trim();
      }
    });
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    notifyRealtime('MEMBERS_UPDATED');
    return members;
  }

  static getActiveUserId(): string {
    if (typeof window === 'undefined') return SEED_MEMBERS[0].id;
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
    if (stored) return stored;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, SEED_MEMBERS[0].id);
    return SEED_MEMBERS[0].id;
  }

  static setActiveUserId(id: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, id);
      notifyRealtime('USER_CHANGED');
    }
  }

  /**
   * Automatic Month Transition Logic:
   * "agr month ki last date hay to new month khud say start ho jana chahiya"
   * If today is the last date of the current month (e.g. Nov 30, Dec 31, etc.),
   * the register automatically starts and defaults to the upcoming new month (e.g. 2026-12).
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
    // Day 0 of next month returns the exact last day count of the current month
    const lastDateOfMonth = new Date(year, monthIndex + 1, 0).getDate();

    const currentCalendarMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const nextDate = new Date(year, monthIndex + 1, 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

    // If today is the last date of the month (e.g. Nov 30), advance to next month!
    const isLastDay = todayDate >= lastDateOfMonth;
    const targetMonth = isLastDay ? nextMonth : currentCalendarMonth;

    return {
      month: targetMonth,
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
    if (typeof window === 'undefined') return INITIAL_DEPOSITS;
    const raw = localStorage.getItem(STORAGE_KEYS.DEPOSITS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(INITIAL_DEPOSITS));
      return INITIAL_DEPOSITS;
    }
    const list: Deposit[] = JSON.parse(raw);
    const cleanList = list.filter((d) => !d.id.startsWith('dep-nov-') && !d.id.startsWith('dep-oct-'));
    if (cleanList.length !== list.length) {
      localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(cleanList));
    }
    return cleanList;
  }

  static addDeposit(data: {
    memberId: string;
    amount: number;
    depositDate: string;
    notes?: string;
    createdBy: string;
  }): Deposit {
    const deposits = this.getDeposits();
    const month = data.depositDate.slice(0, 7);
    const newDeposit: Deposit = {
      id: `dep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      roomId: SEED_ROOM_ID,
      memberId: data.memberId,
      amount: data.amount,
      depositDate: data.depositDate,
      month,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy,
    };
    deposits.unshift(newDeposit);
    localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(deposits));
    notifyRealtime('DEPOSIT_ADDED');
    return newDeposit;
  }

  static deleteDeposit(id: string): void {
    const deposits = this.getDeposits().filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(deposits));
    notifyRealtime('DEPOSIT_DELETED');
  }

  static getExpenses(): Expense[] {
    if (typeof window === 'undefined') return INITIAL_EXPENSES;
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
      return INITIAL_EXPENSES;
    }
    const list: Expense[] = JSON.parse(raw);
    const cleanList = list.filter((e) => !e.id.startsWith('exp-nov-') && !e.id.startsWith('exp-oct-'));
    if (cleanList.length !== list.length) {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(cleanList));
    }
    return cleanList.sort((a, b) => a.expenseDate.localeCompare(b.expenseDate) || a.createdAt.localeCompare(b.createdAt));
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
    const members = this.getMembers();
    const id = `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const month = data.expenseDate.slice(0, 7);
    const participantIds =
      data.participantMemberIds && data.participantMemberIds.length > 0
        ? data.participantMemberIds
        : members.map((m) => m.id);
    const shares = createExpenseShares(id, data.amount, participantIds, members);

    const newExpense: Expense = {
      ...data,
      id,
      roomId: SEED_ROOM_ID,
      month,
      participantMemberIds: participantIds,
      shares,
      createdAt: new Date().toISOString(),
    };

    const expenses = this.getExpenses();
    expenses.push(newExpense);
    expenses.sort((a, b) => a.expenseDate.localeCompare(b.expenseDate) || a.createdAt.localeCompare(b.createdAt));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    notifyRealtime('EXPENSE_ADDED');
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
        ? updates.participantMemberIds
        : prev.participantMemberIds || members.map((m) => m.id);
    const shares = createExpenseShares(id, amount, participantIds, members);
    const month = (updates.expenseDate || prev.expenseDate).slice(0, 7);

    const updated: Expense = {
      ...prev,
      ...updates,
      month,
      participantMemberIds: participantIds,
      shares,
    };
    expenses[idx] = updated;
    expenses.sort((a, b) => a.expenseDate.localeCompare(b.expenseDate) || a.createdAt.localeCompare(b.createdAt));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    notifyRealtime('EXPENSE_UPDATED');
    return updated;
  }

  static deleteExpense(id: string): void {
    const expenses = this.getExpenses().filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    notifyRealtime('EXPENSE_DELETED');
  }

  static getSettlements(): Settlement[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.SETTLEMENTS);
    if (!raw) return [];
    return JSON.parse(raw);
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
    const settlements = this.getSettlements();
    const newSettlement: Settlement = {
      ...data,
      id: `set-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      roomId: SEED_ROOM_ID,
      createdAt: new Date().toISOString(),
    };
    settlements.unshift(newSettlement);
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));
    notifyRealtime('SETTLEMENT_ADDED');
    return newSettlement;
  }

  static deleteSettlement(id: string): void {
    const settlements = this.getSettlements().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));
    notifyRealtime('SETTLEMENT_DELETED');
  }

  /**
   * Strict Owner/Custodian Settlement Model:
   * Noman (the Owner & Custodian) is the sole custodian of the Common Fund.
   *
   * 1. All member deposits are collected by Noman and added to the Common Wallet.
   * 2. Common Fund expenses are deducted from the Common Wallet.
   * 3. Each expense is allocated only among its selected participants.
   * 4. Noman's own expense share is strictly deducted from his member balance.
   * 5. Personal pocket expenses paid by other members are credited to them.
   * 6. Common Wallet Cash is tracked separately from individual Member Net Balances.
   * 7. All settlement suggestions are Owner-centric (Roommates pay Noman; Noman reimburses Roommates).
   * 8. Noman's own payable or receivable balance is calculated correctly.
   * 9. No double-counting; reconciles strictly with the Common Wallet.
   */
  static calculateMonthlySummary(selectedMonth: string): MonthlyRegisterSummary {
    const room = this.getRoom();
    const members = this.getMembers();
    const custodian = this.getCustodian();

    const allDeposits = this.getDeposits().filter((d) => d.month === selectedMonth);
    const allExpenses = this.getExpenses().filter((e) => e.month === selectedMonth);
    const allSettlements = this.getSettlements().filter((s) => s.month === selectedMonth);

    // 1. Opening carry‑over from earlier months (Common Fund balance before this month)
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

    // 3. Build per‑member summaries
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

      // Member settlement reconciliation:
      // For roommates:
      // - settlementsPaid: Roommate paid Noman (offsets their debt towards 0)
      // - settlementsReceived: Roommate received reimbursement from Noman (offsets their credit towards 0)
      const settlementsPaid = allSettlements
        .filter((s) => s.payerMemberId === member.id)
        .reduce((acc, s) => acc + s.amount, 0);
      const settlementsReceived = allSettlements
        .filter((s) => s.payeeMemberId === member.id)
        .reduce((acc, s) => acc + s.amount, 0);

      let rawNet: number;
      if (isCustodian) {
        // Noman's own individual member standing:
        // Deposits + Personal Pocket Paid - Noman's Expense Share
        // (Settlements collected/disbursed on behalf of Common Wallet are kept separate in Common Wallet Cash)
        rawNet = memberDeposits + personalPocketPaid - expenseShare;
      } else {
        // Non-custodian roommate:
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ROOM, JSON.stringify(SEED_ROOM));
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(SEED_MEMBERS));
      localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(INITIAL_DEPOSITS));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
      localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, SEED_MEMBERS[0].id);
      localStorage.setItem(STORAGE_KEYS.SELECTED_MONTH, '2026-11');
      notifyRealtime('RESET');
    }
  }
}
