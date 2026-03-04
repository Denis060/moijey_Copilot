import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe auth instance (no DB/bcrypt — uses JWT only)
const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const session = req.auth;
    const isLoggedIn = !!session;
    const role = (session?.user as any)?.role as string | undefined;
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
    if (isLoggedIn && role !== "admin" && pathname.startsWith("/admin")) {
        return Response.redirect(new URL("/chat", req.url));
    }

    // Block non-managers (and non-admins) from manager pages → send to chat
    if (isLoggedIn && role !== "admin" && role !== "manager" && pathname.startsWith("/manager")) {
        return Response.redirect(new URL("/chat", req.url));
    }
});

export const config = {
    matcher: ["/chat/:path*", "/admin/:path*", "/manager/:path*", "/login"],
};
