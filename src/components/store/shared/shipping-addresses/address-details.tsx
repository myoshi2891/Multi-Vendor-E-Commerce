'use client'

// React
import { Dispatch, FC, SetStateAction, useEffect, useState } from 'react'

// Prisma model
import { Country } from '@prisma/client'

// Form handling utilities
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

// Schema
import { ShippingAddressSchema } from '@/lib/schemas'

// UI Components
import CountrySelector from '@/components/shared/country-selector'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Button } from '../../ui/button'
// import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Queries
import { upsertShippingAddress } from '@/queries/user'

// Utils
import { v4 } from 'uuid'
// import { useToast } from "@/components/ui/use-toast";
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

// types
import { SelectMenuOption, UserShippingAddressType } from '@/lib/types'

interface AddressDetailsProps {
    data?: UserShippingAddressType
    countries: Country[]
    setShow: Dispatch<SetStateAction<boolean>>
}

const AddressDetails: FC<AddressDetailsProps> = ({
    data,
    countries,
    setShow,
}) => {
    // Initializing necessary hooks
    const { toast } = useToast() // Hook for displaying toast messages
    const router = useRouter() // Hook for routing

    // State for country selector
    const [isOpen, setIsOpen] = useState<boolean>(false)

    // State for selected country
    const [country, setCountry] = useState<string>('Afghanistan')

    // Form hook for managing form state and validation
    const form = useForm<z.infer<typeof ShippingAddressSchema>>({
        mode: 'onChange', // Form validation mode
        resolver: zodResolver(ShippingAddressSchema), // Resolver for form validation
        defaultValues: {
            // Setting default form values from data (if available)
            firstName: data?.firstName ?? '',
            lastName: data?.lastName ?? '',
            phone: data?.phone ?? '',
            address1: data?.address1 ?? '',
            address2: data?.address2 ?? '',
            city: data?.city ?? '',
            countryId: data?.countryId,
            state: data?.state ?? '',
            zip_code: data?.zip_code ?? '',
            default: data?.default ?? false,
        },
    })

    // Loading status based on form submission
    const isLoading = form.formState.isSubmitting

    // Reset form values when data changes
    useEffect(() => {
        if (data) {
            form.reset({
                ...data,
                address2: data.address2 || '',
            })
            handleCountryChange(data?.country.name)
        }
    }, [data, form])

    // Submit handler for form submission
    const handleSubmit = async (
        values: z.infer<typeof ShippingAddressSchema>
    ) => {
        try {
            // Upserting Address data
            const response = await upsertShippingAddress({
                id: data?.id ? data.id : v4(),
                firstName: values.firstName,
                lastName: values.lastName,
                phone: values.phone,
                address1: values.address1,
                address2: values.address2 || '',
                city: values.city,
                countryId: values.countryId,
                state: values.state,
                zip_code: values.zip_code,
                default: values.default,
                userId: '',
                createdAt: new Date(),
                updatedAt: new Date(),
            })

            // Displaying success message
            toast({
                title: data?.id
                    ? 'Shipping address has been updated.'
                    : `Congratulations! Shipping address is now created.`,
            })

            // Refresh data
            router.refresh()
            setShow(false)
        } catch (error: any) {
            // Handling form submission errors
            console.log(error)
            toast({
                variant: 'destructive',
                title: 'Oops!',
                description: error.toString(),
            })
        }
    }

    const handleCountryChange = (name: string) => {
        const country = countries.find((c) => c.name === name)
        if (country) {
            form.setValue('countryId', country?.id)
        }
        setCountry(name)
    }

    return (
        <div>
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <FormLabel>Contact information</FormLabel>
                        <div className="flex items-center justify-between gap-3">
                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="First name"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="lastName"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="Last name"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem className="!mt-3 w-[calc(50%-8px)] flex-1">
                                    <FormControl>
                                        <Input
                                            placeholder="Phone number"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="space-y-2">
                        <FormLabel>Address</FormLabel>
                        <div>
                            <FormField
                                control={form.control}
                                name="countryId"
                                render={({ field }) => (
                                    <FormItem className="!mt-3 w-[calc(50%-8px)] flex-1">
                                        <FormControl>
                                            <CountrySelector
                                                id={'countries'}
                                                open={isOpen}
                                                onToggle={() =>
                                                    setIsOpen((prev) => !prev)
                                                }
                                                onChange={(val) =>
                                                    handleCountryChange(val)
                                                }
                                                selectedValue={
                                                    (countries.find(
                                                        (c) =>
                                                            c.name === country
                                                    ) as SelectMenuOption) ||
                                                    countries[0]
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="!mt-3 flex items-center justify-between gap-3">
                            <FormField
                                control={form.control}
                                name="address1"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="Street, house/apartment/unit"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="address2"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="Apt, suite, unit, etc (optional)"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="!mt-3 flex items-center justify-between gap-3">
                            <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="City"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="state"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="State/Province"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="zip_code"
                            render={({ field }) => (
                                <FormItem className="!mt-3 w-[calc(50%-8px)] flex-1">
                                    <FormControl>
                                        <Input
                                            placeholder="Zip code"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="rounded-md"
                    >
                        {isLoading
                            ? 'loading...'
                            : data?.id
                              ? 'Save Address information'
                              : 'Create Address'}
                    </Button>
                </form>
            </Form>
        </div>
    )
}

export default AddressDetails
