'use client'
import { cn } from '@/lib/utils'
import { followStore } from '@/queries/user'
import { useUser } from '@clerk/nextjs'
import { Check, MessageSquareMore, Plus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FC, useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
    store: {
        id: string
        url: string
        name: string
        logo: string
        followersCount: number
        isUserFollowingStore: boolean
    }
}

const StoreCard: FC<Props> = ({ store }) => {
    const { id, name, logo, url, followersCount, isUserFollowingStore } = store
    const [following, setFollowing] = useState<boolean>(isUserFollowingStore)
    const [storeFollowersCount, setStoreFollowersCount] =
        useState<number>(followersCount)
    const { isLoaded, isSignedIn } = useUser()
    const router = useRouter()
    const handleStoreFollow = async () => {
        // Clerk のロード完了前は `isSignedIn` が false を返すため、先に `isLoaded` を見る。
        // これを省くとハイドレーション直後のクリックでサインイン済みユーザーまで
        // `/sign-in` へ飛ばされ、フォローも成立しない。
        if (!isLoaded) return
        if (!isSignedIn) {
            router.push('/sign-in')
            return // push は非同期。return しないと未認証のまま followStore が走る
        }
        try {
            const res = await followStore(id)
            setFollowing(res)
            if (res) {
                setStoreFollowersCount((prev) => prev + 1)
                toast.success(`You are now following ${name}`, {
                    duration: 3000,
                })
            }
            if (!res) {
                setStoreFollowersCount((prev) => prev - 1)
                toast.success(`You unfollowed ${name}`, { duration: 3000 })
            }
        } catch (error) {
            toast.error('Something happened, Try again later.')
        }
    }

    return (
        <div className="w-full">
            <div className="flex items-center justify-between rounded-xl bg-[#f5f5f5] px-4 py-3">
                <div className="flex">
                    <Link href={`/store/${url}`}>
                        <Image
                            src={logo}
                            alt={name}
                            width={50}
                            height={50}
                            className="size-12 rounded-full object-cover"
                            priority
                        />
                    </Link>
                    <div className="mx-2">
                        <div className="text-xl font-bold leading-6">
                            <Link
                                href={`/store/${url}`}
                                className="text-main-primary"
                            >
                                {name}
                            </Link>
                        </div>
                        <div className="mt-1 text-sm leading-5">
                            <strong>100%</strong>
                            <span> Positive Feedback</span>&nbsp;|&nbsp;
                            <strong>{storeFollowersCount}</strong>
                            <strong> Followers</strong>
                        </div>
                    </div>
                </div>
                <div className="flex">
                    <button
                        type="button"
                        // Clerk のロード完了までは押せないようにする（ハンドラ側のガードだけだと
                        // 押下は成立するのに何も起きない「無反応」状態に見えるため）
                        disabled={!isLoaded}
                        aria-pressed={following}
                        className={cn(
                            'mx-2 flex h-9 cursor-pointer items-center rounded-full border border-black px-4 text-base font-bold hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50',
                            {
                                'bg-black text-white': following,
                            }
                        )}
                        onClick={() => handleStoreFollow()}
                    >
                        {following ? (
                            <Check className="me-1 w-4" />
                        ) : (
                            <Plus className="me-1 w-4" />
                        )}
                        <span>{following ? 'Following' : 'Follow'}</span>
                    </button>
                    <div className="mx-2 flex h-9 cursor-pointer items-center rounded-full border border-black bg-black px-4 text-base font-bold text-white">
                        <MessageSquareMore className="me-1 w-4" />
                        <span>Message</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StoreCard
