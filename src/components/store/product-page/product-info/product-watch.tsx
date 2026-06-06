"use client";
import { Eye } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Displays a live watcher count for the given product and updates as viewer activity changes.
 *
 * @param productId - The product identifier to subscribe to for live watcher updates
 * @returns A JSX element showing the number of people watching the product when the count is greater than zero, otherwise `undefined`
 */
export default function ProductWatch({ productId }: { productId: string }) {
    const [watchersCount, setWatchersCount] = useState<number>(0);
    const [socket, setSocket] = useState<WebSocket | null>(null);

    useEffect(() => {
        const ws = new WebSocket(`wss://bony-onyx-nephew.glitch.me/${productId}`);
        setSocket(ws);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if(productId === data.productId)
            setWatchersCount(data.count);
        };

        ws.onopen = () => {
            // connection established
        }

        ws.onerror = () => {
            setSocket(null);
        }

        ws.onclose = () => {
            setSocket(null);
        }

        return () => {
            ws.close();
        };
    }, [productId]);

    if (watchersCount > 0) {
        return <div className="mb-2 text-sm">
            <p className="flex items-center gap-x-1">
                <Eye className="w-4 text-main-secondary" />
                <span>{watchersCount} {watchersCount > 1 ? "people are" : "person is"}&nbsp;watching this product</span>
            </p>
        </div>;
    }
}
