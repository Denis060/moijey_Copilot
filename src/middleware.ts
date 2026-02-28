import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe auth instance (no DB/bcrypt — uses JWT only)
const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const session = req.auth;
    const isLoggedIn = !!session;
    const isAdmin = (session?.user as any)?.role === "admin";
    const { pathname } = req.nextUrl;

    // Redirect authenticated users away from login page
    if (pathname === "/login" && isLoggedIn) {
        return Response.redirect(new URL("/chat", req.url));
    }

    // Redirect unauthenticated users to login
    if (!isLoggedIn && pathname !== "/login") {
        return Response.redirect(new URL("/login", req.url));
    }

    // Block non-admins from admin pages → send to chat
    if (isLoggedIn && !isAdmin && pathname.startsWith("/admin")) {
        return Response.redirect(new URL("/chat", req.url));
    }
});

export const config = {
    // Only run middleware on page routes (not API, not Next.js internals, not static files)
    matcher: ["/chat/:path*", "/admin/:path*", "/login"],
};
