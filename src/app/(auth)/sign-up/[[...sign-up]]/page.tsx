import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
	return (
		<div className="grid w-full flex-1 place-content-center py-10">
			<SignUp />
		</div>
	);
}
