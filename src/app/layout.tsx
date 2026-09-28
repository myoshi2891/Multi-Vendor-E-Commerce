// Next.js
import type { Metadata } from "next";
import localFont from "next/font/local";

// Global CSS
import "./globals.css";

// Theme Provider
import { ThemeProvider } from "../providers/theme-provider";

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
	title: "Luxuries for Happiness",
	description: "Exceptional things. Meaningful moments. 幸せを纏う、という贅沢。",
    icons: { icon: "/assets/brand/star.svg" },
    openGraph: { title: "Luxuries for Happiness", description: "A little luxury. A lot of happiness. 幸せを纏う、という贅沢。" },
};

/**
 * Root layout component that wraps the application with authentication, theming, modal, and toast providers.
 *
 * @param children - The page or application content to render inside the layout
 * @returns A React element containing the HTML document structure with Clerk authentication, theme provider, modal provider, and two toaster components
 */
export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ClerkProvider afterSignOutUrl="/">
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
