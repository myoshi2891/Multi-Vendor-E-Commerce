"use client";
import { FC, ReactNode, useState, useSyncExternalStore } from "react";
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
import { cn } from "@/lib/utils";
import { Copy, Share2 } from 'lucide-react'
import styles from '../product-page/product.module.css'
interface Props {
    url: string;
    quote: string;
    isCol?: boolean;
    editorial?: boolean;
    media?: string;
}

const subscribeToOrigin = () => () => {}
const getBrowserOrigin = () => window.location.origin
const getServerOrigin = () => ''

const SocialShare: FC<Props> = ({ url, quote, isCol, editorial, media }) => {
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState(false)
    const origin = useSyncExternalStore(subscribeToOrigin, getBrowserOrigin, getServerOrigin)
    const shareUrl = origin ? new URL(url, origin).toString() : url
    const mediaUrl = origin ? new URL(media || '/assets/brand/gem.svg', origin).toString() : (media || '/assets/brand/gem.svg')
    const copyLink = async () => {
        try {
            const absoluteUrl = new URL(url, window.location.origin).toString()
            await navigator.clipboard.writeText(absoluteUrl)
            setCopied(true)
            setCopyError(false)
        } catch {
            // 権限拒否・非セキュアコンテキスト等。失敗をユーザーに通知する
            setCopied(false)
            setCopyError(true)
        }
    }
    const tile = (content: ReactNode) => editorial
        ? <div className={styles.shareTile} data-testid="share-tile">{content}</div>
        : content
    return (
        <div className={editorial ? styles.shareBlock : undefined} data-testid={editorial ? 'product-share' : undefined}>
            {editorial && <p><Share2 size={14} /> SHARE THIS PIECE</p>}
            <div
            className={editorial ? styles.shareLinks : cn('flex flex-wrap justify-center gap-2', { 'flex-col': isCol })}
            >
            <button type="button" onClick={copyLink} aria-label="Copy product link" className={editorial ? styles.shareButton : undefined}>
                <Copy size={editorial ? 20 : 14} aria-hidden="true" />{editorial && <span>{copied ? 'Link copied' : 'Copy link'}</span>}
            </button>
            {tile(<FacebookShareButton url={shareUrl} quote={quote} hashtag="#LuxuriesForHappiness" aria-label={editorial ? 'Share on Facebook' : undefined}>
                {editorial ? <span className={styles.shareAction}><FacebookIcon size={20} round /><span>Facebook</span></span> : <FacebookIcon size={32} round />}
            </FacebookShareButton>)}
            {tile(<TwitterShareButton url={shareUrl} title={quote} aria-label={editorial ? 'Share on X' : undefined}>
                {editorial ? <span className={styles.shareAction}><span className={styles.shareXIcon} aria-hidden="true">𝕏</span><span>X</span></span> : <TwitterIcon size={32} round />}
            </TwitterShareButton>)}
            {tile(<WhatsappShareButton url={shareUrl} title={quote} separator=":: " aria-label={editorial ? 'Share on WhatsApp' : undefined}>
                {editorial ? <span className={styles.shareAction}><WhatsappIcon size={20} round /><span>WhatsApp</span></span> : <WhatsappIcon size={32} round />}
            </WhatsappShareButton>)}
            {tile(<PinterestShareButton url={shareUrl} media={mediaUrl} description={quote} aria-label={editorial ? 'Share on Pinterest' : undefined}>
                {editorial ? <span className={styles.shareAction}><PinterestIcon size={20} round /><span>Pinterest</span></span> : <PinterestIcon size={32} round />}
            </PinterestShareButton>)}
            </div>
            {/* live region は内容変化前から DOM に存在させる必要があるため常時描画する */}
            <span role="status" className="sr-only">{copied ? 'Product link copied to clipboard' : ''}</span>
            {copyError && (
                <p role="alert" className="mt-2 text-xs text-red-600">
                    Couldn&apos;t copy the link. Please copy it from the address bar.
                </p>
            )}
        </div>
    );
};

export default SocialShare;
