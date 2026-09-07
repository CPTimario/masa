'use client'

import { MobilePageHeader } from '@/components/shell/MobilePageHeader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WalletPageContent } from '@/components/wallet/WalletPage'
import { SettlePageContent } from '@/components/settlement/SettlePage'
import { MoneyHistory } from './MoneyHistory'
import type {
  Trip,
  Member,
  MemberBalance,
  Conversion,
  Expense,
  ExpenseSplit,
  Settlement,
  SettlementItem,
  Transfer,
} from '@/lib/db/schema'

interface Props {
  trip: Trip
  members: Member[]
  balances: MemberBalance[]
  conversions: Conversion[]
  expenses: Expense[]
  expenseSplits: ExpenseSplit[]
  settlements: Settlement[]
  settlementItems: SettlementItem[]
  transfers: Transfer[]
}

export function MoneyPage({
  trip,
  members,
  balances,
  conversions,
  expenses,
  expenseSplits,
  settlements,
  settlementItems,
  transfers,
}: Props) {
  return (
    <>
      <MobilePageHeader title="Money" backHref={`/trips/${trip.id}`} />
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight">Money</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Balances, settle up, and activity</p>
        </div>

        <Tabs defaultValue="balances">
          <TabsList className="w-full">
            <TabsTrigger value="balances" className="flex-1">Balances</TabsTrigger>
            <TabsTrigger value="settle" className="flex-1">Settle Up</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
          </TabsList>

          <TabsContent value="balances" className="mt-4">
            <WalletPageContent trip={trip} members={members} balances={balances} conversions={conversions} />
          </TabsContent>

          <TabsContent value="settle" className="mt-4">
            <SettlePageContent
              tripId={trip.id}
              currency={trip.currency}
              initialMembers={members}
              initialExpenses={expenses}
              initialSplits={expenseSplits}
              initialSettlements={settlements}
              initialSettlementItems={settlementItems}
              initialTransfers={transfers}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <MoneyHistory
              members={members}
              settlements={settlements}
              settlementItems={settlementItems}
              expenseSplits={expenseSplits}
              expenses={expenses}
              transfers={transfers}
              conversions={conversions}
              currency={trip.currency}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
