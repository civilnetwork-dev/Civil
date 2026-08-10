import { createSchema, createYoga } from "graphql-yoga";
import { banUser, getUser, isUserBanned, unbanUser } from "./models/user";
import { recordVisit } from "./models/visit";
import { type ResolvedSession, resolveSessionFromHeaders } from "./session";

type AdminUser = { isAdmin?: boolean };

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
                ctx: { session: ResolvedSession },
            ) => {
                if (!(ctx.session?.user as AdminUser | undefined)?.isAdmin) {
                    throw new Error("Forbidden: admin privileges required");
                }
                return banUser(userId, reason);
            },
            unbanUser: async (
                _: unknown,
                { userId }: { userId: string },
                ctx: { session: ResolvedSession },
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
    context: async ({ request }) => ({
        session: await resolveSessionFromHeaders(request.headers),
    }),
});
