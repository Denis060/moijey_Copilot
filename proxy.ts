import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/auth";

export async function proxy(request: NextRequest) {
    const session = await auth();
    const { pathname } = request.nextUrl;

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

export default proxy;

export const config = {
    matcher: ["/admin/:path*", "/chat/:path*"],
};
