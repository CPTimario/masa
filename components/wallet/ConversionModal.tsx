'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResponsiveFormModal } from '@/components/ui/responsive-form-modal'
import { createConversion } from '@/server/actions/conversions'
import { format } from 'date-fns'

const CURRENCIES = ['PHP', 'THB', 'USD', 'SGD', 'EUR']

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

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
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
  }, [open, defaultMemberId, defaultFromCurrency])

  const fromCurrency = watch('fromCurrency')
  const toCurrency = watch('toCurrency')
  const fromAmount = watch('fromAmount')
  const exchangeRate = watch('exchangeRate')

  // Auto-compute toAmount from fromAmount * exchangeRate
  useEffect(() => {
    if (fromAmount > 0 && exchangeRate > 0) {
      setValue('toAmount', parseFloat((fromAmount * exchangeRate).toFixed(2)))
    }
  }, [fromAmount, exchangeRate])

  // When toCurrency changes and equals fromCurrency, pick a different one
  useEffect(() => {
    if (toCurrency === fromCurrency) {
      const alt = CURRENCIES.find(c => c !== fromCurrency)
      if (alt) setValue('toCurrency', alt)
    }
  }, [fromCurrency])

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
          <Select value={watch('memberId')} onValueChange={(v) => v && setValue('memberId', v)}>
            <SelectTrigger className="mt-1">
              <SelectValue>{members.find((m) => m.id === watch('memberId'))?.name ?? 'Select'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From currency</label>
            <Select value={watch('fromCurrency')} onValueChange={(v) => v && setValue('fromCurrency', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To currency</label>
            <Select
              value={watch('toCurrency')}
              onValueChange={(v) => { if (v) { setValue('toCurrency', v); setValue('toAmount', undefined as unknown as number) } }}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.filter(c => c !== fromCurrency).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.toCurrency && <p className="text-xs text-destructive mt-1">{errors.toCurrency.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Amount ({watch('fromCurrency')})</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="mt-1"
              {...register('fromAmount', { valueAsNumber: true })}
            />
            {errors.fromAmount && <p className="text-xs text-destructive mt-1">{errors.fromAmount.message}</p>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Exchange rate</label>
            <Input
              type="number"
              step="0.000001"
              placeholder="0.000000"
              className="mt-1"
              {...register('exchangeRate', { valueAsNumber: true })}
            />
            {errors.exchangeRate && <p className="text-xs text-destructive mt-1">{errors.exchangeRate.message}</p>}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">You get ({watch('toCurrency')})</label>
          <Input
            type="number"
            step="0.01"
            placeholder="Auto-computed"
            className="mt-1"
            {...register('toAmount', { valueAsNumber: true })}
          />
          {errors.toAmount && <p className="text-xs text-destructive mt-1">{errors.toAmount.message}</p>}
        </div>

        <Input type="date" {...register('date')} />
        <Input placeholder="Notes (optional)" {...register('notes')} />

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Convert'}</Button>
        </div>
      </form>
    </ResponsiveFormModal>
  )
}
