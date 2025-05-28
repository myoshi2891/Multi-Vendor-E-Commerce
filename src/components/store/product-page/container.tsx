import { ProductPageDataType } from "@/lib/types";
import { FC, ReactNode } from "react";
import ProductSwiper from "./product-swiper";
import ProductInfo from "./product-info/product-info";
import ShipTo from "./shipping/ship-to";
import ShippingDetails from "./shipping/shipping-details";

interface Props {
	productData: ProductPageDataType;
	sizeId: string | undefined;
	children: ReactNode;
}
const ProductPageContainer: FC<Props> = ({ productData, sizeId, children }) => {
	// If there is no product data available, render nothing (null)
	if (!productData) return null;
	const { images, shippingDetails } = productData;

	return (
		<div className="relative">
			<div className="w-full xl:flex xl:gap-4">
				{/* Product images swiper */}
				<ProductSwiper images={images} />
				<div className="w-full mt-4 md:mt-0 flex flex-col gap-4 md:flex-row">
					{/* Product main info */}
					<ProductInfo productData={productData} sizeId={sizeId} />
					{/* Shipping details - buy actions buttons */}
					<div className="w-[390px]">
						<div className="z-20">
							<div className="bg-white border rounded-md overflow-hidden overflow-y-auto p-4 pb-0">
								{/* Ship to */}
								{typeof shippingDetails !== "boolean" && (
									<>
										<ShipTo
											countryCode={
												shippingDetails.countryCode
											}
											countryName={
												shippingDetails.countryName
											}
											city={shippingDetails.city}
										/>
										<div className="mt-3 space-y-3">
											<ShippingDetails
												shippingDetails={
													shippingDetails
												}
												quantity={1}
												weight={1}
											/>
										</div>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="w-[calc(100%-390px)] mt-6 pb-16">{children}</div>
		</div>
	);
};

export default ProductPageContainer;
