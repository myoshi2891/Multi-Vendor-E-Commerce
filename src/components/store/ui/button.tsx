import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'group/button relative flex w-full cursor-pointer select-none items-center justify-center gap-x-1 whitespace-nowrap rounded-3xl border border-orange-border font-bold leading-6 text-white transition-all duration-300 ease-bezier-1',
    {
        variants: {
            variant: {
                default: 'bg-orange-background hover:bg-orange-hover',
                black: 'bg-black',
                pink: 'bg-[#ffe6e7] text-orange-background hover:bg-[#e4cdce] hover:text-white',
                outline:
                    '!h-7 rounded-md border-orange-background bg-transparent px-2 text-sm font-normal text-orange-background hover:bg-orange-background hover:text-white',
                'orange-gradient':
                    'inline-block h-[36px] rounded-full bg-gradient-to-r from-[#ff0a0a] to-[#ff7539] text-center text-[14px] font-bold leading-[36px] text-white hover:bg-gradient-to-l',
                gray: 'inline-block h-[36px] rounded-full border-[#f5f5f5] bg-[#f5f5f5] text-center text-[14px] font-bold leading-[36px] text-[#222]',
            },
            size: {
                default: 'h-11 py-2',
                icon: 'h-11 min-w-11 max-w-11 rounded-full',
            },

            width: {
                default: 'w-full',
            },
            rounded: {
                full: 'rounded-full',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
            width: 'default',
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        { className, variant, size, width, rounded, asChild = false, ...props },
        ref
    ) => {
        const Comp = asChild ? Slot : 'button'
        return (
            <Comp
                className={cn(
                    buttonVariants({ variant, size, width, rounded, className })
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
