import { ImageResponse } from "next/og";
export const alt =
    "Luxuries for Happiness — A little luxury. A lot of happiness.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    background: "#0b100e",
                    color: "#d4ba83",
                    padding: 80,
                    flexDirection: "column",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{ fontSize: 22, letterSpacing: 6, marginBottom: 40 }}
                >
                    ✦ LUXURY. FORTUNE. HAPPINESS.
                </div>
                <div
                    style={{
                        fontSize: 88,
                        fontFamily: "serif",
                        color: "#f1eee4",
                    }}
                >
                    Luxuries for
                </div>
                <div
                    style={{
                        fontSize: 108,
                        fontFamily: "serif",
                        fontStyle: "italic",
                    }}
                >
                    Happiness.
                </div>
                <div style={{ fontSize: 23, marginTop: 38 }}>
                    A little luxury. A lot of happiness.
                </div>
            </div>
        ),
        size
    );
}
