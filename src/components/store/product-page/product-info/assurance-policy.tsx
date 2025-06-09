import { Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export default function ProductAssurancePolicy() {
    return (
        <div className="mt-4">
            <h3 className="text-main-primary">GoShop assurance</h3>
            <Link
                href=""
                className="mt-3 flex items-center text-sm text-main-primary"
            >
                <ShieldCheck className="w-5" />
                <div className="flex-1 px-1">
                    <span className="leading-5 text-main-primary">
                        Safe payments
                    </span>
                    <span className="leading-5 text-main-secondary">
                        &nbsp;&nbsp;Payment methods used by many international
                        shoppers
                    </span>
                </div>
            </Link>
            <Link
                href=""
                className="mt-3 flex items-center text-sm text-main-primary"
            >
                <Lock className="w-5" />
                <div className="flex-1 px-1">
                    <span className="leading-5 text-main-primary">
                        Security & privacy
                    </span>
                    <span className="leading-5 text-main-secondary">
                        &nbsp;&nbsp;We respect your privacy so your personal
                        details are safe
                    </span>
                </div>
            </Link>
            <Link
                href=""
                className="mt-3 flex items-center text-sm text-main-primary"
            >
                <ShieldAlert className="w-5" />
                <div className="flex-1 px-1">
                    <span className="leading-5 text-main-primary">
                        Buyer protection
                    </span>
                    <span className="leading-5 text-main-secondary">
                        &nbsp;&nbsp;Get your money back if your order isn't
                        delivered by estimated date or if you're not satisfied
                        with your order
                    </span>
                </div>
            </Link>
        </div>
    )
}
