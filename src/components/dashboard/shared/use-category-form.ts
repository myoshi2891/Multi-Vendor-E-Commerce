"use client";

import { useEffect } from "react";
import { Category } from "@prisma/client";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CategoryFormSchema } from "@/lib/schemas";
// カテゴリツリー（DB に触れない純粋ヘルパーのみ）
import {
    isWithinSubtree,
    toCanonicalCategorySlug,
    MAX_CATEGORY_DEPTH,
} from "@/lib/category-path";

export type CategoryFormValues = z.infer<typeof CategoryFormSchema>;

/**
 * 既存カテゴリをフォーム値へ写す。
 *
 * 移行で温存された旧 url（大文字・`_`・空白）は CategoryFormSchema の
 * 正規表現を通らない。正準形へ寄せておかないと、その行は featured の
 * 切り替えすら保存できない（旧 slug は保存時に別名表へ残る）。
 */
const toFormValues = (data?: Category): CategoryFormValues => ({
    name: data?.name ?? "",
    image: data?.image ? [{ url: data.image }] : [],
    url: data?.url ? toCanonicalCategorySlug(data.url) : "",
    featured: data?.featured ?? false,
    parentId: data?.parentId ?? null,
    sortOrder: data?.sortOrder ?? 0,
});

/**
 * 親に選べるカテゴリだけを残す。
 *
 * - 自分自身と自分の子孫（循環になる。サーバー側も V-7b / V-7c で拒否する）
 * - 自分のサブツリーを載せると上限を超えるノード
 *
 * **移動するのは 1 ノードではなくサブツリー全体である。** 深さ判定に
 * 自分の高さを含めないと、「自分は入るが子孫が上限を超える」親を UI が
 * 提示してしまい、保存して初めて upsertCategory の V-7（rebase 後の全子孫を
 * MAX_CATEGORY_DEPTH で検証する経路）に弾かれる。
 * **UI の絞り込みは表示上の親切であって強制ではない** —— 本体の検証は
 * upsertCategory 側にある。
 */
const selectParentOptions = (
    categories: Category[],
    data?: Category
): Category[] => {
    // 編集対象を根とするサブツリーの高さ（自分だけなら 0）
    const subtreeHeight = data
        ? categories.reduce(
              (max, node) =>
                  isWithinSubtree(node.path, data.path)
                      ? Math.max(max, node.depth - data.depth)
                      : max,
              0
          )
        : 0;

    return categories.filter((candidate) => {
        if (data && candidate.id === data.id) return false;
        if (data && isWithinSubtree(candidate.path, data.path)) return false;
        return candidate.depth + 1 + subtreeHeight <= MAX_CATEGORY_DEPTH;
    });
};

/**
 * カテゴリ作成・編集フォームの共通状態。
 *
 * 旧フォーム（forms/category-details）と管理画面フォーム（admin/category-form）は
 * 保存方法だけが異なるため、初期値・親候補・data 変更時のリセットをここへ集約する。
 */
export const useCategoryForm = (data?: Category, categories?: Category[]) => {
    const form = useForm<CategoryFormValues>({
        mode: "onChange",
        resolver: zodResolver(CategoryFormSchema),
        defaultValues: toFormValues(data),
    });

    const parentOptions = selectParentOptions(categories ?? [], data);

    // Reset form values when data changes
    useEffect(() => {
        if (data) form.reset(toFormValues(data));
    }, [data, form]);

    return { form, parentOptions };
};
