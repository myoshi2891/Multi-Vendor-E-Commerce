import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { getRecentStores } from "@/queries/dashboard";

type RecentStore = Awaited<ReturnType<typeof getRecentStores>>[number];

interface Props {
    design?: "seller";
    stores: RecentStore[];
}

const STATUS_LABEL: Record<string, string> = {
    ACTIVE: "アクティブ",
    PENDING: "審査中",
    BANNED: "BAN",
    DISABLED: "無効",
};

const STATUS_VARIANT: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
> = {
    ACTIVE: "default",
    PENDING: "secondary",
    BANNED: "destructive",
    DISABLED: "outline",
};

/**
 * Renders a dashboard card displaying recent stores with their creation dates and status badges.
 */
export function RecentStores({ stores, design }: Props) {
    return (
        <Card>
            <CardHeader>
                {design === "seller" ? (
                    <h2>新規店舗</h2>
                ) : (
                    <CardTitle>新規店舗</CardTitle>
                )}
            </CardHeader>
            <CardContent>
                {stores.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        店舗がありません。
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {stores.map((store) => (
                            <li
                                key={store.id}
                                className="flex flex-wrap items-center justify-between gap-3 text-sm"
                            >
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-medium">
                                        {store.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {store.createdAt.toLocaleDateString(
                                            "ja-JP"
                                        )}
                                    </span>
                                </div>
                                <Badge
                                    variant={
                                        STATUS_VARIANT[store.status] ??
                                        "outline"
                                    }
                                >
                                    {STATUS_LABEL[store.status] ?? store.status}
                                </Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
