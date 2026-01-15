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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Target,
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Star,
  Zap,
  Shield,
  Wrench,
  Gamepad2,
  MapPin,
  GraduationCap,
  User,
  Calendar,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

function RatingBar({ value, max, label, icon: Icon }: { value: number; max: number; label: string; icon: React.ComponentType<{ className?: string }> }) {
  const percentage = (value / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>
        <span className="font-bold">{value}/{max}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function ScoutedTeamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as Id<"scoutedTeams">;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteReportOpen, setDeleteReportOpen] = useState<Id<"scoutingReports"> | null>(null);
  const [addReportOpen, setAddReportOpen] = useState(false);

  const [formData, setFormData] = useState({
    teamName: "",
    school: "",
    location: "",
    notes: "",
  });

  const [reportData, setReportData] = useState({
    drivetrainType: "",
    autoCapabilities: "",
    teleopCapabilities: "",
    endgameCapabilities: "",
    speedRating: 3,
    defenseRating: 3,
    reliabilityRating: 3,
    driverSkillRating: 3,
    strengths: "",
    weaknesses: "",
    allianceNotes: "",
    overallRating: 5,
  });

  const team = useQuery(api.scouting.getScoutedTeam, { teamId });
  const upsertTeam = useMutation(api.scouting.upsertScoutedTeam);
  const addReport = useMutation(api.scouting.addScoutingReport);
  const deleteReport = useMutation(api.scouting.deleteScoutingReport);

  const handleEdit = () => {
    if (team) {
      setFormData({
        teamName: team.teamName ?? "",
        school: team.school ?? "",
        location: team.location ?? "",
        notes: team.notes ?? "",
      });
      setEditOpen(true);
    }
  };

  const handleUpdate = async () => {
    if (!team) return;

    await upsertTeam({
      teamNumber: team.teamNumber,
      teamName: formData.teamName || undefined,
      school: formData.school || undefined,
      location: formData.location || undefined,
      notes: formData.notes || undefined,
    });

    setEditOpen(false);
  };

  const handleAddReport = async () => {
    await addReport({
      scoutedTeamId: teamId,
      drivetrainType: reportData.drivetrainType || undefined,
      autoCapabilities: reportData.autoCapabilities || undefined,
      teleopCapabilities: reportData.teleopCapabilities || undefined,
      endgameCapabilities: reportData.endgameCapabilities || undefined,
      speedRating: reportData.speedRating,
      defenseRating: reportData.defenseRating,
      reliabilityRating: reportData.reliabilityRating,
      driverSkillRating: reportData.driverSkillRating,
      strengths: reportData.strengths || undefined,
      weaknesses: reportData.weaknesses || undefined,
      allianceNotes: reportData.allianceNotes || undefined,
      overallRating: reportData.overallRating,
    });

    setReportData({
      drivetrainType: "",
      autoCapabilities: "",
      teleopCapabilities: "",
      endgameCapabilities: "",
      speedRating: 3,
      defenseRating: 3,
      reliabilityRating: 3,
      driverSkillRating: 3,
      strengths: "",
      weaknesses: "",
      allianceNotes: "",
      overallRating: 5,
    });
    setAddReportOpen(false);
  };

  const handleDeleteReport = async () => {
    if (deleteReportOpen) {
      await deleteReport({ reportId: deleteReportOpen });
      setDeleteReportOpen(null);
    }
  };

  if (team === undefined) {
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

  if (team === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Target className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Team not found</h3>
        <p className="text-muted-foreground mb-4">
          This scouted team may have been deleted.
        </p>
        <Link href="/scouting">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Scouting
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/scouting">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl font-bold text-primary">#{team.teamNumber}</span>
              {team.avgRatings.overall > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  {team.avgRatings.overall}/10
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold">{team.teamName || "Unknown Team"}</h1>
            {(team.school || team.location) && (
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                {team.school && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-4 w-4" />
                    {team.school}
                  </span>
                )}
                {team.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {team.location}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddReportOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Report
          </Button>
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Team
          </Button>
        </div>
      </div>

      {/* Average Ratings */}
      {team.avgRatings.overall > 0 && (
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">Average Ratings</h2>
                <p className="text-sm text-muted-foreground">
                  Based on {team.reports.length} scouting report{team.reports.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-8 w-8 text-primary fill-primary" />
                <span className="text-4xl font-bold">{team.avgRatings.overall}</span>
                <span className="text-xl text-muted-foreground">/10</span>
              </div>
            </div>
            <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-4">
              <RatingBar value={team.avgRatings.speed} max={5} label="Speed" icon={Zap} />
              <RatingBar value={team.avgRatings.defense} max={5} label="Defense" icon={Shield} />
              <RatingBar value={team.avgRatings.reliability} max={5} label="Reliability" icon={Wrench} />
              <RatingBar value={team.avgRatings.driverSkill} max={5} label="Driver Skill" icon={Gamepad2} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Notes */}
      {team.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Team Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{team.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Scouting Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Scouting Reports ({team.reports.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setAddReportOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {team.reports.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No scouting reports yet. Add your first report!
            </p>
          ) : (
            <div className="space-y-4">
              {team.reports.map((report) => (
                <Card key={report._id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {report.overallRating && (
                            <Badge className="gap-1">
                              <Star className="h-3 w-3" />
                              {report.overallRating}/10
                            </Badge>
                          )}
                          {report.competitionName && (
                            <Badge variant="outline">
                              <Trophy className="h-3 w-3 mr-1" />
                              {report.competitionName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{report.scoutName}</span>
                          <span>•</span>
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteReportOpen(report._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Ratings */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Ratings</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" /> Speed
                            </span>
                            <span className="font-bold">{report.speedRating ?? "-"}/5</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" /> Defense
                            </span>
                            <span className="font-bold">{report.defenseRating ?? "-"}/5</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="flex items-center gap-1">
                              <Wrench className="h-3 w-3" /> Reliability
                            </span>
                            <span className="font-bold">{report.reliabilityRating ?? "-"}/5</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="flex items-center gap-1">
                              <Gamepad2 className="h-3 w-3" /> Driver
                            </span>
                            <span className="font-bold">{report.driverSkillRating ?? "-"}/5</span>
                          </div>
                        </div>
                      </div>

                      {/* Capabilities */}
                      <div className="space-y-2">
                        {report.drivetrainType && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Drivetrain</p>
                            <p className="text-sm">{report.drivetrainType}</p>
                          </div>
                        )}
                        {report.autoCapabilities && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Autonomous</p>
                            <p className="text-sm">{report.autoCapabilities}</p>
                          </div>
                        )}
                        {report.teleopCapabilities && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">TeleOp</p>
                            <p className="text-sm">{report.teleopCapabilities}</p>
                          </div>
                        )}
                        {report.endgameCapabilities && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Endgame</p>
                            <p className="text-sm">{report.endgameCapabilities}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Strengths & Weaknesses */}
                    {(report.strengths || report.weaknesses) && (
                      <div className="grid gap-4 md:grid-cols-2 mt-4 pt-4 border-t">
                        {report.strengths && (
                          <div>
                            <p className="text-sm font-medium text-green-600 mb-1">Strengths</p>
                            <p className="text-sm">{report.strengths}</p>
                          </div>
                        )}
                        {report.weaknesses && (
                          <div>
                            <p className="text-sm font-medium text-red-600 mb-1">Weaknesses</p>
                            <p className="text-sm">{report.weaknesses}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Alliance Notes */}
                    {report.allianceNotes && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium text-blue-600 mb-1">Alliance Notes</p>
                        <p className="text-sm">{report.allianceNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Team Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Info</DialogTitle>
            <DialogDescription>
              Update team information for #{team.teamNumber}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input
                value={formData.teamName}
                onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                placeholder="e.g., RoboWarriors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>School</Label>
                <Input
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  placeholder="School name"
                />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, State"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="General notes about this team..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Report Confirmation */}
      <AlertDialog open={deleteReportOpen !== null} onOpenChange={(open) => !open && setDeleteReportOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scouting report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReport} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Report Dialog */}
      <Dialog open={addReportOpen} onOpenChange={setAddReportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Scouting Report</DialogTitle>
            <DialogDescription>
              Record a scouting report for team #{team.teamNumber}.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="capabilities" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
              <TabsTrigger value="ratings">Ratings</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="capabilities" className="space-y-4">
              <div className="space-y-2">
                <Label>Drivetrain Type</Label>
                <Input
                  value={reportData.drivetrainType}
                  onChange={(e) => setReportData({ ...reportData, drivetrainType: e.target.value })}
                  placeholder="e.g., Mecanum, Tank, Swerve"
                />
              </div>

              <div className="space-y-2">
                <Label>Autonomous Capabilities</Label>
                <Textarea
                  value={reportData.autoCapabilities}
                  onChange={(e) => setReportData({ ...reportData, autoCapabilities: e.target.value })}
                  placeholder="What can they do in autonomous?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>TeleOp Capabilities</Label>
                <Textarea
                  value={reportData.teleopCapabilities}
                  onChange={(e) => setReportData({ ...reportData, teleopCapabilities: e.target.value })}
                  placeholder="What can they do in teleop?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Endgame Capabilities</Label>
                <Textarea
                  value={reportData.endgameCapabilities}
                  onChange={(e) => setReportData({ ...reportData, endgameCapabilities: e.target.value })}
                  placeholder="What can they do in endgame?"
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="ratings" className="space-y-6">
              {[
                { key: "speedRating", label: "Speed", icon: Zap },
                { key: "defenseRating", label: "Defense", icon: Shield },
                { key: "reliabilityRating", label: "Reliability", icon: Wrench },
                { key: "driverSkillRating", label: "Driver Skill", icon: Gamepad2 },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </Label>
                    <span className="font-bold">{reportData[key as keyof typeof reportData]}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={reportData[key as keyof typeof reportData] as number}
                    onChange={(e) => setReportData({ ...reportData, [key]: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              ))}

              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    Overall Rating
                  </Label>
                  <span className="font-bold text-primary">{reportData.overallRating}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={reportData.overallRating}
                  onChange={(e) => setReportData({ ...reportData, overallRating: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-2">
                <Label>Strengths</Label>
                <Textarea
                  value={reportData.strengths}
                  onChange={(e) => setReportData({ ...reportData, strengths: e.target.value })}
                  placeholder="What are they good at?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Weaknesses</Label>
                <Textarea
                  value={reportData.weaknesses}
                  onChange={(e) => setReportData({ ...reportData, weaknesses: e.target.value })}
                  placeholder="What do they struggle with?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Alliance Notes</Label>
                <Textarea
                  value={reportData.allianceNotes}
                  onChange={(e) => setReportData({ ...reportData, allianceNotes: e.target.value })}
                  placeholder="Would they be a good alliance partner? Strategy notes?"
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddReport}>
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
