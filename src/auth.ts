import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import db from "@/lib/db/db-client";

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const { email, password } = credentials;

                try {
                    // Fetch user and role
                    const result = await db.query(
                        `SELECT u.*, r.name as role_name 
               FROM users u 
               JOIN roles r ON u.role_id = r.id 
               WHERE u.email = $1 AND u.is_active = true`,
                        [email]
                    );

                    const user = result.rows[0];

                    if (!user) {
                        return null;
                    }

                    const isPasswordValid = await bcrypt.compare(password as string, user.password_hash);

                    if (isPasswordValid) {
                        return {
                            id: user.id,
                            email: user.email,
                            role: user.role_name,
                            workspace_id: user.workspace_id,
                        };
                    }
                } catch (error: any) {
                    console.error("Auth: Database error during authorize:", error);
                }

                return null;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.workspace_id = user.workspace_id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role as string;
                session.user.workspace_id = token.workspace_id as string;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
});
