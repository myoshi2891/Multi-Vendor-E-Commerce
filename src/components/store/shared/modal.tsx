'use client'
import { X } from 'lucide-react'
import { Dispatch, FC, ReactNode, SetStateAction, useRef } from 'react'
import useOnClickOutside from 'use-onclickoutside'

interface ModalProps {
    title?: string
    show?: boolean
    setShow: Dispatch<SetStateAction<boolean>>
    children: ReactNode
}

const Modal: FC<ModalProps> = ({ children, title, show, setShow }) => {
    const ref = useRef(null)
    const close = () => setShow(false)
    useOnClickOutside(ref, close)

    if (show) {
        return (
            <div className="fixed inset-0 z-50 size-full bg-gray-50/65">
                <div
                    ref={ref}
                    className="fixed left-1/2 top-1/2 min-w-[800px] max-w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white px-10 py-5 shadow-md"
                >
                    <div className="flex items-center justify-between border-b pb-2">
                        <h1 className="text-xl font-bold">{title}</h1>
                        <X
                            className="size-4 cursor-pointer"
                            onClick={() => setShow(false)}
                        />
                    </div>
                    <div className="mt-6">{children}</div>
                </div>
            </div>
        )
    } else {
        return null
    }
}

export default Modal
