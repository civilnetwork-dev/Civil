-- The strike system banned a student for good after five tries at a site on
-- the porn-domains list, and counted the ad and CDN hosts ordinary pages load
-- along the way. It is gone: a restricted site is now refused, never punished,
-- so the bans it handed out are lifted. Only those: it banned with exactly this
-- reason (misc/violations.ts, removed), and an administrator's ban, given
-- through GraphQL banUser with a reason of their own, stays.
UPDATE "users"
SET "is_banned" = false, "ban_reason" = NULL, "banned_at" = NULL
WHERE "is_banned" AND "ban_reason" = 'Repeatedly accessed restricted domains via proxy';
