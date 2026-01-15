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
  Trophy,
  Bot,
  BookOpen,
  Target,
  Package,
  Calendar,
  Activity,
  CalendarDays,
  Wrench,
  GanttChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visibleTo: ("owner" | "admin" | "member")[];
  requiresTeamLeader?: boolean;
};

type NavSection = {
  title?: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: Home,
        visibleTo: ["owner", "admin", "member"],
      },
    ],
  },
  {
    title: "FTC SEASON",
    items: [
      {
        href: "/competitions",
        label: "Competitions",
        icon: Trophy,
        visibleTo: ["owner", "admin", "member"],
      },
      {
        href: "/scouting",
        label: "Scouting",
        icon: Target,
        visibleTo: ["owner", "admin", "member"],
      },
      {
        href: "/timeline",
        label: "Timeline",
        icon: GanttChart,
        visibleTo: ["owner", "admin", "member"],
      },
    ],
  },
  {
    title: "ROBOT",
    items: [
      {
        href: "/robot",
        label: "Subsystems",
        icon: Bot,
        visibleTo: ["owner", "admin", "member"],
      },
      {
        href: "/inventory",
        label: "Inventory",
        icon: Package,
        visibleTo: ["owner", "admin", "member"],
      },
    ],
  },
  {
    title: "TEAM",
    items: [
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
        href: "/meetings",
        label: "Meetings",
        icon: CalendarDays,
        visibleTo: ["owner", "admin", "member"],
      },
      {
        href: "/notebook",
        label: "Notebook",
        icon: BookOpen,
        visibleTo: ["owner", "admin", "member"],
      },
    ],
  },
  {
    items: [
      {
        href: "/calendar",
        label: "Calendar",
        icon: Calendar,
        visibleTo: ["owner", "admin", "member"],
      },
      {
        href: "/activity",
        label: "Activity",
        icon: Activity,
        visibleTo: ["owner", "admin", "member"],
      },
    ],
  },
  {
    items: [
      {
        href: "/admin",
        label: "Admin",
        icon: Settings,
        visibleTo: ["owner", "admin"],
      },
    ],
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
      {navSections.map((section, sectionIndex) => (
        <div key={sectionIndex}>
          {section.title && (
            <div className="px-3 py-2 mt-4 first:mt-0">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                {section.title}
              </span>
            </div>
          )}
          {!section.title && sectionIndex > 0 && (
            <Separator className="my-3 bg-border/50" />
          )}
          {section.items.map((item) => {
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
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive && "drop-shadow-sm")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function RobotLogo({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Wrench className="h-6 w-6 text-primary" />
      <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
    </div>
  );
}

export function DesktopSidebar() {
  const { user } = useAuthContext();

  if (!user) {
    return null;
  }

  return (
    <aside className="hidden lg:flex h-screen w-64 flex-col border-r border-border/50 bg-sidebar">
      <div className="flex h-16 items-center border-b border-border/50 px-4">
        <Link href="/" className="flex items-center gap-3 font-semibold group">
          <RobotLogo />
          <div className="flex flex-col">
            <span className="text-sm font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              FTC Manager
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
              ROBOTICS TEAM
            </span>
          </div>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks userRole={user.role} />
      </div>
      <div className="border-t border-border/50 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-accent/50 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">
              {user.firstName?.[0] || user.email?.[0] || "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user.firstName
                ? `${user.firstName} ${user.lastName || ""}`
                : user.email}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {user.role}
            </p>
          </div>
        </div>
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
      <SheetContent side="left" className="w-64 p-0 bg-sidebar border-border/50">
        <div className="flex h-16 items-center border-b border-border/50 px-4">
          <Link
            href="/"
            className="flex items-center gap-3 font-semibold"
            onClick={() => setOpen(false)}
          >
            <RobotLogo />
            <div className="flex flex-col">
              <span className="text-sm font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                FTC Manager
              </span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
                ROBOTICS TEAM
              </span>
            </div>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks userRole={user.role} onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t border-border/50 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-accent/50 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">
                {user.firstName?.[0] || user.email?.[0] || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.firstName
                  ? `${user.firstName} ${user.lastName || ""}`
                  : user.email}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {user.role}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
