"use client";

import { useState } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Plus,
  AlertTriangle,
  Cpu,
  Cog,
  Box,
  Zap,
  HardDrive,
  Printer,
  Wind,
  CircleDot,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

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

export default function InventoryPage() {
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [showLowStock, setShowLowStock] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    partNumber: "",
    category: "electronics" as const,
    quantity: 1,
    minQuantity: 0,
    location: "",
    supplier: "",
    supplierUrl: "",
    unitCost: "",
    notes: "",
  });

  const { results, status, loadMore } = usePaginatedQuery(
    api.inventory.listParts,
    {
      category: categoryFilter as "motors" | "sensors" | "structural" | "electronics" | "hardware" | "3d_prints" | "pneumatics" | "wheels" | "other" | undefined,
      lowStockOnly: showLowStock,
    },
    { initialNumItems: 20 }
  );

  const stats = useQuery(api.inventory.getInventoryStats);
  const lowStockItems = useQuery(api.inventory.getLowStockItems, { limit: 5 });
  const createPart = useMutation(api.inventory.createPart);

  const handleCreate = async () => {
    if (!formData.name) return;

    await createPart({
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

    setFormData({
      name: "",
      partNumber: "",
      category: "electronics",
      quantity: 1,
      minQuantity: 0,
      location: "",
      supplier: "",
      supplierUrl: "",
      unitCost: "",
      notes: "",
    });
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            Parts Inventory
          </h1>
          <p className="text-muted-foreground">
            Track your robot parts and supplies
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Part
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.totalParts}</div>
              <p className="text-xs text-muted-foreground">Part Types</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.totalItems}</div>
              <p className="text-xs text-muted-foreground">Total Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className={`text-2xl font-bold ${stats.lowStockCount > 0 ? "text-yellow-500" : "text-green-500"}`}>
                {stats.lowStockCount}
              </div>
              <p className="text-xs text-muted-foreground">Low Stock</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Total Value</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.pendingRequests}</div>
              <p className="text-xs text-muted-foreground">Pending Requests</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low Stock Alert */}
      {lowStockItems && lowStockItems.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-4 w-4" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((item) => (
                <Badge key={item._id} variant="outline" className="border-yellow-500/50">
                  {item.name}: {item.quantity}/{item.minQuantity}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!categoryFilter && !showLowStock ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setCategoryFilter(undefined);
            setShowLowStock(false);
          }}
        >
          All
        </Button>
        <Button
          variant={showLowStock ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setShowLowStock(!showLowStock);
            setCategoryFilter(undefined);
          }}
          className={showLowStock ? "" : "text-yellow-500 border-yellow-500/50"}
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          Low Stock
        </Button>
        {partCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Button
              key={cat.value}
              variant={categoryFilter === cat.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setCategoryFilter(cat.value);
                setShowLowStock(false);
              }}
            >
              <Icon className="h-3 w-3 mr-1" />
              {cat.label}
            </Button>
          );
        })}
      </div>

      {/* Parts Table */}
      {status === "LoadingFirstPage" ? (
        <Skeleton className="h-96" />
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No parts found</h3>
            <p className="text-muted-foreground mb-4">
              {categoryFilter
                ? `No parts in the ${partCategories.find((c) => c.value === categoryFilter)?.label} category`
                : showLowStock
                ? "No low stock items"
                : "Start tracking your parts inventory"}
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Part
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((part) => {
                  const isLowStock = part.minQuantity !== undefined && part.quantity <= part.minQuantity;
                  const catInfo = partCategories.find((c) => c.value === part.category);
                  const CatIcon = catInfo?.icon || Package;
                  
                  return (
                    <TableRow key={part._id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link href={`/inventory/${part._id}`} className="flex items-center gap-2 hover:text-primary">
                          {isLowStock && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          {part.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          <CatIcon className="h-3 w-3 mr-1" />
                          {catInfo?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {part.partNumber || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={isLowStock ? "text-yellow-500 font-bold" : ""}>
                          {part.quantity}
                        </span>
                        {part.minQuantity !== undefined && (
                          <span className="text-muted-foreground text-xs">
                            /{part.minQuantity}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {part.location || "-"}
                      </TableCell>
                      <TableCell>
                        {part.supplierUrl ? (
                          <a
                            href={part.supplierUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            {part.supplier || "Link"}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          part.supplier || "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {part.unitCost ? `$${part.unitCost.toFixed(2)}` : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {status === "CanLoadMore" && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => loadMore(20)}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Part</DialogTitle>
            <DialogDescription>
              Add a new part to your inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
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
                  onValueChange={(v) => setFormData({ ...formData, category: v as typeof formData.category })}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name}>
              Add Part
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
