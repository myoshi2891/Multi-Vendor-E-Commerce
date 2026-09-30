import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import AuthFrame from "@/components/store/auth/auth-frame";
import { authAppearance } from "@/components/store/auth/appearance";

export const metadata: Metadata = { title: "Sign up | Luxuries for Happiness" };

export default function SignUpPage() {
    return (
        <AuthFrame mode="sign-up">
            <SignUp appearance={authAppearance} />
        </AuthFrame>
    );
}
