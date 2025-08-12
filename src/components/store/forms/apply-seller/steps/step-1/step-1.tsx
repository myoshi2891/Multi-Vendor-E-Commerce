import { useUser } from "@clerk/nextjs";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import AnimatedContainer from "../../animated-container";
import DefaultUserImg from "@/public/assets/images/default-user.jpg";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/store/ui/button";
import UserDetails from "./user-details";

export default function Step1({
    step,
    setStep,
}: {
    step: number;
    setStep: Dispatch<SetStateAction<number>>;
}) {
    const { isSignedIn } = useUser();
    const [user, setUser] = useState<boolean>(false);
    useEffect(() => {
        if (isSignedIn) {
            setUser(isSignedIn);
        }
    }, [isSignedIn]);
    return (
        <div className="w-full">
            <AnimatedContainer>
                {isSignedIn && user ? (
                    <UserDetails />
                ) : (
                    <div className="h-full">
                        <div className="flex h-full flex-col justify-center space-y-4">
                            <div className="w-full rounded-lg border border-blue-200 bg-blue-100 text-sm text-blue-800">
                                <div className="flex p-4">
                                    Please sign in (Or sign up if you are new)
                                    to start
                                </div>
                            </div>
                            <div className="flex items-center justify-center">
                                <Image
                                    src={DefaultUserImg}
                                    alt=" Default User"
                                    width={200}
                                    height={200}
                                    className="size-40 rounded-full object-cover"
                                    priority
                                />
                            </div>
                            <div className="flex flex-col gap-y-3">
                                <Link href="/sign-in">
                                    <Button>Sign in</Button>
                                </Link>
                                <Link href="/sign-up">
                                    <Button variant="pink">Sign up</Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatedContainer>
            {isSignedIn && (
                <div className="flex h-[100px] justify-between px-2 pt-4">
                    <button
                        type="button"
                        onClick={() => step > 1 && setStep((prev) => prev - 1)}
                        className="h-10 rounded-lg border bg-white px-4 py-2 font-medium text-gray-600 shadow-sm hover:bg-gray-100"
                    >
                        Previous
                    </button>
                    <button
                        type="submit"
                        onClick={() => step < 4 && setStep((prev) => prev + 1)}
                        className="h-10 rounded-lg border bg-blue-500 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
