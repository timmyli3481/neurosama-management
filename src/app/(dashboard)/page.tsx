"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderKanban,
  CheckSquare,
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TaskStatusCard({
  tasksByStatus,
  totalTasks,
}: {
  tasksByStatus: {
    backlog: number;
    todo: number;
    in_progress: number;
    review: number;
    done: number;
  };
  totalTasks: number;
}) {
  const statusLabels = {
    backlog: { label: "Backlog", color: "bg-slate-500" },
    todo: { label: "To Do", color: "bg-blue-500" },
    in_progress: { label: "In Progress", color: "bg-yellow-500" },
    review: { label: "Review", color: "bg-purple-500" },
    done: { label: "Done", color: "bg-green-500" },
  };

  const completionRate =
    totalTasks > 0 ? Math.round((tasksByStatus.done / totalTasks) * 100) : 0;

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Task Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Completion Rate</span>
          <span className="text-sm text-muted-foreground">{completionRate}%</span>
        </div>
        <Progress value={completionRate} className="h-2" />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4">
          {(Object.keys(statusLabels) as (keyof typeof statusLabels)[]).map(
            (status) => (
              <div key={status} className="text-center">
                <div
                  className={`inline-block w-3 h-3 rounded-full ${statusLabels[status].color} mb-2`}
                />
                <div className="text-2xl font-bold">{tasksByStatus[status]}</div>
                <div className="text-xs text-muted-foreground">
                  {statusLabels[status].label}
                </div>
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const stats = useQuery(api.tasks.getDashboardStats);

  if (stats === undefined) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your projects and tasks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={stats.totalProjects}
          icon={FolderKanban}
          description="Projects you have access to"
        />
        <StatCard
          title="Total Tasks"
          value={stats.totalTasks}
          icon={CheckSquare}
          description="Across all projects"
        />
        <StatCard
          title="My Tasks"
          value={stats.myTasks}
          icon={Clock}
          description="Assigned to you"
        />
        <StatCard
          title="Teams"
          value={stats.teamCount}
          icon={Users}
          description="Teams you belong to"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TaskStatusCard
          tasksByStatus={stats.tasksByStatus}
          totalTasks={stats.totalTasks}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Active Tasks</span>
              <span className="font-medium">
                {stats.tasksByStatus.todo +
                  stats.tasksByStatus.in_progress +
                  stats.tasksByStatus.review}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">In Backlog</span>
              <span className="font-medium">{stats.tasksByStatus.backlog}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Completed</span>
              <span className="font-medium text-green-600">
                {stats.tasksByStatus.done}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">In Review</span>
              <span className="font-medium text-purple-600">
                {stats.tasksByStatus.review}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
