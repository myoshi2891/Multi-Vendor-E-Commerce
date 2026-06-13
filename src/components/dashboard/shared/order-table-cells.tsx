"use client";

// 注文テーブル（admin / seller）で重複していたセル UI を共通化するモジュール。
// columns.tsx 間のコピペ（SonarCloud 重複検出）を解消する目的で抽出した。

import React from "react";
import Image from "next/image";
import { Expand } from "lucide-react";
import { useModal } from "@/providers/modal-provider";
import CustomModal from "@/components/dashboard/shared/custom-modal";

/**
 * 注文行の商品画像を横並びで重ねて表示するセル。
 * 画像 URL の取り出し方は呼び出し側（admin は group 横断、seller は items）で異なるため、
 * 整形済みの `images` 配列のみを受け取り、描画ロジックを一元化する。
 */
export const ProductImagesCell = ({ images }: { images: string[] }) => {
    return (
        <div className="flex flex-wrap gap-1">
            {images.map((img, i) => (
                <Image
                    key={`${img}-${i}`}
                    src={img}
                    alt={`product-${i}`}
                    width={100}
                    height={100}
                    className="size-7 rounded-full object-cover"
                    style={{
                        transform: `translateX(-${i * 15}px)`,
                    }}
                />
            ))}
        </div>
    );
};

/**
 * 注文詳細モーダルを開く「View」ボタン。
 * モーダルの中身は呼び出し側で組み立てて `children` として渡す
 * （admin は OrderGroup ごとに複数 `StoreOrderSummary`、seller は単一）。
 */
export const ViewOrderButton = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const { setOpen } = useModal();
    return (
        <button
            className="group relative isolation-auto z-10 mx-auto flex items-center justify-center gap-2 overflow-hidden rounded-full border-2 bg-[#0A0D2D] px-4 py-2 font-sans text-lg text-gray-50 backdrop-blur-md before:absolute before:-left-full before:-z-10 before:aspect-square before:w-full before:scale-150 before:rounded-full before:transition-all before:duration-700 hover:text-gray-50 before:hover:left-0 before:hover:bg-blue-primary before:hover:duration-700 lg:font-semibold"
            onClick={() => {
                setOpen(
                    <CustomModal maxWidth="!max-w-3xl">{children}</CustomModal>
                );
            }}
        >
            View
            <span className="grid size-7 place-items-center rounded-full bg-white">
                <Expand className="w-5 stroke-black" />
            </span>
        </button>
    );
};
