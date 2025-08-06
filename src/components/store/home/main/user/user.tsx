import { SimpleProduct } from "@/lib/types";
import { currentUser } from "@clerk/nextjs/server";
import Image from "next/image";
import UserImg from "@/public/assets/images/default-user.avif";
import Link from "next/link";
import { Button } from "../../../ui/button";
import MainSwiper from "../../../shared/swiper";
import UserCardProducts from "./products";

export default async function HomeUserCard({
    products,
}: {
    products: SimpleProduct[];
}) {
    const user = await currentUser();
    const role = user?.privateMetadata.role;
    return (
        <div className="relative hidden h-full overflow-hidden rounded-md bg-white shadow-sm min-[1170px]:block">
            <div
                className="h-full rounded-md bg-no-repeat pb-9"
                style={{
                    backgroundImage: "url(/assets/images/user-card-bg.avif)",
                    backgroundSize: "100% 101px",
                }}
            >
                {/* User Info */}
                <div className="h-[76px] w-full">
                    <div className="mx-auto cursor-pointer">
                        <Image
                            src={user ? user.imageUrl : UserImg}
                            alt="User Avatar"
                            width={48}
                            height={48}
                            priority
                            className="absolute left-1/2 top-2 size-12 -translate-x-1/2 rounded-full object-cover"
                        />
                    </div>
                    <div className="absolute inset-x-0 top-16 mx-auto h-5 w-full cursor-pointer text-center font-bold capitalize text-black">
                        {user
                            ? user.fullName?.toLowerCase()
                            : "Welcome to GoShop"}
                    </div>
                </div>
                {/* User Links */}
                <div className="mt-4 flex h-[100px] w-full items-center justify-center gap-x-4">
                    <Link
                        href="/profile"
                        className="flex flex-col items-center"
                    >
                        <div
                            className="relative mx-auto block size-12 bg-cover bg-no-repeat"
                            style={{
                                backgroundImage:
                                    "url(/assets/images/user-card/user.webp)",
                                backgroundSize: "100% 100%",
                                width: "100%",
                                height: "auto",
                            }}
                        />
                        <span className="max-h-7 w-full text-center text-xs text-main-primary">
                            Account
                        </span>
                    </Link>
                    <Link
                        href="/profile/orders"
                        className="flex flex-col items-center"
                    >
                        <div
                            className="relative mx-auto block size-12 bg-cover bg-no-repeat"
                            style={{
                                backgroundImage:
                                    "url(/assets/images/user-card/orders.webp)",
                                backgroundSize: "100% 100%",
                                width: "100%",
                                height: "auto",
                            }}
                        />
                        <span className="max-h-7 w-full text-center text-xs text-main-primary">
                            Orders
                        </span>
                    </Link>
                    <Link
                        href="/profile/wishlist"
                        className="flex flex-col items-center"
                    >
                        <div
                            className="relative mx-auto block size-12 bg-cover bg-no-repeat"
                            style={{
                                backgroundImage:
                                    "url(/assets/images/user-card/wishlist.png)",
                                backgroundSize: "100% 100%",
                                width: "100%",
                                height: "auto",
                            }}
                        />
                        <span className="max-h-7 w-full text-center text-xs text-main-primary">
                            Wishlist
                        </span>
                    </Link>
                </div>
                {/* Action btn */}
                <div className="w-full px-2">
                    {user ? (
                        <div className="w-full">
                            {role === "ADMIN" ? (
                                <Button
                                    variant="orange-gradient"
                                    className="w-full rounded-md"
                                    asChild
                                >
                                    <Link href="/dashboard/admin">
                                        Switch to Admin Dashboard
                                    </Link>
                                </Button>
                            ) : role === "SELLER" ? (
                                <Button
                                    variant="orange-gradient"
                                    className="w-full rounded-md"
                                    asChild
                                >
                                    <Link href="/dashboard/seller">
                                        Switch to Seller Dashboard
                                    </Link>
                                </Button>
                            ) : (
                                <Button
                                    variant="orange-gradient"
                                    className="w-full rounded-md"
                                    asChild
                                >
                                    <Link href="/seller/apply">
                                        Apply to become a Seller
                                    </Link>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="flex w-full justify-between gap-x-4">
                            <Button variant="orange-gradient" asChild>
                                <Link href="/sign-up">Join</Link>
                            </Button>
                            <Button variant="gray" asChild>
                                <Link href="/sign-in">Sign in</Link>
                            </Button>
                        </div>
                    )}
                </div>
                {/* Ad swiper */}
                <div className="mt-2 size-full max-h-[420px] flex-1 px-2 pb-[102px]">
                    <div
                        className="size-full overflow-hidden rounded-md bg-[#f5f5f5] bg-cover px-2.5"
                        style={{
                            backgroundImage:
                                "url(/assets/images/ads/user-card-ad.avif)",
                        }}
                    >
                        <Link href="#">
                            <div className="h-24">
                                <div className="mt-2.5 overflow-hidden text-[13px] leading-[18px] text-white">
                                    Your favorite store
                                </div>
                                <div className="mt-2.5 font-bold leading-5 text-white">
                                    Check out the latest new deals
                                </div>
                            </div>
                        </Link>
                        <UserCardProducts products={products} />
                    </div>
                </div>
            </div>
        </div>
    );
}
