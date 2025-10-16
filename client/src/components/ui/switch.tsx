import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer group relative inline-flex h-4 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      "before:absolute before:inset-0 before:-m-3 before:min-h-[44px] before:min-w-[44px] before:content-['']",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none relative flex items-center justify-center h-[20px] w-[20px] rounded-full bg-background shadow-lg ring-0 transition-transform duration-[180ms] ease data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-0"
      )}
    >
      <Check className="absolute h-3 w-3 text-primary transition-opacity duration-[180ms] group-data-[state=checked]:opacity-100 group-data-[state=unchecked]:opacity-0" />
      <Minus className="absolute h-3 w-3 text-muted-foreground transition-opacity duration-[180ms] group-data-[state=checked]:opacity-0 group-data-[state=unchecked]:opacity-100" />
    </SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
