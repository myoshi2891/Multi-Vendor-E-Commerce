import styles from "./brand.module.css";
export default function Brand() {
    return (
        <span className={styles.brand} aria-label="Luxuries for Happiness">
            <span aria-hidden="true" className={styles.star}>
                ✦
            </span>
            <span>
                Luxuries<span className={styles.subtitle}>FOR HAPPINESS</span>
            </span>
        </span>
    );
}
