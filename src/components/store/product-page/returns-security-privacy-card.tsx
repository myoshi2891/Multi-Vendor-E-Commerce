import { ShieldCheck, Undo } from 'lucide-react'
import Link from 'next/link'
import styles from './product.module.css'

export default function ReturnsSecurityPrivacyCard({
    returnPolicy,
}: {
    returnPolicy: string
}) {
    return (
        <div className={styles.assuranceList}>
            <div className={styles.assuranceItem}>
                <Undo size={17} aria-hidden="true" />
                <div><strong>Considered returns</strong><p>{returnPolicy}</p><Link href="/returns-exchange">Returns &amp; exchanges</Link></div>
            </div>
            <div className={styles.assuranceItem}>
                <ShieldCheck size={17} aria-hidden="true" />
                <div><strong>Secure by design</strong><p>Protected payment and respectful handling of your details.</p><Link href="/legal">Privacy &amp; terms</Link></div>
            </div>
        </div>
    )
}

export const Returns = ({ returnPolicy }: { returnPolicy: string }) => {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-1">
                    <Undo className="w-4" />
                    <span className="text-sm font-bold">Return Policy</span>
                </div>
            </div>
            <div>
                <span className="ml-5 flex text-xs text-[#979797]">
                    {returnPolicy}
                </span>
            </div>
        </div>
    )
}

export const SecurityPrivacyCard = () => {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-1">
                    <ShieldCheck className="w-4" />
                    <span className="text-sm font-bold">
                        Security & Privacy
                    </span>
                </div>
            </div>
            <p className="ml-5 text-xs text-[#979797]">
                We value your privacy and security. We use secure payment
                methods and follow industry best practices. Please review our
                <a href="#" className="text-[#007BFF] underline hover:text-[#004587]">
                    &nbsp;Privacy Policy&nbsp;
                </a>
                and
                <a href="#" className="text-[#007BFF] underline hover:text-[#004587]">
                    &nbsp;Terms of Service&nbsp;
                </a>
                for more information.
            </p>
        </div>
    )
}
