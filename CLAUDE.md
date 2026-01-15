# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Robotics Team Manager is a Next.js web application for managing FTC (FIRST Tech Challenge) robotics team operations including competitions, tasks, robot subsystems, inventory, engineering notebooks, scouting, and meetings.

**Stack**: Next.js 15.5, React 19, Convex (backend/database), Clerk (authentication), Tailwind CSS, Radix UI/shadcn, Bun

## Common Commands

```bash
bun run dev           # Start both frontend (Next.js) and backend (Convex)
bun run dev:frontend  # Start only Next.js dev server
bun run dev:backend   # Start only Convex backend
bun run build         # Production build
bun run lint          # Run ESLint
```

## Architecture

### Frontend (`src/app/`)
- Uses Next.js App Router with route groups
- `(dashboard)/` - Protected routes requiring authentication
- `login/`, `signup/` - Clerk authentication pages
- Path alias: `@/*` maps to `./src/*`

### Backend (`src/convex/`)
- Convex handles database, real-time subscriptions, and server functions
- `schema.ts` - Database schema with all table definitions
- Each feature has its own file (e.g., `tasks.ts`, `projects.ts`, `competitions.ts`)
- `_generated/` - Auto-generated types (do not edit)

### Authentication Flow
1. Clerk handles sign-in/sign-up
2. Middleware (`middleware.ts`) protects routes, redirects unauthenticated users to `/login`
3. `AuthContext` manages user state and approval status via Convex
4. User roles: "owner", "admin", "member"

### Data Patterns
```typescript
// Fetching data (auto-subscribes to real-time updates)
const data = useQuery(api.module.queryName, { args });

// Mutations
const mutate = useMutation(api.module.mutationName);
await mutate({ args });

// Auth context
const { user, isApproved, authStatus } = useAuthContext();
```

### Key Directories
- `src/components/ui/` - Reusable shadcn/ui components
- `src/components/layout/` - AppShell, Sidebar
- `src/components/{feature}/` - Feature-specific components (projects/, tasks/, teams/, kanban/)
- `src/context/AuthContext.tsx` - Authentication state management

## Database Schema Highlights

Core tables in `src/convex/schema.ts`:
- **users/waitlist** - User management with approval flow
- **teams/teamMembers** - Team entities and membership
- **projects/tasks** - Work management with assignments
- **competitions/competitionMatches** - FTC event tracking
- **robotSubsystems/partsInventory** - Robot and parts management
- **engineeringNotebook/scoutingReports** - Documentation
- **meetings/attendance** - Team operations

## Convex Guidelines

From `.cursor/rules/convex_rules.mdc`:
- Use new function syntax with explicit validators
- Reference functions via `api.module.function` or `internal.module.function`
- Queries should be indexed for performance

## Clerk Guidelines

From `.cursor/rules/clerk.mdc`:
- Use modern App Router approach with `clerkMiddleware()` from `@clerk/nextjs/server`
- Never use deprecated `authMiddleware()` or Pages Router patterns
- ClerkProvider wraps the app in root layout

## Environment Variables

Required:
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- Clerk keys (publishable and secret)
