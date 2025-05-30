import { FC } from "react";
import {
	FacebookShareButton,
	FacebookIcon,
	TwitterShareButton,
	TwitterIcon,
	WhatsappShareButton,
	WhatsappIcon,
	PinterestShareButton,
	PinterestIcon,
} from "next-share";
interface Props {
	url: string;
	quote: string;
}

const SocialShare: FC<Props> = ({ url, quote }) => {
	return (
		<div className="flex flex-wrap justify-center gap-2">
			<FacebookShareButton url={url} quote={quote} hashtag="#GoShop">
				<FacebookIcon size={32} round />
			</FacebookShareButton>
			{/* Add more social media icons */}
			<TwitterShareButton url={url} title={quote}>
				<TwitterIcon size={32} round />
			</TwitterShareButton>
			<WhatsappShareButton url={url} title={quote} separator=":: ">
				<WhatsappIcon size={32} round />
			</WhatsappShareButton>
			<PinterestShareButton url={url} media={quote} description={quote}>
				<PinterestIcon size={32} round />
			</PinterestShareButton>
		</div>
	);
};

export default SocialShare;
