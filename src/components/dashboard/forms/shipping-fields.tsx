"use client";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import styles from "../design/seller.module.css";

/** [フィールド名, ラベル, min, step] */
export type ShippingNumberField<T extends FieldValues> = readonly [
    FieldPath<T>,
    string,
    number,
    number,
];

/**
 * 既定配送設定・国別配送料フォームで共通の入力群
 * （配送サービス・数値グリッド・返品ポリシー）。
 */
export default function ShippingFields<T extends FieldValues>({
    control,
    serviceName,
    numberFields,
    returnPolicyName,
}: {
    control: Control<T>;
    serviceName: FieldPath<T>;
    numberFields: readonly ShippingNumberField<T>[];
    returnPolicyName: FieldPath<T>;
}) {
    return (
        <>
            <FormField
                control={control}
                name={serviceName}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Shipping service</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <div className={styles.grid}>
                {numberFields.map(([name, label, min, step]) => (
                    <FormField
                        key={name}
                        control={control}
                        name={name}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{label}</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={min}
                                        step={step}
                                        {...field}
                                        onChange={(event) =>
                                            field.onChange(
                                                event.target.value === ""
                                                    ? NaN
                                                    : Number(event.target.value)
                                            )
                                        }
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}
            </div>
            <FormField
                control={control}
                name={returnPolicyName}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Return policy</FormLabel>
                        <FormControl>
                            <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}
