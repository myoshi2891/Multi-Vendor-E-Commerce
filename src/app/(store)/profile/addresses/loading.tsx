import AddressesHeading from "@/components/store/profile/addresses/heading";
import styles from "@/components/store/profile/addresses/addresses.module.css";

export default function AddressesLoading() {
    return (
        <section
            className={styles.addresses}
            data-addresses
            aria-label="Shipping address management"
            aria-busy="true"
        >
            <AddressesHeading />
            <div className={styles.message} role="status">
                <p>Loading addresses…</p>
                <div className={styles.skeleton} aria-hidden="true" />
            </div>
        </section>
    );
}
