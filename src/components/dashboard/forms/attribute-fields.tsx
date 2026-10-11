"use client";

// React
import { FC } from "react";
import styles from "../design/seller.module.css";

// Form
import type { Control } from "react-hook-form";

// UI Components
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

// Types
import type {
    ArchivedCurrentOptions,
    AttributeDefinitionDTO,
    AttributeFormValue,
    AttributeOptionDTO,
} from "@/lib/attribute-definitions";
import type { ProductFormWithAttributes } from "@/lib/attribute-schema";

/** 任意項目の「未選択」を Select で表す番兵値（option id と衝突しない）。 */
const UNSET_VALUE = "__unset__";

interface AttributeFieldsProps {
    design?: "seller";
    control: Control<ProductFormWithAttributes>;
    prefix: "productAttributes" | "variantAttributes";
    definitions: readonly AttributeDefinitionDTO[];
    /** このレコードの現在値であるアーカイブ済み選択肢（A-11）。他レコードの値は渡さないこと。 */
    archivedCurrent?: ArchivedCurrentOptions;
    disabled?: boolean;
}

const labelFor = (def: AttributeDefinitionDTO) => {
    const unit = def.unit ? ` (${def.unit})` : "";
    const requiredMark = def.required ? " *" : "";
    return `${def.name}${unit}${requiredMark}`;
};

const asString = (value: AttributeFormValue | undefined): string =>
    typeof value === "string" ? value : "";

const asStringArray = (value: AttributeFormValue | undefined): string[] =>
    Array.isArray(value) ? value : [];

/** BOOLEAN の値を Select の値へ（未選択は番兵値）。 */
const booleanSelectValue = (value: AttributeFormValue | undefined): string => {
    if (value === true) return "true";
    if (value === false) return "false";
    return UNSET_VALUE;
};

interface ValueControlProps {
    design?: "seller";
    value: AttributeFormValue | undefined;
    onChange: (value: AttributeFormValue) => void;
    disabled?: boolean;
}

interface OptionControlProps extends ValueControlProps {
    /** アクティブな選択肢 + このレコードのアーカイブ済み現在値（"(Discontinued)" 表記付き）。 */
    options: readonly AttributeOptionDTO[];
}

interface ControlProps extends OptionControlProps {
    def: AttributeDefinitionDTO;
}

const OptionSelect: FC<ControlProps> = ({
    design,
    def,
    value,
    onChange,
    disabled,
    options,
}) => (
    <Select
        disabled={disabled}
        value={asString(value) || UNSET_VALUE}
        onValueChange={(next) => onChange(next === UNSET_VALUE ? null : next)}
    >
        <FormControl>
            <SelectTrigger>
                <SelectValue placeholder={`Select ${def.name}`} />
            </SelectTrigger>
        </FormControl>
        <SelectContent
            className={
                design === "seller"
                    ? `${styles.theme} ${styles.controls}`
                    : undefined
            }
        >
            <SelectItem value={UNSET_VALUE}>Not specified</SelectItem>
            {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                    {option.label}
                </SelectItem>
            ))}
        </SelectContent>
    </Select>
);

const BooleanSelect: FC<ValueControlProps> = ({
    design,
    value,
    onChange,
    disabled,
}) => (
    <Select
        disabled={disabled}
        value={booleanSelectValue(value)}
        onValueChange={(next) =>
            onChange(next === UNSET_VALUE ? null : next === "true")
        }
    >
        <FormControl>
            <SelectTrigger>
                <SelectValue />
            </SelectTrigger>
        </FormControl>
        <SelectContent
            className={
                design === "seller"
                    ? `${styles.theme} ${styles.controls}`
                    : undefined
            }
        >
            <SelectItem value={UNSET_VALUE}>Not specified</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
        </SelectContent>
    </Select>
);

const MultiOptionCheckboxes: FC<OptionControlProps> = ({
    value,
    onChange,
    disabled,
    options,
}) => {
    const selected = asStringArray(value);
    return (
        <div className="flex flex-wrap gap-4">
            {options.map((option) => (
                <label
                    key={option.id}
                    className="flex items-center gap-2 text-sm"
                >
                    <Checkbox
                        disabled={disabled}
                        checked={selected.includes(option.id)}
                        onCheckedChange={(checked) =>
                            onChange(
                                checked === true
                                    ? [...selected, option.id]
                                    : selected.filter((id) => id !== option.id)
                            )
                        }
                    />
                    {option.label}
                </label>
            ))}
        </div>
    );
};

const AttributeControl: FC<ControlProps> = (props) => {
    const { def, options, value, onChange, disabled } = props;
    switch (def.type) {
        case "TEXT":
            return (
                <FormControl>
                    <Input
                        disabled={disabled}
                        value={asString(value)}
                        onChange={(event) => onChange(event.target.value)}
                    />
                </FormControl>
            );
        case "NUMBER":
            // 文字列のまま保持する（空入力を 0 に化かさない・A-9）
            return (
                <FormControl>
                    <Input
                        disabled={disabled}
                        inputMode="decimal"
                        value={asString(value)}
                        onChange={(event) => onChange(event.target.value)}
                    />
                </FormControl>
            );
        case "BOOLEAN":
            return (
                <BooleanSelect
                    design={props.design}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                />
            );
        case "ENUM":
            return def.multiValued ? (
                <MultiOptionCheckboxes
                    options={options}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                />
            ) : (
                <OptionSelect {...props} />
            );
    }
};

/**
 * 解決済みの属性定義からフォーム項目を描画する（plan 069 Step 8）。
 * 値の型はスコープ別オブジェクト `prefix.<definitionId>` に入る。
 */
/** アクティブな選択肢の後ろに、このレコードのアーカイブ済み現在値を廃止表記で足す。 */
const optionsFor = (
    def: AttributeDefinitionDTO,
    archivedCurrent: ArchivedCurrentOptions | undefined
): AttributeOptionDTO[] => {
    const archived = (archivedCurrent?.[def.id] ?? []).filter(
        (option) => !def.options.some((active) => active.id === option.id)
    );
    return [
        ...def.options,
        ...archived.map((option) => ({
            ...option,
            label: `${option.label} (Discontinued)`,
        })),
    ];
};

const AttributeFields: FC<AttributeFieldsProps> = ({
    design,
    control,
    prefix,
    definitions,
    archivedCurrent,
    disabled,
}) => (
    <div className="grid gap-4 md:grid-cols-2">
        {definitions.map((def) => (
            <FormField
                key={def.id}
                control={control}
                name={`${prefix}.${def.id}`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{labelFor(def)}</FormLabel>
                        <AttributeControl
                            design={design}
                            def={def}
                            options={optionsFor(def, archivedCurrent)}
                            value={field.value}
                            onChange={field.onChange}
                            disabled={disabled}
                        />
                        {def.multiValued && (
                            <FormDescription>
                                Select all that apply.
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />
        ))}
    </div>
);

export default AttributeFields;
