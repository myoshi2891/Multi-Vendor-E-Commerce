'use client'

import { useId, useState } from 'react'
import { ChevronDown, Truck } from 'lucide-react'
import { ProductShippingDetailsType } from '@/lib/types'
import { computeShippingTotal } from '@/lib/shipping-utils'
import { getShippingDatesRange } from '@/lib/utils'
import ProductShippingFee from './shipping-fee'
import styles from '../product.module.css'

export default function ShippingDetails({
    shippingDetails,
    quantity,
    weight,
}: Readonly<{
    shippingDetails: ProductShippingDetailsType
    quantity: number
    weight: number
}>) {
    const [expanded, setExpanded] = useState(false)
    const panelId = useId()
    if (!shippingDetails) return null

    const {
        countryName,
        shippingService,
        shippingFeeMethod,
        shippingFee,
        extraShippingFee,
        deliveryTimeMin,
        deliveryTimeMax,
        isFreeShipping,
    } = shippingDetails
    const total = computeShippingTotal(shippingFeeMethod, shippingFee, extraShippingFee, weight, quantity)
    const { minDate, maxDate } = getShippingDatesRange(deliveryTimeMin, deliveryTimeMax)

    return (
        <div className={styles.shippingDetails}>
            <div className={styles.shippingSummary}>
                <Truck size={18} aria-hidden="true" />
                <div><span>DELIVERY</span><strong>{isFreeShipping ? 'Complimentary shipping' : `Shipping to ${countryName}`}</strong></div>
                <b>{isFreeShipping ? 'FREE' : `$${total}`}</b>
            </div>
            <dl className={styles.shippingMeta}>
                <div><dt>Service</dt><dd>{shippingService}</dd></div>
                <div><dt>Estimated</dt><dd>{minDate.slice(4)} – {maxDate.slice(4)}</dd></div>
            </dl>
            {!isFreeShipping && (
                <>
                    <button
                        type="button"
                        className={styles.shippingToggle}
                        data-testid="shipping-breakdown-toggle"
                        aria-label={`${expanded ? 'Hide' : 'Show'} shipping fee breakdown`}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={() => setExpanded(!expanded)}
                    >
                        <span>Shipping fee breakdown</span><ChevronDown size={16} aria-hidden="true" />
                    </button>
                    {expanded && (
                        <section id={panelId} aria-label="Shipping fee breakdown" className={styles.feePanel}>
                            <ProductShippingFee method={shippingFeeMethod} fee={shippingFee} extraFee={extraShippingFee} quantity={quantity} weight={weight} />
                        </section>
                    )}
                </>
            )}
        </div>
    )
}
