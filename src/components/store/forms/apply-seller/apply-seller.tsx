"use client";

import styles from "./application.module.css";
import type { applySeller } from "@/queries/store";
import { StoreType } from "@/lib/types";
import { useState } from "react";
import Instructions from "./instructions";
import ProgressBar from "./progress-bar";
import Step1 from "./steps/step-1/step-1";
import Step2 from "./steps/step-2/step-2";
import Step3 from "./steps/step-3/step-3";
import Step4 from "./steps/step-4/step-4";

export default function ApplySellerMultiForm({
    applySellerAction,
}: {
    applySellerAction: typeof applySeller;
}) {
    const [step, setStep] = useState<number>(1);
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
        <main className={styles.application}>
            <Instructions />
            <div className={styles.body}>
                <header className={styles.header}>
                    <p className={styles.eyebrow}>Sell with us</p>
                    <h1>Become a seller</h1>
                </header>
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
                ) : step === 3 ? (
                    <Step3
                        applySellerAction={applySellerAction}
                        formData={formData}
                        setFormData={setFormData}
                        step={step}
                        setStep={setStep}
                    />
                ) : step === 4 ? (
                    <Step4 />
                ) : null}
            </div>
        </main>
    );
}
