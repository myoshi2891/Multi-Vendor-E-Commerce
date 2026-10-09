import type { ComponentProps } from "react";
import type { UserProfile } from "@clerk/nextjs";
import styles from "./settings.module.css";
export const settingsAppearance = {
    variables: {
        colorPrimary: "var(--purchase-link)",
        colorPrimaryForeground: "var(--purchase-on-dark)",
        colorBackground: "var(--purchase-panel)",
        colorForeground: "var(--purchase-ink)",
        colorMutedForeground: "var(--purchase-muted)",
        colorNeutral: "var(--purchase-ink)",
        colorInput: "var(--purchase-input)",
        colorInputForeground: "var(--purchase-ink)",
        colorDanger: "var(--purchase-danger)",
        colorSuccess: "var(--purchase-success)",
        colorRing: "var(--purchase-focus)",
        fontFamily: "Arial, Helvetica, sans-serif",
        borderRadius: "3px",
    },
    elements: {
        rootBox: styles.root,
        cardBox: styles.cardBox,
        card: styles.card,
        headerTitle: styles.clerkTitle,
        modalContent: styles.portal,
    },
} satisfies NonNullable<ComponentProps<typeof UserProfile>["appearance"]>;
