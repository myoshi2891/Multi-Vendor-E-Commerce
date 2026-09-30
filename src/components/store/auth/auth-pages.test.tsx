/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { SignIn, SignUp } from "@clerk/nextjs";
import SignInPage from "@/app/(auth)/sign-in/[[...sign-in]]/page";
import SignUpPage from "@/app/(auth)/sign-up/[[...sign-up]]/page";

jest.mock("@clerk/nextjs", () => ({
    SignIn: jest.fn(() => <div data-testid="clerk-sign-in"><h1>Sign in</h1></div>),
    SignUp: jest.fn(() => <div data-testid="clerk-sign-up"><h1>Create your account</h1></div>),
}));

describe.each([
    { name: "sign-in", Page: SignInPage, Widget: SignIn, heading: "Welcome back.", testId: "clerk-sign-in" },
    { name: "sign-up", Page: SignUpPage, Widget: SignUp, heading: "Begin something special.", testId: "clerk-sign-up" },
])("Branded $name page", ({ Page, Widget, heading, testId }) => {
    beforeEach(() => jest.clearAllMocks());

    it("provides a page heading, collection and support links around the Clerk widget", () => {
        render(<Page />);

        expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Explore the collection/ })).toHaveAttribute("href", "/browse");
        expect(screen.getByRole("link", { name: /Customer service/ })).toHaveAttribute("href", "/customer-service");
        // AuthLayout already owns the main landmark.
        expect(screen.queryByRole("main")).not.toBeInTheDocument();
    });

    it("themes Clerk with readable ivory surfaces, gold buttons and dark text", () => {
        render(<Page />);

        const props = jest.mocked(Widget).mock.calls[0][0];
        expect(props.appearance).toEqual(expect.objectContaining({
            variables: expect.objectContaining({
                colorPrimary: "#d4ba83",
                colorPrimaryForeground: "#141c16",
                colorBackground: "#f3f0e8",
                colorForeground: "#17251d",
                colorMutedForeground: "#536356",
                colorInput: "#faf8f2",
                colorInputForeground: "#17251d",
                colorDanger: "#a02222",
                borderRadius: "0px",
            }),
        }));
    });

    it("leaves redirect handling to Clerk so query-string destinations survive authentication", () => {
        window.history.replaceState({}, "", `/${testId === "clerk-sign-in" ? "sign-in" : "sign-up"}?redirect_url=http%3A%2F%2Flocalhost%3A3000%2Fprofile%2Fwishlist`);
        render(<Page />);

        const props = jest.mocked(Widget).mock.calls[0][0];
        for (const key of ["forceRedirectUrl", "fallbackRedirectUrl", "signInForceRedirectUrl", "signInFallbackRedirectUrl", "signUpForceRedirectUrl", "signUpFallbackRedirectUrl", "afterSignInUrl", "afterSignUpUrl", "redirectUrl"]) {
            expect(props).not.toHaveProperty(key);
        }
        expect(new URL(window.location.href).searchParams.get("redirect_url")).toBe("http://localhost:3000/profile/wishlist");
    });
});
