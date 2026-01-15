import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/login", "/signup", "/api/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Allow public routes
  if (isPublicRoute(req)) {
    // If signed in and trying to access login/signup, redirect to home
    if (userId && (req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/signup")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return;
  }

  // Protect all other routes - redirect to login if not authenticated
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
