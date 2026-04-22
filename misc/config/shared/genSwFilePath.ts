import genProxyPath from "$config/shared/genProxyPath";

export default function genSwFilePath(proxy: string, file: string) {
    const spf = genProxyPath("/", proxy);

    return spf + file;
}
