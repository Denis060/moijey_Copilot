import NextAuth from "next-auth"
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            role: string
            workspace_id: string
        } & DefaultSession["user"]
    }

    interface User {
        role: string
        workspace_id: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role: string
        workspace_id: string
    }
}
