"use client"

import { cn } from "@/lib/utils"
import { forwardRef } from "react"

const Progress = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number }
>(({ className, value = 0, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props}
  >
    <div
      className="h-full w-full flex-1 bg-primary transition-all duration-300 rounded-full"
      style={{ transform: `translateX(-${100 - Math.min(Math.max(value, 0), 100)}%)` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
