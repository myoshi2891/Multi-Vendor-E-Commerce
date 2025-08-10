"use client";

import { StoreType } from "@/lib/types";
import { useState } from "react";
import Instructions from "./instructions";
import ProgressBar from "./progress-bar";
import Step1 from "./steps/step-1/step-1";
import Step2 from "./steps/step-2/step-2";

export default function ApplySellerMultiForm() {
    const [step, setStep] = useState<number>(2);
    const [formData, setFormData] = useState<StoreType>({
        name: "",
        description: "",
        email: "",
        phone: "",
        url: "",
        logo: "",
        cover: "",
        defaultShippingService: "",
        defaultDeliveryTimeMax: undefined,
        defaultDeliveryTimeMin: undefined,
        defaultShippingFeeFixed: undefined,
        defaultShippingFeeForAdditionalItem: undefined,
        defaultShippingFeePerItem: undefined,
        defaultShippingFeePerKg: undefined,
        returnPolicy: "",
    });
    return (
        <div className="grid grid-cols-[400px_1fr]">
            <Instructions />
            <div className="relative w-full p-5">
                <ProgressBar step={step} />
                {/* Steps */}
                {step === 1 ? (
                    <Step1 step={step} setStep={setStep} />
                ) : step === 2 ? (
                    <Step2
                        formData={formData}
                        setFormData={setFormData}
                        step={step}
                        setStep={setStep}
                    />
                ) : null}
            </div>
        </div>
    );
}
