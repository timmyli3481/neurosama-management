"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  User,
  Users,
  Palette,
  Code,
  Wrench,
  Heart,
  Briefcase,
  Target,
  TestTube,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

const categories = [
  { value: "design", label: "Design", icon: Palette, color: "bg-purple-500" },
  { value: "build", label: "Build", icon: Wrench, color: "bg-orange-500" },
  { value: "code", label: "Code", icon: Code, color: "bg-blue-500" },
  { value: "outreach", label: "Outreach", icon: Heart, color: "bg-pink-500" },
  { value: "business", label: "Business", icon: Briefcase, color: "bg-green-500" },
  { value: "team", label: "Team", icon: Users, color: "bg-cyan-500" },
  { value: "strategy", label: "Strategy", icon: Target, color: "bg-yellow-500" },
  { value: "testing", label: "Testing", icon: TestTube, color: "bg-red-500" },
];

type Category = "design" | "build" | "code" | "outreach" | "business" | "team" | "strategy" | "testing";

export default function NotebookEntryPage() {
  const router = useRouter();
  const params = useParams();
  const entryId = params.id as Id<"engineeringNotebook">;

  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "build" as Category,
    entryDate: "",
    tags: "",
  });

  const entry = useQuery(api.notebook.getEntry, { entryId });
  const updateEntry = useMutation(api.notebook.updateEntry);
  const deleteEntry = useMutation(api.notebook.deleteEntry);

  const handleEdit = () => {
    if (entry) {
      setFormData({
        title: entry.title,
        content: entry.content,
        category: entry.category,
        entryDate: new Date(entry.entryDate).toISOString().split("T")[0],
        tags: entry.tags?.join(", ") ?? "",
      });
      setEditOpen(true);
    }
  };

  const handleUpdate = async () => {
    if (!formData.title || !formData.content) return;

    await updateEntry({
      entryId,
      title: formData.title,
      content: formData.content,
      category: formData.category,
      entryDate: new Date(formData.entryDate).getTime(),
      tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : undefined,
    });

    setEditOpen(false);
  };

  const handleDelete = async () => {
    await deleteEntry({ entryId });
    router.push("/notebook");
  };

  if (entry === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (entry === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Entry not found</h3>
        <p className="text-muted-foreground mb-4">
          This notebook entry may have been deleted.
        </p>
        <Link href="/notebook">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Notebook
          </Button>
        </Link>
      </div>
    );
  }

  const categoryInfo = categories.find((c) => c.value === entry.category);
  const Icon = categoryInfo?.icon || BookOpen;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/notebook">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={`${categoryInfo?.color} bg-opacity-20 border-0`}
              >
                <Icon className="h-3 w-3 mr-1" />
                {categoryInfo?.label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                <Calendar className="h-3 w-3 inline mr-1" />
                {new Date(entry.entryDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <h1 className="text-2xl font-bold">{entry.title}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this notebook entry? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardContent className="pt-6">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {entry.content}
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entry.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Author */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4 inline mr-1" />
              Author
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entry.author && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={entry.author.imageUrl ?? undefined} />
                  <AvatarFallback>
                    {entry.author.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{entry.author.name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contributors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4 inline mr-1" />
              Contributors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entry.contributors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {entry.contributors.map((contributor) => (
                  <div key={contributor._id} className="flex items-center gap-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={contributor.imageUrl ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {contributor.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{contributor.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No contributors</span>
            )}
          </CardContent>
        </Card>

        {/* Linked Subsystem */}
        {entry.subsystem && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Linked Subsystem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/robot" className="text-primary hover:underline">
                {entry.subsystem.name}
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Linked Competition */}
        {entry.competition && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Linked Competition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/competitions" className="text-primary hover:underline">
                {entry.competition.name}
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Linked Meeting */}
        {entry.meeting && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Linked Meeting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/meetings" className="text-primary hover:underline">
                {entry.meeting.title}
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Notebook Entry</DialogTitle>
            <DialogDescription>
              Update your notebook entry details.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Input
                    type="date"
                    value={formData.entryDate}
                    onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v as Category })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => {
                        const CatIcon = cat.icon;
                        return (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <CatIcon className="h-4 w-4" />
                              {cat.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Drivetrain Design Review"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Content *</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Document your work, decisions, and learnings..."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tags (comma separated)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., drivetrain, mecanum, prototype"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.title || !formData.content}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
