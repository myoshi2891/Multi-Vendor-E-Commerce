import React from "react";

export default function ProgressBar({ step }: { step: number }) {
    return (
        <div className="h-12 w-full border-b-2">
            <div className="flex items-center justify-between gap-x-4">
                <div className="mb-4 w-48 text-xs font-bold uppercase leading-tight tracking-wide text-gray-500">
                    <span>Step {step} of 4</span>
                    <div className="text-lg font-bold leading-tight text-gray-700">
                        {step === 1
                            ? "Personal Details"
                            : step === 2
                              ? "Store Details"
                              : step === 3
                                ? "Shipping Details"
                                : "Completed"}
                    </div>
                </div>
                <div className="mr-2 w-full flex-1 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-green-500 text-center text-white"
                    style={{ width: `${(step/4) * 100}%` }}/>
                </div>
                <div className="text-xs text-gray-600" >
                    {Math.floor((step/4) * 100)}% completed
                </div>
            </div>
        </div>
    );
}
