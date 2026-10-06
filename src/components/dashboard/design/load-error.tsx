"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import styles from "./seller.module.css";
export default function LoadError({ subject }: { subject: string }) {
    const router = useRouter();
    return (
        <div className={styles.alert}>
            <p role="alert">Could not load {subject}. Please try again.</p>
            <Button variant="outline" onClick={() => router.refresh()}>
                Retry
            </Button>
        </div>
    );
}
