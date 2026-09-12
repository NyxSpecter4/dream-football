import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[opacity,transform,background-color,color,box-shadow,filter] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live/50 disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96]",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg btn-primary hover:brightness-[1.04]",
        secondary:
          "bg-surface text-fg shadow-[var(--shadow-border)] hover:-translate-y-px hover:shadow-[var(--shadow-border-hover)]",
        ghost: "bg-transparent text-fg hover:bg-surface-2",
        danger: "bg-loss/90 text-fg hover:bg-loss",
        field: "bg-field text-fg btn-field hover:brightness-110",
      },
      size: {
        default: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-6 text-base",
        sm: "min-h-9 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: Props) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
