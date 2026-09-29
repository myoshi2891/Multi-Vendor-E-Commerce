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
const DEFAULT_SHARE_MEDIA = '/assets/brand/gem.svg'

// SSR 時は origin が空のため相対パスのまま返し、ハイドレーション後に絶対 URL へ切り替える
const toAbsoluteUrl = (path: string, origin: string) => origin ? new URL(path, origin).toString() : path

// editorial 表示ではアイコン + ラベルのタイル、通常表示では丸アイコンのみを描画する
const shareLabel = (editorial: boolean | undefined, label: string) => editorial ? `Share on ${label}` : undefined
const shareContent = (editorial: boolean | undefined, label: string, editorialIcon: ReactNode, compactIcon: ReactNode) => editorial
    ? <span className={styles.shareAction}>{editorialIcon}<span>{label}</span></span>
    : compactIcon

const SocialShare: FC<Props> = ({ url, quote, isCol, editorial, media }) => {
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState(false)
    const origin = useSyncExternalStore(subscribeToOrigin, getBrowserOrigin, getServerOrigin)
    const shareUrl = toAbsoluteUrl(url, origin)
    const mediaUrl = toAbsoluteUrl(media || DEFAULT_SHARE_MEDIA, origin)
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
            {tile(<FacebookShareButton url={shareUrl} quote={quote} hashtag="#LuxuriesForHappiness" aria-label={shareLabel(editorial, 'Facebook')}>
                {shareContent(editorial, 'Facebook', <FacebookIcon size={20} round />, <FacebookIcon size={32} round />)}
            </FacebookShareButton>)}
            {tile(<TwitterShareButton url={shareUrl} title={quote} aria-label={shareLabel(editorial, 'X')}>
                {shareContent(editorial, 'X', <span className={styles.shareXIcon} aria-hidden="true">𝕏</span>, <TwitterIcon size={32} round />)}
            </TwitterShareButton>)}
            {tile(<WhatsappShareButton url={shareUrl} title={quote} separator=":: " aria-label={shareLabel(editorial, 'WhatsApp')}>
                {shareContent(editorial, 'WhatsApp', <WhatsappIcon size={20} round />, <WhatsappIcon size={32} round />)}
            </WhatsappShareButton>)}
            {tile(<PinterestShareButton url={shareUrl} media={mediaUrl} description={quote} aria-label={shareLabel(editorial, 'Pinterest')}>
                {shareContent(editorial, 'Pinterest', <PinterestIcon size={20} round />, <PinterestIcon size={32} round />)}
            </PinterestShareButton>)}
            </div>
            {/* live region は内容変化前から DOM に存在させる必要があるため常時描画する */}
            <output className="sr-only">{copied ? 'Product link copied to clipboard' : ''}</output>
            {copyError && (
                <p role="alert" className="mt-2 text-xs text-red-600">
                    Couldn&apos;t copy the link. Please copy it from the address bar.
                </p>
            )}
        </div>
    );
};

export default SocialShare;
