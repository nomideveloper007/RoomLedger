export type UserRole = 'owner' | 'editor' | 'viewer';

export type PaymentSource = 'common_fund' | 'personal_pocket' | 'common_wallet';

export type PaymentMethod =
  | 'Cash'
  | 'Bank Transfer'
  | 'EasyPaisa'
  | 'JazzCash'
  | 'Raast'
  | 'SadaPay'
  | 'Other';

export interface RoomMember {
  id: string;
  roomId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  joinedAt?: string;
  isActive?: boolean;
}

export interface Room {
  id: string;
  name: string;
  currency: string; // 'PKR'
  monthlyContributionTarget: number;
  monthStartDay: number; // e.g. 1
  autoMonthRollover?: boolean; // When true (default), starts new month on the last day of current month
  walletCustodianId?: string;
  createdAt: string;
  description?: string;
}

export interface Deposit {
  id: string;
  roomId: string;
  memberId: string;
  amount: number;
  depositDate: string; // 'YYYY-MM-DD'
  month: string; // 'YYYY-MM'
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface ExpenseShare {
  id: string;
  expenseId: string;
  memberId: string;
  shareAmount: number;
}

export interface Expense {
  id: string;
  roomId: string;
  description: string;
  amount: number;
  expenseDate: string; // 'YYYY-MM-DD'
  month: string; // 'YYYY-MM'
  paidByMemberId: string;
  paymentSource: 'common_fund' | 'personal_pocket';
  notes?: string;
  participantMemberIds?: string[];
  shares: ExpenseShare[];
  createdAt: string;
  createdBy: string;
}

export interface Settlement {
  id: string;
  roomId: string;
  month: string;
  payerMemberId: string;
  payeeMemberId: string;
  amount: number;
  settlementDate: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface SuggestedTransfer {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
}

export interface MonthlyMemberSummary {
  member: RoomMember;
  totalDeposited: number;
  personalExpensesPaid: number;
  totalExpenseShare: number;
  netBalance: number; // Total Deposited + Personal Pocket Paid - Total Expense Share + SettlementsPaid - SettlementsReceived
  amountToPay: number; // positive if member owes
  amountToReceive: number; // positive if member should receive
  status: 'pays' | 'receives' | 'settled';
}

export interface MonthlyRegisterSummary {
  month: string; // 'YYYY-MM'
  totalDeposited: number;
  totalExpenses: number;
  commonFundExpenses: number;
  personalExpenses: number;
  commonFundBalance: number; // Opening carryover + Deposits - Common Fund Expenses
  openingCarryOverBalance?: number; // Balance brought forward from previous months
  memberSummaries: MonthlyMemberSummary[];
  suggestedTransfers: SuggestedTransfer[];
}
