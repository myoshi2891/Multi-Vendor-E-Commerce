"use client";

import { SendIcon } from "@/components/store/icons";
import toast from "react-hot-toast";
import { useState } from "react";

export default function Newsletter() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    return <div className="bg-gradient-to-r from-slate-500 to-slate-800 p-5">
        <div className="mx-auto max-w-[1430px]">
            <div className="flex flex-col items-center gap-y-4 text-white xl:flex-row">
                {/* Left */}
                <div className="flex items-center xl:w-[58%]">
                    <h5 className="flex items-center gap-x-2">
                        <span className="mr-2 scale-125">
                            <SendIcon />
                        </span>
                        <span className="md:text-xl">Sign up to Newsletter</span>
                        <span className="ml-10">
                            ...and receive &nbsp;
                            <b>$10 coupon for first shopping</b>
                        </span>
                    </h5>
                </div>
                {/* Right */}
                <form className="flex w-full xl:flex-1" onSubmit={async (e: React.FormEvent<HTMLFormElement>) => { 
                    e.preventDefault(); 
                    const formData = new FormData(e.currentTarget);
                    const emailValue = formData.get("email");
                    const email = typeof emailValue === 'string' ? emailValue.trim() : '';
                    if (!email) return;
                    
                    setIsSubmitting(true);
                    try {
                        const response = await fetch('/api/newsletter', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email }),
                        });
                        
                        if (!response.ok) throw new Error("Subscription failed");
                        
                        toast.success("Successfully subscribed to newsletter!"); 
                        e.currentTarget.reset();
                    } catch (err) {
                        toast.error("Failed to subscribe.");
                    } finally {
                        setIsSubmitting(false);
                    }
                }}>
                    <label htmlFor="newsletter-email" className="sr-only">メールアドレス</label>
                    <input id="newsletter-email" type="email" name="email" autoComplete="email" placeholder="Enter your email address" required
                        className="h-10 w-full rounded-l-full bg-white pl-6 text-black outline-none" />
                    <button type="submit" disabled={isSubmitting} className="grid h-10 w-24 cursor-pointer place-content-center rounded-r-full bg-slate-600 text-sm text-white disabled:opacity-50">Sign up</button>
                </form>
            </div>
      </div>
  </div>;
}
