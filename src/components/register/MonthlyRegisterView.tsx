import React, { useState, useMemo } from 'react';
import { useRoom } from '../../context/RoomContext';
import { formatCurrencyPKR } from '../../lib/export';
import { Expense, Deposit, SuggestedTransfer } from '../../types';
import confetti from 'canvas-confetti';
import {
  PlusCircle,
  ArrowDownCircle,
  Trash2,
  Edit2,
  Calendar,
  Wallet,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  X,
  CreditCard,
  FileSpreadsheet,
  Receipt,
  Users,
} from 'lucide-react';

interface DailyExpenseGroup {
  date: string;
  expenses: Expense[];
  totalAmount: number;
  totalCommonFund: number;
  totalPersonalPocket: number;
  memberShares: Record<string, number>;
  memberPaid: Record<string, number>;
}

function formatDateDisplay(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

export const MonthlyRegisterView: React.FC = () => {
  const {
    selectedMonth,
    autoMonthInfo,
    members,
    activeUser,
    canEdit,
    monthExpenses,
    monthDeposits,
    monthSummary,
    addExpense,
    updateExpense,
    deleteExpense,
    addDeposit,
    deleteDeposit,
    addSettlement,
  } = useRoom();

  // Modals state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddDepositOpen, setIsAddDepositOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingDate, setViewingDate] = useState<string | null>(null);

  // Form states for Add Expense
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => `${selectedMonth}-05`);
  const [paidByMemberId, setPaidByMemberId] = useState(members[0]?.id || '');
  const [paymentSource, setPaymentSource] = useState<'common_fund' | 'personal_pocket'>('common_fund');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(() => members.map((m) => m.id));

  // Form states for Add Deposit
  const [depositMemberId, setDepositMemberId] = useState(members[0]?.id || '');
  const [depositAmount, setDepositAmount] = useState('15000');
  const [depositDate, setDepositDate] = useState(() => `${selectedMonth}-01`);
  const [depositNotes, setDepositNotes] = useState('');

  // Form states for Edit Expense
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPayer, setEditPayer] = useState('');
  const [editSource, setEditSource] = useState<'common_fund' | 'personal_pocket'>('common_fund');
  const [editParticipants, setEditParticipants] = useState<string[]>([]);

  // Toggle participant helpers
  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllParticipants = () => {
    setSelectedParticipants(members.map((m) => m.id));
  };

  const toggleEditParticipant = (memberId: string) => {
    setEditParticipants((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllEditParticipants = () => {
    setEditParticipants(members.map((m) => m.id));
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!desc.trim() || !val || val <= 0) return;
    if (selectedParticipants.length === 0) return;

    addExpense({
      description: desc.trim(),
      amount: val,
      expenseDate,
      paidByMemberId,
      paymentSource,
      participantMemberIds: selectedParticipants,
    });

    setDesc('');
    setAmount('');
    setSelectedParticipants(members.map((m) => m.id));
    setIsAddExpenseOpen(false);
  };

  const handleAddDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(depositAmount);
    if (!val || val <= 0) return;

    addDeposit({
      memberId: depositMemberId,
      amount: val,
      depositDate,
      notes: depositNotes.trim() || undefined,
    });

    setIsAddDepositOpen(false);
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setEditDesc(exp.description);
    setEditAmount(exp.amount.toString());
    setEditDate(exp.expenseDate);
    setEditPayer(exp.paidByMemberId);
    setEditSource(exp.paymentSource);
    const existingParts =
      exp.participantMemberIds && exp.participantMemberIds.length > 0
        ? exp.participantMemberIds
        : exp.shares && exp.shares.some((s) => s.shareAmount > 0)
        ? exp.shares.filter((s) => s.shareAmount > 0).map((s) => s.memberId)
        : members.map((m) => m.id);
    setEditParticipants(existingParts);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const val = parseFloat(editAmount);
    if (!editDesc.trim() || !val || val <= 0) return;
    if (editParticipants.length === 0) return;

    updateExpense(editingExpense.id, {
      description: editDesc.trim(),
      amount: val,
      expenseDate: editDate,
      paidByMemberId: editPayer,
      paymentSource: editSource,
      participantMemberIds: editParticipants,
    });
    setEditingExpense(null);
  };

  const handleSettle = (t: SuggestedTransfer) => {
    addSettlement({
      payerMemberId: t.fromMemberId,
      payeeMemberId: t.toMemberId,
      amount: t.amount,
      settlementDate: new Date().toISOString().slice(0, 10),
      notes: 'Settled in RoomLedger register',
    });

    try {
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
    } catch {
      // ignore
    }
  };

  // Format month name for display
  const [yearStr, monthStr] = selectedMonth.split('-');
  const monthDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const formattedMonth = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Group all expenses of this month by date, sorted ascending chronologically (oldest date first)
  const dailyGroups: DailyExpenseGroup[] = useMemo(() => {
    const map = new Map<string, Expense[]>();

    monthExpenses.forEach((exp) => {
      const list = map.get(exp.expenseDate) || [];
      list.push(exp);
      map.set(exp.expenseDate, list);
    });

    // Ascending chronological order (oldest date first)
    const sortedDates = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

    return sortedDates.map((date) => {
      const expenses = map.get(date) || [];
      const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

      let totalCommonFund = 0;
      let totalPersonalPocket = 0;
      const memberPaid: Record<string, number> = {};
      const memberShares: Record<string, number> = {};

      members.forEach((m) => {
        memberPaid[m.id] = 0;
        memberShares[m.id] = 0;
      });

      expenses.forEach((e) => {
        if (e.paymentSource === 'common_fund' || (e as any).paymentSource === 'common_wallet') {
          totalCommonFund += e.amount;
        } else {
          totalPersonalPocket += e.amount;
        }

        // Payer credit
        if (e.paymentSource === 'personal_pocket') {
          memberPaid[e.paidByMemberId] = (memberPaid[e.paidByMemberId] || 0) + e.amount;
        }

        // Member shares
        members.forEach((m) => {
          const shareObj = e.shares?.find((s) => s.memberId === m.id);
          if (shareObj) {
            memberShares[m.id] = (memberShares[m.id] || 0) + shareObj.shareAmount;
          } else if (e.participantMemberIds && e.participantMemberIds.length > 0) {
            if (e.participantMemberIds.includes(m.id)) {
              memberShares[m.id] =
                (memberShares[m.id] || 0) +
                Math.round((e.amount / e.participantMemberIds.length) * 100) / 100;
            }
          } else {
            memberShares[m.id] =
              (memberShares[m.id] || 0) + Math.round((e.amount / 5) * 100) / 100;
          }
        });
      });

      // Round to 2 decimal places
      members.forEach((m) => {
        memberShares[m.id] = Math.round((memberShares[m.id] || 0) * 100) / 100;
        memberPaid[m.id] = Math.round((memberPaid[m.id] || 0) * 100) / 100;
      });

      return {
        date,
        expenses,
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalCommonFund: Math.round(totalCommonFund * 100) / 100,
        totalPersonalPocket: Math.round(totalPersonalPocket * 100) / 100,
        memberShares,
        memberPaid,
      };
    });
  }, [monthExpenses, members]);

  const activeDateGroup = dailyGroups.find((g) => g.date === viewingDate);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Month-End Transition Notification if today is the last date and new month was auto-started */}
      {autoMonthInfo?.isLastDay && selectedMonth === autoMonthInfo.nextMonth && (
        <div className="p-3.5 sm:p-4 bg-[#EFF6FF] border border-[#93C5FD] rounded-2xl text-xs sm:text-sm text-[#1E40AF] flex items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#2563EB] text-white rounded-xl shrink-0 shadow-xs">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div>
              <span className="font-bold text-xs sm:text-sm text-[#142B4A] block">
                Month-End Auto Transition: {formattedMonth} Register has Automatically Started!
              </span>
              <span className="text-[11px] sm:text-xs text-[#3B82F6] block mt-0.5">
                Aaj pichlay maheene ki aakhri tareekh (Day {autoMonthInfo.lastDateOfMonth}) hai, is liye agla maheena ({formattedMonth}) register mein khud-bakhud start ho chuka hai. Pichla balance ({formatCurrencyPKR(monthSummary.openingCarryOverBalance || 0)}) common wallet mein mehfooz carryover ho gaya hai.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner: Month Summary & Core Numbers (Premium Linear Gradient Background) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0C192E] via-[#132847] to-[#0F1F38] border border-[#233C64] p-4 sm:p-6 shadow-xl shadow-slate-950/10 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        
        {/* Subtle decorative mesh gradient glows */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/4 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.04] pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>Household Monthly Ledger</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-1.5 drop-shadow-xs">
            {formattedMonth} Register
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
            <span>Equal {members.length}-way division for shared expenses</span>
            <span className="text-slate-500 hidden sm:inline">•</span>
            <span className="text-blue-300 font-semibold font-mono">Pakistani Rupee (PKR)</span>
          </p>
        </div>

        {/* 3 Core Monthly Financial Cards with Frosted Glass look */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 w-full lg:w-auto">
          {/* Card 1: Common Wallet Cash */}
          <div className="p-3 sm:p-3.5 bg-white/[0.06] hover:bg-white/[0.09] transition-colors rounded-xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-300 font-medium block">Common Wallet Cash</span>
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            </div>
            <span
              className={`text-xl sm:text-2xl font-bold font-mono tabular-nums block mt-0.5 ${
                monthSummary.commonFundBalance >= 0 ? 'text-blue-400' : 'text-rose-400'
              }`}
            >
              {formatCurrencyPKR(monthSummary.commonFundBalance)}
            </span>
            {Boolean(monthSummary.openingCarryOverBalance && monthSummary.openingCarryOverBalance > 0) && (
              <span
                className="text-[10px] text-blue-200/90 font-sans block mt-0.5 truncate"
                title={`Rs. ${(monthSummary.openingCarryOverBalance || 0).toLocaleString()} carried over from earlier months`}
              >
                +{formatCurrencyPKR(monthSummary.openingCarryOverBalance || 0)} prev. carryover
              </span>
            )}
          </div>

          {/* Card 2: Total Deposited */}
          <div className="p-3 sm:p-3.5 bg-white/[0.06] hover:bg-white/[0.09] transition-colors rounded-xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-300 font-medium block">Total Deposited</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            </div>
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tabular-nums block mt-0.5">
              {formatCurrencyPKR(monthSummary.totalDeposited)}
            </span>
          </div>

          {/* Card 3: Total Expenses */}
          <div className="p-3 sm:p-3.5 bg-white/[0.06] hover:bg-white/[0.09] transition-colors rounded-xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-300 font-medium block">Total Expenses</span>
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
            </div>
            <span className="text-xl sm:text-2xl font-bold font-mono text-rose-400 tabular-nums block mt-0.5">
              {formatCurrencyPKR(monthSummary.totalExpenses)}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: THE NOTEBOOK-STYLE EXPENSE REGISTER (ONE MAIN ROW PER DATE)
          ===================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-3.5 sm:p-5 bg-[#142B4A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
              <span>Monthly Expense Register</span>
              <span className="text-[10px] sm:text-xs font-medium text-slate-200 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
                {dailyGroups.length} {dailyGroups.length === 1 ? 'date' : 'dates'} · {monthExpenses.length} {monthExpenses.length === 1 ? 'expense' : 'expenses'}
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
              One main row per calendar date · Ascending chronological order
            </p>
          </div>

          {/* Action buttons: 2 equal touch targets on mobile — hidden for viewers */}
          {canEdit && (
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddDepositOpen(true)}
                className="px-3 py-2.5 sm:px-3.5 sm:py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-white/10 hover:bg-white/20 text-white border border-white/20 min-h-[42px] touch-manipulation"
              >
                <ArrowDownCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span>+ Deposit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExpenseDate(`${selectedMonth}-05`);
                  setIsAddExpenseOpen(true);
                }}
                className="px-3 py-2.5 sm:px-4 sm:py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer bg-[#2563EB] hover:bg-[#1D4ED8] text-white min-h-[42px] touch-manipulation"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>+ Add Expense</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Swipe Hint */}
        <div className="lg:hidden px-3.5 py-1.5 bg-[#F5F8FF] border-b border-[#E2E8F0] text-[11px] text-[#2563EB] font-medium flex items-center justify-between select-none">
          <span>👈 Swipe table to view all {members.length} roommates 👉</span>
          <span className="font-bold text-[#142B4A]">{members.length} Members</span>
        </div>

        {/* The Notebook Table with Sticky Date Column */}
        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Table Column Headers (Deep Navy #142B4A) */}
              <tr className="bg-[#142B4A] text-white border-b border-[#1E3A5F]">
                {/* Sticky Date Header */}
                <th className="sticky left-0 z-20 bg-[#142B4A] py-2.5 sm:py-3 px-2 sm:px-4 font-semibold uppercase tracking-wider w-[115px] min-w-[115px] max-w-[115px] sm:w-[240px] sm:min-w-[240px] sm:max-w-[280px] border-r border-[#1E3A5F] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.25)] text-[10px] sm:text-xs">
                  <div className="leading-tight break-words">
                    Date &amp; Purchased Items
                  </div>
                </th>
                {members.map((m) => (
                  <th
                    key={m.id}
                    className="py-3 px-2.5 sm:px-3 font-semibold text-center border-r border-[#1E3A5F] min-w-[105px] sm:min-w-[120px]"
                  >
                    <div className="truncate text-white font-bold">{m.name}</div>
                    <div className="text-[10px] text-slate-300 font-normal">Daily Share</div>
                  </th>
                ))}
                <th className="py-3 px-2.5 sm:px-3 font-semibold text-center border-r border-[#1E3A5F] min-w-[110px] sm:min-w-[125px]">
                  Daily Total
                </th>
                <th className="py-3 px-2 sm:px-3 font-semibold text-center min-w-[70px] sm:min-w-[80px]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E2E8F0]">
              {dailyGroups.length === 0 ? (
                <tr>
                  <td
                    colSpan={members.length + 3}
                    className="py-12 text-center text-[#64748B] italic text-xs bg-[#F7F9FC]"
                  >
                    No expense entries recorded for {formattedMonth}. Click "+ Add Expense" to record one.
                  </td>
                </tr>
              ) : (
                dailyGroups.map((group) => {
                  return (
                    <tr
                      key={group.date}
                      className="group bg-white hover:bg-[#F5F8FF] transition-colors border-b border-[#E2E8F0]"
                    >
                      {/* 1. Date & Expense Details Column — Sticky Left on horizontal scroll */}
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F5F8FF] py-2.5 sm:py-3 px-2 sm:px-4 border-r border-[#E2E8F0] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)] w-[115px] min-w-[115px] max-w-[115px] sm:w-[240px] sm:min-w-[240px] sm:max-w-[280px] align-middle transition-colors">
                        <div className="w-full max-w-full overflow-hidden">
                          {/* Day and Date display + Expense count */}
                          <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-[#E2E8F0]/70">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[#142B4A] text-[11px] sm:text-sm flex items-center gap-1 leading-tight">
                                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#2563EB] shrink-0" />
                                <span className="truncate">{formatDateDisplay(group.date)}</span>
                              </div>
                              <div className="text-[9px] sm:text-[11px] font-mono text-[#64748B] mt-0.5 truncate">
                                {group.date}
                              </div>
                            </div>

                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#CBD5E1]/60 shrink-0"
                              title={`${group.expenses.length} expense${group.expenses.length === 1 ? '' : 's'}`}
                            >
                              {group.expenses.length}
                            </span>
                          </div>

                          {/* Purchased Items description / snippet */}
                          {group.expenses.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {group.expenses.slice(0, 2).map((exp) => (
                                <div
                                  key={exp.id}
                                  className="text-[10px] sm:text-[11px] text-[#475569] font-medium truncate block max-w-full"
                                  title={exp.description}
                                >
                                  <span className="text-[#94A3B8] mr-1">•</span>
                                  <span className="truncate">{exp.description}</span>
                                </div>
                              ))}
                              {group.expenses.length > 2 && (
                                <div className="text-[9px] text-[#2563EB] font-medium truncate pl-2">
                                  +{group.expenses.length - 2} more
                                </div>
                              )}
                            </div>
                          )}

                          {/* Single button to View Expenses modal */}
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => setViewingDate(group.date)}
                              className="w-full py-1 sm:py-1.5 px-1.5 sm:px-3 bg-[#EFF6FF] hover:bg-[#2563EB] text-[#2563EB] hover:text-white font-semibold text-[10px] sm:text-xs rounded-lg border border-[#CBD5E1]/60 shadow-2xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer min-h-[30px] sm:min-h-[34px] touch-manipulation"
                              title={`View expenses for ${group.date}`}
                            >
                              <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                              <span className="sm:hidden truncate">View ({group.expenses.length})</span>
                              <span className="hidden sm:inline">View Expenses ({group.expenses.length})</span>
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 5 Member Columns: Daily Combined Share for that Date */}
                      {members.map((m) => {
                        const dailyShare = group.memberShares[m.id] || 0;
                        const dailyPaid = group.memberPaid[m.id] || 0;

                        return (
                          <td
                            key={m.id}
                            className={`py-3 px-2.5 sm:px-3 border-r border-[#E2E8F0] text-center align-top min-w-[105px] sm:min-w-[120px] ${
                              dailyPaid > 0 ? 'bg-[#F5F8FF]' : ''
                            }`}
                          >
                            <div className="pt-1">
                              {dailyShare > 0 ? (
                                <div>
                                  <div className="text-xs sm:text-sm font-bold font-mono text-[#172B4D] tabular-nums whitespace-nowrap">
                                    {formatCurrencyPKR(dailyShare)}
                                  </div>
                                  <div className="text-[9px] sm:text-[10px] text-[#94A3B8] font-medium mt-0.5">
                                    Daily Share
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[#CBD5E1] font-mono text-xs py-1">—</div>
                              )}
                            </div>

                            {/* Paid indicator if this member paid anything on this date */}
                            {dailyPaid > 0 && (
                              <div className="mt-1.5 pt-1 border-t border-[#E2E8F0]">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-[#EFF6FF] border border-[#CBD5E1] text-[#142B4A] text-[9px] sm:text-[10px] font-bold font-mono whitespace-nowrap">
                                  Paid {formatCurrencyPKR(dailyPaid)}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Payment Source & Daily Total Column */}
                      <td className="py-3 px-2.5 sm:px-3 border-r border-[#E2E8F0] text-center align-top whitespace-nowrap min-w-[110px] sm:min-w-[125px]">
                        <div className="pt-1 font-bold font-mono text-xs sm:text-sm text-[#142B4A] tabular-nums">
                          {formatCurrencyPKR(group.totalAmount)}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-[#94A3B8] font-medium mt-0.5">
                          Daily Total
                        </div>

                        <div className="mt-1.5 space-y-1">
                          {group.totalCommonFund > 0 && (
                            <div className="text-[9px] sm:text-[10px] font-semibold text-[#2563EB] bg-[#EFF6FF] border border-[#CBD5E1]/60 rounded px-1.5 py-0.5">
                              Common: {formatCurrencyPKR(group.totalCommonFund)}
                            </div>
                          )}
                          {group.totalPersonalPocket > 0 && (
                            <div className="text-[9px] sm:text-[10px] font-semibold text-[#172B4D] bg-[#F1F5F9] border border-[#CBD5E1]/60 rounded px-1.5 py-0.5">
                              Pocket: {formatCurrencyPKR(group.totalPersonalPocket)}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3 px-2 sm:px-3 text-center align-middle whitespace-nowrap min-w-[70px] sm:min-w-[80px]">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpenseDate(group.date);
                              setIsAddExpenseOpen(true);
                            }}
                            title={`Add another expense on ${group.date}`}
                            className="px-2 py-1 text-[11px] font-semibold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#2563EB] hover:text-white border border-[#CBD5E1]/60 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer min-h-[30px] touch-manipulation"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>+ Add</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Total Row with Sticky Date Total Column */}
            <tfoot>
              <tr className="bg-[#142B4A] text-white font-bold border-t-2 border-[#1E3A5F]">
                <td className="sticky left-0 z-20 bg-[#142B4A] py-3 sm:py-3.5 px-2 sm:px-4 border-r border-[#1E3A5F] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.25)] w-[115px] min-w-[115px] max-w-[115px] sm:w-[240px] sm:min-w-[240px] sm:max-w-[280px]">
                  <span className="text-white font-bold uppercase tracking-wider text-[10px] sm:text-xs block leading-tight">
                    Register Total
                  </span>
                </td>
                {members.map((m) => {
                  const memberTotal = dailyGroups.reduce((acc, g) => acc + (g.memberShares[m.id] || 0), 0);
                  return (
                    <td key={m.id} className="py-3.5 px-2.5 sm:px-3 text-center font-mono border-r border-[#1E3A5F] tabular-nums whitespace-nowrap min-w-[105px] sm:min-w-[120px]">
                      <div className="text-xs sm:text-sm font-bold text-white">{formatCurrencyPKR(Math.round(memberTotal * 100) / 100)}</div>
                    </td>
                  );
                })}
                <td className="py-3.5 px-2.5 sm:px-3 text-center font-mono border-r border-[#1E3A5F] tabular-nums whitespace-nowrap min-w-[110px] sm:min-w-[125px]">
                  <div className="text-xs sm:text-sm font-bold text-white">
                    {formatCurrencyPKR(dailyGroups.reduce((acc, g) => acc + g.totalAmount, 0))}
                  </div>
                </td>
                <td className="py-3.5 px-2 sm:px-3 text-center text-slate-300 font-mono text-[11px] min-w-[70px] sm:min-w-[80px]">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* =====================================================================
          SECTION 2: MONEY DEPOSIT RECORDS FOR THIS MONTH
          ===================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-3.5 sm:p-5 bg-[#142B4A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-[#16A34A]" />
              <span>Money Deposit Records — {formattedMonth}</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
              Tracks member contributions credited into the Common Wallet
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAddDepositOpen(true)}
              className="px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors min-h-[38px] self-start sm:self-auto touch-manipulation"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Add Deposit</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F1F5F9] text-[#172B4D] border-b border-[#E2E8F0]">
                <th className="py-2.5 px-3 sm:px-4 font-semibold min-w-[95px]">Date</th>
                <th className="py-2.5 px-3 sm:px-4 font-semibold min-w-[110px]">Member Name</th>
                <th className="py-2.5 px-3 sm:px-4 font-semibold min-w-[130px]">Notes</th>
                <th className="py-2.5 px-3 sm:px-4 font-semibold text-right min-w-[115px]">Amount Deposited</th>
                <th className="py-2.5 px-2 sm:px-4 font-semibold text-center w-16 min-w-[50px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {monthDeposits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#64748B] italic text-xs bg-[#F7F9FC]">
                    No deposits recorded yet for {formattedMonth}.
                  </td>
                </tr>
              ) : (
                monthDeposits.map((dep) => {
                  const memberName = members.find((m) => m.id === dep.memberId)?.name || 'Member';
                  return (
                    <tr key={dep.id} className="hover:bg-[#F5F8FF] transition-colors">
                      <td className="py-2.5 px-3 sm:px-4 font-mono text-[#64748B] text-[11px] sm:text-xs">{dep.depositDate}</td>
                      <td className="py-2.5 px-3 sm:px-4 font-bold text-[#142B4A]">{memberName}</td>
                      <td className="py-2.5 px-3 sm:px-4 text-[#64748B]">{dep.notes || 'Monthly Contribution'}</td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono font-bold text-[#16A34A] tabular-nums">
                        +{formatCurrencyPKR(dep.amount)}
                      </td>
                      <td className="py-2.5 px-2 sm:px-4 text-center">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete deposit record of ${formatCurrencyPKR(dep.amount)} for ${memberName}?`)) {
                                deleteDeposit(dep.id);
                              }
                            }}
                            title="Delete Deposit"
                            className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] rounded cursor-pointer transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center mx-auto"
                            aria-label={`Delete deposit for ${memberName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          SECTION 3: MONTHLY FINAL SUMMARY TABLE (HISAB / BALANCES)
          ===================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-3.5 sm:p-5 bg-[#142B4A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#1E3A5F]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#2563EB]" />
              <span>Monthly Final Settlement Summary (Hisab)</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
              Net Balance = Total Deposited + Personal Pocket Paid - Total Expense Share
            </p>
          </div>

          <div className="text-[11px] sm:text-xs text-slate-300 bg-white/10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-white/15 font-mono self-start sm:self-auto">
            Wallet Cash Left: <strong className="text-white font-bold">{formatCurrencyPKR(monthSummary.commonFundBalance)}</strong>
          </div>
        </div>

        {/* Mobile Swipe Hint */}
        <div className="lg:hidden px-3.5 py-1.5 bg-[#F5F8FF] border-b border-[#E2E8F0] text-[11px] text-[#2563EB] font-medium flex items-center justify-between select-none">
          <span>👈 Swipe table to view all balances</span>
          <span className="font-bold text-[#142B4A]">{members.length} Members</span>
        </div>

        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F1F5F9] text-[#172B4D] border-b border-[#CBD5E1]">
                <th className="sticky left-0 z-20 bg-[#F1F5F9] py-3 px-3 sm:px-4 font-semibold border-r border-[#CBD5E1] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)] min-w-[110px] sm:min-w-[130px]">
                  Member Name
                </th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-right border-r border-[#CBD5E1] min-w-[105px]">Total Deposited</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-right border-r border-[#CBD5E1] min-w-[105px]">Personal Paid</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-right border-r border-[#CBD5E1] min-w-[105px]">Expense Share</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-right border-r border-[#CBD5E1] min-w-[105px]">Net Balance</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-right text-[#DC2626] border-r border-[#CBD5E1] bg-[#FEF2F2] min-w-[110px]">Amount to Pay</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-right text-[#16A34A] bg-[#F0FDF4] min-w-[110px]">Amount to Receive</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E2E8F0]">
              {monthSummary.memberSummaries.map((s) => {
                const pays = s.amountToPay > 0;
                const receives = s.amountToReceive > 0;

                return (
                  <tr key={s.member.id} className="group hover:bg-[#F5F8FF] transition-colors">
                    {/* Sticky Member Name */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F5F8FF] py-3 px-3 sm:px-4 font-bold text-[#142B4A] border-r border-[#E2E8F0] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)] text-xs sm:text-sm min-w-[110px] sm:min-w-[130px] transition-colors">
                      {s.member.name}
                    </td>

                    {/* Total Deposited */}
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-semibold text-[#172B4D] border-r border-[#E2E8F0] tabular-nums min-w-[105px]">
                      {formatCurrencyPKR(s.totalDeposited)}
                    </td>

                    {/* Personal Expenses Paid */}
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-semibold text-[#2563EB] border-r border-[#E2E8F0] tabular-nums min-w-[105px]">
                      {formatCurrencyPKR(s.personalExpensesPaid)}
                    </td>

                    {/* Total Expense Share */}
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-semibold text-[#64748B] border-r border-[#E2E8F0] tabular-nums min-w-[105px]">
                      {formatCurrencyPKR(s.totalExpenseShare)}
                    </td>

                    {/* Net Balance */}
                    <td
                      className={`py-3 px-3 sm:px-4 text-right font-mono font-extrabold border-r border-[#E2E8F0] tabular-nums min-w-[105px] ${
                        receives ? 'text-[#16A34A]' : pays ? 'text-[#DC2626]' : 'text-[#64748B]'
                      }`}
                    >
                      {formatCurrencyPKR(s.netBalance)}
                    </td>

                    {/* Amount to Pay (Red) */}
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-[#DC2626] border-r border-[#E2E8F0] bg-[#FEF2F2]/80 tabular-nums min-w-[110px]">
                      {pays ? formatCurrencyPKR(s.amountToPay) : '—'}
                    </td>

                    {/* Amount to Receive (Green) */}
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-[#16A34A] bg-[#F0FDF4]/80 tabular-nums min-w-[110px]">
                      {receives ? formatCurrencyPKR(s.amountToReceive) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Total Row */}
            <tfoot>
              <tr className="bg-[#142B4A] text-white font-bold border-t-2 border-[#1E3A5F]">
                <td className="sticky left-0 z-20 bg-[#142B4A] py-3 px-3 sm:px-4 border-r border-[#1E3A5F] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.25)] min-w-[110px] sm:min-w-[130px]">
                  Total
                </td>
                <td className="py-3 px-3 sm:px-4 text-right font-mono border-r border-[#1E3A5F] tabular-nums min-w-[105px]">
                  {formatCurrencyPKR(monthSummary.totalDeposited)}
                </td>
                <td className="py-3 px-3 sm:px-4 text-right font-mono border-r border-[#1E3A5F] tabular-nums min-w-[105px]">
                  {formatCurrencyPKR(monthSummary.personalExpenses)}
                </td>
                <td className="py-3 px-3 sm:px-4 text-right font-mono border-r border-[#1E3A5F] tabular-nums min-w-[105px]">
                  {formatCurrencyPKR(monthSummary.totalExpenses)}
                </td>
                <td className="py-3 px-3 sm:px-4 text-right font-mono border-r border-[#1E3A5F] tabular-nums text-blue-300 min-w-[105px]">
                  {formatCurrencyPKR(monthSummary.commonFundBalance)}
                </td>
                <td className="py-3 px-3 sm:px-4 text-right font-mono border-r border-[#1E3A5F] text-rose-300 tabular-nums min-w-[110px]">
                  {formatCurrencyPKR(
                    monthSummary.memberSummaries.reduce((acc, m) => acc + m.amountToPay, 0)
                  )}
                </td>
                <td className="py-3 px-3 sm:px-4 text-right font-mono text-emerald-300 tabular-nums min-w-[110px]">
                  {formatCurrencyPKR(
                    monthSummary.memberSummaries.reduce((acc, m) => acc + m.amountToReceive, 0)
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* =====================================================================
          SECTION 4: FINAL SETTLEMENT INSTRUCTIONS ("WHO OWES WHOM")
          ===================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3 sm:space-y-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[#142B4A] flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#2563EB]" />
            <span>Settlement Instructions — Who Owes Whom</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5">
            Calculated automatically to settle all {members.length} roommates with minimal transfers.
          </p>
        </div>

        {monthSummary.suggestedTransfers.length === 0 ? (
          <div className="p-4 sm:p-5 bg-[#F0FDF4] rounded-xl border border-[#16A34A]/30 text-center">
            <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-[#16A34A] mx-auto mb-1.5" />
            <div className="text-xs sm:text-sm font-bold text-[#142B4A]">
              All {members.length} Roommates are Completely Settled for {formattedMonth}!
            </div>
            <div className="text-[11px] sm:text-xs text-[#16A34A] mt-0.5 font-medium">
              Nobody owes any money. The register balances out to zero.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {monthSummary.suggestedTransfers.map((t, idx) => (
              <div
                key={idx}
                className="p-3.5 sm:p-4 bg-[#F7F9FC] rounded-xl border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="text-xs leading-relaxed">
                  <span className="font-extrabold text-[#DC2626] text-xs sm:text-sm">{t.fromMemberName}</span>
                  <span className="text-[#64748B] font-medium mx-1.5">should pay</span>
                  <span className="font-extrabold text-[#16A34A] text-xs sm:text-sm">{t.toMemberName}</span>
                  <div className="text-sm sm:text-base font-bold font-mono text-[#142B4A] mt-0.5">
                    {formatCurrencyPKR(t.amount)}
                  </div>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleSettle(t)}
                    className="w-full sm:w-auto px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] touch-manipulation"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Settled</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =====================================================================
          DATE EXPENSES MODAL
          Opens when clicking "View Expenses (N)" in the Expense Details column
          ===================================================================== */}
      {viewingDate && activeDateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 bg-[#142B4A] text-white flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="text-sm sm:text-base font-bold flex items-center gap-1.5 sm:gap-2 truncate">
                  <Calendar className="w-4 h-4 text-[#2563EB] shrink-0" />
                  <span className="truncate">Expenses on {formatDateDisplay(viewingDate)}</span>
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5 font-mono truncate">
                  {viewingDate} · {activeDateGroup.expenses.length} recorded · Total: {formatCurrencyPKR(activeDateGroup.totalAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingDate(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Expenses List */}
            <div className="p-3.5 sm:p-5 space-y-3 flex-1 overflow-y-auto bg-[#F7F9FC]">
              {activeDateGroup.expenses.map((exp, idx) => {
                const payer = members.find((m) => m.id === exp.paidByMemberId)?.name || 'Member';
                const isCommon = exp.paymentSource === 'common_fund';
                const partCount = exp.participantMemberIds?.length || 5;
                const isAllMembers = partCount === members.length;
                const partNames = members
                  .filter((m) => exp.participantMemberIds?.includes(m.id))
                  .map((m) => m.name)
                  .join(', ');
                const sharePerPerson = Math.round((exp.amount / partCount) * 100) / 100;

                return (
                  <div
                    key={exp.id}
                    className="p-3.5 sm:p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs hover:border-[#CBD5E1] transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs sm:text-sm text-[#142B4A] flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#EFF6FF] text-[#2563EB] font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="break-words font-semibold">{exp.description}</span>
                        </div>

                        <div className="mt-1.5 flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
                          <span className="font-mono font-extrabold text-[#142B4A] text-sm">
                            {formatCurrencyPKR(exp.amount)}
                          </span>
                          <span className="text-[#CBD5E1]">•</span>
                          <span className="text-[#64748B] text-[11px] sm:text-xs">
                            Paid by <strong className="text-[#142B4A]">{payer}</strong>
                          </span>
                          <span className="text-[#CBD5E1]">•</span>
                          <span
                            className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold ${
                              isCommon
                                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#CBD5E1]/60'
                                : 'bg-[#F1F5F9] text-[#142B4A] border border-[#CBD5E1]/60'
                            }`}
                          >
                            {isCommon ? 'Common Fund' : 'Personal Pocket'}
                          </span>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setViewingDate(null);
                              handleOpenEdit(exp);
                            }}
                            title={`Edit "${exp.description}"`}
                            className="p-1.5 sm:p-2 text-[#64748B] hover:text-[#2563EB] hover:bg-[#F1F5F9] rounded-lg border border-[#E2E8F0] transition-colors cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center"
                            aria-label={`Edit ${exp.description}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete expense "${exp.description}" (${formatCurrencyPKR(exp.amount)})?`
                                )
                              ) {
                                deleteExpense(exp.id);
                              }
                            }}
                            title={`Delete "${exp.description}"`}
                            className="p-1.5 sm:p-2 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg border border-[#E2E8F0] transition-colors cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center"
                            aria-label={`Delete ${exp.description}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Shared members breakdown */}
                    <div className="pt-2 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] sm:text-xs text-[#64748B]">
                      <div>
                        <span className="font-medium text-[#172B4D]">Shared by ({partCount}): </span>
                        {isAllMembers ? (
                          <span className="text-[#64748B] font-medium">All {members.length} members</span>
                        ) : (
                          <span className="text-[#2563EB] font-semibold">{partNames}</span>
                        )}
                      </div>
                      <div className="font-mono text-[#142B4A]">
                        Share: <strong className="text-[#2563EB]">{formatCurrencyPKR(sharePerPerson)}</strong> / person
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-white border-t border-[#E2E8F0] shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setExpenseDate(viewingDate);
                    setViewingDate(null);
                    setIsAddExpenseOpen(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#2563EB] hover:text-white border border-[#CBD5E1]/60 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[42px] touch-manipulation"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Add Another Expense for this Date</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setViewingDate(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#334155] hover:text-[#172B4D] bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-lg transition-colors cursor-pointer min-h-[42px] flex items-center justify-center touch-manipulation"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD EXPENSE MODAL
          ===================================================================== */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3.5 sm:p-4 bg-[#142B4A] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold">Add Expense to Register</h3>
                <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5">{formattedMonth}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
                {/* 1. What was purchased? */}
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    1. What was purchased?
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="e.g. Atta 20kg & Cooking Oil, Breakfast, Dinner"
                    className="w-full px-3 py-2.5 text-sm border border-[#CBD5E1] rounded-lg text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all min-h-[44px]"
                  />
                </div>

                {/* 2. Amount (PKR) */}
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    2. Amount (PKR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-bold font-mono text-[#94A3B8]">
                      Rs.
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="any"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="2500"
                      className="w-full pl-10 pr-3 py-2.5 text-base font-bold font-mono text-[#142B4A] border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all min-h-[44px]"
                    />
                  </div>
                </div>

                {/* 3. Who paid? */}
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    3. Who paid?
                  </label>
                  <select
                    value={paidByMemberId}
                    onChange={(e) => setPaidByMemberId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm font-semibold text-[#172B4D] border border-[#CBD5E1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] transition-all cursor-pointer min-h-[44px]"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Who shared this expense? (Multi-select) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider">
                      4. Who shared this expense?
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllParticipants}
                        className="text-[#2563EB] hover:text-[#1D4ED8] font-bold hover:underline cursor-pointer py-1"
                      >
                        All ({members.length})
                      </button>
                      <span className="text-[#CBD5E1]">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedParticipants([])}
                        className="text-[#64748B] hover:text-[#172B4D] font-medium hover:underline cursor-pointer py-1"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 bg-[#F7F9FC] p-2.5 rounded-xl border border-[#E2E8F0]">
                    {members.map((m) => {
                      const isSelected = selectedParticipants.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-all min-h-[44px] touch-manipulation ${
                            isSelected
                              ? 'bg-[#EFF6FF] border-[#2563EB] text-[#142B4A] shadow-xs'
                              : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleParticipant(m.id)}
                            className="w-4 h-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                          />
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-[#E2E8F0] text-[#142B4A] font-bold text-[10px] flex items-center justify-center shrink-0">
                              {m.name.charAt(0)}
                            </span>
                            <span className="text-xs font-bold truncate">
                              {m.name}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded">
                              Included
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {selectedParticipants.length === 0 && (
                    <p className="text-[11px] font-semibold text-[#DC2626] mt-1 flex items-center gap-1">
                      ⚠️ Please select at least one member who shared this expense.
                    </p>
                  )}
                </div>

                {/* 5. Payment Source */}
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    5. Payment Source
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentSource('common_fund')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all min-h-[48px] touch-manipulation ${
                        paymentSource === 'common_fund'
                          ? 'border-[#2563EB] bg-[#EFF6FF] ring-2 ring-[#2563EB]/20'
                          : 'border-[#CBD5E1] hover:border-[#94A3B8] bg-white'
                      }`}
                    >
                      <div className="font-bold text-xs text-[#142B4A] flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                        <span>Common Fund</span>
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">
                        Deduct from shared wallet
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentSource('personal_pocket')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all min-h-[48px] touch-manipulation ${
                        paymentSource === 'personal_pocket'
                          ? 'border-[#2563EB] bg-[#EFF6FF] ring-2 ring-[#2563EB]/20'
                          : 'border-[#CBD5E1] hover:border-[#94A3B8] bg-white'
                      }`}
                    >
                      <div className="font-bold text-xs text-[#142B4A] flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                        <span>Personal Pocket</span>
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">
                        Payer credited full amount
                      </div>
                    </button>
                  </div>
                </div>

                {/* 6. Date */}
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    6. Date
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] transition-all min-h-[44px]"
                  />
                </div>

                {/* Live Preview Before Saving */}
                {parseFloat(amount) > 0 && (
                  <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
                      <span className="font-bold text-[#142B4A]">Division Preview:</span>
                      <span className="font-mono font-bold text-[#142B4A]">
                        Total: {formatCurrencyPKR(parseFloat(amount))}
                      </span>
                    </div>

                    <div className="flex items-start justify-between text-[#64748B] gap-2">
                      <span className="shrink-0 font-medium">Participants ({selectedParticipants.length}):</span>
                      <span className="font-bold text-right text-[#142B4A] break-words">
                        {selectedParticipants.length === 0 ? (
                          <span className="text-[#DC2626]">None selected</span>
                        ) : selectedParticipants.length === members.length ? (
                          `All ${members.length} members`
                        ) : (
                          members
                            .filter((m) => selectedParticipants.includes(m.id))
                            .map((m) => m.name)
                            .join(', ')
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                      <span className="font-semibold text-[#142B4A]">Per Person Share:</span>
                      <span className="font-mono font-extrabold text-[#2563EB] text-sm">
                        {selectedParticipants.length > 0
                          ? formatCurrencyPKR(
                              Math.round((parseFloat(amount) / selectedParticipants.length) * 100) / 100
                            )
                          : '—'}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#64748B] pt-0.5">
                      {paymentSource === 'common_fund' ? (
                        <span>
                          • <strong>Common Fund:</strong> Deducts {formatCurrencyPKR(parseFloat(amount))} from wallet. Unselected members pay 0.
                        </span>
                      ) : (
                        <span>
                          • <strong>Personal Pocket:</strong> Full credit to {members.find((m) => m.id === paidByMemberId)?.name || 'Payer'}. Allocated among {selectedParticipants.length} selected.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 7. Save / Cancel Actions */}
              <div className="p-3.5 sm:p-4 bg-white border-t border-[#E2E8F0] shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#334155] hover:text-[#172B4D] bg-white border border-[#CBD5E1] rounded-lg transition-colors cursor-pointer min-h-[44px] flex items-center justify-center touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedParticipants.length === 0 || !amount || parseFloat(amount) <= 0}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#CBD5E1] disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors cursor-pointer min-h-[44px] flex items-center justify-center touch-manipulation"
                >
                  {selectedParticipants.length === members.length
                    ? 'Save Expense & Divide 5 Ways'
                    : selectedParticipants.length > 0
                    ? `Save Expense & Divide (${selectedParticipants.length})`
                    : 'Select at least 1 Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD DEPOSIT MODAL
          ===================================================================== */}
      {isAddDepositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3.5 sm:p-4 bg-[#142B4A] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold">Record Money Deposit</h3>
                <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5">{formattedMonth}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDepositOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDepositSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    Member
                  </label>
                  <select
                    value={depositMemberId}
                    onChange={(e) => setDepositMemberId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm font-semibold text-[#172B4D] border border-[#CBD5E1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer min-h-[44px]"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    Amount Deposited (PKR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-bold font-mono text-[#94A3B8]">
                      Rs.
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="any"
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="15000"
                      className="w-full pl-10 pr-3 py-2.5 text-base font-bold font-mono text-[#142B4A] border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    placeholder="e.g. Cash handed over or Raast transfer"
                    className="w-full px-3 py-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                  />
                </div>
              </div>

              <div className="p-3.5 sm:p-4 bg-white border-t border-[#E2E8F0] shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddDepositOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#334155] hover:text-[#172B4D] bg-white border border-[#CBD5E1] rounded-lg min-h-[44px] flex items-center justify-center touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-lg shadow-xs transition-colors min-h-[44px] flex items-center justify-center touch-manipulation"
                >
                  Save Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          EDIT EXPENSE MODAL
          ===================================================================== */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3.5 sm:p-4 bg-[#142B4A] text-white flex items-center justify-between shrink-0">
              <h3 className="text-sm sm:text-base font-bold">Edit Expense Entry</h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    1. What was purchased?
                  </label>
                  <input
                    type="text"
                    required
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    2. Amount (PKR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-bold font-mono text-[#94A3B8]">
                      Rs.
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="any"
                      required
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 text-base font-bold font-mono text-[#142B4A] border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    3. Who paid?
                  </label>
                  <select
                    value={editPayer}
                    onChange={(e) => setEditPayer(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm font-semibold text-[#172B4D] border border-[#CBD5E1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider">
                      4. Who shared this expense?
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllEditParticipants}
                        className="text-[#2563EB] hover:text-[#1D4ED8] font-bold hover:underline cursor-pointer py-1"
                      >
                        All ({members.length})
                      </button>
                      <span className="text-[#CBD5E1]">•</span>
                      <button
                        type="button"
                        onClick={() => setEditParticipants([])}
                        className="text-[#64748B] hover:text-[#172B4D] font-medium hover:underline cursor-pointer py-1"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 bg-[#F7F9FC] p-2.5 rounded-xl border border-[#E2E8F0]">
                    {members.map((m) => {
                      const isSelected = editParticipants.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-all min-h-[44px] touch-manipulation ${
                            isSelected
                              ? 'bg-[#EFF6FF] border-[#2563EB] text-[#142B4A] shadow-xs'
                              : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEditParticipant(m.id)}
                            className="w-4 h-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                          />
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-[#E2E8F0] text-[#142B4A] font-bold text-[10px] flex items-center justify-center shrink-0">
                              {m.name.charAt(0)}
                            </span>
                            <span className="text-xs font-bold truncate">
                              {m.name}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded">
                              Included
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    5. Payment Source
                  </label>
                  <select
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value as any)}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm font-semibold text-[#172B4D] border border-[#CBD5E1] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                  >
                    <option value="common_fund">Common Fund (Deducts shared wallet)</option>
                    <option value="personal_pocket">Personal Pocket (Payer credited full amount)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#142B4A] uppercase tracking-wider mb-1">
                    6. Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-lg bg-white min-h-[44px]"
                  />
                </div>
              </div>

              <div className="p-3.5 sm:p-4 bg-white border-t border-[#E2E8F0] shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#334155] hover:text-[#172B4D] bg-white border border-[#CBD5E1] rounded-lg min-h-[44px] flex items-center justify-center touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editParticipants.length === 0 || !editAmount || parseFloat(editAmount) <= 0}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#CBD5E1] rounded-lg shadow-xs transition-colors cursor-pointer min-h-[44px] flex items-center justify-center touch-manipulation"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
