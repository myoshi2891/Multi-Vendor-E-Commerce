import { ShippingFeeMethod } from '@prisma/client'
import { Check, Truck } from 'lucide-react'
import { computeShippingTotal } from '@/lib/shipping-utils'
import styles from '../product.module.css'

export default function ProductShippingFee({
    method,
    fee,
    extraFee,
    weight,
    quantity,
}: {
    method: ShippingFeeMethod
    fee: number
    extraFee: number
    weight: number
    quantity: number
}) {
    const total = computeShippingTotal(method, fee, extraFee, weight, quantity)
    let note: string
    let formula: string
    let rows: { label: string; value: string }[]

    switch (method) {
        case ShippingFeeMethod.ITEM:
            note = 'This store calculates the delivery fee based on the number of items in the order.'
            rows = fee === extraFee
                ? [{ label: 'Fee per item', value: `$${fee}` }]
                : [
                    { label: 'Fee for First Item', value: `$${fee}` },
                    { label: 'Fee for Each Additional Item', value: `$${extraFee}` },
                ]
            rows.push({ label: 'Quantity', value: `x${quantity}` })
            formula = quantity === 1 || fee === extraFee
                ? `$${fee} (fee) x ${quantity} (items) = $${total}`
                : `$${fee} (first item) + ${quantity - 1} (additional items) x $${extraFee} = $${total}`
            break
        case ShippingFeeMethod.WEIGHT:
            note = 'This store calculates the delivery fee based on product weight.'
            rows = [{ label: 'Fee per kg (1 kg = 2.205 lb)', value: `$${fee}` }, { label: 'Quantity', value: `x${quantity}` }]
            formula = `$${fee} (fee) x ${weight}kg (weight) x ${quantity} (items) = $${total} (total fee)`
            break
        case ShippingFeeMethod.FIXED:
            note = 'This store calculates the delivery fee on a fixed price.'
            rows = [{ label: 'Fee', value: `$${fee}` }, { label: 'Quantity', value: `x${quantity}` }]
            formula = 'This fixed delivery fee stays the same when you add more items.'
            break
        default:
            return null
    }

    return (
        <div className={styles.feeBreakdown}>
            <div className={styles.feeIntro}>
                <span className={styles.feeMark}><Truck size={17} aria-hidden="true" /></span>
                <div><span>DELIVERY, CLEARLY EXPLAINED</span><p>{note}</p></div>
            </div>
            {method === ShippingFeeMethod.ITEM && fee !== extraFee && (
                <p className={styles.feeSaving}><Check size={14} aria-hidden="true" />If you purchase multiple items, you&apos;ll receive a discounted delivery fee.</p>
            )}
            <dl>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
            <div className={styles.feeTotal}><span>Total delivery</span><strong>${total}</strong></div>
            <p className={styles.feeFormula}>{formula}</p>
        </div>
    )
}
