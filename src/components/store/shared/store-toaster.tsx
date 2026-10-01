"use client";

import { Check, CircleAlert, X } from "lucide-react";
import toast, { Toaster, resolveValue } from "react-hot-toast";
import styles from "./store-toaster.module.css";

export default function StoreToaster() {
    return (
        <Toaster
            position="top-center"
            containerStyle={{ top: 24 }}
            toastOptions={{ duration: 6000 }}
        >
            {(notification) => (
                <div
                    role={notification.type === "error" ? "alert" : "status"}
                    aria-live={
                        notification.type === "error" ? "assertive" : "polite"
                    }
                    className={`${styles.toast} ${notification.visible ? styles.visible : styles.hidden}`}
                >
                    {notification.type === "error" ? (
                        <CircleAlert
                            size={20}
                            className={styles.error}
                            aria-hidden="true"
                        />
                    ) : (
                        <Check
                            size={20}
                            className={styles.success}
                            aria-hidden="true"
                        />
                    )}
                    <div className={styles.message}>
                        {resolveValue(notification.message, notification)}
                    </div>
                    <button
                        type="button"
                        aria-label="Dismiss notification"
                        onClick={() => toast.dismiss(notification.id)}
                        className={styles.close}
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
            )}
        </Toaster>
    );
}
