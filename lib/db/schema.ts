import { pgTable, uuid, text, varchar, numeric, boolean, timestamp, date, pgEnum, primaryKey } from 'drizzle-orm/pg-core'

export const expenseCategoryEnum = pgEnum('expense_category', [
  'travel',
  'food',
  'accommodation',
  'activities',
  'shopping',
  'health',
  'gifts',
  'misc',
])

export const expenseTypeEnum = pgEnum('expense_type', ['personal', 'shared'])

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  destination: text('destination').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  initialBudget: numeric('initial_budget').notNull().default('0'),
  isSelf: boolean('is_self').notNull().default(false),
  color: varchar('color', { length: 7 }).notNull().default('#6366f1'),
})

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount: numeric('amount').notNull(),
  category: expenseCategoryEnum('category').notNull(),
  paidById: uuid('paid_by_id').notNull().references(() => members.id),
  type: expenseTypeEnum('type').notNull(),
  date: date('date').notNull(),
  currency: varchar('currency', { length: 3 }),
  exchangeRate: numeric('exchange_rate'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const expenseSplits = pgTable('expense_splits', {
  id: uuid('id').primaryKey().defaultRandom(),
  expenseId: uuid('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  shareAmount: numeric('share_amount').notNull(),
})

// Settlement: paying off specific expense splits between members
export const settlements = pgTable('settlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  fromMemberId: uuid('from_member_id').notNull().references(() => members.id),
  toMemberId: uuid('to_member_id').notNull().references(() => members.id),
  amount: numeric('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  date: date('date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Audit trail: which expense splits a settlement covers
export const settlementItems = pgTable('settlement_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  settlementId: uuid('settlement_id').notNull().references(() => settlements.id, { onDelete: 'cascade' }),
  expenseSplitId: uuid('expense_split_id').notNull().references(() => expenseSplits.id, { onDelete: 'cascade' }),
})

// Fund transfer: direct money movement between members (same currency)
export const transfers = pgTable('transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  fromMemberId: uuid('from_member_id').notNull().references(() => members.id),
  toMemberId: uuid('to_member_id').notNull().references(() => members.id),
  amount: numeric('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  exchangeRateToTrip: numeric('exchange_rate_to_trip'),
  date: date('date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Currency conversion: a member exchanges one currency for another
export const conversions = pgTable('conversions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id),
  fromCurrency: varchar('from_currency', { length: 3 }).notNull(),
  fromAmount: numeric('from_amount').notNull(),
  toCurrency: varchar('to_currency', { length: 3 }).notNull(),
  toAmount: numeric('to_amount').notNull(),
  exchangeRate: numeric('exchange_rate').notNull(),
  date: date('date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Conversion = typeof conversions.$inferSelect
export type NewConversion = typeof conversions.$inferInsert

// Materialized per-member, per-currency balance — updated atomically on every mutation
export const memberBalances = pgTable('member_balances', {
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  currency: varchar('currency', { length: 3 }).notNull(),
  balance: numeric('balance').notNull().default('0'),
}, (t) => ({
  pk: primaryKey({ columns: [t.memberId, t.currency] }),
}))

export type Trip = typeof trips.$inferSelect
export type NewTrip = typeof trips.$inferInsert
export type Member = typeof members.$inferSelect
export type NewMember = typeof members.$inferInsert
export type Expense = typeof expenses.$inferSelect
export type NewExpense = typeof expenses.$inferInsert
export type ExpenseSplit = typeof expenseSplits.$inferSelect
export type NewExpenseSplit = typeof expenseSplits.$inferInsert
export type Settlement = typeof settlements.$inferSelect
export type NewSettlement = typeof settlements.$inferInsert
export type SettlementItem = typeof settlementItems.$inferSelect
export type NewSettlementItem = typeof settlementItems.$inferInsert
export type Transfer = typeof transfers.$inferSelect
export type NewTransfer = typeof transfers.$inferInsert
export type MemberBalance = typeof memberBalances.$inferSelect
export type NewMemberBalance = typeof memberBalances.$inferInsert
