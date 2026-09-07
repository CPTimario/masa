'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResponsiveFormModal } from '@/components/ui/responsive-form-modal'
import { createTransfer } from '@/server/actions/transfers'
import { format } from 'date-fns'

const CURRENCIES = ['PHP', 'THB', 'USD', 'SGD', 'EUR']

const schema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  date: z.string(),
  notes: z.string().optional(),
}).refine(d => d.fromMemberId !== d.toMemberId, {
  message: 'Sender and recipient must be different members',
  path: ['toMemberId'],
})

type FormData = z.infer<typeof schema>

interface Member { id: string; name: string; isSelf: boolean }

interface Props {
  tripId: string
  tripCurrency: string
  members: Member[]
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultFromMemberId?: string
}

export function TransferModal({ tripId, tripCurrency, members, open, onOpenChange, defaultFromMemberId }: Props) {
  const defaultFrom = defaultFromMemberId ?? members[0]?.id ?? ''
  const defaultTo = members.find(m => m.id !== defaultFrom)?.id ?? ''

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromMemberId: defaultFrom,
      toMemberId: defaultTo,
      amount: undefined,
      currency: tripCurrency,
      date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    },
  })

  const fromMemberId = watch('fromMemberId')

  useEffect(() => {
    if (watch('toMemberId') === fromMemberId) {
      setValue('toMemberId', members.find(m => m.id !== fromMemberId)?.id ?? '')
    }
  }, [fromMemberId])

  async function onSubmit(data: FormData) {
    await createTransfer(tripId, {
      fromMemberId: data.fromMemberId,
      toMemberId: data.toMemberId,
      amount: data.amount,
      currency: data.currency,
      date: data.date,
      notes: data.notes,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <ResponsiveFormModal open={open} onOpenChange={onOpenChange} title="Transfer Money">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 md:p-0">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Select value={watch('fromMemberId')} onValueChange={(v) => v && setValue('fromMemberId', v)}>
              <SelectTrigger className="mt-1">
                <SelectValue>{members.find((m) => m.id === watch('fromMemberId'))?.name ?? 'Select'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Select value={watch('toMemberId')} onValueChange={(v) => v && setValue('toMemberId', v)}>
              <SelectTrigger className="mt-1">
                <SelectValue>{members.find((m) => m.id === watch('toMemberId'))?.name ?? 'Select'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {members.filter(m => m.id !== fromMemberId).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.toMemberId && <p className="text-xs text-destructive mt-1">{errors.toMemberId.message}</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="mt-1"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
          </div>
          <div className="w-24">
            <label className="text-xs text-muted-foreground">Currency</label>
            <Select value={watch('currency')} onValueChange={(v) => v && setValue('currency', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Input type="date" {...register('date')} />
        <Input placeholder="Notes (optional)" {...register('notes')} />

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Transfer'}</Button>
        </div>
      </form>
    </ResponsiveFormModal>
  )
}
