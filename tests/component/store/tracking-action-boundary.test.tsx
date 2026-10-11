/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import { Prisma } from "@prisma/client";
import Page from "@/app/(store)/track-order/page";
import TrackOrderForm from "@/components/store/track-order/track-order-form";
import { trackOrder } from "@/queries/order";

jest.mock("@/queries/order", () => ({trackOrder:jest.fn()}));
jest.mock("@/components/store/track-order/track-order-form", () => ({__esModule:true,default:jest.fn(() => null)}));
beforeEach(() => jest.clearAllMocks());
it("passes only serializable display fields from the public lookup to the client", async () => {
    const displayed={id:"order-1",orderStatus:"Processing",paymentStatus:"Paid",groups:[{id:"group-1",shippingService:"Standard",shippingDeliveryMin:3,shippingDeliveryMax:5,store:{name:"Store",url:"store"},items:[{id:"item-1",name:"Piece",image:"/piece.jpg",quantity:2,status:"Shipped"}]}]};
    jest.mocked(trackOrder).mockResolvedValueOnce({...displayed,total:new Prisma.Decimal("12.50"),groups:displayed.groups.map(group => ({...group,total:new Prisma.Decimal("12.50"),storeId:"private-store-id"}))} as unknown as NonNullable<Awaited<ReturnType<typeof trackOrder>>>);
    render(<Page />);
    const action=jest.mocked(TrackOrderForm).mock.calls.at(-1)![0].lookupAction;
    const input={orderId:"order-1",email:"customer@example.test"};
    expect(await action(input)).toEqual(displayed);
    expect(trackOrder).toHaveBeenCalledWith(input);
});
it("preserves missing and lookup-failure responses", async () => {
    jest.mocked(trackOrder).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Lookup unavailable"));
    render(<Page />);
    const action=jest.mocked(TrackOrderForm).mock.calls.at(-1)![0].lookupAction;
    const input={orderId:"order-1",email:"customer@example.test"};
    await expect(action(input)).resolves.toBeNull();
    await expect(action(input)).rejects.toThrow("Lookup unavailable");
});
