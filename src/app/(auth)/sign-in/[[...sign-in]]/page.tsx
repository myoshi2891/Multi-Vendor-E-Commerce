import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import AuthFrame from "@/components/store/auth/auth-frame";
import { authAppearance } from "@/components/store/auth/appearance";

export const metadata: Metadata = { title: "Sign in | Luxuries for Happiness" };

export default function SignInPage() {
    return (
        <AuthFrame mode="sign-in">
            <SignIn appearance={authAppearance} />
        </AuthFrame>
    );
}
