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
 * Renders the public order tracking form.
 *
 * Submits an order ID and email address to look up a matching order and display its tracking details or a status message.
 */
export default function TrackOrderForm() {
    const isSubmittingRef = useRef(false);
    const [result, setResult] =
        useState<Awaited<ReturnType<typeof trackOrder>>>(null);
    const [notFound, setNotFound] = useState(false);
    const [failed, setFailed] = useState(false);

    const form = useForm<TrackOrderInput>({
        resolver: zodResolver(TrackOrderSchema),
        defaultValues: { orderId: "", email: "" },
    });

    // 直前の照会結果（result/notFound/failed）を即座にクリアする。
    // 表示中の状態を常に「現在の入力」に同期させ、再照会中やバリデーション失敗時に
    // 古い結果や not-found メッセージが残らないようにする。
    const resetLookup = () => {
        setResult(null);
        setNotFound(false);
        setFailed(false);
    };

    const onSubmit = async (values: TrackOrderInput) => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        resetLookup();
        try {
            const data = await trackOrder(values);
            if (!data) setNotFound(true);
            setResult(data);
        } catch {
            // trackOrder が一過性のインフラ障害を throw した場合は not-found ではなく
            // 汎用の再試行メッセージを表示する（不存在/不一致の null とは区別する）。
            setFailed(true);
        } finally {
            isSubmittingRef.current = false;
        }
    };

    return (
        <div>
            <Form {...form}>
                <form
                    onSubmit={(e) =>
                        void form.handleSubmit(onSubmit, resetLookup)(e)
                    }
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

            {failed ? (
                <output className="mt-6 block text-sm text-destructive">
                    注文の照会に失敗しました。時間をおいて再度お試しください。
                </output>
            ) : null}
            {notFound ? (
                <output className="mt-6 block text-sm text-muted-foreground">
                    注文が見つかりませんでした。
                </output>
            ) : null}
            {result ? <TrackOrderResult order={result} /> : null}
        </div>
    );
}
