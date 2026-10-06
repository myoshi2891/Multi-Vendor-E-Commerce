import { currentUser } from "@clerk/nextjs/server";
import AccountMenu from "./account-menu";

export default async function UserMenu({
    disclosureName,
}: Readonly<{ disclosureName?: string }> = {}) {
    // Clerk の外部呼び出しは try/catch でラップする（規約: 外部 API 呼び出し）。
    // 取得失敗時は user=null のままサインイン/登録ブランチを描画して安全に縮退する。
    let user: Awaited<ReturnType<typeof currentUser>> = null;
    try {
        user = await currentUser();
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[UserMenu] Failed to fetch current user", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error("[UserMenu] Failed to fetch current user (unknown)", {
                error,
            });
        }
    }

    return (
        <AccountMenu
            user={
                user
                    ? { imageUrl: user.imageUrl, fullName: user.fullName }
                    : null
            }
            disclosureName={disclosureName}
        />
    );
}
