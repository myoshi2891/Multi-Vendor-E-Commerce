"use client";

import { ShippingAddressSchema } from "@/lib/schemas";
import type {
    AddressCountry,
    ProfileAddress,
    ProfileAddressFields,
    AddressActions,
} from "@/lib/profile-addresses";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import styles from "./addresses.module.css";

const fields = [
    { name: "firstName", label: "First name", autoComplete: "given-name" },
    { name: "lastName", label: "Last name", autoComplete: "family-name" },
    { name: "phone", label: "Phone number", autoComplete: "tel", type: "tel" },
    {
        name: "address1",
        label: "Address line 1",
        autoComplete: "address-line1",
    },
    {
        name: "address2",
        label: "Address line 2",
        autoComplete: "address-line2",
        optional: true,
    },
    { name: "city", label: "City", autoComplete: "address-level2" },
    {
        name: "state",
        label: "State / Province",
        autoComplete: "address-level1",
    },
    { name: "zip_code", label: "Postal code", autoComplete: "postal-code" },
] as const;

export default function AddressForm({
    data,
    countries,
    saveAddressAction,
    onSaved,
    onCancel,
    onBusyChange,
}: {
    data?: ProfileAddress;
    countries: AddressCountry[];
    saveAddressAction: AddressActions["saveAddressAction"];
    onSaved: (address: ProfileAddressFields) => void;
    onCancel: () => void;
    onBusyChange: (pending: boolean) => void;
}) {
    const [error, setError] = useState(false);
    const inFlight = useRef(false);
    const form = useForm<z.infer<typeof ShippingAddressSchema>>({
        resolver: zodResolver(ShippingAddressSchema),
        defaultValues: {
            firstName: data?.firstName ?? "",
            lastName: data?.lastName ?? "",
            phone: data?.phone ?? "",
            address1: data?.address1 ?? "",
            address2: data?.address2 ?? "",
            city: data?.city ?? "",
            state: data?.state ?? "",
            zip_code: data?.zip_code ?? "",
            countryId: data?.countryId ?? "",
            default: data?.default ?? false,
        },
    });
    const pending = form.formState.isSubmitting;
    const errors = form.formState.errors;
    const submit = form.handleSubmit(async (values) => {
        setError(false);
        try {
            const saved = await saveAddressAction({
                ...values,
                ...(data ? { id: data.id } : {}),
            });
            onSaved(saved);
        } catch {
            setError(true);
        }
    });
    return (
        <form
            aria-label="Shipping address form"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                if (inFlight.current) return;
                inFlight.current = true;
                onBusyChange(true);
                void submit(event).finally(() => {
                    inFlight.current = false;
                    onBusyChange(false);
                });
            }}
        >
            {error && (
                <p className={styles.errorText} role="alert">
                    We couldn’t save this address. Please try again.
                </p>
            )}
            {Object.keys(errors).length > 0 && (
                <p className={styles.errorText} role="alert">
                    Please check the highlighted fields.
                </p>
            )}
            <fieldset disabled={pending} className={styles.formFields}>
                <legend className="sr-only">Shipping address details</legend>
                <div className={styles.formGrid}>
                    {fields.map((field) => (
                        <div key={field.name} className={styles.field}>
                            <label htmlFor={`shipping-${field.name}`}>
                                {field.label}
                                {"optional" in field && (
                                    <span> (optional)</span>
                                )}
                            </label>
                            <input
                                id={`shipping-${field.name}`}
                                type={"type" in field ? field.type : "text"}
                                autoComplete={field.autoComplete}
                                {...form.register(field.name)}
                                aria-invalid={Boolean(errors[field.name])}
                                aria-describedby={
                                    errors[field.name]
                                        ? `shipping-${field.name}-error`
                                        : undefined
                                }
                            />
                            {errors[field.name] && (
                                <p
                                    id={`shipping-${field.name}-error`}
                                    className={styles.errorText}
                                >
                                    {errors[field.name]?.message}
                                </p>
                            )}
                        </div>
                    ))}
                    <div className={styles.field}>
                        <label htmlFor="shipping-country">Country</label>
                        <select
                            id="shipping-country"
                            autoComplete="country"
                            {...form.register("countryId")}
                            aria-invalid={Boolean(errors.countryId)}
                            aria-describedby={
                                errors.countryId
                                    ? "shipping-country-error"
                                    : undefined
                            }
                        >
                            <option value="">Choose a country</option>
                            {countries.map((country) => (
                                <option key={country.id} value={country.id}>
                                    {country.name}
                                </option>
                            ))}
                        </select>
                        {errors.countryId && (
                            <p
                                id="shipping-country-error"
                                className={styles.errorText}
                            >
                                Choose an available country.
                            </p>
                        )}
                    </div>
                </div>
                <label className={styles.check}>
                    <input type="checkbox" {...form.register("default")} />
                    Use as default address
                </label>
                <div className={styles.formActions}>
                    <button
                        className={styles.secondary}
                        type="button"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button className={styles.primary} type="submit">
                        {pending ? "Saving address…" : "Save address"}
                    </button>
                </div>
            </fieldset>
            {pending && (
                <p className={styles.feedback} role="status">
                    Saving address…
                </p>
            )}
        </form>
    );
}
