import Link from "next/link";
import CouponImg from "@/public/assets/images/sideline/coupon.png";
import WishlistImg from "@/public/assets/images/sideline/wishlist.png";
import HistoryImg from "@/public/assets/images/sideline/history.png";
import ShareImg from "@/public/assets/images/sideline/share.png";
import FeedbackImg from "@/public/assets/images/sideline/feedback.png";
import SlidelineItem from "./item";
import SocialShare from "../../shared/social-share";

export default function Sideline() {
    return (
        <div className="absolute right-0 top-0 z-30 h-full w-10 bg-gradient-to-t from-slate-500 to-slate-800 text-[13px] duration-100">
            <div className="fixed top-[35%] -translate-y-1/2 text-center">
                <Link
                    href="/profile"
                    className="group relative block size-[35px] bg-[url('/assets/images/sideline/gift.avif')] bg-cover transition-all duration-100 ease-linear hover:bg-[url('/assets/images/sideline/gift-opened.avif')]"
                >
                    <span className="absolute left-[-160px] top-0.5 hidden rounded-sm bg-[#373737] px-4 py-[0.8rem] text-white transition-all duration-500 ease-linear group-hover:block">
                        Check your profile
                    </span>
                    <div className="absolute left-[-18px] top-[38%] hidden size-0 border-y-[12px] border-l-[12px] border-transparent border-l-[#373737] transition-all duration-500 ease-in-out group-hover:block" />
                </Link>
                <SlidelineItem link="/profile" image={CouponImg}>
                    Coupons
                </SlidelineItem>
                <SlidelineItem link="/profile/wishlist" image={WishlistImg}>
                    Wishlist
                </SlidelineItem>
                <SlidelineItem link="/profile/history" image={HistoryImg}>
                    History
                </SlidelineItem>
            </div>
            <div className="fixed top-[60%] -translate-y-1/2 text-left">
                <SlidelineItem
                    link="/"
                    image={ShareImg}
                    className="-bottom-9"
                    arrowClassName="mt-28"
                    w_fit
                >
                    <SocialShare url="http://localhost:3000" quote="" isCol />
                </SlidelineItem>
                <SlidelineItem link="/feedback" image={FeedbackImg}>
                    Feedback
                </SlidelineItem>
            </div>
        </div>
    );
}
