import { SignIn } from "@clerk/nextjs";

/**
 * Renders the sign-in page layout.
 *
 * @returns The centered sign-in page content.
 */
export default function SignInPage() {
	return (
		<div className="grid w-full flex-1 place-content-center py-10">
			<SignIn />
		</div>
	);
}
