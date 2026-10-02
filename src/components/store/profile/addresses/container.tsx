"use client";

import type {
    AddressActions,
    ProfileAddress,
    ProfileAddressData,
    ProfileAddressFields,
} from "@/lib/profile-addresses";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import AddressForm from "./address-form";
import AddressesHeading from "./heading";
import styles from "./addresses.module.css";

export default function AddressContainer({
    addresses,
    countries,
    initialError = false,
    loadAddressesAction,
    saveAddressAction,
    makeDefaultAction,
}: ProfileAddressData & AddressActions & { initialError?: boolean }) {
    const [data, setData] = useState<ProfileAddressData>({
        addresses,
        countries,
    });
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(initialError);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [editor, setEditor] = useState<ProfileAddress | "new" | null>(null);
    const pending = useRef(false);
    const trigger = useRef<HTMLButtonElement | null>(null);
    async function reload() {
        if (pending.current || busy) return;
        pending.current = true;
        setLoading(true);
        setLoadError(false);
        setMessage("");
        setError("");
        try {
            setData(await loadAddressesAction());
        } catch {
            setLoadError(true);
        } finally {
            pending.current = false;
            setLoading(false);
        }
    }
    async function makeDefault(id: string) {
        if (pending.current || busy) return;
        pending.current = true;
        setBusy(true);
        setError("");
        setMessage("Updating default address…");
        try {
            await makeDefaultAction(id);
            setData((current) => ({
                ...current,
                addresses: current.addresses.map((address) => ({
                    ...address,
                    default: address.id === id,
                })),
            }));
            setMessage("Default address updated.");
        } catch {
            setMessage("");
            setError(
                "We couldn’t update the default address. Please try again."
            );
        } finally {
            pending.current = false;
            setBusy(false);
        }
    }
    function onSaved(saved: ProfileAddressFields) {
        const country = data.countries.find(
            (item) => item.id === saved.countryId
        );
        if (!country) return;
        const next = { ...saved, country };
        setData((current) => {
            const items = current.addresses.map((address) =>
                saved.default ? { ...address, default: false } : address
            );
            return {
                ...current,
                addresses: items.some((address) => address.id === saved.id)
                    ? items.map((address) =>
                          address.id === saved.id ? next : address
                      )
                    : [...items, next],
            };
        });
        setEditor(null);
        setMessage("Address saved.");
        setError("");
    }
    function openEditor(
        button: HTMLButtonElement,
        value: ProfileAddress | "new"
    ) {
        trigger.current = button;
        setMessage("");
        setError("");
        setEditor(value);
    }
    return (
        <section
            className={styles.addresses}
            data-addresses
            aria-label="Shipping address management"
        >
            <AddressesHeading />
            <div className={styles.toolbar}>
                <p>Saved destinations for your collection.</p>
                <button
                    type="button"
                    className={styles.secondary}
                    disabled={loading || busy}
                    onClick={() => void reload()}
                >
                    Refresh addresses
                </button>
            </div>
            {message && (
                <p role="status" className={styles.feedback}>
                    {message}
                </p>
            )}
            {error && (
                <p role="alert" className={styles.errorText}>
                    {error}
                </p>
            )}
            <div aria-busy={loading || busy}>
                {loading ? (
                    <div className={styles.message} role="status">
                        <p>Loading addresses…</p>
                        <div className={styles.skeleton} aria-hidden="true" />
                    </div>
                ) : loadError ? (
                    <div className={styles.message} role="alert">
                        <h2>We couldn’t load your addresses</h2>
                        <p>Please try again.</p>
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={() => void reload()}
                        >
                            Try again
                        </button>
                    </div>
                ) : (
                    <>
                        {data.addresses.length === 0 ? (
                            <div className={styles.message}>
                                <span
                                    className={styles.emptySymbol}
                                    aria-hidden="true"
                                >
                                    ◇
                                </span>
                                <h2>No addresses yet</h2>
                                <p>
                                    Add a destination for your next discovery.
                                </p>
                            </div>
                        ) : (
                            <ol
                                className={styles.list}
                                aria-label="Saved shipping addresses"
                            >
                                {data.addresses.map((address) => {
                                    const name = `${address.firstName} ${address.lastName}`;
                                    return (
                                        <li
                                            key={address.id}
                                            className={styles.card}
                                        >
                                            <div className={styles.cardHeading}>
                                                <h2>{name}</h2>
                                                {address.default && (
                                                    <span
                                                        className={styles.badge}
                                                    >
                                                        Default address
                                                    </span>
                                                )}
                                            </div>
                                            <p className={styles.phone}>
                                                {address.phone}
                                            </p>
                                            <address className={styles.postal}>
                                                <p>{address.address1}</p>
                                                {address.address2 && (
                                                    <p>{address.address2}</p>
                                                )}
                                                <p>
                                                    {address.city},{" "}
                                                    {address.state}{" "}
                                                    {address.zip_code}
                                                </p>
                                                <p>{address.country.name}</p>
                                            </address>
                                            <div className={styles.cardActions}>
                                                <button
                                                    type="button"
                                                    className={styles.secondary}
                                                    aria-label={`Edit address for ${name}`}
                                                    disabled={busy}
                                                    onClick={(event) =>
                                                        openEditor(
                                                            event.currentTarget,
                                                            address
                                                        )
                                                    }
                                                >
                                                    Edit address
                                                </button>
                                                {!address.default && (
                                                    <button
                                                        type="button"
                                                        className={
                                                            styles.secondary
                                                        }
                                                        aria-label={`Make default address for ${name}`}
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void makeDefault(
                                                                address.id
                                                            )
                                                        }
                                                    >
                                                        Make default
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                        {data.countries.length === 0 && (
                            <p role="alert" className={styles.errorText}>
                                Shipping destinations are not available. Refresh
                                addresses to try again.
                            </p>
                        )}
                        <button
                            type="button"
                            className={styles.primary}
                            disabled={busy || data.countries.length === 0}
                            onClick={(event) =>
                                openEditor(event.currentTarget, "new")
                            }
                        >
                            Add new address
                        </button>
                    </>
                )}
            </div>
            <Dialog.Root
                open={editor !== null}
                onOpenChange={(open) => {
                    if (!open && !busy) setEditor(null);
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className={styles.overlay} />
                    <Dialog.Content
                        tabIndex={0}
                        className={styles.dialog}
                        onEscapeKeyDown={(event) => {
                            if (busy) event.preventDefault();
                        }}
                        onPointerDownOutside={(event) => {
                            if (busy) event.preventDefault();
                        }}
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            trigger.current?.focus();
                        }}
                    >
                        <Dialog.Title className={styles.dialogTitle}>
                            {editor === "new"
                                ? "Add shipping address"
                                : "Edit shipping address"}
                        </Dialog.Title>
                        <Dialog.Description className={styles.description}>
                            Keep your delivery details up to date. All fields
                            are required except address line 2.
                        </Dialog.Description>
                        {editor !== null && (
                            <AddressForm
                                key={editor === "new" ? "new" : editor.id}
                                data={editor === "new" ? undefined : editor}
                                countries={data.countries}
                                saveAddressAction={saveAddressAction}
                                onSaved={onSaved}
                                onBusyChange={setBusy}
                                onCancel={() => {
                                    if (!busy) setEditor(null);
                                }}
                            />
                        )}
                        <Dialog.Close
                            className={styles.close}
                            aria-label="Close address form"
                            disabled={busy}
                        >
                            ×
                        </Dialog.Close>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </section>
    );
}
