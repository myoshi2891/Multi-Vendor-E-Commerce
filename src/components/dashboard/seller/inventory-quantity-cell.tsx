"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { updateSizeStock } from "@/queries/inventory";

/**
 * src/components/dashboard/seller/inventory-quantity-cell.tsx
 * 在庫数のインライン編集セル（F2・在庫一覧 DataTable の「在庫数」列）。
 *
 * - useState で編集値、useRef でリエントランシーガード（多重送信防止・tech.md）。
 * - 保存時 updateSizeStock(sizeId, value, storeUrl) を呼び、成功/失敗を toast 表示し
 *   router.refresh() で Server Component（在庫一覧）を再取得する。
 * - 入力は number。空文字/NaN は送信せず元値に戻す（権威ある検証は query 側 Zod）。
 */

type Props = {
    sizeId: string;
    initialQuantity: number;
    storeUrl: string;
};

export default function InventoryQuantityCell({
    sizeId,
    initialQuantity,
    storeUrl,
}: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const isSubmittingRef = useRef(false);
    const [value, setValue] = useState<string>(String(initialQuantity));
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (isSubmittingRef.current) return; // 多重送信防止（早期リターン）

        const trimmed = value.trim();
        const parsed = Number(trimmed);
        // 空文字/NaN/負数/非整数は送信せず元値に戻す（query 側 Zod でも再検証される）。
        // ※ Number("") は 0 になり整数・非負チェックを誤って通過するため、空文字を先に弾く。
        if (trimmed === "" || !Number.isInteger(parsed) || parsed < 0) {
            setValue(String(initialQuantity));
            return;
        }
        // 変更が無ければ何もしない
        if (parsed === initialQuantity) return;

        isSubmittingRef.current = true;
        setSaving(true);
        try {
            await updateSizeStock(sizeId, parsed, storeUrl);
            toast({ title: "在庫数を更新しました" });
            router.refresh();
        } catch (error: unknown) {
            toast({ variant: "destructive", title: "更新に失敗しました" });
            if (error instanceof Error) {
                console.error("[InventoryCell:handleSave] Failed to update size stock", {
                    error: error.message,
                    stack: error.stack,
                });
            } else {
                console.error("[InventoryCell:handleSave] Unknown error", {
                    error,
                });
            }
            setValue(String(initialQuantity)); // 失敗時は表示を元値へ戻す
        } finally {
            isSubmittingRef.current = false; // 必ず解放
            setSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Input
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
                className="h-9 w-24"
                aria-label="在庫数"
            />
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void handleSave()}
            >
                保存
            </Button>
        </div>
    );
}
