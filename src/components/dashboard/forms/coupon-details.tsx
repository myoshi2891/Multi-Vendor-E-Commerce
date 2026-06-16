'use client'

import { FC, useEffect } from 'react'
import { Coupon } from '@prisma/client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { CouponFormSchema } from '@/lib/schemas'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { upsertCoupon } from '@/queries/coupon'
import { v4 } from 'uuid'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CouponFormFields } from './coupon-form-fields'

interface CouponDetailsProps {
    data?: Coupon
    storeUrl: string
}

const CouponDetails: FC<CouponDetailsProps> = ({ data, storeUrl }) => {
    const { toast } = useToast()
    const router = useRouter()

    const form = useForm<z.infer<typeof CouponFormSchema>>({
        mode: 'onChange',
        resolver: zodResolver(CouponFormSchema),
        defaultValues: {
            code: data?.code,
            discount: data?.discount ?? 0,
            startDate:
                data?.startDate || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            endDate:
                data?.endDate || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        },
    })

    const isLoading = form.formState.isSubmitting

    useEffect(() => {
        if (data) {
            form.reset(data)
        }
    }, [data, form])

    const handleSubmit = async (values: z.infer<typeof CouponFormSchema>) => {
        try {
            const response = await upsertCoupon(
                {
                    id: data?.id ?? v4(),
                    code: values.code,
                    discount: values.discount,
                    startDate: values.startDate,
                    endDate: values.endDate,
                    isActive: data?.isActive ?? true,
                    scope: 'STORE',
                    storeId: '',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                storeUrl
            )

            toast({
                title: data?.id
                    ? 'Coupon has been updated.'
                    : `Congratulations! '${response?.code}' is now created.`,
            })

            if (data?.id) {
                router.refresh()
            } else {
                router.push(`/dashboard/seller/stores/${storeUrl}/coupons`)
            }
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : 'An unknown error occurred'
            if (error instanceof Error) {
                console.error('[CouponDetails] Error submitting form:', {
                    error: error.message,
                    stack: error.stack,
                })
            } else {
                console.error('[CouponDetails] Unknown error:', { error })
            }
            toast({
                variant: 'destructive',
                title: 'Oops!',
                description: message,
            })
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Coupon Information</CardTitle>
                <CardDescription>
                    {data?.id
                        ? `Update ${data.code} Coupon information.`
                        : 'Create a Coupon. You can edit it later from the Coupons table or the Coupon page.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <CouponFormFields control={form.control} />

                        <Button type="submit" disabled={isLoading}>
                            {isLoading
                                ? 'loading...'
                                : data?.id
                                  ? 'Save Coupon information'
                                  : 'Create Coupon'}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}

export default CouponDetails
