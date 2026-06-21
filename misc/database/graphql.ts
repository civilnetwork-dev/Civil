import { createSchema, createYoga } from "graphql-yoga";
import { auth } from "./auth";
import { cached, sessionKey } from "./cache";
import { banUser, getUser, isUserBanned, unbanUser } from "./models/user";
import { recordVisit } from "./models/visit";

type AdminUser = { isAdmin?: boolean };

async function resolveSession(token: string | undefined) {
    if (!token) return null;
    return cached(
        sessionKey(token),
        () =>
            auth.api.getSession({
                headers: new Headers({
                    cookie: `better-auth.session_token=${token}`,
                    authorization: `Bearer ${token}`,
                }),
            }),
        60,
    ).catch(() => null);
}

function extractToken(request: Request): string | undefined {
    const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
    if (bearer) return bearer;
    return request.headers
        .get("cookie")
        ?.split(";")
        .find(c => c.trim().startsWith("better-auth.session_token="))
        ?.split("=")[1]
        ?.trim();
}

const schema = createSchema({
    typeDefs: `
        type User {
            id: ID!
            isAdmin: Boolean!
            isBanned: Boolean!
            banReason: String
            bannedAt: String
            createdAt: String!
        }

        type TrackVisitResult {
            ok: Boolean!
            error: String
        }

        type Query {
            user(id: ID!): User
            isUserBanned(id: ID!): Boolean!
        }

        type Mutation {
            trackVisit(userId: ID!, url: String!): TrackVisitResult!
            banUser(userId: ID!, reason: String!): User
            unbanUser(userId: ID!): User
        }
    `,
    resolvers: {
        Query: {
            user: (_: unknown, { id }: { id: string }) => getUser(id),
            isUserBanned: (_: unknown, { id }: { id: string }) =>
                isUserBanned(id),
        },
        Mutation: {
            trackVisit: async (
                _: unknown,
                { userId, url }: { userId: string; url: string },
            ) => {
                try {
                    await recordVisit(userId, url);
                    return { ok: true };
                } catch (err) {
                    return { ok: false, error: (err as Error).message };
                }
            },
            banUser: async (
                _: unknown,
                { userId, reason }: { userId: string; reason: string },
                ctx: { session: Awaited<ReturnType<typeof resolveSession>> },
            ) => {
                if (!(ctx.session?.user as AdminUser | undefined)?.isAdmin) {
                    throw new Error("Forbidden: admin privileges required");
                }
                return banUser(userId, reason);
            },
            unbanUser: async (
                _: unknown,
                { userId }: { userId: string },
                ctx: { session: Awaited<ReturnType<typeof resolveSession>> },
            ) => {
                if (!(ctx.session?.user as AdminUser | undefined)?.isAdmin) {
                    throw new Error("Forbidden: admin privileges required");
                }
                return unbanUser(userId);
            },
        },
    },
});

export const yoga = createYoga({
    schema,
    graphqlEndpoint: "/graphql",
    landingPage: false,
    logging: false,
    context: async ({ request }) => {
        const token = extractToken(request);
        const session = await resolveSession(token);
        return { session };
    },
});
