"use client";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

/** Synchronous guard complements RHF pending state; failures preserve the form. */
export function useSellerSave(onBusyChange?: (busy: boolean) => void) {
    const saving = useRef(false);
    const submitting = useRef(false);
    const [state, setState] = useState<"idle" | "saving" | "error" | "success">(
        "idle"
    );
    async function save(task: () => Promise<unknown>, onSuccess: () => void) {
        if (saving.current) return;
        saving.current = true;
        setState("saving");
        onBusyChange?.(true);
        try {
            await task();
            setState("success");
            onSuccess();
        } catch {
            setState("error");
        } finally {
            saving.current = false;
            onBusyChange?.(false);
        }
    }
    function submit(
        event: FormEvent<HTMLFormElement>,
        handler: (event: FormEvent<HTMLFormElement>) => Promise<void>
    ) {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        void handler(event).finally(() => {
            submitting.current = false;
        });
    }
    return { state, pending: state === "saving", save, submit };
}
