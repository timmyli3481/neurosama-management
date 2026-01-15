"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

const statusConfig: Record<
  TaskStatus,
  { label: string; variant: "default" | "secondary" | "outline"; className: string }
> = {
  backlog: {
    label: "Backlog",
    variant: "secondary",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  todo: {
    label: "To Do",
    variant: "secondary",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  in_progress: {
    label: "In Progress",
    variant: "secondary",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  },
  review: {
    label: "Review",
    variant: "secondary",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
  done: {
    label: "Done",
    variant: "secondary",
    className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}

export function getStatusLabel(status: TaskStatus): string {
  return statusConfig[status].label;
}

export const TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
];
