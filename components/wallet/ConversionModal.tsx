'use client'

import { useEffect, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyField } from '@/components/ui/currency-field'
import { ResponsiveFormModal } from '@/components/ui/responsive-form-modal'
import { createConversion } from '@/server/actions/conversions'
import { fetchExchangeRate } from '@/lib/exchange-rate'
import { CURRENCIES } from '@/lib/currencies'
import { format } from 'date-fns'

const schema = z.object({
  memberId: z.string().uuid(),
  fromCurrency: z.string().length(3),
  fromAmount: z.number().positive(),
  exchangeRate: z.number().positive(),
  toCurrency: z.string().length(3),
  toAmount: z.number().positive(),
  date: z.string(),
  notes: z.string().optional(),
}).refine(d => d.fromCurrency !== d.toCurrency, {
  message: 'Source and target currency must differ',
  path: ['toCurrency'],
})

type FormData = z.infer<typeof schema>

interface Member { id: string; name: string }

interface Props {
  tripId: string
  members: Member[]
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultMemberId?: string
  defaultFromCurrency?: string
}

export function ConversionModal({ tripId, members, open, onOpenChange, defaultMemberId, defaultFromCurrency }: Props) {
  const defaultMember = defaultMemberId ?? members[0]?.id ?? ''
  const defaultFrom = defaultFromCurrency ?? CURRENCIES[0]
  const defaultTo = CURRENCIES.find(c => c !== defaultFrom) ?? CURRENCIES[1]

  const [fetchingRate, startFetchingRate] = useTransition()

  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      memberId: defaultMember,
      fromCurrency: defaultFrom,
      fromAmount: undefined,
      exchangeRate: undefined,
      toCurrency: defaultTo,
      toAmount: undefined,
      date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    },
  })

  // Reset form to new defaults whenever the modal opens for a different row
  useEffect(() => {
    if (open) {
      const fromCurr = defaultFromCurrency ?? CURRENCIES[0]
      reset({
        memberId: defaultMemberId ?? members[0]?.id ?? '',
        fromCurrency: fromCurr,
        fromAmount: undefined as unknown as number,
        exchangeRate: undefined as unknown as number,
        toCurrency: CURRENCIES.find(c => c !== fromCurr) ?? CURRENCIES[1],
        toAmount: undefined as unknown as number,
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      })
    }
  }, [open, defaultMemberId, defaultFromCurrency, members, reset])

  const memberId = useWatch({ control, name: 'memberId' })
  const fromCurrency = useWatch({ control, name: 'fromCurrency' })
  const toCurrency = useWatch({ control, name: 'toCurrency' })
  const fromAmount = useWatch({ control, name: 'fromAmount' })
  const exchangeRate = useWatch({ control, name: 'exchangeRate' })

  // Auto-fetch the live exchange rate whenever the currency pair changes
  useEffect(() => {
    if (!open) return
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return
    startFetchingRate(async () => {
      try {
        const rate = await fetchExchangeRate(fromCurrency, toCurrency)
        setValue('exchangeRate', parseFloat(rate.toFixed(6)))
      } catch {
        // leave field for manual entry
      }
    })
  }, [fromCurrency, toCurrency, open, setValue])

  // Auto-compute toAmount from fromAmount * exchangeRate
  useEffect(() => {
    if (fromAmount > 0 && exchangeRate > 0) {
      setValue('toAmount', parseFloat((fromAmount * exchangeRate).toFixed(2)))
    }
  }, [fromAmount, exchangeRate, setValue])

  // When toCurrency changes and equals fromCurrency, pick a different one
  useEffect(() => {
    if (toCurrency === fromCurrency) {
      const alt = CURRENCIES.find(c => c !== fromCurrency)
      if (alt) setValue('toCurrency', alt)
    }
  }, [fromCurrency, toCurrency, setValue])

  async function onSubmit(data: FormData) {
    await createConversion(tripId, {
      memberId: data.memberId,
      fromCurrency: data.fromCurrency,
      fromAmount: data.fromAmount,
      exchangeRate: data.exchangeRate,
      toCurrency: data.toCurrency,
      toAmount: data.toAmount,
      date: data.date,
      notes: data.notes,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <ResponsiveFormModal open={open} onOpenChange={onOpenChange} title="Convert Currency">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 md:p-0">
        <div>
          <label className="text-xs text-muted-foreground">Member</label>
          <Select value={memberId} onValueChange={(v) => v && setValue('memberId', v)}>
            <SelectTrigger className="mt-1">
              <SelectValue>{members.find((m) => m.id === memberId)?.name ?? 'Select'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="conv-from-currency" className="text-xs text-muted-foreground">From currency</label>
            <div className="mt-1">
              <CurrencyField id="conv-from-currency" value={fromCurrency} onValueChange={(v) => setValue('fromCurrency', v)} />
            </div>
          </div>
          <div>
            <label htmlFor="conv-to-currency" className="text-xs text-muted-foreground">To currency</label>
            <div className="mt-1">
              <CurrencyField
                id="conv-to-currency"
                value={toCurrency}
                onValueChange={(v) => { setValue('toCurrency', v); setValue('toAmount', undefined as unknown as number) }}
                exclude={fromCurrency}
              />
            </div>
            {errors.toCurrency && <p className="text-xs text-destructive mt-1">{errors.toCurrency.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="conv-from-amount" className="text-xs text-muted-foreground">Amount ({fromCurrency})</label>
            <Input
              id="conv-from-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="mt-1"
              {...register('fromAmount', { valueAsNumber: true })}
            />
            {errors.fromAmount && <p className="text-xs text-destructive mt-1">{errors.fromAmount.message}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="conv-exchange-rate" className="text-xs text-muted-foreground">Exchange rate</label>
              {fetchingRate ? (
                <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : exchangeRate > 0 ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Using live rate</Badge>
              ) : null}
            </div>
            <div className="flex gap-1 items-center mt-1">
              <Input
                id="conv-exchange-rate"
                type="number"
                step="0.000001"
                placeholder="0.000000"
                className="flex-1"
                {...register('exchangeRate', { valueAsNumber: true })}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={fetchingRate || fromCurrency === toCurrency}
                aria-label="Refresh exchange rate"
                onClick={() => {
                  startFetchingRate(async () => {
                    try {
                      const rate = await fetchExchangeRate(fromCurrency, toCurrency)
                      setValue('exchangeRate', parseFloat(rate.toFixed(6)))
                    } catch {
                      // leave field for manual entry
                    }
                  })
                }}
              >
                <RefreshCw className={`h-4 w-4 ${fetchingRate ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            {errors.exchangeRate && <p className="text-xs text-destructive mt-1">{errors.exchangeRate.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="conv-to-amount" className="text-xs text-muted-foreground">You get ({toCurrency})</label>
          <Input
            id="conv-to-amount"
            type="number"
            step="0.01"
            placeholder="Auto-computed"
            className="mt-1"
            {...register('toAmount', { valueAsNumber: true })}
          />
          {errors.toAmount && <p className="text-xs text-destructive mt-1">{errors.toAmount.message}</p>}
        </div>

        <div>
          <label htmlFor="conv-date" className="text-xs text-muted-foreground">Date</label>
          <Input id="conv-date" type="date" className="mt-1" {...register('date')} />
        </div>
        <div>
          <label htmlFor="conv-notes" className="text-xs text-muted-foreground">Notes</label>
          <Input id="conv-notes" placeholder="Notes (optional)" className="mt-1" {...register('notes')} />
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Convert'}</Button>
        </div>
      </form>
    </ResponsiveFormModal>
  )
}
