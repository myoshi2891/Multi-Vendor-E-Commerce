"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SupportTicketSchema, type SupportTicketInput } from "@/lib/schemas";
import type { createSupportTicket } from "@/queries/support";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import styles from "./support-form.module.css";

interface SupportFormProps {
    category: SupportTicketInput["category"];
    submitAction: typeof createSupportTicket;
    appearance?: "default" | "brand";
    submitLabel?: string;
}

export default function SupportForm({
    category,
    submitLabel,
    submitAction,
    appearance = "default",
}: Readonly<SupportFormProps>) {
    const branded = appearance === "brand";
    // orderId 欄の要否は category から導出する（schemas.ts の superRefine と同一条件）。
    // caller が category と requireOrderId を別々に渡してずれる事故を防ぐ。
    const requireOrderId =
        category === "RETURN_REQUEST" || category === "DISPUTE";
    const isSubmittingRef = useRef(false);
    const [done, setDone] = useState(false);
    const form = useForm<SupportTicketInput>({
        resolver: zodResolver(SupportTicketSchema),
        defaultValues: {
            category,
            name: "",
            email: "",
            subject: "",
            message: "",
            orderId: "",
        },
    });

    const lockInputs = branded && form.formState.isSubmitting;

    const onSubmit = async (values: SupportTicketInput) => {
        if (isSubmittingRef.current) return; // 早期リターン（二重送信防止）
        isSubmittingRef.current = true;
        try {
            await submitAction(values);
            setDone(true);
            form.reset({
                ...form.getValues(),
                name: "",
                email: "",
                subject: "",
                message: "",
                orderId: "",
            });
        } catch (error: unknown) {
            // ユーザー向けエラーは form のルートエラーに反映（console は使わない）。
            const message =
                error instanceof Error ? error.message : "送信に失敗しました。";
            form.setError("root", { message });
        } finally {
            isSubmittingRef.current = false;
        }
    };

    if (done)
        return (
            <output className={branded ? styles.success : undefined}>
                {branded && (
                    <CheckCircle2
                        size={28}
                        strokeWidth={1.5}
                        aria-hidden="true"
                    />
                )}
                受け付けました。担当より追ってご連絡します。
            </output>
        );

    // shadcn/ui Form プリミティブで描画（既存ダッシュボードフォームのスタイルに準拠）。
    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className={branded ? styles.form : "space-y-4"}
                aria-busy={form.formState.isSubmitting}
                noValidate
            >
                {/* ルートエラー（server action からの汎用エラー）を上部に表示 */}
                {form.formState.errors.root?.message && (
                    <p
                        role="alert"
                        className={
                            branded ? styles.error : "text-sm text-destructive"
                        }
                    >
                        {form.formState.errors.root.message}
                    </p>
                )}

                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>お名前</FormLabel>
                            <FormControl>
                                <Input
                                    className={
                                        branded ? styles.input : undefined
                                    }
                                    disabled={lockInputs}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>メールアドレス</FormLabel>
                            <FormControl>
                                <Input
                                    className={
                                        branded ? styles.input : undefined
                                    }
                                    disabled={lockInputs}
                                    type="email"
                                    autoComplete="email"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>件名</FormLabel>
                            <FormControl>
                                <Input
                                    className={
                                        branded ? styles.input : undefined
                                    }
                                    disabled={lockInputs}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>内容</FormLabel>
                            <FormControl>
                                <Textarea
                                    className={
                                        branded ? styles.textarea : undefined
                                    }
                                    disabled={lockInputs}
                                    rows={6}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* RETURN_REQUEST / DISPUTE のときのみ orderId 欄を表示 */}
                {requireOrderId && (
                    <FormField
                        control={form.control}
                        name="orderId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>対象の注文番号</FormLabel>
                                <FormControl>
                                    <Input
                                        className={
                                            branded ? styles.input : undefined
                                        }
                                        disabled={lockInputs}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <Button
                    className={branded ? styles.submit : undefined}
                    type="submit"
                    disabled={form.formState.isSubmitting}
                >
                    {branded && form.formState.isSubmitting
                        ? "送信中…"
                        : (submitLabel ?? "送信")}
                </Button>
            </form>
        </Form>
    );
}
