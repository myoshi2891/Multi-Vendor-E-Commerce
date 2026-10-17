import FaqRedirectPage from "@/app/(store)/faq/page";
import { permanentRedirect, redirect } from "next/navigation";
jest.mock("next/navigation", () => ({
    permanentRedirect: jest.fn((url: string) => {
        throw new Error(`permanent:${url}`);
    }),
    redirect: jest.fn(),
}));
it("keeps the permanent FAQ alias rather than creating a duplicate UI", () => {
    expect(() => FaqRedirectPage()).toThrow("permanent:/faqs");
    expect(permanentRedirect).toHaveBeenCalledWith("/faqs");
    expect(redirect).not.toHaveBeenCalled();
});
