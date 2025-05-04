// Next.js
import type { Metadata } from "next";
import localFont from "next/font/local";

// Global CSS
import "./globals.css";

// Theme Provider
import { ThemeProvider } from "next-themes";

// Clerk Provider
import { ClerkProvider } from "@clerk/nextjs";

// Toast
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import ModalProvider from "../providers/modal-provider";
// Fonts
const geistSans = localFont({
	src: "./fonts/GeistVF.woff",
	variable: "--font-geist-sans",
	weight: "100 900",
});
const geistMono = localFont({
	src: "./fonts/GeistMonoVF.woff",
	variable: "--font-geist-mono",
	weight: "100 900",
});

// Metadata
export const metadata: Metadata = {
	title: "GoShop",
	description: "Welcome to GoShop!",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ClerkProvider>
			<html lang="en" suppressHydrationWarning>
				<body
					className={`${geistSans.variable} ${geistMono.variable} antialiased`}
				>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<ModalProvider>{children}</ModalProvider>
						<Toaster />
						<SonnerToaster position="bottom-left" />
					</ThemeProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
