import Link from "next/link";

export default function Featured() {
    return (
        <div className="relative overflow-hidden rounded-md">
            <div
                className="flex w-full items-center bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: "url(/assets/images/ads/featured.webp)",
                }}
            >
                {/* Coupon */}
                <Link href="/">
                    <div className="relative float-left h-[190px] w-52 px-3">
                        <div className="flex h-[103px] flex-col items-center justify-center">
                            <h3 className="my-1 w-full font-bold leading-5 text-white">
                                Welcome New Comers
                            </h3>
                            <p className="w-full text-sm text-white">
                                Enjoy shopping made easy like nothing before
                            </p>
                        </div>
                        <div
                            className="absolute bottom-[35px] h-[55px] w-[192px] overflow-hidden bg-contain bg-no-repeat pl-[14px] pr-[45px] text-left text-white"
                            style={{
                                backgroundImage:
                                    "url(/assets/images/ads/coupon.gif)",
                            }}
                        >
                            <h3 className="mb-1 mt-[11px] w-full text-[20px] leading-6 text-white">
                                use &apos;COUPON&apos;
                            </h3>
                            <p className="w-full -translate-y-1 overflow-hidden text-ellipsis text-xs">
                                for 87% off
                            </p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
