/**
 * chrome.enterprise.{deviceAttributes,networkingAttributes} — managed-device
 * identity, privileged APIs only a device policy grants. lightspeedFilterAgent
 * calls `getDeviceSerialNumber`/`getDirectoryDeviceId` to build its license
 * request; a managed Chromebook's own dummy-but-real-shaped identifiers are
 * the honest answer, same reasoning as `buildSystem`'s CPU/memory inventory —
 * not captured values (this project never had a real fleet's), just the
 * right shape so a bundle's own validation (non-empty string) passes.
 */

export function buildDeviceAttributes() {
    return {
        getDirectoryDeviceId: async () => "civil-filterprobe-device",
        getDeviceSerialNumber: async () => "CVLFP0000001",
        getDeviceAssetId: async () => "",
        getDeviceAnnotatedLocation: async () => "",
        getDeviceHostname: async () => "civil-filterprobe",
        getDeviceHardwarePlatformName: async () => "Civil FilterProbe",
    };
}

export function buildNetworkingAttributes() {
    return {
        getNetworkDetails: async () => ({
            macAddress: "02:00:00:00:00:01",
            ipv4: "127.0.0.1",
        }),
    };
}
