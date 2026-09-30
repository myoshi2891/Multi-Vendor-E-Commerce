import type { ComponentProps } from "react";
import type { SignIn } from "@clerk/nextjs";
import styles from "./auth.module.css";

/** Shared across Clerk's sign-in/sign-up steps; redirect behavior stays with Clerk. */
export const authAppearance = {
    variables: {
        colorPrimary: "#d4ba83",
        colorPrimaryForeground: "#141c16",
        colorBackground: "#f3f0e8",
        colorForeground: "#17251d",
        colorMutedForeground: "#536356",
        colorNeutral: "#17251d",
        colorInput: "#faf8f2",
        colorInputForeground: "#17251d",
        colorDanger: "#a02222",
        colorSuccess: "#31583b",
        colorRing: "#8b7346",
        fontFamily: 'Arial, "Noto Sans JP", sans-serif',
        fontFamilyButtons: 'Arial, "Noto Sans JP", sans-serif',
        borderRadius: "0px",
    },
    elements: {
        rootBox: styles.clerkRoot,
        cardBox: styles.cardBox,
        card: styles.card,
        headerTitle: styles.clerkTitle,
        headerSubtitle: styles.clerkSubtitle,
        socialButtonsBlockButton: styles.socialButton,
        socialButtonsIconButton: styles.socialButton,
        formFieldInput: styles.input,
        formButtonPrimary: styles.primaryButton,
        footer: styles.clerkFooter,
        footerActionLink: styles.clerkLink,
        formFieldAction: styles.clerkLink,
        formResendCodeLink: styles.clerkLink,
        identityPreviewEditButton: styles.clerkLink,
        backLink: styles.clerkLink,
    },
} satisfies NonNullable<ComponentProps<typeof SignIn>["appearance"]>;
