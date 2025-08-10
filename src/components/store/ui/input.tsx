import { FC } from 'react'

interface Props {
    name: string;
    value: string;
    type: "text" | "number";
    placeholder?: string;
    onChange: (value: string | number) => void;
    readonly?: boolean;
}

const Input: FC<Props> = ({
    name,
    onChange,
    type,
    value,
    placeholder,
    readonly,
}) => {
    return (
        <div className="relative w-full">
            <input
                type={type}
                className="w-full rounded-xl py-4 pl-8 pr-6 outline-none ring-1 ring-transparent duration-200 focus:ring-[#11BE86]"
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readonly}
            />
        </div>
    );
};

export default Input
