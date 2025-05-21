import ThemeToggle from "@/components/shared/theme-toggle";
import { UserButton } from "@clerk/nextjs";

export default async function Home() {
	return (
		<div className="p-5">
			<div className="w-100 flex gap-x-5 justify-end">
				<UserButton />
				<ThemeToggle />
			</div>
		</div>
	);
}
