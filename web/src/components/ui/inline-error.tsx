import * as React from "react"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string
}

const InlineError = React.forwardRef<HTMLDivElement, InlineErrorProps>(
  ({ className, message, children, ...props }, ref) => {
    if (!message && !children) return null

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "flex items-start gap-2 text-sm text-destructive animate-in fade-in-50 slide-in-from-top-1 duration-200 mt-1.5",
          className
        )}
        {...props}
      >
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="text-red-600 dark:text-red-500">{message || children}</span>
      </div>
    )
  }
)

InlineError.displayName = "InlineError"

export { InlineError }
