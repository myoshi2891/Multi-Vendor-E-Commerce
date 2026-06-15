'use client'

import { FC, useEffect } from 'react'
import { Prisma } from '@prisma/client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { AdminCouponFormSchema } from '@/lib/schemas'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { upsertCouponAsAdmin } from '@/queries/coupon'
import { v4 } from 'uuid'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CouponFormFields } from './coupon-form-fields'

type AdminCouponType = Prisma.CouponGetPayload<{ include: { store: true } }>

interface AdminCouponDetailsProps {
    data?: AdminCouponType | null
}

const AdminCouponDetails: FC<AdminCouponDetailsProps> = ({ data }) => {
    const { toast } = useToast()
    const router = useRouter()

    const form = useForm<z.infer<typeof AdminCouponFormSchema>>({
        mode: 'onChange',
        resolver: zodResolver(AdminCouponFormSchema),
        defaultValues: {
            code: data?.code ?? '',
            discount: data?.discount ?? 0,
            startDate:
                data?.startDate || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            endDate:
                data?.endDate || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            isActive: data?.isActive ?? true,
            storeId: data?.storeId ?? '',
        },
    })

    const isLoading = form.formState.isSubmitting

    useEffect(() => {
        if (data) {
            form.reset({
                code: data.code,
                discount: data.discount,
                startDate: data.startDate,
                endDate: data.endDate,
                isActive: data.isActive,
                storeId: data.storeId,
            })
        }
    }, [data, form])

    const handleSubmit = async (
        values: z.infer<typeof AdminCouponFormSchema>
    ) => {
        try {
            const response = await upsertCouponAsAdmin({
                id: data?.id ?? v4(),
                code: values.code,
                discount: values.discount,
                startDate: values.startDate,
                endDate: values.endDate,
                isActive: values.isActive,
                storeId: values.storeId,
                createdAt: data?.createdAt ?? new Date(),
                updatedAt: new Date(),
            })

            toast({
                title: data?.id
                    ? 'Coupon has been updated.'
                    : `Coupon '${response?.code}' created.`,
            })

            router.refresh()
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : 'An unknown error occurred'
            if (error instanceof Error) {
                console.error('[AdminCouponDetails] Error submitting form:', {
                    error: error.message,
                    stack: error.stack,
                })
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
                        ? `Update ${data.code} coupon.`
                        : 'Create a new coupon.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data?.store && (
                    <p className="mb-4 text-sm text-muted-foreground">
                        Store:{' '}
                        <span className="font-medium text-foreground">
                            {data.store.name}
                        </span>
                    </p>
                )}
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        {!data?.id && (
                            <FormField
                                control={form.control}
                                name="storeId"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>Store ID</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Store ID"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <CouponFormFields control={form.control} />

                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center gap-3">
                                    <FormLabel className="mt-1">
                                        Active
                                    </FormLabel>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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

export default AdminCouponDetails
