import { cn } from '@/lib/utils'
import { OfferTag } from '@prisma/client'
import Link from 'next/link'

export default function OfferTagsLinks({
    offerTags,
    open,
}: {
    offerTags: OfferTag[]
    open: boolean
}) {
    return (
        <div className="relative w-fit">
            <div
                className={cn(
                    'flex flex-wrap items-center transition-all duration-100 ease-in-out xl:-translate-x-6',
                    {
                        '!translate-x-0': open,
                    }
                )}
            >
                {offerTags.slice(0, 7).map((tag, i) => (
                    <Link
                        href={`/browse?offer=${tag.url}`}
                        key={tag.id}
                        className={cn(
                            'rounded-[20px] px-4 text-center font-bold leading-10 text-white hover:bg-[#ffffff33]',
                            {
                                'text-orange-background': i === 0,
                                'hidden sm:block': i === 2,
                                'hidden md:block': i === 3,
                                'hidden lg:block': i === 4 || i === 5,
                                'hidden 2xl:block': i === 6,
                            }
                        )}
                    >
                        {tag.name}
                    </Link>
                ))}
            </div>
        </div>
    )
}
