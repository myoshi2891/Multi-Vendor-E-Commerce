import { cn } from '@/lib/utils'
import { OfferTag } from '@prisma/client'
import Link from 'next/link'
import { useMediaQuery } from 'react-responsive'

export default function OfferTagsLinks({
    offerTags,
    open,
}: {
    offerTags: OfferTag[]
    open: boolean
}) {
    const isPhoneScreen = useMediaQuery({ query: '(max-width: 640px)' })
    const isSmallScreen = useMediaQuery({ query: '(min-width: 640px)' })
    const isMediumScreen = useMediaQuery({ query: '(min-width: 768px)' })
    const isLargeScreen = useMediaQuery({ query: '(min-width: 1024px)' })
    const is2XLargeScreen = useMediaQuery({ query: '(min-width: 1536px)' })

    let splitPoint = 1
    if (is2XLargeScreen) splitPoint = 7
    else if (isLargeScreen) splitPoint = 6
    else if (isMediumScreen) splitPoint = 4
    else if (isSmallScreen) splitPoint = 3
    else if (isPhoneScreen) splitPoint = 2

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
                {offerTags.slice(0, splitPoint).map((tag, i) => (
                    <Link
                        href={`/browse?offer=${tag.url}`}
                        key={tag.id}
                        className={cn(
                            'rounded-[20px] px-4 text-center font-bold leading-10 text-white hover:bg-[#ffffff33]',
                            {
                                'text-orange-background': i === 0,
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
