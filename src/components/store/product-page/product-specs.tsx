import { cn } from "@/lib/utils";
import type { AttributeDisplayItem } from "@/lib/attribute-repository";
import { FC, useId } from "react";

interface Spec {
    name: string;
    value: string;
}

interface Props {
    // 構造化属性（カテゴリ別属性・plan 069）→「Specifications」
    attributes: {
        product: AttributeDisplayItem[];
        variant: AttributeDisplayItem[];
    };
    // 自由記述の Spec（温存・design.md Q3）→「Other specifications」
    specs: {
        product: Spec[];
        variant: Spec[];
    };
}

const toSpecRow = (item: AttributeDisplayItem): Spec => {
    const value = item.values.join(", ");
    return {
        name: item.name,
        value: item.unit ? `${value} ${item.unit}` : value,
    };
};

const ProductSpecs: FC<Props> = ({ attributes, specs }) => {
    const structuredProduct = attributes.product.map(toSpecRow);
    const structuredVariant = attributes.variant.map(toSpecRow);
    return (
        <div>
            <SpecSection
                title="Specifications"
                product={structuredProduct}
                variant={structuredVariant}
            />
            <SpecSection
                title="Other specifications"
                product={specs.product}
                variant={specs.variant}
            />
        </div>
    );
};

export default ProductSpecs;

const SpecSection = ({
    title,
    product,
    variant,
}: {
    title: string;
    product: Spec[];
    variant: Spec[];
}) => {
    const headingId = useId();
    if (product.length === 0 && variant.length === 0) return null;
    return (
        <section aria-labelledby={headingId} className="pt-6">
            {/* Title */}
            <div className="h-12">
                <h2
                    id={headingId}
                    className="text-2xl font-bold text-main-primary"
                >
                    {title}
                </h2>
            </div>
            {/* Product Specs Table */}
            {product.length > 0 && <SpecTable data={product} />}
            {/* Variant Specs Table */}
            {variant.length > 0 && (
                <SpecTable data={variant} noTopBorder={product.length > 0} />
            )}
        </section>
    );
};

const SpecTable = ({
    data,
    noTopBorder,
}: {
    data: Spec[];
    noTopBorder?: boolean;
}) => {
    return (
        <ul
            className={cn("grid grid-cols-2 border", {
                "border-t-0": noTopBorder,
            })}
        >
            {data.map((spec, i) => (
                <li
                    key={i}
                    className={cn("flex border-t", {
                        "border-t-0": i === 0,
                    })}
                >
                    <div className="relative float-left flex w-1/2 max-w-[50%] text-sm leading-7">
                        <div className="w-44 bg-[#f5f5f5] p-4 text-main-primary">
                            <span className="leading-5">{spec.name}</span>
                        </div>
                        <div className="flex-1 break-words p-4 leading-5 text-[#151515]">
                            <span className="leading-5">{spec.value}</span>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
};
