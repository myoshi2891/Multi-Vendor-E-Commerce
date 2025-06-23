import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from '@/components/ui/form'
import { ApplyCouponFormSchema } from '@/lib/schemas'
import { CartWithCartItemsType } from '@/lib/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Dispatch, SetStateAction } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '../ui/button'
import toast from 'react-hot-toast'

export default function ApplyCouponForm({
    cartId,
    setCartData,
}: {
    cartId: string
    setCartData: Dispatch<SetStateAction<CartWithCartItemsType>>
}) {
    // Form hook for managing form state and validation
    const form = useForm<z.infer<typeof ApplyCouponFormSchema>>({
        mode: 'onChange', // Form validation mode
        resolver: zodResolver(ApplyCouponFormSchema), // Resolver for form validation
        defaultValues: {
            coupon: '',
        },
    })

    // Loading status & errors
    const { errors, isSubmitting } = form.formState

    // Submit handler for form submission
    const handleSubmit = async (
        values: z.infer<typeof ApplyCouponFormSchema>
    ) => {
        try {
            const res = await applyCoupon(values.coupon, cartId)
            setCartData(res.cart)
            toast.success(res.message)
        } catch (error: any) {
            console.log(error)

            toast.error(error.toString())
        }
    }

    return (
        <div className="rounded-xl">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    {/* Form items */}
                    <div className="relative rounded-2xl bg-gray-100 p-1.5 shadow-sm hover:shadow-md">
                        <FormField
                            control={form.control}
                            name="coupon"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <input
                                            className="w-full rounded-lg bg-transparent py-3 pl-8 pr-24 text-base text-main-primary focus:outline-none"
                                            type="text"
                                            placeholder="Coupon code"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <Button
                            variant="outline"
                            className="absolute right-2 top-1/2 w-20 -translate-y-1/2 rounded-2xl px-6"
                        >
                            Apply
                        </Button>
                    </div>
                    <div className="mt-3">
                        {errors.coupon && (
                            <FormMessage className="text-xs">
                                {errors.coupon.message}
                            </FormMessage>
                        )}
                    </div>
                </form>
            </Form>
        </div>
    )
}
