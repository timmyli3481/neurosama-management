"use client";

import { useState } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target,
  Plus,
  Star,
  Users,
  Trophy,
  Shield,
  Zap,
  Wrench,
  Gamepad2,
} from "lucide-react";

function TeamCard({ team }: {
  team: {
    _id: string;
    teamNumber: string;
    teamName?: string | null;
    reportCount: number;
    avgRating: number;
  };
}) {
  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">#{team.teamNumber}</div>
            <p className="text-sm text-muted-foreground">
              {team.teamName || "Unknown Team"}
            </p>
          </div>
          {team.avgRating > 0 && (
            <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded">
              <Star className="h-4 w-4 text-primary fill-primary" />
              <span className="font-bold">{team.avgRating}</span>
            </div>
          )}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {team.reportCount} scouting report{team.reportCount !== 1 ? "s" : ""}
        </div>
      </CardContent>
    </Card>
  );
}

function TopTeamCard({ team, rank }: {
  team: {
    _id: string;
    teamNumber: string;
    teamName: string | null;
    avgRating: number;
    reportCount: number;
    strengths: string | null;
  };
  rank: number;
}) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-accent/50">
      <div className="text-2xl font-bold text-muted-foreground w-8">
        {rank}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold">#{team.teamNumber}</span>
          <span className="text-sm text-muted-foreground">
            {team.teamName}
          </span>
        </div>
        {team.strengths && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {team.strengths}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 text-primary fill-primary" />
        <span className="font-bold">{team.avgRating}</span>
      </div>
    </div>
  );
}

export default function ScoutingPage() {
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [scoutOpen, setScoutOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<Id<"scoutedTeams"> | null>(null);
  const [newTeamData, setNewTeamData] = useState({
    teamNumber: "",
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

  const { results, status, loadMore } = usePaginatedQuery(
    api.scouting.listScoutedTeams,
    {},
    { initialNumItems: 20 }
  );

  const topTeams = useQuery(api.scouting.getTopRatedTeams, { limit: 5 });
  const stats = useQuery(api.scouting.getScoutingStats);
  const upsertTeam = useMutation(api.scouting.upsertScoutedTeam);
  const addReport = useMutation(api.scouting.addScoutingReport);

  const handleCreateTeam = async () => {
    if (!newTeamData.teamNumber) return;

    const teamId = await upsertTeam({
      teamNumber: newTeamData.teamNumber,
      teamName: newTeamData.teamName || undefined,
      school: newTeamData.school || undefined,
      location: newTeamData.location || undefined,
      notes: newTeamData.notes || undefined,
    });

    setNewTeamData({
      teamNumber: "",
      teamName: "",
      school: "",
      location: "",
      notes: "",
    });
    setCreateTeamOpen(false);
    
    // Open scouting form
    setSelectedTeamId(teamId);
    setScoutOpen(true);
  };

  const handleSubmitReport = async () => {
    if (!selectedTeamId) return;

    await addReport({
      scoutedTeamId: selectedTeamId,
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
    setScoutOpen(false);
    setSelectedTeamId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            Match Scouting
          </h1>
          <p className="text-muted-foreground">
            Scout other teams for alliance selection
          </p>
        </div>
        <Button onClick={() => setCreateTeamOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Scout Team
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.totalTeamsScouted}</div>
              <p className="text-xs text-muted-foreground">Teams Scouted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.totalReports}</div>
              <p className="text-xs text-muted-foreground">Total Reports</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-500">{stats.reportsThisWeek}</div>
              <p className="text-xs text-muted-foreground">This Week</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Rated Teams */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Top Alliance Picks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topTeams === undefined ? (
              <Skeleton className="h-40" />
            ) : topTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No teams scouted yet
              </p>
            ) : (
              topTeams.map((team, index) => (
                <TopTeamCard key={team._id} team={team} rank={index + 1} />
              ))
            )}
          </CardContent>
        </Card>

        {/* All Scouted Teams */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Scouted Teams</h2>
          
          {status === "LoadingFirstPage" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No teams scouted</h3>
                <p className="text-muted-foreground mb-4">
                  Start scouting teams at your next competition
                </p>
                <Button onClick={() => setCreateTeamOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Scout First Team
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {results.map((team) => (
                  <div
                    key={team._id}
                    onClick={() => {
                      setSelectedTeamId(team._id as Id<"scoutedTeams">);
                      setScoutOpen(true);
                    }}
                  >
                    <TeamCard team={team} />
                  </div>
                ))}
              </div>

              {status === "CanLoadMore" && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => loadMore(20)}>
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Team Dialog */}
      <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team to Scout</DialogTitle>
            <DialogDescription>
              Enter the team information before scouting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Number *</Label>
              <Input
                value={newTeamData.teamNumber}
                onChange={(e) => setNewTeamData({ ...newTeamData, teamNumber: e.target.value })}
                placeholder="e.g., 12345"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input
                value={newTeamData.teamName}
                onChange={(e) => setNewTeamData({ ...newTeamData, teamName: e.target.value })}
                placeholder="e.g., RoboWarriors"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>School</Label>
                <Input
                  value={newTeamData.school}
                  onChange={(e) => setNewTeamData({ ...newTeamData, school: e.target.value })}
                  placeholder="School name"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={newTeamData.location}
                  onChange={(e) => setNewTeamData({ ...newTeamData, location: e.target.value })}
                  placeholder="City, State"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTeamOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTeam} disabled={!newTeamData.teamNumber}>
              Continue to Scout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scouting Report Dialog */}
      <Dialog open={scoutOpen} onOpenChange={setScoutOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scouting Report</DialogTitle>
            <DialogDescription>
              Rate and document the team&apos;s capabilities.
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
            <Button variant="outline" onClick={() => setScoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReport}>
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
