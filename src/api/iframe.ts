let _currentSrc = "";
const _listeners: Set<(src: string) => void> = new Set();

export function iframeSetCurrentSrc(src: string): void {
    _currentSrc = src;
    for (const l of _listeners) l(src);
}

/**
 * Returns the current proxied src of the active iframe.
 */
export function iframeGetCurrentSrc(): string {
    return _currentSrc;
}

export function iframeOnSrcChange(cb: (src: string) => void): () => void {
    _listeners.add(cb);
    return () => _listeners.delete(cb);
}
