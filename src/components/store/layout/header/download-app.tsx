// Assets
import { AppIcon } from '@/components/store/icons'
import PlayStoreImg from '@/public/assets/icons/google-play.webp'
import AppStoreImg from '@/public/assets/icons/app-store.webp'

// Next.js
import Link from 'next/link'
import Image from 'next/image'

export default function DownloadApp() {
    return (
        <div className="group relative">
            {/* Trigger */}
            <div className="flex h-11 cursor-pointer items-center px-2">
                <span className="text-[32px]">
                    <AppIcon />
                </span>
                <div className="ml-1">
                    <b className="inline-block max-w-[90px] text-xs font-medium text-white">
                        Download the GoShop App
                    </b>
                </div>
            </div>
            {/* Content */}
            <div className="absolute top-0 hidden cursor-pointer group-hover:block">
                <div className="relative z-50 -ml-20 mt-12 w-[300px] rounded-3xl bg-white px-1 pb-6 pt-2 text-main-primary shadow-lg">
                    {/* Triangle */}
                    <div className="absolute -top-1.5 left-36 size-0 !border-x-[10px] !border-b-[10px] !border-l-transparent !border-r-transparent border-b-white"></div>
                    <div className="break-words px-1 py-3">
                        <div className="flex">
                            <div className="mx-3">
                                <h3 className="m-0 mx-auto max-w-40 text-[20px] font-bold text-main-primary">
                                    Download the GoShop App
                                </h3>
                                <div className="mt-4 flex items-center gap-x-2">
                                    <Link
                                        href=""
                                        className="grid place-items-center rounded-3xl bg-black px-4 py-3"
                                    >
                                        <Image
                                            src={AppStoreImg}
                                            alt="App Store"
                                            width={120}
                                            height={40}
                                        />
                                    </Link>
                                    <Link
                                        href=""
                                        className="grid place-items-center rounded-3xl bg-black px-4 py-3"
                                    >
                                        <Image
                                            src={PlayStoreImg}
                                            alt="Google Play Store"
                                            width={120}
                                            height={40}
                                        />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
