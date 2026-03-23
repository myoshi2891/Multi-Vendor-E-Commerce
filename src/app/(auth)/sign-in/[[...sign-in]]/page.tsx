import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
	return (
		<div className="grid h-screen w-full place-content-center">
			<SignIn />
		</div>
	);
}
