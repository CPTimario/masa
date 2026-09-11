import type { Member, Expense, ExpenseSplit, Settlement, Transfer } from '@/lib/db/schema'

// Per-currency balances: { [currency]: { [memberId]: net } }. No conversion —
// each expense/settlement/transfer stays in its own currency.
export function computeBalances(
  members: Member[],
  expenses: Expense[],
  expenseSplits: ExpenseSplit[],
  settlements: Settlement[],
  transfers: Transfer[],
  tripCurrency: string
): Record<string, Record<string, number>> {
  const balances: Record<string, Record<string, number>> = {}

  function add(currency: string, memberId: string, delta: number) {
    if (!balances[currency]) {
      balances[currency] = {}
      members.forEach((m) => { balances[currency][m.id] = 0 })
    }
    balances[currency][memberId] = (balances[currency][memberId] || 0) + delta
  }

  for (const expense of expenses) {
    if (expense.type !== 'shared') continue
    const currency = expense.currency ?? tripCurrency
    const rawAmount = parseFloat(String(expense.amount))
    add(currency, expense.paidById, rawAmount)
    for (const split of expenseSplits.filter((s) => s.expenseId === expense.id)) {
      const splitAmount = parseFloat(String(split.shareAmount))
      add(currency, split.memberId, -splitAmount)
    }
  }

  for (const settlement of settlements) {
    const amount = parseFloat(String(settlement.amount))
    add(settlement.currency, settlement.fromMemberId, amount)
    add(settlement.currency, settlement.toMemberId, -amount)
  }

  for (const transfer of transfers) {
    const amount = parseFloat(String(transfer.amount))
    add(transfer.currency, transfer.fromMemberId, amount)
    add(transfer.currency, transfer.toMemberId, -amount)
  }

  return balances
}

export interface DebtItem {
  splitId: string
  expenseId: string
  description: string
  category: string
  date: string
  shareAmount: number
  paidBySettlementId?: string
}

export function getDebtBreakdown(
  fromId: string,
  toId: string,
  expenses: Expense[],
  splits: ExpenseSplit[],
  paidSplitIds: Map<string, string>,
  currency: string,
  tripCurrency: string,
): DebtItem[] {
  return expenses
    .filter((e) => e.type === 'shared' && e.paidById === toId && (e.currency ?? tripCurrency) === currency)
    .flatMap((e) => {
      const split = splits.find((s) => s.expenseId === e.id && s.memberId === fromId)
      if (!split) return []
      return [{
        splitId: split.id,
        expenseId: e.id,
        description: e.description,
        category: e.category,
        date: e.date,
        shareAmount: Math.round(parseFloat(String(split.shareAmount)) * 100) / 100,
        paidBySettlementId: paidSplitIds.get(split.id),
      }]
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function simplifyDebts(balances: Record<string, number>): { from: string; to: string; amount: number }[] {
  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  for (const [id, balance] of Object.entries(balances)) {
    if (balance > 0.01) creditors.push({ id, amount: balance })
    else if (balance < -0.01) debtors.push({ id, amount: -balance })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const transactions: { from: string; to: string; amount: number }[] = []

  let i = 0, j = 0
  while (i < creditors.length && j < debtors.length) {
    const settle = Math.min(creditors[i].amount, debtors[j].amount)
    transactions.push({ from: debtors[j].id, to: creditors[i].id, amount: Math.round(settle * 100) / 100 })
    creditors[i].amount -= settle
    debtors[j].amount -= settle
    if (creditors[i].amount < 0.01) i++
    if (debtors[j].amount < 0.01) j++
  }

  return transactions
}

// Run the greedy debt simplification independently per currency so debts are
// never cross-converted (THB settles THB, PHP settles PHP).
export function simplifyDebtsByCurrency(
  balancesByCurrency: Record<string, Record<string, number>>
): { from: string; to: string; amount: number; currency: string }[] {
  const result: { from: string; to: string; amount: number; currency: string }[] = []
  for (const [currency, balances] of Object.entries(balancesByCurrency)) {
    for (const t of simplifyDebts(balances)) {
      result.push({ ...t, currency })
    }
  }
  return result
}
