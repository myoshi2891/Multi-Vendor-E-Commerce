import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'group/button relative w-full flex items-center justify-center gap-x-1 text-white rounded-3xl leading-6 font-bold whitespace-nowrap border border-orange-border cursor-pointer transition-all duration-300 ease-bezier-1 select-none',
    {
        variants: {
            variant: {
                default: 'bg-orange-background hover:bg-orange-hover',
                black: 'bg-black',
                pink: 'bg-[#ffe6e7] text-orange-background hover:bg-[#e4cdce] hover:text-white',
                outline:
                    'bg-transparent hover:bg-orange-background hover:text-white text-orange-background rounded-md border-orange-background px-2 !h-7 text-sm font-normal',
                'orange-gradient':
                    'bg-gradient-to-r from-[#ff0a0a] to-[#ff7539] hover:bg-gradient-to-l text-white inline-block w-full h-[36px] leading-[36px] text-[14px] font-bold text-center rounded-full cursor-pointer',
                gray: 'bg-[#f5f5f5] text-[#222] border-[#f5f5f5] inline-block w-full h-[36px] leading-[36px] text-[14px] font-bold text-center rounded-full cursor-pointer',
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
