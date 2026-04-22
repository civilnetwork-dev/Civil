// for internal efficiency
export default function genProxyPath(base?: string, proxy?: string) {
    const cleanBase = base?.endsWith("/") ? base.slice(0, -1) : base;
    return `${cleanBase ?? ""}/${proxy}/`;
}
