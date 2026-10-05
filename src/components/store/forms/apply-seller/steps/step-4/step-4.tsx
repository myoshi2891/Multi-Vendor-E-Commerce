import Link from "next/link";
import AnimatedContainer from "../../animated-container";
import styles from "../../application.module.css";
export default function Step4() {
    return (
        <AnimatedContainer>
            <section className={styles.success} role="status">
                <h2>Your store has been created!</h2>
                <p>
                    Thank you for creating your store. It&apos;s currently under
                    review and will be approved shortly. Stay tuned!
                </p>
                <Link href="/" className={styles.secondary}>
                    Back to home
                </Link>
            </section>
        </AnimatedContainer>
    );
}
