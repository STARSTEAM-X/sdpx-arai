import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import { FOCUS } from './Ui'
import { IconCheck, IconChevronDown } from './icons'

export type DropdownOption<T extends string> = {
  value: T
  label: string
  description?: string
  icon?: ReactNode
}

export function Dropdown<T extends string>({
  id,
  name,
  value,
  options,
  onChange,
  ariaLabel,
  ariaLabelledby,
  disabled = false,
  className = '',
}: {
  id?: string
  name?: string
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel?: string
  ariaLabelledby?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [open])

  function openAndFocus(index = selectedIndex) {
    setOpen(true)
    requestAnimationFrame(() => optionRefs.current[index]?.focus())
  }

  function select(option: DropdownOption<T>) {
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openAndFocus(selectedIndex)
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const next = (index + direction + options.length) % options.length
      optionRefs.current[next]?.focus()
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAndFocus())}
        onKeyDown={handleTriggerKeyDown}
        className={
          'flex min-h-11 w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 text-left ' +
          'transition-[border-color,box-shadow,background-color] disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted ' +
          `${open ? 'border-brand-600 ring-3 ring-accent-soft' : 'border-edge-strong hover:border-muted'} ${FOCUS}`
        }
      >
        {selected.icon && (
          <span aria-hidden="true" className="shrink-0 text-muted">
            {selected.icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold">
          {selected.label}
        </span>
        <IconChevronDown
          className={`size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          className="absolute top-[calc(100%+0.5rem)] right-0 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-edge-strong bg-white p-1.5 shadow-[0_18px_42px_-16px_rgba(23,32,51,0.32)]"
        >
          {options.map((option, index) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                ref={(element) => {
                  optionRefs.current[index] = element
                }}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(option)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={
                  'grid w-full grid-cols-[2rem_minmax(0,1fr)_1rem] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ' +
                  `transition-colors ${active ? 'bg-accent-soft/60 text-accent-ink' : 'hover:bg-sand'} ${FOCUS}`
                }
              >
                <span
                  aria-hidden="true"
                  className={`grid size-8 place-items-center rounded-lg ${active ? 'bg-white/60' : 'bg-sand text-ink-2'}`}
                >
                  {option.icon ?? <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-sm font-semibold">{option.label}</span>
                  {option.description && (
                    <span className="mt-0.5 block truncate text-xs leading-4 text-muted">
                      {option.description}
                    </span>
                  )}
                </span>
                <IconCheck className={`size-4 ${active ? 'visible' : 'invisible'}`} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
