import { ShieldCheck, Undo } from "lucide-react";

export default function ReturnsSecurityPrivacyCard({
	returnPolicy,
}: {
	returnPolicy: string;
}) {
	return (
		<div className="mt-2 space-y-2">
            <Returns returnPolicy={returnPolicy} />
            <SecurityPrivacyCard/>
		</div>
	);
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
				<span className="text-xs ml-5 text-[#979797] flex">
					{returnPolicy}
				</span>
			</div>
		</div>
	);
};

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
			<p className="text-xs text-[#979797] ml-5 ">
				We value your privacy and security. We use secure payment
				methods and follow industry best practices. Please review our
				<a href="#" className="text-[#007BFF] hover:text-[#004587]">
					&nbsp;Privacy Policy&nbsp;
				</a>
				and
				<a href="#" className="text-[#007BFF] hover:text-[#004587]">
					&nbsp;Terms of Service&nbsp;
				</a>
				for more information.
			</p>
		</div>
	);
};
