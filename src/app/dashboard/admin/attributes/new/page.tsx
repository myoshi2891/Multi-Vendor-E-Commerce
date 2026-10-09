import { upsertAttributeDefinition } from "@/queries/attribute";
import AttributeDetails from "@/components/dashboard/forms/attribute-details";
import { getAttributeCategoryOptions } from "../category-options";

export const dynamic = "force-dynamic";

export default async function AdminNewAttributePage() {
    const categories = await getAttributeCategoryOptions();
    return (
        <div className="w-full">
            <AttributeDetails
                saveAction={upsertAttributeDefinition}
                categories={categories}
            />
        </div>
    );
}
