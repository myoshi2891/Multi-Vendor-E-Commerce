import styles from "./application.module.css";
export default function ProgressBar({ step }: { step: number }) {
    const labels = [
        "Personal Details",
        "Store Details",
        "Shipping Details",
        "Completed",
    ];
    return (
        <div className={styles.progress}>
            <div>
                <p className={styles.eyebrow}>Step {step} of 4</p>
                <h2>{labels[step - 1]}</h2>
                <div
                    className={styles.track}
                    role="progressbar"
                    aria-label="Application progress"
                    aria-valuemin={1}
                    aria-valuemax={4}
                    aria-valuenow={step}
                    aria-valuetext={`Step ${step} of 4: ${labels[step - 1]}`}
                >
                    <div
                        className={styles.fill}
                        style={{ width: `${(step / 4) * 100}%` }}
                    />
                </div>
            </div>
            <p>{Math.floor((step / 4) * 100)}% completed</p>
        </div>
    );
}
