import { Expense, Deposit, Settlement, RoomMember, MonthlyRegisterSummary } from '../types';

export function formatCurrencyPKR(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return 'Rs. ' + rounded.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function exportMonthlyRegisterToCSV(
  monthSummary: MonthlyRegisterSummary,
  expenses: Expense[],
  deposits: Deposit[],
  members: RoomMember[]
) {
  const rows: string[][] = [
    [`ROOM REGISTER — ${monthSummary.month}`, `Generated: ${new Date().toLocaleDateString()}`],
    [],
    ['MONTHLY EXPENSE LEDGER (2-ROW FORMAT)'],
    ['Date', 'Description', ...members.map((m) => `${m.name} Expense`), 'Payment Source', ...members.map((m) => `${m.name} Share`)],
  ];

  expenses.forEach((e) => {
    const shareAmount = Math.round((e.amount / 5) * 100) / 100;
    const sourceLabel = e.paymentSource === 'common_fund' ? 'Common Fund' : 'Personal Pocket';

    const expenseAmounts = members.map((m) => (m.id === e.paidByMemberId ? e.amount.toFixed(2) : '0.00'));
    const shareAmounts = members.map(() => shareAmount.toFixed(2));

    rows.push([e.expenseDate, `"${e.description.replace(/"/g, '""')}"`, ...expenseAmounts, sourceLabel, ...shareAmounts]);
  });

  rows.push([]);
  rows.push(['MONTHLY FINAL SUMMARY']);
  rows.push(['Member Name', 'Total Deposited', 'Personal Paid', 'Total Share', 'Net Balance', 'Amount to Pay', 'Amount to Receive']);

  monthSummary.memberSummaries.forEach((s) => {
    rows.push([
      `"${s.member.name}"`,
      s.totalDeposited.toFixed(2),
      s.personalExpensesPaid.toFixed(2),
      s.totalExpenseShare.toFixed(2),
      s.netBalance.toFixed(2),
      s.amountToPay.toFixed(2),
      s.amountToReceive.toFixed(2),
    ]);
  });

  const csvContent = rows.map((e) => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `room_register_${monthSummary.month}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
