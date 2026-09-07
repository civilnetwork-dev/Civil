export default function genBCKey(key: string) {
    return `${window.location.hostname.replace("www.", "").split(".").toReversed().join(".")}.${key}`;
}
