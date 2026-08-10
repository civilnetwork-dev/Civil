/** Cloud origins the connector talks to. */
export const IBOSS_ORIGINS = [
    "https://ibosstest.com",
    "https://ibossgov.com",
    "https://ibossgov-staging.com",
    "https://ibosscloud.com",
    "https://ibosscloud-staging.com",
] as const;

/** Default SSL port used for the cloud URL-categorization API. */
export const DEFAULT_CLOUD_CATEGORIZATION_SSL_PORT = 8026;

/** Path of the API-mode URL filtering endpoint on the gateway. */
export const PERFORM_URL_FILTERING_PATH =
    "/json/mobileClient/performUrlFiltering";

/**
 * Hosts the connector always lets through directly (never categorized).
 * Useful as an intrinsic allow-list before hitting the cloud.
 */
export const DIRECT_FILTER_INTRINSIC_BYPASS_LIST = [
    "gstatic.com",
    "gvt1.com",
    "gvt2.com",
    "gvt3.com",
    "clients1.google.com",
    "clients2.google.com",
    "clients3.google.com",
    "clients4.google.com",
    "clients5.google.com",
    "clients6.google.com",
    "accounts.google.com",
] as const;

/** Base domains the connector treats as intrinsically allowed. */
export const DIRECT_FILTER_INTRINSIC_DOMAIN_LIST = [
    "google.com",
    "googleusercontent.com",
    "1e100.net",
    "accounts.youtube.com",
    "activation.rfbd.org",
    "android.com",
    "cros-omahaproxy.appspot.com",
    "google-analytics.com",
    "googleapis.com",
    "gweb-gettingstartedguide.appspot.com",
    "learningally.org",
    "llnwd.net",
    "omahaproxy.appspot.com",
    "vexrobotics.com",
] as const;

/** Host the connector pings to detect on-/off-premise location. */
export const LOCATION_CHECK_HOST = "http://myiboss.net/";
export const LOCATION_CHECK_HOST_DOMAIN = "myiboss.net";
