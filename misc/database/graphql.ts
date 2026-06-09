import { createSchema, createYoga } from "graphql-yoga";
import { banUser, getUser, isUserBanned, unbanUser } from "./models/user";
import { recordVisit } from "./models/visit";

const schema = createSchema({
    typeDefs: `
        type User {
            id: ID!
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
            banUser: (
                _: unknown,
                { userId, reason }: { userId: string; reason: string },
            ) => banUser(userId, reason),
            unbanUser: (_: unknown, { userId }: { userId: string }) =>
                unbanUser(userId),
        },
    },
});

export const yoga = createYoga({
    schema,
    graphqlEndpoint: "/graphql",
    landingPage: false,
    logging: false,
});
