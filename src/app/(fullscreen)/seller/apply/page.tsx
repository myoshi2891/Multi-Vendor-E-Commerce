import ApplySellerMultiForm from "@/components/store/forms/apply-seller/apply-seller";
import MinimalHeader from "@/components/store/layout/minimal-header/header";

export default function SellerApplyPage() {
    return (
        <div className="h-screen overflow-y-hidden bg-[#eef4fc]">
            <MinimalHeader />
            <ApplySellerMultiForm />
        </div>
    );
}
