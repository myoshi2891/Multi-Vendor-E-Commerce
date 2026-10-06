import React from "react";
import Header from "@/components/store/layout/header/header-frame";
import AccountMenu from "@/components/store/layout/header/user-menu/account-menu";
export default function PurchaseHeader() {
    const user = new URLSearchParams(location.search).get("signed")
        ? {
              fullName: "Test customer",
              imageUrl: "/assets/images/default-user.jpg",
          }
        : null;
    return (
        <Header
            userCountry={{ name: "Japan", code: "JP", city: "", region: "" }}
            accountMenu={
                <AccountMenu user={user} disclosureName="store-header-panel" />
            }
        />
    );
}
