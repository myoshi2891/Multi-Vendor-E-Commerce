import styles from "@/components/store/forms/apply-seller/application.module.css";
import { applySeller } from "@/queries/store";
import ApplySellerMultiForm from "@/components/store/forms/apply-seller/apply-seller";
import MinimalHeader from "@/components/store/layout/minimal-header/header";

export default function SellerApplyPage() {
    return (
        <div className={styles.page}>
            <MinimalHeader design="seller-application" />
            <ApplySellerMultiForm applySellerAction={applySeller} />
        </div>
    );
}
