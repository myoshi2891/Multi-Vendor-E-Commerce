"use client";
import type { UserShippingAddressType } from "@/lib/types";
import type { CheckoutActions } from "@/lib/commerce-actions";
import type { Country, ShippingAddress } from "@prisma/client";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import AddressForm from "../../profile/addresses/address-form";
import styles from "../commerce.module.css";

type Props = {
    countries: Country[];
    addresses: UserShippingAddressType[];
    selectedAddress: ShippingAddress | null;
    setSelectedAddress: Dispatch<SetStateAction<ShippingAddress | null>>;
    actions: Pick<
        CheckoutActions,
        "loadAddressesAction" | "saveAddressAction" | "makeDefaultAction"
    >;
    disabled?: boolean;
    onBusyChange: (busy: boolean) => void;
};
export default function UserShippingAddresses({
    countries,
    addresses,
    selectedAddress,
    setSelectedAddress,
    actions,
    disabled = false,
    onBusyChange,
}: Props) {
    const [items, setItems] = useState(addresses);
    const [editor, setEditor] = useState<
        UserShippingAddressType | "new" | null
    >(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const locked = useRef(false);
    const trigger = useRef<HTMLButtonElement | null>(null);
    const savedId = useRef<string | null>(null);
    const retryAddressId = useRef<string | null>(null);
    async function reload(id?: string) {
        if (locked.current) return;
        if (id) retryAddressId.current = id;
        locked.current = true;
        setLoading(true);
        onBusyChange(true);
        setError("");
        try {
            const next = await actions.loadAddressesAction();
            setItems(next);
            const selected = next.find(
                (address) => address.id === (id ?? selectedAddress?.id)
            );
            setSelectedAddress(
                selected ?? next.find((address) => address.default) ?? null
            );
            if (id) {
                retryAddressId.current = null;
                setMessage("Address saved.");
            }
        } catch {
            setError("We couldn’t refresh your addresses. Please try again.");
        } finally {
            locked.current = false;
            setLoading(false);
            onBusyChange(false);
            if (id) requestAnimationFrame(() => trigger.current?.focus());
        }
    }
    async function makeDefault(id: string) {
        if (locked.current || disabled) return;
        locked.current = true;
        onBusyChange(true);
        setLoading(true);
        setError("");
        setMessage("");
        try {
            await actions.makeDefaultAction(id);
            setItems((current) =>
                current.map((item) => ({ ...item, default: item.id === id }))
            );
            setMessage("Default address updated.");
        } catch {
            setMessage("");
            setError(
                "We couldn’t update the default address. Please try again."
            );
        } finally {
            locked.current = false;
            setLoading(false);
            onBusyChange(false);
        }
    }
    function open(
        button: HTMLButtonElement,
        value: UserShippingAddressType | "new"
    ) {
        trigger.current = button;
        setEditor(value);
        setError("");
        setMessage("");
    }
    return (
        <section className={styles.panel} aria-labelledby="shipping-addresses">
            <h2 id="shipping-addresses">Shipping Addresses</h2>
            <p className={styles.note}>
                Choose a delivery destination for your order.
            </p>
            {message && (
                <p role="status" className={styles.success}>
                    {message}
                </p>
            )}
            {loading && (
                <p role="status" className={styles.status}>
                    Updating addresses…
                </p>
            )}
            {error && (
                <div role="alert" className={styles.error}>
                    <p>{error}</p>
                    <button
                        className={styles.secondary}
                        disabled={disabled || loading}
                        onClick={() =>
                            void reload(retryAddressId.current ?? undefined)
                        }
                    >
                        Retry addresses
                    </button>
                </div>
            )}
            <fieldset
                disabled={disabled || loading}
                className={styles.addressList}
            >
                <legend className="sr-only">Choose a shipping address</legend>
                {items.length ? (
                    items.map((address) => (
                        <div
                            key={address.id}
                            className={styles.address}
                            data-selected={address.id === selectedAddress?.id}
                        >
                            <label>
                                <input
                                    type="radio"
                                    name="shipping-address"
                                    checked={address.id === selectedAddress?.id}
                                    onChange={() => setSelectedAddress(address)}
                                    aria-label={`${address.firstName} ${address.lastName}, ${address.address1}, ${address.country.name}`}
                                />
                                <span>
                                    <strong>
                                        {address.firstName} {address.lastName}
                                    </strong>
                                    {address.default && (
                                        <span> · Default address</span>
                                    )}
                                    <br />
                                    {address.phone}
                                    <br />
                                    {address.address1}
                                    {address.address2 && (
                                        <> · {address.address2}</>
                                    )}
                                    <br />
                                    {address.city}, {address.state}{" "}
                                    {address.zip_code}
                                    <br />
                                    {address.country.name}
                                </span>
                            </label>
                            <div className={styles.actions}>
                                <button
                                    className={styles.secondary}
                                    aria-label={`Edit address for ${address.firstName} ${address.lastName}`}
                                    onClick={(event) =>
                                        open(event.currentTarget, address)
                                    }
                                >
                                    Edit
                                </button>
                                {!address.default && (
                                    <button
                                        className={styles.secondary}
                                        aria-label={`Make address default for ${address.firstName} ${address.lastName}`}
                                        onClick={() =>
                                            void makeDefault(address.id)
                                        }
                                    >
                                        Make default
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className={styles.note}>
                        No shipping addresses yet. Add a destination to
                        continue.
                    </p>
                )}
            </fieldset>
            <button
                className={styles.secondary}
                disabled={disabled || loading}
                onClick={(event) => open(event.currentTarget, "new")}
            >
                Add new address
            </button>
            <Dialog.Root
                open={editor !== null}
                onOpenChange={(open) => {
                    if (!open && !saving) setEditor(null);
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className={styles.overlay} />
                    <Dialog.Content
                        className={styles.dialog}
                        style={{
                            position: "fixed",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%,-50%)",
                            zIndex: 61,
                        }}
                        tabIndex={0}
                        aria-describedby={undefined}
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            document
                                .getElementById("shipping-firstName")
                                ?.focus();
                        }}
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            trigger.current?.focus();
                        }}
                        onEscapeKeyDown={(event) => {
                            if (saving) event.preventDefault();
                        }}
                        onPointerDownOutside={(event) => {
                            if (saving) event.preventDefault();
                        }}
                        onInteractOutside={(event) => {
                            if (saving) event.preventDefault();
                        }}
                    >
                        <div className={styles.dialogHeader}>
                            <Dialog.Title>
                                {editor === "new"
                                    ? "Add new address"
                                    : "Edit address"}
                            </Dialog.Title>
                            <button
                                className={styles.secondary}
                                disabled={saving}
                                aria-label="Close address dialog"
                                onClick={() => setEditor(null)}
                            >
                                Close
                            </button>
                        </div>
                        {editor && (
                            <AddressForm
                                data={editor === "new" ? undefined : editor}
                                countries={countries}
                                saveAddressAction={actions.saveAddressAction}
                                onSaved={(saved) => {
                                    savedId.current = saved.id;
                                    setEditor(null);
                                }}
                                onCancel={() => setEditor(null)}
                                onBusyChange={(busy) => {
                                    setSaving(busy);
                                    onBusyChange(busy);
                                    if (!busy && savedId.current) {
                                        const id = savedId.current;
                                        savedId.current = null;
                                        void reload(id);
                                    }
                                }}
                            />
                        )}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </section>
    );
}
