import type { trackOrder } from "@/queries/order";

type TrackedOrder = NonNullable<Awaited<ReturnType<typeof trackOrder>>>;

/** Public tracking presentation excludes unused monetary Decimal and internal identifiers. */
export type TrackingDisplayData = Pick<TrackedOrder, "id" | "orderStatus" | "paymentStatus"> & {
    groups: Pick<TrackedOrder["groups"][number], "id" | "shippingService" | "shippingDeliveryMin" | "shippingDeliveryMax" | "store" | "items">[];
};
