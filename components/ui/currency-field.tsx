"use client"

import * as React from "react"
import { Autocomplete } from "@base-ui/react/autocomplete"

import { cn } from "@/lib/utils"
import { CURRENCIES } from "@/lib/currencies"

// Normalize any input to an uppercase 3-letter code (A–Z only), satisfying the
// z.string().length(3) schema on both client and server.
function normalizeCurrency(value: string) {
  return value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3)
}

interface CurrencyFieldProps {
  value: string
  onValueChange: (value: string) => void
  id?: string
  placeholder?: string
  /** A currency code to omit from the suggestions (e.g. the "from" currency). */
  exclude?: string
  className?: string
}

export function CurrencyField({
  value,
  onValueChange,
  id,
  placeholder,
  exclude,
  className,
}: CurrencyFieldProps) {
  const items = React.useMemo(
    () => CURRENCIES.filter((c) => c !== exclude),
    [exclude]
  )

  return (
    <Autocomplete.Root
      items={items}
      value={value}
      onValueChange={(v) => onValueChange(normalizeCurrency(v))}
      openOnInputClick
    >
      <Autocomplete.Input
        id={id}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base uppercase transition-colors outline-none placeholder:text-muted-foreground placeholder:normal-case focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30",
          className
        )}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          side="bottom"
          sideOffset={4}
          align="start"
          className="isolate z-50"
        >
          <Autocomplete.Popup className="relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-24 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item
                  key={item}
                  value={item}
                  className="relative flex w-full cursor-default items-center rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
            <Autocomplete.Empty className="px-1.5 py-1 text-sm text-muted-foreground empty:m-0 empty:p-0">
              No matches — press a valid 3-letter code
            </Autocomplete.Empty>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  )
}
