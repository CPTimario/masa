'use client'

import { useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyField } from '@/components/ui/currency-field'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { createExpense, updateExpense } from '@/server/actions/expenses'
import { fetchExchangeRate } from '@/lib/exchange-rate'
import { CATEGORIES } from '@/lib/categories'
import { formatCurrency } from '@/lib/format'
import { format } from 'date-fns'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { Label } from '@/components/ui/label'

const schema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.enum(['travel', 'food', 'accommodation', 'activities', 'shopping', 'health', 'gifts', 'misc']),
  paidById: z.string().uuid(),
  type: z.enum(['personal', 'shared']),
  date: z.string(),
  currency: z.string().length(3).optional(),
  exchangeRate: z.number().positive().optional(),
})

type FormData = z.infer<typeof schema>

interface Member { id: string; name: string; isSelf: boolean }
interface Expense {
  id: string
  description: string
  amount: string
  category: string
  paid_by_id: string
  type: string
  date: string
  currency?: string | null
  exchangeRate?: string | null
  splitMemberIds?: string[]
}

interface Props {
  tripId: string
  members: Member[]
  currency: string
  expense?: Expense | null
  defaultPaidById?: string
  onSuccess: () => void
  onCancel: () => void
}

export function ExpenseForm({ tripId, members, currency, expense, defaultPaidById, onSuccess, onCancel }: Props) {
  const selfMember = members.find(m => m.isSelf)
  const [type, setType] = useState<'personal' | 'shared'>(expense?.type as 'personal' | 'shared' ?? 'personal')
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    expense?.splitMemberIds?.length
      ? expense.splitMemberIds
      : members.map(m => m.id)
  )
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})
  const [fetchingRate, startFetchingRate] = useTransition()

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: expense?.description ?? '',
      amount: expense ? parseFloat(expense.amount) : undefined,
      category: (expense?.category as FormData['category']) ?? 'food',
      paidById: expense?.paid_by_id ?? defaultPaidById ?? selfMember?.id ?? members[0]?.id,
      type: type,
      date: expense?.date ?? format(new Date(), 'yyyy-MM-dd'),
      currency: expense?.currency ?? undefined,
      exchangeRate: expense?.exchangeRate ? parseFloat(expense.exchangeRate) : undefined,
    },
  })

  const selectedCurrency = useWatch({ control, name: 'currency' })
  const showExchangeRate = selectedCurrency && selectedCurrency !== currency

  function handleCurrencyChange(val: string | null) {
    if (!val || val === currency) {
      setValue('currency', undefined)
      setValue('exchangeRate', undefined)
    } else {
      setValue('currency', val)
      startFetchingRate(async () => {
        try {
          const rate = await fetchExchangeRate(val, currency)
          setValue('exchangeRate', rate)
        } catch {
          // leave field for manual entry
        }
      })
    }
  }

  const amount = useWatch({ control, name: 'amount' }) ?? 0
  const paidById = useWatch({ control, name: 'paidById' })

  const allIds = members.map(m => m.id)
  const allSelected = selectedMembers.length === members.length

  const sumOfCustomSplits = members
    .filter(m => selectedMembers.includes(m.id))
    .reduce((sum, m) => sum + parseFloat(customSplits[m.id] || '0'), 0)

  function toggleMember(id: string) {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function toggleAll() {
    setSelectedMembers(allSelected ? [] : allIds)
  }

  function getEqualShare() {
    if (selectedMembers.length === 0 || !amount || isNaN(amount)) return 0
    return Math.round((amount / selectedMembers.length) * 100) / 100
  }

  async function onSubmit(data: FormData) {
    const splits = type === 'shared'
      ? selectedMembers.map(memberId => ({
          memberId,
          shareAmount: splitMode === 'equal'
            ? getEqualShare()
            : parseFloat(customSplits[memberId] ?? '0'),
        }))
      : undefined

    const payload = {
      ...data,
      type,
      splits,
      currency: data.currency || undefined,
      exchangeRate: data.currency && data.currency !== currency ? data.exchangeRate : undefined,
    }

    if (expense) {
      await updateExpense(expense.id, tripId, payload)
    } else {
      await createExpense(tripId, payload)
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="description">Description</Label>
        <Input id="description" placeholder="Description" autoComplete="off" className="mt-1" {...register('description')} />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" step="0.01" placeholder="Amount" className="mt-1" {...register('amount', { valueAsNumber: true })} />
          {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
        </div>
        <div className="w-24 shrink-0">
          <Label htmlFor="expense-currency" className="sr-only">Currency</Label>
          <CurrencyField id="expense-currency" value={selectedCurrency ?? currency} onValueChange={handleCurrencyChange} />
        </div>
      </div>

      {showExchangeRate && (
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label htmlFor="expense-exchange-rate" className="text-xs text-muted-foreground">Rate: 1 {selectedCurrency} =</label>
            <div className="flex gap-1 items-center mt-1">
              <Input
                id="expense-exchange-rate"
                type="number"
                step="0.000001"
                placeholder="Exchange rate"
                aria-describedby="expense-exchange-rate-currency"
                {...register('exchangeRate', { valueAsNumber: true })}
                className="flex-1"
              />
              <span id="expense-exchange-rate-currency" className="text-sm text-muted-foreground">{currency}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="mt-5"
            disabled={fetchingRate}
            aria-label="Refresh exchange rate"
            onClick={() => {
              if (!selectedCurrency) return
              startFetchingRate(async () => {
                try {
                  const rate = await fetchExchangeRate(selectedCurrency, currency)
                  setValue('exchangeRate', rate)
                } catch {
                  // leave for manual entry
                }
              })
            }}
          >
            <RefreshCw className={`h-4 w-4 ${fetchingRate ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select onValueChange={(v) => v && setValue('category', v as FormData['category'])} defaultValue={expense?.category ?? 'food'}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <SelectItem key={key} value={key}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={paidById} onValueChange={(v) => v && setValue('paidById', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Paid by">
              {members.find(m => m.id === paidById)?.name ?? 'Paid by'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" className="mt-1" {...register('date')} />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant={type === 'personal' ? 'default' : 'outline'} size="sm" onClick={() => { setType('personal'); setValue('type', 'personal') }}>Personal</Button>
        <Button type="button" variant={type === 'shared' ? 'default' : 'outline'} size="sm" onClick={() => { setType('shared'); setValue('type', 'shared') }}>Shared</Button>
      </div>

      {type === 'shared' && (
        <div className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant={splitMode === 'equal' ? 'default' : 'outline'} size="sm" onClick={() => setSplitMode('equal')}>Equal</Button>
              <Button type="button" variant={splitMode === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setSplitMode('custom')}>Custom</Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex-1 flex items-center justify-between rounded-md border px-3 py-1.5 text-sm bg-background hover:bg-accent transition-colors">
                <span className="truncate">
                  {allSelected ? 'All members' : selectedMembers.length === 0 ? 'Select members' : `${selectedMembers.length} selected`}
                </span>
                <ChevronDown className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuCheckboxItem checked={allSelected} closeOnClick={false} onCheckedChange={toggleAll} className="font-medium">
                  All
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {members.map(m => (
                  <DropdownMenuCheckboxItem
                    key={m.id}
                    checked={selectedMembers.includes(m.id)}
                    closeOnClick={false}
                    onCheckedChange={() => toggleMember(m.id)}
                  >
                    {m.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {splitMode === 'equal' && selectedMembers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {currency} {getEqualShare().toFixed(2)} each · {selectedMembers.length} {selectedMembers.length === 1 ? 'member' : 'members'}
            </p>
          )}

          {splitMode === 'custom' && selectedMembers.length > 0 && (
            <div className="space-y-2">
              {members.filter(m => selectedMembers.includes(m.id)).map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <label htmlFor={`split-${m.id}`} className="flex-1 text-sm">{m.name}</label>
                  <Input
                    id={`split-${m.id}`}
                    type="number"
                    step="0.01"
                    className="w-24 h-7 text-sm"
                    aria-label={`Split amount for ${m.name}`}
                    value={customSplits[m.id] ?? ''}
                    onChange={e => setCustomSplits(prev => ({ ...prev, [m.id]: e.target.value }))}
                  />
                </div>
              ))}
              <p className={`text-sm ${Math.abs(amount - sumOfCustomSplits) > 0.01 ? 'text-destructive' : 'text-muted-foreground'}`}>
                Remaining: {formatCurrency(amount - sumOfCustomSplits, currency)}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : expense ? 'Update' : 'Save'}</Button>
      </div>
    </form>
  )
}
