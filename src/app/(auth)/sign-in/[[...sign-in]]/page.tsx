import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
	return (
		<div className="grid w-full flex-1 place-content-center py-10">
			<SignIn />
		</div>
	);
}
