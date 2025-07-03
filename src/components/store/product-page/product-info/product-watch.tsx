"use client";
import { Eye } from "lucide-react";
import { useEffect, useState } from "react";

export default function ProductWatch({ productId }: { productId: string }) {
    const [watchersCount, setWatchersCount] = useState<number>(0);
    const [socket, setSocket] = useState<WebSocket | null>(null);

    useEffect(() => {
        const ws = new WebSocket(`ws:bony-onyx-nephew.glitch.me/${productId}`);
        setSocket(ws);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if(productId === data.productId)
            setWatchersCount(data.count);
        };

        ws.onopen = () => {
            console.log("Connected to WebSocket server");
        }

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            setSocket(null);
        }

        ws.onclose = () => {
            console.log("WebSocket connection closed");
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
