/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as calendar from "../calendar.js";
import type * as clerk from "../clerk.js";
import type * as competitions from "../competitions.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as invites from "../invites.js";
import type * as meetings from "../meetings.js";
import type * as notebook from "../notebook.js";
import type * as permissions from "../permissions.js";
import type * as projects from "../projects.js";
import type * as robot from "../robot.js";
import type * as scouting from "../scouting.js";
import type * as settings from "../settings.js";
import type * as tasks from "../tasks.js";
import type * as teams from "../teams.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  calendar: typeof calendar;
  clerk: typeof clerk;
  competitions: typeof competitions;
  http: typeof http;
  inventory: typeof inventory;
  invites: typeof invites;
  meetings: typeof meetings;
  notebook: typeof notebook;
  permissions: typeof permissions;
  projects: typeof projects;
  robot: typeof robot;
  scouting: typeof scouting;
  settings: typeof settings;
  tasks: typeof tasks;
  teams: typeof teams;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
