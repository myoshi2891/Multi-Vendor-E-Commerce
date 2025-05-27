import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function ProductAssurancePolicy() {
	return (
		<div className="mt-4">
			<h3 className="text-main-primary">GoShop assurance</h3>
			<Link
				href=""
				className="text-main-primary flex items-center mt-3 text-sm"
			>
				<ShieldCheck className="w-5" />
				<div className="flex-1 px-1">
					<span className="text-main-primary leading-5">
						Safe payments
					</span>
					<span className="text-main-secondary leading-5">
						&nbsp;&nbsp;Payment methods used by many international
						shoppers
					</span>
				</div>
			</Link>
			<Link
				href=""
				className="text-main-primary flex items-center mt-3 text-sm"
			>
				<Lock className="w-5" />
				<div className="flex-1  px-1">
					<span className="text-main-primary leading-5">
						Security & privacy
					</span>
					<span className="text-main-secondary leading-5">
						&nbsp;&nbsp;We respect your privacy so your personal
						details are safe
					</span>
				</div>
			</Link>
			<Link
				href=""
				className="text-main-primary flex items-center mt-3 text-sm"
			>
				<ShieldAlert className="w-5" />
				<div className="flex-1 px-1">
					<span className="text-main-primary leading-5">
						Buyer protection
					</span>
					<span className="text-main-secondary leading-5">
						&nbsp;&nbsp;Get your money back if your order isn't
						delivered by estimated date or if you're not satisfied
						with your order
					</span>
				</div>
			</Link>
		</div>
	);
}
