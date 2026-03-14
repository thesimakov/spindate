import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Кнопки в ярком casual‑стиле, как в match‑3 / mobile UI
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-tight transition-all disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-[1px] active:shadow-[0_4px_0_rgba(0,0,0,0.25)] focus-visible:ring-[3px] focus-visible:ring-ring/60",
  {
    variants: {
      variant: {
        // Ярко‑зелёная основная кнопка
        default:
          'text-white bg-[linear-gradient(180deg,#6dff7c_0%,#22c45e_45%,#03913c_100%)] border-2 border-[#027334] hover:brightness-110',
        // Красная кнопка «опасных» действий
        destructive:
          'text-white bg-[linear-gradient(180deg,#ff7f7f_0%,#ff3b3b_45%,#c01724_100%)] border-2 border-[#8f111b] hover:brightness-110 focus-visible:ring-destructive/40',
        // Плоская кнопка с цветной кромкой
        outline:
          'bg-[rgba(255,255,255,0.06)] text-white border-2 border-[#3fd0ff] shadow-[0_4px_0_rgba(0,0,0,0.25)] hover:bg-[rgba(255,255,255,0.12)]',
        // Голубая вторичная кнопка
        secondary:
          'text-white bg-[linear-gradient(180deg,#78d6ff_0%,#1ea5ff_45%,#0a6bd1_100%)] border-2 border-[#08509e] hover:brightness-110',
        // Прозрачная «призрачная» кнопка
        ghost:
          'bg-transparent text-[#ffe38a] hover:bg-[rgba(255,255,255,0.08)] border border-transparent',
        // Ссылка без подложки
        link: 'text-[#7fd3ff] underline-offset-4 hover:underline bg-transparent border-none shadow-none rounded-none px-0',
      },
      size: {
        default: 'h-10 px-6 has-[>svg]:px-4',
        sm: 'h-8 gap-1.5 px-4 text-xs has-[>svg]:px-3',
        lg: 'h-11 px-7 text-base has-[>svg]:px-5',
        icon: 'size-10',
        'icon-sm': 'size-8',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
