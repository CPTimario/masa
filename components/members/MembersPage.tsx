'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ResponsiveFormModal } from '@/components/ui/responsive-form-modal'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { MobilePageHeader } from '@/components/shell/MobilePageHeader'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Checkbox } from '@/components/ui/checkbox'
import { createMember, updateMember, deleteMember } from '@/server/actions/members'
import type { Member as DBMember } from '@/lib/db/schema'
import { formatCurrency } from '@/lib/format'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#3b82f6', '#0ea5e9', '#7c3aed', '#64748b', '#78716c',
  '#1d4ed8', '#be185d', '#b45309', '#15803d', '#0e7490',
]

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  initialBudget: z.number().min(0, 'Budget must be 0 or more'),
  isSelf: z.boolean(),
  color: z.string(),
})

type MemberFormData = z.infer<typeof memberSchema>

interface Member {
  id: string
  name: string
  initialBudget: string
  isSelf: boolean
  color: string
}

function toMember(m: DBMember): Member {
  return { id: m.id, name: m.name, initialBudget: m.initialBudget, isSelf: m.isSelf, color: m.color }
}

export function MembersPage({ tripId, initialMembers = [], currency = 'PHP' }: { tripId: string; initialMembers?: DBMember[]; currency?: string }) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>(
    [...initialMembers].sort((a, b) => (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0)).map(toMember)
  )
  const [open, setOpen] = useState(false)
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [pendingDeleteMemberId, setPendingDeleteMemberId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, setValue, control, reset, formState: { errors, isSubmitting } } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: { name: '', initialBudget: 0, isSelf: false, color: PRESET_COLORS[0] },
  })

  const watchedColor = useWatch({ control, name: 'color' })
  const watchedIsSelf = useWatch({ control, name: 'isSelf' })

  function openAdd() {
    setEditMember(null)
    const colorIndex = members.length % PRESET_COLORS.length
    reset({ name: '', initialBudget: 0, isSelf: members.length === 0, color: PRESET_COLORS[colorIndex] })
    setOpen(true)
  }

  function openEdit(m: Member) {
    setEditMember(m)
    reset({ name: m.name, initialBudget: parseFloat(m.initialBudget || '0'), isSelf: m.isSelf, color: m.color })
    setOpen(true)
  }

  async function onSubmit(data: MemberFormData) {
    if (editMember) {
      await updateMember(editMember.id, tripId, {
        name: data.name,
        initialBudget: data.initialBudget,
        isSelf: data.isSelf,
        color: data.color,
      })
    } else {
      await createMember(tripId, {
        name: data.name,
        initialBudget: data.initialBudget,
        isSelf: data.isSelf,
        color: data.color,
      })
    }
    setOpen(false)
    router.refresh()
  }

  function handleDelete() {
    if (!pendingDeleteMemberId) return
    startTransition(async () => {
      await deleteMember(pendingDeleteMemberId, tripId)
      setMembers(prev => prev.filter(m => m.id !== pendingDeleteMemberId))
      setPendingDeleteMemberId(null)
      router.refresh()
    })
  }

  return (
    <>
      <MobilePageHeader
        title="People"
        backHref={`/trips/${tripId}`}
        action={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        }
      />

      <div className="p-4 md:p-6">
        <div className="hidden md:flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">People</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{members.length} {members.length === 1 ? 'person' : 'people'}</p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Person
          </Button>
        </div>

        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            heading="No people yet"
            body="Add people to this trip to start tracking expenses"
            action={{ label: 'Add Person', onClick: openAdd }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {members.map((member) => {
              const budget = parseFloat(member.initialBudget || '0')
              return (
                <Card key={member.id} className="border-border transition-shadow hover:shadow-md">
                  <CardContent className="pt-4 pb-4 flex items-center justify-between">
                    <Link
                      href={`/trips/${tripId}/people/${member.id}`}
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      <div
                        role="img"
                        aria-label={member.name}
                        className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 ring-2 ring-white dark:ring-card shadow-sm"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{member.name}</span>
                          {member.isSelf && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">You</Badge>
                          )}
                        </div>
                        {budget > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Budget: {formatCurrency(budget, currency)}
                          </p>
                        )}
                      </div>
                    </Link>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xl"
                        aria-label="Edit person"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(member)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xl"
                        aria-label="Remove person"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDeleteMemberId(member.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <ResponsiveFormModal
        open={open}
        onOpenChange={setOpen}
        title={editMember ? 'Edit Person' : 'Add Person'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 md:p-0">
          <div className="space-y-1">
            <label htmlFor="memberName" className="text-sm font-medium">Name</label>
            <Input id="memberName" placeholder="e.g. Alice" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="memberBudget" className="text-sm font-medium">Initial Budget</label>
            <Input
              id="memberBudget"
              type="number"
              placeholder="0"
              {...register('initialBudget', { valueAsNumber: true })}
              aria-invalid={!!errors.initialBudget}
            />
            {errors.initialBudget && <p className="text-xs text-destructive">{errors.initialBudget.message}</p>}
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Color</p>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Select color ${c}`}
                  aria-pressed={watchedColor === c}
                  onClick={() => setValue('color', c)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${watchedColor === c ? 'border-foreground scale-110 shadow-sm' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={watchedIsSelf}
              onCheckedChange={(checked) => setValue('isSelf', checked)}
            />
            <span className="text-sm font-medium">This is me</span>
          </label>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </ResponsiveFormModal>

      <AlertDialog open={pendingDeleteMemberId !== null} onOpenChange={(o) => { if (!o) setPendingDeleteMemberId(null) }}>
        <AlertDialogContent>
          <AlertDialogTitle>Remove person?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
