import type { ComponentProps } from "react";
import type { UserProfile } from "@clerk/nextjs";
import styles from "./settings.module.css";
export const settingsAppearance = {
    variables: {
        colorPrimary: "#755b2f",
        colorPrimaryForeground: "#ffffff",
        colorBackground: "#faf8f2",
        colorForeground: "#17251d",
        colorMutedForeground: "#536356",
        colorNeutral: "#17251d",
        colorInput: "#faf8f2",
        colorInputForeground: "#17251d",
        colorDanger: "#a32929",
        colorSuccess: "#285d3c",
        colorRing: "#755b2f",
        fontFamily: "Arial, Helvetica, sans-serif",
        borderRadius: "3px",
    },
    elements: {
        rootBox: styles.root,
        cardBox: styles.cardBox,
        card: styles.card,
        headerTitle: styles.clerkTitle,
    },
} satisfies NonNullable<ComponentProps<typeof UserProfile>["appearance"]>;
