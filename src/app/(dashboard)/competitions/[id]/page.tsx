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
  Trophy,
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Clock,
  Plus,
  Award,
  Target,
  Gamepad2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";
import { FormattedDate, FormattedFullDate } from "@/components/ui/timezone-date-input";
import { useTimezone } from "@/context/TimezoneContext";

const competitionTypes = [
  { value: "scrimmage", label: "Scrimmage" },
  { value: "league_meet", label: "League Meet" },
  { value: "qualifier", label: "Qualifier" },
  { value: "championship", label: "Championship" },
  { value: "worlds", label: "Worlds" },
];

const registrationStatuses = [
  { value: "not_started", label: "Not Started" },
  { value: "registered", label: "Registered" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "confirmed", label: "Confirmed" },
];

const matchTypes = [
  { value: "practice", label: "Practice" },
  { value: "qualification", label: "Qualification" },
  { value: "semifinal", label: "Semifinal" },
  { value: "final", label: "Final" },
];

type CompetitionType = "scrimmage" | "league_meet" | "qualifier" | "championship" | "worlds";
type RegistrationStatus = "not_started" | "registered" | "waitlisted" | "confirmed";
type MatchType = "practice" | "qualification" | "semifinal" | "final";

export default function CompetitionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as Id<"competitions">;
  const { dateToUtcTimestamp, utcTimestampToDate } = useTimezone();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addMatchOpen, setAddMatchOpen] = useState(false);
  const [addAwardOpen, setAddAwardOpen] = useState(false);

  const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
  const [editEndDate, setEditEndDate] = useState<Date | undefined>(undefined);
  const [editRegistrationDeadline, setEditRegistrationDeadline] = useState<Date | undefined>(undefined);

  const [formData, setFormData] = useState({
    name: "",
    type: "qualifier" as CompetitionType,
    location: "",
    address: "",
    registrationStatus: "not_started" as RegistrationStatus,
    notes: "",
  });

  const [matchData, setMatchData] = useState({
    matchNumber: 1,
    matchType: "qualification" as MatchType,
    allianceColor: "red" as "red" | "blue",
    alliancePartner: "",
    opponents: "",
    ourScore: "",
    opponentScore: "",
    autoPoints: "",
    teleopPoints: "",
    endgamePoints: "",
    penaltyPoints: "",
    notes: "",
  });

  const [awardData, setAwardData] = useState({
    awardName: "",
    placement: "",
    notes: "",
  });

  const competition = useQuery(api.competitions.getCompetition, { competitionId });
  const updateCompetition = useMutation(api.competitions.updateCompetition);
  const deleteCompetition = useMutation(api.competitions.deleteCompetition);
  const addMatch = useMutation(api.competitions.addMatch);
  const addAward = useMutation(api.competitions.addAward);

  const handleEdit = () => {
    if (competition) {
      setEditStartDate(utcTimestampToDate(competition.startDate));
      setEditEndDate(utcTimestampToDate(competition.endDate));
      setEditRegistrationDeadline(competition.registrationDeadline ? utcTimestampToDate(competition.registrationDeadline) : undefined);
      setFormData({
        name: competition.name,
        type: competition.type,
        location: competition.location,
        address: competition.address ?? "",
        registrationStatus: competition.registrationStatus,
        notes: competition.notes ?? "",
      });
      setEditOpen(true);
    }
  };

  const handleUpdate = async () => {
    if (!formData.name || !formData.location || !editStartDate) return;

    await updateCompetition({
      competitionId,
      name: formData.name,
      type: formData.type,
      location: formData.location,
      address: formData.address || undefined,
      startDate: dateToUtcTimestamp(editStartDate),
      endDate: editEndDate ? dateToUtcTimestamp(editEndDate) : dateToUtcTimestamp(editStartDate),
      registrationDeadline: editRegistrationDeadline ? dateToUtcTimestamp(editRegistrationDeadline) : undefined,
      registrationStatus: formData.registrationStatus,
      notes: formData.notes || undefined,
    });

    setEditOpen(false);
  };

  const handleDelete = async () => {
    await deleteCompetition({ competitionId });
    router.push("/competitions");
  };

  const handleAddMatch = async () => {
    await addMatch({
      competitionId,
      matchNumber: matchData.matchNumber,
      matchType: matchData.matchType,
      allianceColor: matchData.allianceColor,
      alliancePartner: matchData.alliancePartner || undefined,
      opponents: matchData.opponents ? matchData.opponents.split(",").map((s) => s.trim()) : undefined,
      ourScore: matchData.ourScore ? parseInt(matchData.ourScore) : undefined,
      opponentScore: matchData.opponentScore ? parseInt(matchData.opponentScore) : undefined,
      autoPoints: matchData.autoPoints ? parseInt(matchData.autoPoints) : undefined,
      teleopPoints: matchData.teleopPoints ? parseInt(matchData.teleopPoints) : undefined,
      endgamePoints: matchData.endgamePoints ? parseInt(matchData.endgamePoints) : undefined,
      penaltyPoints: matchData.penaltyPoints ? parseInt(matchData.penaltyPoints) : undefined,
      notes: matchData.notes || undefined,
    });

    setMatchData({
      matchNumber: matchData.matchNumber + 1,
      matchType: "qualification",
      allianceColor: "red",
      alliancePartner: "",
      opponents: "",
      ourScore: "",
      opponentScore: "",
      autoPoints: "",
      teleopPoints: "",
      endgamePoints: "",
      penaltyPoints: "",
      notes: "",
    });
    setAddMatchOpen(false);
  };

  const handleAddAward = async () => {
    if (!awardData.awardName) return;

    await addAward({
      competitionId,
      awardName: awardData.awardName,
      placement: awardData.placement ? parseInt(awardData.placement) : undefined,
      notes: awardData.notes || undefined,
    });

    setAwardData({
      awardName: "",
      placement: "",
      notes: "",
    });
    setAddAwardOpen(false);
  };

  if (competition === undefined) {
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

  if (competition === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Competition not found</h3>
        <p className="text-muted-foreground mb-4">
          This competition may have been deleted.
        </p>
        <Link href="/competitions">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Competitions
          </Button>
        </Link>
      </div>
    );
  }

  const now = Date.now();
  const isPast = competition.endDate < now;
  const isOngoing = competition.startDate <= now && competition.endDate >= now;
  const daysUntil = Math.ceil((competition.startDate - now) / (1000 * 60 * 60 * 24));

  // Calculate match stats
  const wins = competition.matches.filter((m) =>
    m.ourScore !== undefined && m.opponentScore !== undefined && m.ourScore > m.opponentScore
  ).length;
  const losses = competition.matches.filter((m) =>
    m.ourScore !== undefined && m.opponentScore !== undefined && m.ourScore < m.opponentScore
  ).length;
  const ties = competition.matches.filter((m) =>
    m.ourScore !== undefined && m.opponentScore !== undefined && m.ourScore === m.opponentScore
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/competitions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className={`h-5 w-5 ${isOngoing ? "text-green-500" : isPast ? "text-muted-foreground" : "text-primary"}`} />
              <Badge variant="secondary" className="capitalize">
                {competition.type.replace("_", " ")}
              </Badge>
              {isOngoing && <Badge className="bg-green-500">Ongoing</Badge>}
              {isPast && <Badge variant="secondary">Completed</Badge>}
              {!isPast && !isOngoing && (
                <Badge variant="outline">{daysUntil} days away</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold">{competition.name}</h1>
          </div>
        </div>
        <div className="flex gap-2">
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

      {/* Competition Details */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date & Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">
              <FormattedFullDate timestamp={competition.startDate} />
            </p>
            {competition.startDate !== competition.endDate && (
              <p className="text-sm text-muted-foreground">
                to <FormattedFullDate timestamp={competition.endDate} />
              </p>
            )}
            {competition.registrationDeadline && (
              <p className="text-sm text-muted-foreground">
                <Clock className="h-3 w-3 inline mr-1" />
                Registration deadline: <FormattedDate timestamp={competition.registrationDeadline} format="date" />
              </p>
            )}
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
            <p className="font-medium">{competition.location}</p>
            {competition.address && (
              <p className="text-sm text-muted-foreground">{competition.address}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={competition.registrationStatus === "confirmed" ? "default" : "secondary"}
              className="capitalize"
            >
              {competition.registrationStatus.replace("_", " ")}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Match Record Summary */}
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Match Record</h2>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500">{wins}</div>
                  <p className="text-sm text-muted-foreground">Wins</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-500">{losses}</div>
                  <p className="text-sm text-muted-foreground">Losses</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-500">{ties}</div>
                  <p className="text-sm text-muted-foreground">Ties</p>
                </div>
              </div>
            </div>
            {competition.awards.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {competition.awards.map((award) => (
                  <Badge key={award._id} variant="outline" className="border-yellow-500/50 text-yellow-500">
                    <Award className="h-3 w-3 mr-1" />
                    {award.awardName}
                    {award.placement && ` (${award.placement}${award.placement === 1 ? "st" : award.placement === 2 ? "nd" : award.placement === 3 ? "rd" : "th"})`}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Matches Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              Matches ({competition.matches.length})
            </CardTitle>
            <Button onClick={() => setAddMatchOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Match
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {competition.matches.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No matches recorded yet. Add your first match result!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Alliance</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competition.matches.map((match) => {
                  const won = match.ourScore !== undefined && match.opponentScore !== undefined && match.ourScore > match.opponentScore;
                  const lost = match.ourScore !== undefined && match.opponentScore !== undefined && match.ourScore < match.opponentScore;
                  const tied = match.ourScore !== undefined && match.opponentScore !== undefined && match.ourScore === match.opponentScore;

                  return (
                    <TableRow key={match._id}>
                      <TableCell className="font-medium">#{match.matchNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {match.matchType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={match.allianceColor === "red" ? "border-red-500 text-red-500" : "border-blue-500 text-blue-500"}
                        >
                          {match.allianceColor}
                        </Badge>
                      </TableCell>
                      <TableCell>{match.alliancePartner || "-"}</TableCell>
                      <TableCell className="text-center">
                        {match.ourScore !== undefined ? (
                          <span className="font-mono">
                            {match.ourScore} - {match.opponentScore ?? "?"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {won && <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />}
                        {lost && <XCircle className="h-5 w-5 text-red-500 mx-auto" />}
                        {tied && <span className="text-yellow-500 font-bold">TIE</span>}
                        {!won && !lost && !tied && "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Awards Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Awards ({competition.awards.length})
            </CardTitle>
            <Button onClick={() => setAddAwardOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Award
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {competition.awards.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No awards recorded yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {competition.awards.map((award) => (
                <div
                  key={award._id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-yellow-500/5 border-yellow-500/20"
                >
                  <Award className="h-6 w-6 text-yellow-500" />
                  <div>
                    <p className="font-medium">{award.awardName}</p>
                    {award.placement && (
                      <p className="text-sm text-muted-foreground">
                        {award.placement === 1 ? "1st Place" :
                         award.placement === 2 ? "2nd Place" :
                         award.placement === 3 ? "3rd Place" :
                         `${award.placement}th Place`}
                      </p>
                    )}
                    {award.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{award.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Section */}
      {competition.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{competition.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Competition Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Competition</DialogTitle>
            <DialogDescription>
              Update competition details.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Competition Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Regional Qualifier #1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as CompetitionType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {competitionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Registration Status</Label>
                  <Select
                    value={formData.registrationStatus}
                    onValueChange={(v) => setFormData({ ...formData, registrationStatus: v as RegistrationStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {registrationStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Location *</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Lincoln High School"
                />
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <DatePicker
                    value={editStartDate}
                    onChange={setEditStartDate}
                    placeholder="Select start date"
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <DatePicker
                    value={editEndDate}
                    onChange={setEditEndDate}
                    placeholder="Select end date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Registration Deadline</Label>
                <DatePicker
                  value={editRegistrationDeadline}
                  onChange={setEditRegistrationDeadline}
                  placeholder="Select deadline"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
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
              disabled={!formData.name || !formData.location || !editStartDate}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Competition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{competition.name}&quot;? This will also delete all match results and awards. This action cannot be undone.
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

      {/* Add Match Dialog */}
      <Dialog open={addMatchOpen} onOpenChange={setAddMatchOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Match Result</DialogTitle>
            <DialogDescription>
              Record a match result for this competition.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Match Number</Label>
                  <Input
                    type="number"
                    min="1"
                    value={matchData.matchNumber}
                    onChange={(e) => setMatchData({ ...matchData, matchNumber: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Match Type</Label>
                  <Select
                    value={matchData.matchType}
                    onValueChange={(v) => setMatchData({ ...matchData, matchType: v as MatchType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {matchTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Alliance Color</Label>
                  <Select
                    value={matchData.allianceColor}
                    onValueChange={(v) => setMatchData({ ...matchData, allianceColor: v as "red" | "blue" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="red">Red Alliance</SelectItem>
                      <SelectItem value="blue">Blue Alliance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Alliance Partner</Label>
                  <Input
                    value={matchData.alliancePartner}
                    onChange={(e) => setMatchData({ ...matchData, alliancePartner: e.target.value })}
                    placeholder="Team number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Opponents (comma separated)</Label>
                <Input
                  value={matchData.opponents}
                  onChange={(e) => setMatchData({ ...matchData, opponents: e.target.value })}
                  placeholder="e.g., 12345, 67890"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Our Score</Label>
                  <Input
                    type="number"
                    min="0"
                    value={matchData.ourScore}
                    onChange={(e) => setMatchData({ ...matchData, ourScore: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Opponent Score</Label>
                  <Input
                    type="number"
                    min="0"
                    value={matchData.opponentScore}
                    onChange={(e) => setMatchData({ ...matchData, opponentScore: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Auto Points</Label>
                  <Input
                    type="number"
                    min="0"
                    value={matchData.autoPoints}
                    onChange={(e) => setMatchData({ ...matchData, autoPoints: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>TeleOp Points</Label>
                  <Input
                    type="number"
                    min="0"
                    value={matchData.teleopPoints}
                    onChange={(e) => setMatchData({ ...matchData, teleopPoints: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Endgame Points</Label>
                  <Input
                    type="number"
                    min="0"
                    value={matchData.endgamePoints}
                    onChange={(e) => setMatchData({ ...matchData, endgamePoints: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Penalty Points</Label>
                  <Input
                    type="number"
                    min="0"
                    value={matchData.penaltyPoints}
                    onChange={(e) => setMatchData({ ...matchData, penaltyPoints: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={matchData.notes}
                  onChange={(e) => setMatchData({ ...matchData, notes: e.target.value })}
                  placeholder="Match notes..."
                  rows={2}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMatchOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMatch}>
              Add Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Award Dialog */}
      <Dialog open={addAwardOpen} onOpenChange={setAddAwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Award</DialogTitle>
            <DialogDescription>
              Record an award won at this competition.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Award Name *</Label>
              <Input
                value={awardData.awardName}
                onChange={(e) => setAwardData({ ...awardData, awardName: e.target.value })}
                placeholder="e.g., Inspire Award, Design Award"
              />
            </div>

            <div className="space-y-2">
              <Label>Placement</Label>
              <Input
                type="number"
                min="1"
                value={awardData.placement}
                onChange={(e) => setAwardData({ ...awardData, placement: e.target.value })}
                placeholder="1, 2, 3..."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={awardData.notes}
                onChange={(e) => setAwardData({ ...awardData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAwardOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAward} disabled={!awardData.awardName}>
              Add Award
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
