import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Room,
  RoomMember,
  Deposit,
  Expense,
  Settlement,
  MonthlyRegisterSummary,
  UserRole,
} from '../types';
import { RegisterStorage, subscribeToRegisterRealtime, getRegisterSyncStatus, RegisterSyncStatus } from '../lib/storage';
import { AuthService, AuthUser } from '../lib/auth';
import { getSupabaseClient } from '../lib/supabase';

interface RoomContextType {
  // Single Account Authentication
  authAccount: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Navigation: Maximum 2 pages
  activePage: 'register' | 'settings';
  setActivePage: (page: 'register' | 'settings') => void;

  // Month management
  selectedMonth: string; // 'YYYY-MM'
  setSelectedMonth: (month: string) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  autoMonthInfo: {
    month: string;
    isLastDay: boolean;
    isAutoStarted: boolean;
    currentCalendarMonth: string;
    nextMonth: string;
    lastDateOfMonth: number;
    todayDate: number;
    isSimulated: boolean;
  };
  setSimulatedDate: (dateStr: string | null) => void;

  // Room & Members
  room: Room;
  members: RoomMember[];
  activeUser: RoomMember;
  activeUserId: string;
  setActiveUserId: (id: string) => void;

  // Role permissions
  canEdit: boolean; // Single authorized account has full edit rights
  isOwner: boolean; // Single authorized account is owner/admin

  // Monthly Records
  monthExpenses: Expense[];
  monthDeposits: Deposit[];
  monthSettlements: Settlement[];
  monthSummary: MonthlyRegisterSummary;

  // Actions
  syncStatus: RegisterSyncStatus;
  syncNow: () => Promise<void>;

  addExpense: (data: {
    description: string;
    amount: number;
    expenseDate: string;
    paidByMemberId: string;
    paymentSource: 'common_fund' | 'personal_pocket';
    notes?: string;
    participantMemberIds?: string[];
  }) => void;
  updateExpense: (id: string, updates: Partial<Expense> & { participantMemberIds?: string[] }) => void;
  deleteExpense: (id: string) => void;

  addDeposit: (data: {
    memberId: string;
    amount: number;
    depositDate: string;
    notes?: string;
  }) => void;
  deleteDeposit: (id: string) => void;

  addSettlement: (data: {
    payerMemberId: string;
    payeeMemberId: string;
    amount: number;
    settlementDate: string;
    notes?: string;
  }) => void;
  deleteSettlement: (id: string) => void;

  updateMemberNames: (names: string[]) => void;
  updateMemberRole: (memberId: string, role: UserRole) => void;
  addMember: (
    name: string,
    role?: UserRole,
    email?: string,
    password?: string
  ) => Promise<{ success: boolean; member?: RoomMember; error?: string }>;
  removeMember: (
    memberId: string
  ) => Promise<{ success: boolean; deleted: boolean; deactivated: boolean; error?: string }>;
  updateRoom: (updates: Partial<Room>) => void;
  resetAll: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Single Account Auth state
  const [authAccount, setAuthAccount] = useState<AuthUser | null>(() => AuthService.getCurrentUser());
  const isAuthenticated = Boolean(authAccount);

  const login = async (email: string, password: string) => {
    const res = await AuthService.login(email, password);
    if (res.success && res.user) {
      setAuthAccount(res.user);
      await RegisterStorage.syncWithSupabase();
      const currentMembers = RegisterStorage.getMembers();
      const matched =
        currentMembers.find((m) => m.id === res.user?.id) ||
        currentMembers.find((m) => m.email.toLowerCase() === res.user?.email.toLowerCase());
      if (matched) {
        RegisterStorage.setActiveUserId(matched.id);
        setActiveUserIdState(matched.id);
      }
      refresh();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const logout = async () => {
    await AuthService.logout();
    setAuthAccount(null);
  };

  const [activePage, setActivePage] = useState<'register' | 'settings'>('register');
  const [selectedMonth, setSelectedMonthState] = useState<string>(() => RegisterStorage.getSelectedMonth());

  const [room, setRoom] = useState<Room>(() => RegisterStorage.getRoom());
  const [members, setMembers] = useState<RoomMember[]>(() => RegisterStorage.getMembers());
  const [activeUserId, setActiveUserIdState] = useState<string>(() => RegisterStorage.getActiveUserId());

  const [allExpenses, setAllExpenses] = useState<Expense[]>(() => RegisterStorage.getExpenses());
  const [allDeposits, setAllDeposits] = useState<Deposit[]>(() => RegisterStorage.getDeposits());
  const [allSettlements, setAllSettlements] = useState<Settlement[]>(() => RegisterStorage.getSettlements());

  const [autoMonthInfo, setAutoMonthInfo] = useState(() => RegisterStorage.getEffectiveAutoMonth());
  const [syncStatus, setSyncStatus] = useState<RegisterSyncStatus>(() => getRegisterSyncStatus());

  const [monthSummary, setMonthSummary] = useState<MonthlyRegisterSummary>(() =>
    RegisterStorage.calculateMonthlySummary(selectedMonth)
  );

  const refresh = useCallback(() => {
    const r = RegisterStorage.getRoom();
    const m = RegisterStorage.getMembers();
    const u = RegisterStorage.getActiveUserId();
    const autoInfo = RegisterStorage.getEffectiveAutoMonth();
    const curMonth = RegisterStorage.getSelectedMonth();
    const exp = RegisterStorage.getExpenses();
    const dep = RegisterStorage.getDeposits();
    const set = RegisterStorage.getSettlements();
    const summary = RegisterStorage.calculateMonthlySummary(curMonth);

    setRoom(r);
    setMembers(m);
    setActiveUserIdState(u);
    setAutoMonthInfo(autoInfo);
    setSelectedMonthState(curMonth);
    setAllExpenses(exp);
    setAllDeposits(dep);
    setAllSettlements(set);
    setMonthSummary(summary);
    setSyncStatus(getRegisterSyncStatus());
  }, []);

  const syncNow = useCallback(async () => {
    await RegisterStorage.syncWithSupabase();
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = subscribeToRegisterRealtime(() => {
      refresh();
    });

    // Initial cloud sync with Supabase on mount
    RegisterStorage.syncWithSupabase();

    // Sync whenever browser tab regains focus or becomes visible
    const handleFocus = () => {
      RegisterStorage.syncWithSupabase();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        RegisterStorage.syncWithSupabase();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Periodic background sync every 15 seconds for multi-device consistency
    const syncTimer = window.setInterval(() => {
      RegisterStorage.syncWithSupabase();
    }, 15 * 1000);

    return () => {
      unsub();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(syncTimer);
    };
  }, [refresh]);

  // Check every minute whether the auto month changed (e.g. midnight on the last date)
  useEffect(() => {
    const timer = window.setInterval(() => {
      const latest = RegisterStorage.getEffectiveAutoMonth();
      setAutoMonthInfo((prev) => {
        if (prev.month !== latest.month || prev.todayDate !== latest.todayDate) {
          // getSelectedMonth() advances once per rollover
          const cur = RegisterStorage.getSelectedMonth();
          setSelectedMonthState(cur);
          setMonthSummary(RegisterStorage.calculateMonthlySummary(cur));
          return latest;
        }
        return prev;
      });
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const setSelectedMonth = (month: string) => {
    RegisterStorage.setSelectedMonth(month);
    setSelectedMonthState(month);
    setMonthSummary(RegisterStorage.calculateMonthlySummary(month));
  };

  const setSimulatedDate = (dateStr: string | null) => {
    if (typeof window !== 'undefined') {
      if (dateStr) {
        localStorage.setItem('simple_register_simulated_date', dateStr);
      } else {
        localStorage.removeItem('simple_register_simulated_date');
      }
      const updatedAuto = RegisterStorage.getEffectiveAutoMonth();
      setAutoMonthInfo(updatedAuto);
      setSelectedMonth(updatedAuto.month);
    }
  };

  const goToPreviousMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    const newMonth = `${year}-${String(month).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const goToNextMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const newMonth = `${year}-${String(month).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const goToCurrentMonth = () => {
    const updatedAuto = RegisterStorage.getEffectiveAutoMonth();
    setAutoMonthInfo(updatedAuto);
    setSelectedMonth(updatedAuto.month);
  };

  const matchedMember = authAccount?.email
    ? members.find((m) => m.email.toLowerCase() === authAccount.email.toLowerCase()) ||
      members.find((m) => m.id === authAccount.id)
    : null;

  const activeUser: RoomMember = matchedMember
    ? {
        ...matchedMember,
        role: (authAccount?.role as UserRole) || matchedMember.role,
      }
    : authAccount
    ? {
        id: authAccount.id,
        roomId: room.id,
        name: authAccount.name,
        email: authAccount.email,
        role: (authAccount.role as UserRole) || 'viewer',
      }
    : members.find((m) => m.id === activeUserId) ||
      members[0] || {
        id: '10159410-71a4-4bb5-9f62-3d35b3635461',
        roomId: '2d87ab1f-e0f5-420b-9799-9bb215914da9',
        name: 'Noman',
        email: 'nomideveloper007@gmail.com',
        role: 'owner' as UserRole,
      };
  const canEdit = activeUser.role !== 'viewer';
  const isOwner = activeUser.role === 'owner';

  const setActiveUserId = (id: string) => {
    RegisterStorage.setActiveUserId(id);
    setActiveUserIdState(id);
  };

  const addExpense = (data: {
    description: string;
    amount: number;
    expenseDate: string;
    paidByMemberId: string;
    paymentSource: 'common_fund' | 'personal_pocket';
    notes?: string;
    participantMemberIds?: string[];
  }) => {
    if (!canEdit) {
      alert('View-only access: you do not have permission to add expenses.');
      return;
    }
    const expMonth = RegisterStorage.getRegisterMonthFor(data.expenseDate);
    if (expMonth && expMonth !== selectedMonth) {
      RegisterStorage.setSelectedMonth(expMonth);
      setSelectedMonthState(expMonth);
    }
    RegisterStorage.addExpense({
      ...data,
      createdBy: activeUser.id,
    });
    refresh();
  };

  const updateExpense = (
    id: string,
    updates: Partial<Expense> & { participantMemberIds?: string[] }
  ): void => {
    if (!canEdit) {
      alert('View-only access: you do not have permission to edit records.');
      return;
    }
    RegisterStorage.updateExpense(id, updates);
    refresh();
  };

  const deleteExpense = (id: string) => {
    if (!canEdit) {
      alert('View-only access: you do not have permission to delete records.');
      return;
    }
    RegisterStorage.deleteExpense(id);
    refresh();
  };

  const addDeposit = (data: {
    memberId: string;
    amount: number;
    depositDate: string;
    notes?: string;
  }) => {
    if (!canEdit) {
      alert('View-only access: you do not have permission to add deposits.');
      return;
    }
    const depMonth = RegisterStorage.getRegisterMonthFor(data.depositDate);
    if (depMonth && depMonth !== selectedMonth) {
      RegisterStorage.setSelectedMonth(depMonth);
      setSelectedMonthState(depMonth);
    }
    RegisterStorage.addDeposit({
      ...data,
      createdBy: activeUser.id,
    });
    refresh();
  };

  const deleteDeposit = (id: string) => {
    if (!canEdit) {
      alert('View-only access: you do not have permission to delete records.');
      return;
    }
    RegisterStorage.deleteDeposit(id);
    refresh();
  };

  const addSettlement = (data: {
    payerMemberId: string;
    payeeMemberId: string;
    amount: number;
    settlementDate: string;
    notes?: string;
  }) => {
    if (!canEdit) {
      alert('View-only access: you do not have permission to record settlements.');
      return;
    }
    RegisterStorage.addSettlement({
      ...data,
      month: RegisterStorage.getRegisterMonthFor(data.settlementDate),
      createdBy: activeUser.id,
    });
    refresh();
  };

  const deleteSettlement = (id: string) => {
    if (!canEdit) {
      alert('View-only access: you do not have permission to delete settlements.');
      return;
    }
    RegisterStorage.deleteSettlement(id);
    refresh();
  };

  const updateMemberNames = (names: string[]) => {
    if (!isOwner) {
      alert('Only the Owner can rename members.');
      return;
    }
    RegisterStorage.updateAllMemberNames(names);
    refresh();
  };

  const updateMemberRole = (memberId: string, role: UserRole) => {
    if (!isOwner) {
      alert('Only the Owner can manage user roles.');
      return;
    }
    const target = members.find((m) => m.id === memberId);
    RegisterStorage.updateMember(memberId, { role });

    if (target?.email) {
      AuthService.updateMemberRole(target.email, role);
    }
    refresh();
  };

  const addMember = async (
    name: string,
    role: UserRole = 'viewer',
    email?: string,
    password?: string
  ): Promise<{ success: boolean; member?: RoomMember; error?: string }> => {
    if (!isOwner) {
      return { success: false, error: 'Only the Owner can add roommates.' };
    }
    if (!name.trim()) {
      return { success: false, error: 'Please enter a roommate name.' };
    }
    const cleanEmail =
      email && email.trim()
        ? email.trim().toLowerCase()
        : `${name.trim().toLowerCase().replace(/\s+/g, '.')}@gmail.com`;

    const result = await RegisterStorage.addMember(name.trim(), role, cleanEmail);
    if (!result.member) {
      return { success: false, error: result.error || 'Could not add the roommate.' };
    }

    if (password && password.trim()) {
      await AuthService.saveMemberCredentials(
        result.member.id,
        result.member.name,
        cleanEmail,
        password.trim(),
        role
      );
    }
    refresh();
    return { success: true, member: result.member };
  };

  const removeMember = async (
    memberId: string
  ): Promise<{ success: boolean; deleted: boolean; deactivated: boolean; error?: string }> => {
    if (!isOwner) {
      return { success: false, deleted: false, deactivated: false, error: 'Only the Owner can remove roommates.' };
    }
    const current = RegisterStorage.getMembers();
    if (current.length <= 1) {
      return {
        success: false,
        deleted: false,
        deactivated: false,
        error: 'At least one roommate must remain in the register.',
      };
    }
    const target = current.find((m) => m.id === memberId);
    if (target?.role === 'owner') {
      return { success: false, deleted: false, deactivated: false, error: 'Cannot remove the Owner account.' };
    }

    if (target?.email) {
      AuthService.removeMemberCredentials(target.email);
    }

    const result = await RegisterStorage.removeMember(memberId);
    refresh();
    return { ...result, success: !result.error };
  };

  const updateRoom = (updates: Partial<Room>) => {
    if (!isOwner) {
      alert('Only the Owner can change room settings.');
      return;
    }
    RegisterStorage.updateRoom(updates);
    refresh();
  };

  const resetAll = () => {
    RegisterStorage.resetToDefault();
    refresh();
  };

  // Filter records for the selected month and sort chronologically ascending (oldest date first)
  const monthExpenses = allExpenses
    .filter((e) => e.month === selectedMonth)
    .sort(
      (a, b) =>
        (a.expenseDate || '').localeCompare(b.expenseDate || '') ||
        (a.createdAt || '').localeCompare(b.createdAt || '')
    );
  const monthDeposits = allDeposits
    .filter((d) => d.month === selectedMonth)
    .sort(
      (a, b) =>
        (a.depositDate || '').localeCompare(b.depositDate || '') ||
        (a.createdAt || '').localeCompare(b.createdAt || '')
    );
  const monthSettlements = allSettlements
    .filter((s) => s.month === selectedMonth)
    .sort(
      (a, b) =>
        (a.settlementDate || '').localeCompare(b.settlementDate || '') ||
        (a.createdAt || '').localeCompare(b.createdAt || '')
    );

  return (
    <RoomContext.Provider
      value={{
        authAccount,
        isAuthenticated,
        login,
        logout,
        activePage,
        setActivePage,
        selectedMonth,
        setSelectedMonth,
        goToPreviousMonth,
        goToNextMonth,
        goToCurrentMonth,
        autoMonthInfo,
        setSimulatedDate,
        room,
        members,
        activeUser,
        activeUserId,
        setActiveUserId,
        canEdit,
        isOwner,
        monthExpenses,
        monthDeposits,
        monthSettlements,
        monthSummary,
        syncStatus,
        syncNow,
        addExpense,
        updateExpense,
        deleteExpense,
        addDeposit,
        deleteDeposit,
        addSettlement,
        deleteSettlement,
        updateMemberNames,
        updateMemberRole,
        addMember,
        removeMember,
        updateRoom,
        resetAll,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = (): RoomContextType => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};
