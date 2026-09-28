// React, Next.js
import { FC } from "react";
import Image from "next/image";

// Logo image
const LogoImg = "/assets/brand/wordmark.svg";

interface LogoProps {
	width: string;
	height: string;
}

const Logo: FC<LogoProps> = ({ width, height }) => {
	return (
        <div className="z-50" style={{ width: width, height: height }}>
            <Image
                src={LogoImg}
                width={360}
                height={80}
                alt="Luxuries for Happiness"
                className="size-full overflow-visible object-contain"
                priority
            />
        </div>
    )
};

export default Logo;
