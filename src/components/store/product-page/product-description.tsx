'use-client'

// import DOMPurify from "dompurify";
import { sanitize } from '@/utils/sanitize'
import styles from './product.module.css'

export default function ProductDescription({
    text,
}: {
    text: [string, string]
}) {
    const sanitizedDescription1 = sanitize(text[0])
    const sanitizedDescription2 = sanitize(text[1])
    return (
        <section id="description" className={styles.descriptionSection}>
            <div className={styles.contentHeading}><div><p>THE STORY OF THE PIECE</p><h2>Description</h2></div></div>
            <div className={styles.descriptionProse} dangerouslySetInnerHTML={{ __html: sanitizedDescription1 }} />
            {sanitizedDescription2 && <div className={styles.descriptionProse} dangerouslySetInnerHTML={{ __html: sanitizedDescription2 }} />}
        </section>
    )
}
