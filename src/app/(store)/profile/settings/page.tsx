import styles from "@/components/store/profile/settings/settings.module.css";
import { settingsAppearance } from "@/components/store/profile/settings/appearance";
import { UserProfile } from "@clerk/nextjs";

/**
 * 顧客アカウント設定ページ。
 * Clerk の <UserProfile /> を埋め込み、氏名/メール編集・パスワード変更・MFA・
 * アカウント削除を提供する。これらの編集は Clerk webhook (user.updated /
 * user.deleted) 経由で Prisma User に自動同期される（src/app/api/webhooks/route.ts）。
 *
 * routing="hash" を用いることで catch-all route ([[...rest]]) を不要にする。
 * src/queries 経由の DB 呼び出しが無いため force-dynamic は付与しない。
 *
 * 認可: 親の ProfileLayout（src/app/(store)/profile/layout.tsx）が `auth()` で
 * 検証し、未認証アクセスはサインインへリダイレクトされるため、ページ本体での
 * requireUser() は不要（DB 呼び出しの無い Clerk UI 埋め込みのみ）。
 */
export default function ProfileSettingsPage() {
    return (
        <section
            className={styles.page}
            aria-labelledby="account-settings-title"
        >
            <header className={styles.heading}>
                <p className={styles.eyebrow}>Your account</p>
                <h1 id="account-settings-title">Account settings</h1>
                <p>Manage your profile and account security.</p>
            </header>
            <UserProfile routing="hash" appearance={settingsAppearance} />
        </section>
    );
}
