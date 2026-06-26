"use client";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrackOrderSchema, type TrackOrderInput } from "@/lib/schemas";
import { trackOrder } from "@/queries/order";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import TrackOrderResult from "./track-order-result";

/**
 * 注文追跡フォーム（公開）。注文番号 + メールを送信し、一致した注文の配送状況を表示する。
 *
 * - 本人性は server action（trackOrder）側で「所有者 email との一致」で検証する。
 * - 不一致・不存在は区別せず単一メッセージ（列挙防止）。
 * - useRef で二重送信を防止する（NFR-TO4）。
 */
export default function TrackOrderForm() {
    const isSubmittingRef = useRef(false);
    const [result, setResult] =
        useState<Awaited<ReturnType<typeof trackOrder>>>(null);
    const [notFound, setNotFound] = useState(false);

    const form = useForm<TrackOrderInput>({
        resolver: zodResolver(TrackOrderSchema),
        defaultValues: { orderId: "", email: "" },
    });

    const onSubmit = async (values: TrackOrderInput) => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setNotFound(false);
        try {
            const data = await trackOrder(values);
            if (!data) setNotFound(true);
            setResult(data);
        } finally {
            isSubmittingRef.current = false;
        }
    };

    return (
        <div>
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                    noValidate
                >
                    <FormField
                        control={form.control}
                        name="orderId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>注文番号</FormLabel>
                                <FormControl>
                                    <Input placeholder="注文番号" {...field} />
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
                                        type="email"
                                        placeholder="メールアドレス"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        追跡する
                    </Button>
                </form>
            </Form>

            {notFound ? (
                <p role="status" className="mt-6 text-sm text-muted-foreground">
                    注文が見つかりませんでした。
                </p>
            ) : null}
            {result ? <TrackOrderResult order={result} /> : null}
        </div>
    );
}
