import { SignUp } from "@clerk/nextjs";

/**
 * Renders the sign-up page.
 *
 * @returns The sign-up page layout with the Clerk `SignUp` component centered in the page.
 */
export default function SignUpPage() {
	return (
		<div className="grid w-full flex-1 place-content-center py-10">
			<SignUp />
		</div>
	);
}
