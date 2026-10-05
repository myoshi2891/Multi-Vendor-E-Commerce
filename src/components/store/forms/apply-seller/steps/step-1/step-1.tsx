import styles from "../../application.module.css";
import { useUser } from "@clerk/nextjs";
import { Dispatch, SetStateAction } from "react";
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
    return (
        <div className="w-full">
            <AnimatedContainer>
                {isSignedIn ? (
                    <UserDetails />
                ) : (
                    <div className="h-full">
                        <div className="flex h-full flex-col justify-center space-y-4">
                            <div className={styles.alert}>
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
                <div className={styles.actions}>
                    <button
                        type="button"
                        disabled={step === 1}
                        onClick={() => step > 1 && setStep((prev) => prev - 1)}
                        className={styles.secondary}
                    >
                        Previous
                    </button>
                    <button
                        type="submit"
                        onClick={() => step < 4 && setStep((prev) => prev + 1)}
                        className={styles.primary}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
