"use client";
import COUNTRIES from "@/data/countries.json";
import type { SelectMenuOption } from "@/lib/types";
import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./country-selector.module.css";

export interface CountrySelectorProps {
    id: string;
    open: boolean;
    disabled?: boolean;
    onToggle: () => void;
    onChange: (value: SelectMenuOption["name"]) => void;
    selectedValue: SelectMenuOption;
    variant?: "default" | "store";
}
export default function CountrySelector({
    id,
    open,
    disabled = false,
    onToggle,
    onChange,
    selectedValue,
    variant = "default",
}: CountrySelectorProps) {
    const ref = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(-1);
    const countries = COUNTRIES.filter((country) =>
        country.name.toLowerCase().startsWith(query.toLowerCase())
    );
    useEffect(() => {
        const dismiss = (event: MouseEvent) => {
            if (
                open &&
                !disabled &&
                event.target instanceof Node &&
                !ref.current?.contains(event.target)
            ) {
                onToggle();
                setQuery("");
                setActive(-1);
            }
        };
        document.addEventListener("mousedown", dismiss);
        return () => document.removeEventListener("mousedown", dismiss);
    }, [open, disabled, onToggle]);
    const close = () => {
        onToggle();
        setQuery("");
        setActive(-1);
        trigger.current?.focus();
    };
    const choose = (name: string) => {
        if (!disabled) {
            onChange(name);
            close();
        }
    };
    const navigate = (event: KeyboardEvent) => {
        if (disabled) return;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
        }
        // 検索欄の Enter では確定しない（クリックで検索欄へ戻った後の古い active で誤選択するため）
        const onOption =
            event.target instanceof HTMLElement &&
            event.target.getAttribute("role") === "option";
        if (
            event.key === "Enter" &&
            onOption &&
            active >= 0 &&
            countries[active]
        ) {
            event.preventDefault();
            choose(countries[active].name);
            return;
        }
        const last = countries.length - 1;
        let next = active;
        if (event.key === "ArrowDown") next = Math.min(active + 1, last);
        else if (event.key === "ArrowUp")
            next = active < 0 ? last : Math.max(active - 1, 0);
        else if (event.key === "Home" && onOption) next = 0;
        else if (event.key === "End" && onOption) next = last;
        else return;
        event.preventDefault();
        setActive(next);
        document
            .getElementById(`${id}-option-${countries[next]?.code}`)
            ?.focus();
    };
    return (
        <div
            ref={ref}
            className={`${styles.root} ${variant === "store" ? styles.store : ""}`}
        >
            <button
                ref={trigger}
                type="button"
                className={styles.trigger}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? `${id}-list` : undefined}
                aria-label={`Ship to: ${selectedValue.name}`}
                onClick={onToggle}
                disabled={disabled}
            >
                <Image
                    alt={selectedValue.name}
                    src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${selectedValue.code}.svg`}
                    width={20}
                    height={16}
                />
                {selectedValue.name}
                <span aria-hidden="true">▾</span>
            </button>
            {open && (
                <div className={styles.picker} onKeyDown={navigate}>
                    <input
                        type="search"
                        aria-label="Search a country"
                        placeholder="Search a country"
                        value={query}
                        disabled={disabled}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setActive(-1);
                        }}
                    />
                    <ul
                        id={`${id}-list`}
                        role="listbox"
                        aria-label="Shipping country"
                        className={styles.list}
                    >
                        {countries.map((country) => (
                            <li
                                key={country.code}
                                id={`${id}-option-${country.code}`}
                                role="option"
                                aria-selected={
                                    country.name === selectedValue.name
                                }
                                aria-disabled={disabled}
                                tabIndex={-1}
                                onFocus={() =>
                                    setActive(countries.indexOf(country))
                                }
                                onClick={() => choose(country.name)}
                            >
                                {country.name}
                            </li>
                        ))}
                    </ul>
                    {countries.length === 0 && (
                        <p role="status" className={styles.empty}>
                            No countries found
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
