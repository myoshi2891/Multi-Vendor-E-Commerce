import { SendIcon } from "@/components/store/icons";

export default function Newsletter() {
    return <div className="bg-gradient-to-r from-slate-500 to-slate-800 p-5">
        <div className="mx-auto max-w-[1430px]">
            <div className="flex flex-col items-center gap-y-4 text-white xl:flex-row">
                {/* Left */}
                <div className="flex items-center xl:w-[58%]">
                    <h5 className="flex items-center gap-x-2">
                        <div className="mr-2 scale-125">
                            <SendIcon />
                        </div>
                        <span className="md:text-xl">Sign up to Newsletter</span>
                        <span className="ml-10">
                            ...and receive &nbsp;
                            <b>$10 coupon for first shopping</b>
                        </span>
                    </h5>
                </div>
                {/* Right */}
                <div className="flex w-full xl:flex-1">
                    <input type="text" placeholder="Enter your email address"
                        className="h-10 w-full rounded-l-full bg-white pl-6 text-black outline-none" />
                    <span className="grid h-10 w-24 cursor-pointer place-content-center rounded-r-full bg-slate-600 text-sm text-white">Sign up</span>
                </div>
            </div>
      </div>
  </div>;
}
