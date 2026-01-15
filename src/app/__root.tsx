import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/clerk-react";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { AuthProvider } from "@/context/AuthContext";
import { TimezoneProvider } from "@/context/TimezoneContext";
import appCss from "./globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Robotics Team Manager" },
      { name: "description", content: "Manage your robotics team" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/convex.svg",
      },
    ],
  }),
  component: RootLayout,
});

function RootLayout() {
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased bg-background text-foreground">
        <ClerkProvider publishableKey={clerkPubKey}>
          <ConvexClientProvider>
            <TimezoneProvider>
              <AuthProvider>
                <Outlet />
              </AuthProvider>
            </TimezoneProvider>
          </ConvexClientProvider>
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}
