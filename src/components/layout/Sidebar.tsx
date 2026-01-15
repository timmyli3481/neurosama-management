"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FolderKanban,
  CheckSquare,
  Users,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visibleTo: ("owner" | "admin" | "member")[];
  requiresTeamLeader?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: Home,
    visibleTo: ["owner", "admin", "member"],
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    visibleTo: ["owner", "admin", "member"],
  },
  {
    href: "/tasks",
    label: "My Tasks",
    icon: CheckSquare,
    visibleTo: ["owner", "admin", "member"],
  },
  {
    href: "/teams",
    label: "Teams",
    icon: Users,
    visibleTo: ["owner", "admin", "member"],
    requiresTeamLeader: true,
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Settings,
    visibleTo: ["owner", "admin"],
  },
];

function NavLinks({
  userRole,
  onNavigate,
}: {
  userRole: "owner" | "admin" | "member";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        // Check visibility based on role
        if (!item.visibleTo.includes(userRole)) {
          // For team leader items, show to all but will be filtered by backend
          if (!item.requiresTeamLeader) {
            return null;
          }
        }

        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DesktopSidebar() {
  const { user } = useAuthContext();

  if (!user) {
    return null;
  }

  return (
    <aside className="hidden lg:flex h-screen w-64 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <FolderKanban className="h-5 w-5" />
          <span>Project Manager</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <NavLinks userRole={user.role} />
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const { user } = useAuthContext();
  const [open, setOpen] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-14 items-center border-b px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold"
            onClick={() => setOpen(false)}
          >
            <FolderKanban className="h-5 w-5" />
            <span>Project Manager</span>
          </Link>
        </div>
        <div className="p-4">
          <NavLinks userRole={user.role} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
