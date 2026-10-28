/** An event that accepts listeners and never fires or remembers them. */
export function silentEvent() {
    return {
        addListener() {},
        removeListener() {},
        hasListener() {
            return false;
        },
        hasListeners() {
            return false;
        },
    };
}
