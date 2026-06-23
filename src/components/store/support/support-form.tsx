"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SupportTicketSchema, type SupportTicketInput } from "@/lib/schemas";
import { createSupportTicket } from "@/queries/support";
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

interface SupportFormProps {
    category: SupportTicketInput["category"];
    submitLabel?: string;
}

/**
 * Renders a support ticket submission form.
 *
 * The form collects name, email, subject, and message. An orderId field is conditionally displayed when the category is "RETURN_REQUEST" or "DISPUTE". After successful submission, displays a confirmation message instead of the form. Submission errors are displayed on the form.
 *
 * @param category - The support ticket category, determining whether the orderId field is displayed.
 * @param submitLabel - Optional text for the submit button; defaults to "送信" if not provided.
 */
export default function SupportForm({
    category,
    submitLabel,
}: Readonly<SupportFormProps>) {
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

    const onSubmit = async (values: SupportTicketInput) => {
        if (isSubmittingRef.current) return; // 早期リターン（二重送信防止）
        isSubmittingRef.current = true;
        try {
            await createSupportTicket(values);
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
        return <output>受け付けました。担当より追ってご連絡します。</output>;

    // shadcn/ui Form プリミティブで描画（既存ダッシュボードフォームのスタイルに準拠）。
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* ルートエラー（server action からの汎用エラー）を上部に表示 */}
                {form.formState.errors.root?.message && (
                    <p role="alert" className="text-sm text-destructive">
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
                                <Input {...field} />
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
                                <Input type="email" {...field} />
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
                                <Input {...field} />
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
                                <Textarea rows={6} {...field} />
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
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {submitLabel ?? "送信"}
                </Button>
            </form>
        </Form>
    );
}
