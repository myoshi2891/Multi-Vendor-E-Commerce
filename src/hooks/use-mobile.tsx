import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Indicates whether the current viewport width is considered mobile.
 *
 * The value updates when the viewport size changes. The hook always returns a boolean — it may return `false` briefly before the initial measurement completes.
 *
 * @returns `true` if the viewport width is less than 768 pixels, `false` otherwise.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Safety check for environments where matchMedia is not supported
    if (typeof window.matchMedia !== 'function') {
      const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      window.addEventListener("resize", handleResize)
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      return () => window.removeEventListener("resize", handleResize)
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
