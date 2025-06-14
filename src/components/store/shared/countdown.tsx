import { FC, useEffect, useState } from 'react'

interface Props {
    targetDate: string // Target date in a string format (e.g., "2024-12-31T23:59:59")
}

const Countdown: FC<Props> = ({ targetDate }) => {
    const [timeLeft, setTimeLeft] = useState<{
        days: number
        hours: number
        minutes: number
        seconds: number
    }>({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    })

    useEffect(() => {
        const targetTime = new Date(targetDate).getTime()
        const calculateTimeLeft = () => {
            const now = new Date().getTime()
            const difference = targetTime - now
            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24))
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
                const minutes = Math.floor((difference / (1000 * 60)) % 60)
                const seconds = Math.floor(difference / 1000) % 60
                setTimeLeft({ days, hours, minutes, seconds })
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
            }
        }
        const timer = setInterval(calculateTimeLeft, 1000)

        // Initial calculation to avoid delay
        calculateTimeLeft()

        return () => clearInterval(timer)
    }, [targetDate])

    return (
        <div className="leading-4 text-orange-background">
            <div className="inline-block text-xs">
                <span className="mr-1">Ends in:</span>
                <div className="inline-block">
                    <span className="inline-block min-h-4 min-w-5 rounded-[2px] bg-orange-background p-0 text-center text-white">
                        {timeLeft.days.toString().padStart(2, '0')}
                    </span>
                    <span className="mx-1"></span>
                    <span className="inline-block min-h-4 min-w-5 rounded-[2px] bg-orange-background p-0 text-center text-white">
                        {timeLeft.hours.toString().padStart(2, '0')}
                    </span>
                    <span className="mx-1"></span>
                    <span className="inline-block min-h-4 min-w-5 rounded-[2px] bg-orange-background p-0 text-center text-white">
                        {timeLeft.minutes.toString().padStart(2, '0')}
                    </span>
                    <span className="mx-1"></span>
                    <span className="inline-block min-h-4 min-w-5 rounded-[2px] bg-orange-background p-0 text-center text-white">
                        {timeLeft.seconds.toString().padStart(2, '0')}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default Countdown
