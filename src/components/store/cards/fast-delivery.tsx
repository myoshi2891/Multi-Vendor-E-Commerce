import { Check, ChevronRight, Package } from 'lucide-react'
import { FC } from 'react'

interface FastDeliveryProps {}

const FastDelivery: FC<FastDeliveryProps> = () => {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-1">
                    <Package className="w-4" />
                    <span className="text-sm font-bold">Fast Delivery</span>
                </div>
                <ChevronRight className="w-3" />
            </div>
            <span className="ml-5 flex gap-x-1 text-xs">
                <Check className="w-3 -translate-y-[2px] stroke-green-400" />
                <span>$5.00 coupon code if delayed</span>
            </span>
            <span className="ml-5 flex gap-x-1 text-xs">
                <Check className="w-3 -translate-y-[2px] stroke-green-400" />
                <span>Refund if package lost</span>
            </span>
            <span className="ml-5 flex gap-x-1 text-xs">
                <Check className="w-3 -translate-y-[2px] stroke-green-400" />
                <span>Refund if no delivery in time</span>
            </span>
        </div>
    )
}

export default FastDelivery
