"use client";

import { Control, FieldValues, Path } from "react-hook-form";
import { format } from "date-fns";
import DateTimePicker from "react-datetime-picker";
import { NumberInput } from "@tremor/react";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import "react-calendar/dist/Calendar.css";
import "react-clock/dist/Clock.css";
import "react-datetime-picker/dist/DateTimePicker.css";

type CouponBaseValues = {
    code: string;
    discount: number;
    startDate: string;
    endDate: string;
};

interface CouponFormFieldsProps<T extends FieldValues & CouponBaseValues> {
    design?: "seller";
    control: Control<T>;
}

/**
 * Renders form fields for creating or editing coupon information.
 *
 * @param control - A react-hook-form Control object for managing form state and validation
 * @returns A React fragment containing the four coupon form fields
 */
export function CouponFormFields<T extends FieldValues & CouponBaseValues>({
    control,
    design,
}: CouponFormFieldsProps<T>) {
    if (design === "seller")
        return (
            <>
                {(
                    [
                        ["code", "Coupon code", "text"],
                        ["discount", "Coupon discount", "number"],
                        ["startDate", "Start date", "datetime-local"],
                        ["endDate", "End date", "datetime-local"],
                    ] as const
                ).map(([name, label, type]) => (
                    <FormField
                        key={name}
                        control={control}
                        name={name as Path<T>}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{label}</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type={type}
                                        value={
                                            type === "number"
                                                ? Number(field.value)
                                                : String(field.value ?? "")
                                        }
                                        min={type === "number" ? 1 : undefined}
                                        max={type === "number" ? 99 : undefined}
                                        step={type === "text" ? undefined : 1}
                                        onChange={(event) =>
                                            field.onChange(
                                                type === "number"
                                                    ? event.target.valueAsNumber
                                                    : type ===
                                                            "datetime-local" &&
                                                        event.target.value
                                                            .length === 16
                                                      ? `${event.target.value}:00`
                                                      : event.target.value
                                            )
                                        }
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}
            </>
        );
    return (
        <>
            <FormField
                control={control}
                name={"code" as Path<T>}
                render={({ field }) => (
                    <FormItem className="flex-1">
                        <FormLabel>Coupon code</FormLabel>
                        <FormControl>
                            <Input placeholder="Coupon code" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name={"discount" as Path<T>}
                render={({ field }) => (
                    <FormItem className="flex-1">
                        <FormLabel>Coupon discount</FormLabel>
                        <FormControl>
                            <NumberInput
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="%"
                                min={1}
                                className="rounded-md !text-sm !shadow-none"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name={"startDate" as Path<T>}
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start date</FormLabel>
                        <FormControl>
                            <DateTimePicker
                                onChange={(date) =>
                                    field.onChange(
                                        date
                                            ? format(
                                                  date,
                                                  "yyyy-MM-dd'T'HH:mm:ss"
                                              )
                                            : ""
                                    )
                                }
                                value={
                                    field.value ? new Date(field.value) : null
                                }
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name={"endDate" as Path<T>}
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>End date</FormLabel>
                        <FormControl>
                            <DateTimePicker
                                onChange={(date) =>
                                    field.onChange(
                                        date
                                            ? format(
                                                  date,
                                                  "yyyy-MM-dd'T'HH:mm:ss"
                                              )
                                            : ""
                                    )
                                }
                                value={
                                    field.value ? new Date(field.value) : null
                                }
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}
