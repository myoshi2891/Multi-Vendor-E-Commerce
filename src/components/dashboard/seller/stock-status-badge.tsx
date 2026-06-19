import { Badge } from "@/components/ui/badge";
import { getStockStatus, type StockStatus } from "@/lib/utils";

/**
 * src/components/dashboard/seller/stock-status-badge.tsx
 * 在庫ステータスバッジ（F2-5）。
 *
 * Size.quantity と店舗の lowStockThreshold から getStockStatus（@/lib/utils）で
 * ステータスを判定し、色分けしたバッジを描画する純粋表示コンポーネント。
 * 判定ロジックは utils 側の純粋関数に委ね、ここでは「ステータス → 表示」のみを担う
 * （在庫一覧の各行 / アラートサマリーと判定を一致させるため）。
 */

type Props = {
    quantity: number;
    threshold: number;
};

/** ステータスごとの表示定義（ラベル + Badge variant + 追加 className）。 */
const STATUS_DISPLAY: Record<
    StockStatus,
    {
        label: string;
        variant: "destructive" | "secondary" | "outline";
        className?: string;
    }
> = {
    out: { label: "在庫切れ", variant: "destructive" },
    low: {
        label: "残りわずか",
        variant: "secondary",
        // Badge に警告系 variant が無いため、デザイントークン --warning を className で付与する
        className:
            "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
    },
    ok: { label: "在庫あり", variant: "outline" },
};

export default function StockStatusBadge({ quantity, threshold }: Props) {
    const status = getStockStatus(quantity, threshold);
    const { label, variant, className } = STATUS_DISPLAY[status];
    return (
        <Badge variant={variant} className={className}>
            {label}
        </Badge>
    );
}
