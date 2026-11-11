import { MonthlyMemberSummary, SuggestedTransfer } from '../types';

/**
 * Strict Owner/Custodian Settlement Model:
 * Noman is the sole Owner & Custodian of the Common Fund.
 *
 * Requirements:
 * 1. Peer-to-peer transfer suggestions are completely removed.
 * 2. All settlement suggestions are Owner-centric:
 *    - Members who owe money must pay Noman (Custodian).
 *    - Members who should receive money must receive it from Noman (Custodian).
 * 3. Noman never pays or receives from himself.
 * 4. All amounts are rounded strictly to 2 decimal places.
 */
export function calculateSuggestedTransfers(
  summaries: MonthlyMemberSummary[],
  custodianId?: string
): SuggestedTransfer[] {
  if (!summaries || summaries.length === 0) return [];

  // Identify the Owner & Custodian
  const custodianSummary =
    (custodianId ? summaries.find((s) => s.member.id === custodianId) : undefined) ||
    summaries.find((s) => s.member.role === 'owner') ||
    summaries[0];

  if (!custodianSummary) return [];

  const custodian = custodianSummary.member;
  const transfers: SuggestedTransfer[] = [];

  for (const item of summaries) {
    // The Custodian cannot have a transfer to/from themselves
    if (item.member.id === custodian.id) continue;

    const net = Math.round(item.netBalance * 100) / 100;

    if (net < -0.01) {
      // Roommate owes money -> must pay Noman (Custodian)
      transfers.push({
        fromMemberId: item.member.id,
        fromMemberName: item.member.name,
        toMemberId: custodian.id,
        toMemberName: custodian.name,
        amount: Math.round(Math.abs(net) * 100) / 100,
      });
    } else if (net > 0.01) {
      // Roommate overpaid / paid personal pocket expenses -> receives from Noman (Custodian)
      transfers.push({
        fromMemberId: custodian.id,
        fromMemberName: custodian.name,
        toMemberId: item.member.id,
        toMemberName: item.member.name,
        amount: Math.round(net * 100) / 100,
      });
    }
  }

  // Sort transfers: Collections into Custodian first, then reimbursements to members
  transfers.sort((a, b) => {
    const aIsPayingCustodian = a.toMemberId === custodian.id;
    const bIsPayingCustodian = b.toMemberId === custodian.id;
    if (aIsPayingCustodian && !bIsPayingCustodian) return -1;
    if (!aIsPayingCustodian && bIsPayingCustodian) return 1;
    return b.amount - a.amount;
  });

  return transfers;
}
