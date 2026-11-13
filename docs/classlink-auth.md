# ClassLink sign-in

ClassLink is an optional OpenID Connect provider. Anonymous browsing and Patreon
continue to work when it is disabled. Civil never collects a school password;
authentication, district routing and MFA happen on ClassLink's pages.

## Deployment prerequisites

Obtain a registered ClassLink OIDC client and approval for the districts that will
use it. Configure all of the following in the server environment:

```dotenv
BETTER_AUTH_URL=https://civil.example
CLASSLINK_ISSUER=https://issuer-assigned-to-your-client.example
CLASSLINK_CLIENT_ID=registered-client-id
CLASSLINK_CLIENT_SECRET=registered-client-secret
```

Register exactly `https://civil.example/api/auth/callback/classlink` as the redirect
URI. Use the issuer assigned to the client: Civil discovers the authorization,
token and JWKS endpoints from `CLASSLINK_ISSUER/.well-known/openid-configuration`.
Do not substitute a district's LaunchPad page or a private credential-login URL.
ClassLink may assign different endpoints to newer clients.

Leave all three `CLASSLINK_*` variables empty to disable the feature. Partial
configuration fails startup with the missing names. Enabling it requires an
explicit `BETTER_AUTH_URL` containing only the canonical origin. URLs require
HTTPS; HTTP localhost is allowed only outside production. Docker Compose forwards
these optional variables. No database migration is needed.

The client must support authorization code flow with PKCE S256, `openid profile
email` scopes, OIDC nonce binding, and signed ID tokens. The ID token must contain
the configured `iss` and a nonempty immutable `sub`. Civil uses the issuer and
subject together as the provider account identity. A valid email can come from
the verified ID token or the discovery-declared UserInfo endpoint. UserInfo is
fetched only when signed claims lack a valid email, using the access token over
HTTPS, with redirects disabled and a five-second budget for discovery and profile
retrieval. Its `sub` must exactly match the verified ID-token subject. Malformed
profiles, missing email, discovery issuer mismatch, request failures and timeouts
reject sign-in. Local email verification requires the boolean `true` for the
email supplied by that source; a missing verification claim never implies it.
Invalid signatures, issuer, audience, expiry or nonce reject sign-in before any
UserInfo claims can be used.
Discovery must publish an issuer and usable JWKS metadata; unavailable discovery
does not downgrade verification. A client with different claim behavior needs
validation against its documented OIDC contract before deployment.

## User and account behavior

`GET /api/authProviders` returns only `{ "classlink": true }` or
`{ "classlink": false }`, with caching disabled. ClassLink is advertised only
when configured and the request reaches the canonical auth origin. Mirrors keep
anonymous browsing; they cannot start or complete ClassLink authentication and
Civil does not relay a completed session to a mirror.

For TLS termination at a reverse proxy, set `REVERSE_PROXY=true` and keep
Civil's HTTP listener reachable only by the trusted proxy. Preserve the public
`Host` header and overwrite `X-Forwarded-Proto` with the external scheme or
append that scheme as its last value. ClassLink uses that last value and the
request host to check the canonical origin for availability, sign-in, and
callbacks.

Sign-in uses Better Auth's `/api/auth/sign-in/social` with provider `classlink`.
An existing signed-in user can explicitly link ClassLink using
`/api/auth/link-social`; the newly authenticated ClassLink email may differ from
the existing primary email. Linking preserves that primary email. Fresh ClassLink
authentication is requested with `prompt=login`; client-supplied ID-token shortcuts
and extra authorization parameters are rejected. Email matching never implicitly
links two accounts. An identity already linked to someone else cannot be moved.

Signing an anonymous visitor into a registered account moves their recorded visits
and district-contribution ownership before deleting the anonymous user. An
administrator's ban follows the conversion; an existing target ban is preserved.
Conversion never copies administrator privileges. Provider claims and request
bodies cannot set Civil's administration or ban fields.
Anonymous visitors use sign-in to convert; explicit account linking requires a
registered Civil account. If transfer fails, the new session is revoked and the
anonymous user is retained for a later retry.

Sign-out clears the Civil session only. It never signs the user out of ClassLink
or other school applications.

## Verification before enabling a live client

The automated suite exercises signed mock OIDC callbacks and account rules without
real ClassLink credentials. A real registered client still needs a deployment
check covering its assigned issuer, discovery, claims, PKCE/nonce support, district
consent and the exact registered callback. No live ClassLink client is registered
as part of this change.

Protocol and implementation references: [Better Auth Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth),
[Better Auth account linking](https://better-auth.com/docs/concepts/users-accounts#account-linking),
[OpenID Connect UserInfo validation](https://openid.net/specs/openid-connect-core-1_0.html#UserInfoResponse),
[ClassLink's published LaunchPad discovery](https://launchpad.classlink.com/.well-known/openid-configuration),
and [ClassLink's official profile response](https://apisandbox.classlink.com/reference/v2myprofiles-2).
