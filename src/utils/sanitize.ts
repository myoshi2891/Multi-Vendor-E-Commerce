// utils/sanitize.ts
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

export const sanitize = (dirty: string) => DOMPurify.sanitize(dirty);
