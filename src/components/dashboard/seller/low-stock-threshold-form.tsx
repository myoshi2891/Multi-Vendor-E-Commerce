"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { updateStoreLowStockThreshold } from "@/queries/inventory";

/**
 * src/components/dashboard/seller/low-stock-threshold-form.tsx
 * 店舗の過小在庫しきい値（Store.lowStockThreshold）設定フォーム（F2）。
 *
 * 単一の数値入力のため RHF+Zod ではなく軽量な制御コンポーネントで実装する
 * （inventory-quantity-cell と同じ送信パターン: リエントランシーガード + toast + refresh）。
 * 権威ある検証は updateStoreLowStockThreshold 内の Zod（LowStockThresholdSchema）に委ねる。
 */

type Props = {
    storeUrl: string;
    initialThreshold: number;
};

export default function LowStockThresholdForm({
    storeUrl,
    initialThreshold,
}: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const isSubmittingRef = useRef(false);
    const [value, setValue] = useState<string>(String(initialThreshold));
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (isSubmittingRef.current) return; // 多重送信防止

        const trimmed = value.trim();
        const parsed = Number(trimmed);
        // ※ Number("") は 0 になり整数・非負チェックを誤って通過するため、空文字を先に弾く。
        if (trimmed === "" || !Number.isInteger(parsed) || parsed < 0) {
            setValue(String(initialThreshold));
            return;
        }
        if (parsed === initialThreshold) return;

        isSubmittingRef.current = true;
        setSaving(true);
        try {
            await updateStoreLowStockThreshold(storeUrl, parsed);
            toast({ title: "しきい値を更新しました" });
            router.refresh();
        } catch (error: unknown) {
            toast({ variant: "destructive", title: "更新に失敗しました" });
            if (error instanceof Error) {
                console.error(
                    "[LowStockThresholdForm:handleSave] Failed to update threshold",
                    { error: error.message, stack: error.stack }
                );
            } else {
                console.error(
                    "[LowStockThresholdForm:handleSave] Unknown error",
                    { error }
                );
            }
            setValue(String(initialThreshold));
        } finally {
            isSubmittingRef.current = false;
            setSaving(false);
        }
    };

    return (
        <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="low-stock-threshold"
                    className="text-sm font-medium"
                >
                    過小在庫しきい値
                </label>
                <Input
                    id="low-stock-threshold"
                    type="number"
                    min={0}
                    step={1}
                    value={value}
                    disabled={saving}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSave();
                        }
                    }}
                    className="h-9 w-28"
                />
            </div>
            <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => void handleSave()}
            >
                保存
            </Button>
        </div>
    );
}
