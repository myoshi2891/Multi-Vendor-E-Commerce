import type { Metadata } from "next";
import AccountView from "@/components/store/profile/account-view";
import ProfileOverview from "@/components/store/profile/overview";

export const metadata: Metadata = {
    title: "My account | Luxuries for Happiness",
    description: "ご注文やお気に入り、アカウント情報を確認できます。",
};

export default function ProfilePage() {
    return <AccountView identity={<ProfileOverview />} />;
}
