import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const session = await auth();

    // Protect Admin routes
    if (pathname.startsWith("/admin") && session?.user?.role !== "admin") {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Protect Sales Rep / Co-Pilot routes
    if (pathname.startsWith("/chat") && !session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/chat/:path*"],
};
