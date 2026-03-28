// React 19 の useRef<T>(null) は RefObject<T | null> を返すため、
// use-onclickoutside の ref パラメータ型を拡張する
declare module "use-onclickoutside" {
    import { RefObject } from "react";

    type PossibleEvent = MouseEvent | TouchEvent;
    type Handler = (event: PossibleEvent) => void;

    export default function useOnClickOutside(
        ref: RefObject<HTMLElement | null>,
        handler: Handler | null,
        options?: { document?: Document }
    ): void;
}
