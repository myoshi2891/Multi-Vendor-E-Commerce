import { FC } from 'react'

interface Props {
    name: string
    value: string
    type: 'text' | 'number'
    placeholder?: string
    onChange: (value: string | number) => void
}

const Input: FC<Props> = ({ name, onChange, type, value, placeholder }) => {
    return (
        <div className="relative w-full">
            <input
                type={type}
                className="w-full rounded-xl py-4 pl-8 pr-6 outline-none ring-1 ring-transparent duration-200 focus:ring-[#11BE86]"
                name={name}
                placeholder={placeholder}
                value={value}
                onAbort={(e) => onChange(e.currentTarget.value)} //e.target.valueから変更
            />
        </div>
    )
}

export default Input
