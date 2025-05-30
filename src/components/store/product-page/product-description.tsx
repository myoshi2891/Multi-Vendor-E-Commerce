"use-client";

// import DOMPurify from "dompurify";
import { sanitize } from "@/utils/sanitize";

export default function ProductDescription({
	text,
}: {
	text: [string, string];
}) {
	const sanitizedDescription1 = sanitize(text[0]);
	const sanitizedDescription2 = sanitize(text[1]);
    return <div className="pt-6">
        {/* Title */}
        <div className="h-12">
            <h2 className="text-main-primary text-2xl font-bold">Description</h2>
        </div>
        {/* Display both descriptions */}
        <div dangerouslySetInnerHTML={{ __html: sanitizedDescription1 }}/>
        <div dangerouslySetInnerHTML={{ __html: sanitizedDescription2 }}/>
    </div>;
}
