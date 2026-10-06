"use client";
import DismissibleDetails from "./dismissible-details";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Country, SelectMenuOption } from "@/lib/types";
import CountrySelector from "@/components/shared/country-selector";
import countries from "@/data/countries.json";
import styles from "./panels.module.css";

export default function CountryLanguageCurrencySelector({
    userCountry,
}: {
    userCountry: Country;
}) {
    const router = useRouter();
    const [show, setShow] = useState(false);
    const [pending, setPending] = useState(false);
    const [failedCountry, setFailedCountry] = useState<string | null>(null);
    const [saved, setSaved] = useState<Country | null>(null);
    const lock = useRef(false);
    const selection = saved ?? userCountry;
    const save = async (name: string) => {
        if (lock.current) return;
        const country = countries.find((item) => item.name === name);
        if (!country) return;
        lock.current = true;
        setPending(true);
        setFailedCountry(null);
        const data: Country = {
            name: country.name,
            code: country.code,
            city: "",
            region: "",
        };
        try {
            const response = await fetch("/api/setUserCountryInCookies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userCountry: data }),
            });
            if (!response.ok) throw new Error("Country could not be saved");
            setSaved(data);
            router.refresh();
        } catch {
            setFailedCountry(name);
        } finally {
            lock.current = false;
            setPending(false);
        }
    };
    return (
        <DismissibleDetails className={styles.theme}>
            <summary
                aria-label={`Country, language and currency: ${selection.name}, English, USD`}
                style={{ color: "#f3f0e8", minHeight: 44 }}
            >
                Ship to {selection.name} / EN / USD
            </summary>
            <div className={`${styles.panel} ${styles.countryPanel}`}>
                <h2 className={styles.heading}>Ship to</h2>
                <CountrySelector
                    id="header-country"
                    variant="store"
                    open={show}
                    disabled={pending}
                    onToggle={() => setShow((value) => !value)}
                    onChange={(name) => void save(name)}
                    selectedValue={
                        (countries.find(
                            (country) => country.name === selection.name
                        ) as SelectMenuOption) || countries[0]
                    }
                />
                <p role="status" className={styles.feedback}>
                    {pending
                        ? "Saving shipping country…"
                        : saved
                          ? `Shipping country saved: ${saved.name}.`
                          : ""}
                </p>
                {failedCountry && (
                    <div role="alert" className={styles.error}>
                        Shipping country could not be saved. Your previous
                        selection is unchanged.
                        <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => void save(failedCountry)}
                        >
                            Retry
                        </button>
                    </div>
                )}
                <dl className={styles.fixed}>
                    <dt>Language</dt>
                    <dd>English</dd>
                    <dt>Currency</dt>
                    <dd>USD (US Dollar)</dd>
                </dl>
            </div>
        </DismissibleDetails>
    );
}
