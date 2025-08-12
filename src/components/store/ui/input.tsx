import React, { ChangeEvent } from "react";

interface Props {
    name: string;
    value: string | number;
    type: "text" | "number";
    placeholder?: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    readonly?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, Props>(
    ({ name, onChange, type, value, placeholder, readonly }, ref) => {
        // Ensure the value is a string when passed to the input
        const inputValue = typeof value === "number" ? String(value) : value;

        return (
            <div className="relative w-full">
                <input
                    ref={ref}
                    type={type}
                    className="w-full rounded-xl py-4 pl-8 pr-6 outline-none ring-1 ring-transparent duration-200 focus:ring-[#11BE86]"
                    name={name}
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={onChange}
                    readOnly={readonly}
                />
            </div>
        );
    }
);

Input.displayName = "Input";

export default Input;
