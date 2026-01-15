"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  ArrowLeft,
  Edit,
  Trash2,
  AlertTriangle,
  Plus,
  Minus,
  RotateCcw,
  ShoppingCart,
  Cog,
  Cpu,
  Box,
  Zap,
  HardDrive,
  Printer,
  Wind,
  CircleDot,
  ExternalLink,
  MapPin,
  DollarSign,
  History,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

const partCategories = [
  { value: "motors", label: "Motors", icon: Cog },
  { value: "sensors", label: "Sensors", icon: Cpu },
  { value: "structural", label: "Structural", icon: Box },
  { value: "electronics", label: "Electronics", icon: Zap },
  { value: "hardware", label: "Hardware", icon: HardDrive },
  { value: "3d_prints", label: "3D Prints", icon: Printer },
  { value: "pneumatics", label: "Pneumatics", icon: Wind },
  { value: "wheels", label: "Wheels", icon: CircleDot },
  { value: "other", label: "Other", icon: Package },
];

const actionTypes = [
  { value: "used", label: "Used", icon: Minus, color: "text-red-500" },
  { value: "restocked", label: "Restocked", icon: Plus, color: "text-green-500" },
  { value: "returned", label: "Returned", icon: RotateCcw, color: "text-blue-500" },
  { value: "damaged", label: "Damaged", icon: AlertTriangle, color: "text-yellow-500" },
  { value: "ordered", label: "Ordered", icon: ShoppingCart, color: "text-purple-500" },
];

type PartCategory = "motors" | "sensors" | "structural" | "electronics" | "hardware" | "3d_prints" | "pneumatics" | "wheels" | "other";
type ActionType = "used" | "restocked" | "returned" | "damaged" | "ordered";

export default function PartDetailPage() {
  const router = useRouter();
  const params = useParams();
  const partId = params.id as Id<"partsInventory">;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logActionOpen, setLogActionOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    partNumber: "",
    category: "electronics" as PartCategory,
    quantity: 1,
    minQuantity: 0,
    location: "",
    supplier: "",
    supplierUrl: "",
    unitCost: "",
    notes: "",
  });

  const [actionData, setActionData] = useState({
    action: "used" as ActionType,
    quantity: 1,
    notes: "",
  });

  const part = useQuery(api.inventory.getPart, { partId });
  const updatePart = useMutation(api.inventory.updatePart);
  const deletePart = useMutation(api.inventory.deletePart);
  const logPartAction = useMutation(api.inventory.logPartAction);

  const handleEdit = () => {
    if (part) {
      setFormData({
        name: part.name,
        partNumber: part.partNumber ?? "",
        category: part.category,
        quantity: part.quantity,
        minQuantity: part.minQuantity ?? 0,
        location: part.location ?? "",
        supplier: part.supplier ?? "",
        supplierUrl: part.supplierUrl ?? "",
        unitCost: part.unitCost?.toString() ?? "",
        notes: part.notes ?? "",
      });
      setEditOpen(true);
    }
  };

  const handleUpdate = async () => {
    if (!formData.name) return;

    await updatePart({
      partId,
      name: formData.name,
      partNumber: formData.partNumber || undefined,
      category: formData.category,
      quantity: formData.quantity,
      minQuantity: formData.minQuantity || undefined,
      location: formData.location || undefined,
      supplier: formData.supplier || undefined,
      supplierUrl: formData.supplierUrl || undefined,
      unitCost: formData.unitCost ? parseFloat(formData.unitCost) : undefined,
      notes: formData.notes || undefined,
    });

    setEditOpen(false);
  };

  const handleDelete = async () => {
    await deletePart({ partId });
    router.push("/inventory");
  };

  const handleLogAction = async () => {
    if (actionData.quantity <= 0) return;

    await logPartAction({
      partId,
      action: actionData.action,
      quantity: actionData.quantity,
      notes: actionData.notes || undefined,
    });

    setActionData({
      action: "used",
      quantity: 1,
      notes: "",
    });
    setLogActionOpen(false);
  };

  if (part === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (part === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Part not found</h3>
        <p className="text-muted-foreground mb-4">
          This part may have been deleted.
        </p>
        <Link href="/inventory">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
        </Link>
      </div>
    );
  }

  const categoryInfo = partCategories.find((c) => c.value === part.category);
  const CategoryIcon = categoryInfo?.icon || Package;
  const totalValue = part.unitCost ? part.unitCost * part.quantity : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/inventory">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="capitalize">
                <CategoryIcon className="h-3 w-3 mr-1" />
                {categoryInfo?.label}
              </Badge>
              {part.isLowStock && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Low Stock
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold">{part.name}</h1>
            {part.partNumber && (
              <p className="text-sm text-muted-foreground font-mono">
                Part #: {part.partNumber}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLogActionOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            Log Action
          </Button>
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Part Details */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={part.isLowStock ? "border-yellow-500/50 bg-yellow-500/5" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Quantity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${part.isLowStock ? "text-yellow-500" : ""}`}>
                {part.quantity}
              </span>
              {part.minQuantity !== undefined && (
                <span className="text-sm text-muted-foreground">
                  / min: {part.minQuantity}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{part.location || "Not specified"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Unit Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {part.unitCost ? `$${part.unitCost.toFixed(2)}` : "Not specified"}
            </p>
            {totalValue && (
              <p className="text-sm text-muted-foreground">
                Total: ${totalValue.toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Supplier
            </CardTitle>
          </CardHeader>
          <CardContent>
            {part.supplierUrl ? (
              <a
                href={part.supplierUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline font-medium"
              >
                {part.supplier || "View"}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="font-medium">{part.supplier || "Not specified"}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linked Subsystem */}
      {part.subsystem && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Linked Subsystem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/robot/${part.subsystem._id}`} className="text-primary hover:underline font-medium">
              {part.subsystem.name}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {part.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{part.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Usage History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Usage History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {part.logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No usage history recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {part.logs.map((log) => {
                  const actionInfo = actionTypes.find((a) => a.value === log.action);
                  const ActionIcon = actionInfo?.icon || Package;

                  return (
                    <TableRow key={log._id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${actionInfo?.color}`}>
                          <ActionIcon className="h-3 w-3 mr-1" />
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {log.action === "used" || log.action === "damaged" ? "-" : "+"}
                        {log.quantity}
                      </TableCell>
                      <TableCell>{log.userName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.notes || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Part Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Part</DialogTitle>
            <DialogDescription>
              Update part details.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Part Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., REV HD Hex Motor"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v as PartCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {partCategories.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {cat.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Part Number</Label>
                  <Input
                    value={formData.partNumber}
                    onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                    placeholder="e.g., REV-41-1301"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Min Quantity (for alerts)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Storage Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Bin A3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Input
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="e.g., REV Robotics"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Unit Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Supplier URL</Label>
                <Input
                  value={formData.supplierUrl}
                  onChange={(e) => setFormData({ ...formData, supplierUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!formData.name}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{part.name}&quot;? This will also delete all usage history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Log Action Dialog */}
      <Dialog open={logActionOpen} onOpenChange={setLogActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Part Action</DialogTitle>
            <DialogDescription>
              Record a change in inventory for this part.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select
                value={actionData.action}
                onValueChange={(v) => setActionData({ ...actionData, action: v as ActionType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((action) => {
                    const Icon = action.icon;
                    return (
                      <SelectItem key={action.value} value={action.value}>
                        <div className={`flex items-center gap-2 ${action.color}`}>
                          <Icon className="h-4 w-4" />
                          {action.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={actionData.quantity}
                onChange={(e) => setActionData({ ...actionData, quantity: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">
                {actionData.action === "used" || actionData.action === "damaged"
                  ? `Will decrease quantity by ${actionData.quantity}`
                  : `Will increase quantity by ${actionData.quantity}`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={actionData.notes}
                onChange={(e) => setActionData({ ...actionData, notes: e.target.value })}
                placeholder="What was it used for? Why restocked?"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogActionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogAction} disabled={actionData.quantity <= 0}>
              Log Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
