import type { UserShippingAddressType } from "@/lib/types";
import Image from "next/image";
import styles from "../../shared/commerce.module.css";
export default function OrderUserDetailsCard({
    details,
}: {
    details: UserShippingAddressType;
}) {
    return (
        <section className={styles.panel}>
            <h2>Shipping address</h2>
            <div className={styles.store}>
                <Image
                    src={
                        details.user.picture ||
                        "/assets/images/default-user.jpg"
                    }
                    alt=""
                    width={40}
                    height={40}
                />
                <strong>
                    {details.firstName} {details.lastName}
                </strong>
            </div>
            <p className={styles.note}>
                {details.user.email}
                <br />
                {details.phone}
            </p>
            <address
                className={styles.note}
                style={{ fontStyle: "normal", marginTop: 16 }}
            >
                {details.address1}
                <br />
                {details.address2 && (
                    <>
                        {details.address2}
                        <br />
                    </>
                )}
                {details.city}, {details.state} {details.zip_code}
                <br />
                {details.country.name}
            </address>
        </section>
    );
}
