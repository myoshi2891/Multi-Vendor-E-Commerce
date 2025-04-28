import ThemeToggle from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";

export default function Home() {
	return (
		<div className="p-5">
			<div className="w-100 flex gap-x-5 justify-end">
				<UserButton />
				<ThemeToggle />
			</div>
			<h1 className="text-blue-500 font-bold">Home Page</h1>
			<Button variant="destructive">Click here</Button>
		</div>
	);
}
