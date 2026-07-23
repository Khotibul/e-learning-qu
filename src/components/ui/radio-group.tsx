"use client"

import { cn } from "@/lib/utils"
import { forwardRef, useId, createContext, useContext, useCallback } from "react"

interface RadioGroupContextValue {
  value?: string
  onValueChange?: (value: string) => void
  name?: string
}

const RadioGroupContext = createContext<RadioGroupContextValue>({})

interface RadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
  name?: string
}

function RadioGroup({ value, onValueChange, children, className, name }: RadioGroupProps) {
  const groupName = useId()
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, name: name ?? groupName }}>
      <div className={cn("grid gap-2", className)} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value"> {
  value: string
}

const RadioGroupItem = forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, id, ...props }, ref) => {
    const ctx = useContext(RadioGroupContext)
    const autoId = useId()
    const inputId = id ?? autoId
    const checked = ctx.value === value
    const handleChange = useCallback(() => {
      ctx.onValueChange?.(value)
    }, [ctx.onValueChange, value])
    return (
      <input
        type="radio"
        id={inputId}
        name={ctx.name}
        value={value}
        checked={checked}
        onChange={handleChange}
        ref={ref}
        className={cn(
          "h-4 w-4 shrink-0 rounded-full border border-input text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
