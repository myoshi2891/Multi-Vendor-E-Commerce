// React, Next.js
import { FC } from "react";
import Image from "next/image";

// Logo image
import LogoImg from "../../../public/assets/icons/logo-1.png";

interface LogoProps {
	width: string;
	height: string;
}

const Logo: FC<LogoProps> = ({ width, height }) => {
	return (
        <div className="z-50" style={{ width: width, height: height }}>
            <Image
                src={LogoImg}
                alt="GoShop"
                className="size-full overflow-visible object-cover"
                priority
            />
        </div>
    )
};

export default Logo;
