"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps the next-themes provider and forwards all received props and children to it.
 *
 * @param children - React node(s) to render inside the theme provider.
 * @param props - Remaining props to pass through to the underlying theme provider.
 * @returns A React element rendering the theme provider configured with the provided props and children.
 */
export function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
