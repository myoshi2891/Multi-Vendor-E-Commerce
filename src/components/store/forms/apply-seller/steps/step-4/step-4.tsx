import Link from "next/link";
import AnimatedContainer from "../../animated-container";

export default function Step4() {
    return (
        <div className="h-full">
            <AnimatedContainer>
                <div className="flex size-full items-center justify-center rounded-lg bg-white p-10 shadow-sm">
                    <div>
                        <svg
                            className="mx-auto mb-4 size-20 text-green-500"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <h2 className="mb-4 text-center text-2xl font-bold text-gray-800">
                            Your store has been created!
                        </h2>
                        <div className="mb-8 text-gray-600">
                            Thank you for creating your store. It&apos;s currently
                            under review and will be approved shortly. Stay
                            tuned!
                        </div>

                        <Link href="/">
                            <button className="mx-auto block w-40 rounded-lg border bg-white px-5 py-2 text-center font-medium text-gray-600 shadow-sm hover:bg-gray-100 focus:outline-none">
                                Back to home
                            </button>
                        </Link>
                    </div>
                </div>
            </AnimatedContainer>
        </div>
    );
}
