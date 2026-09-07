"use client"

import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder, className }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
