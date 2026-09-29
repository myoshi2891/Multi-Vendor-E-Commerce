import type { AttributeDisplayItem } from "@/lib/attribute-repository";
import { FC, useId } from "react";
import styles from './product.module.css'

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
        <section aria-labelledby={headingId} className={styles.specSection}>
            <div className={styles.contentHeading}><div><p>THE FINER DETAILS</p><h2 id={headingId}>{title}</h2></div></div>
            {/* Product Specs Table */}
            {product.length > 0 && <SpecTable data={product} />}
            {/* Variant Specs Table */}
            {variant.length > 0 && (
                <SpecTable data={variant} />
            )}
        </section>
    );
};

const SpecTable = ({
    data,
}: {
    data: Spec[];
}) => {
    return (
        <dl className={styles.specGrid}>
            {data.map((spec, i) => (
                <div key={`${spec.name}-${i}`}><dt>{spec.name}</dt><dd>{spec.value}</dd></div>
            ))}
        </dl>
    );
};
