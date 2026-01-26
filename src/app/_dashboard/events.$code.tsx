import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Trophy,
  Users,
  ExternalLink,
  Play,
  Clock,
  CheckCircle2,
  Circle,
  Video,
  Globe,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimezone } from "@/context/TimezoneContext";
import { useState, useEffect, useCallback, useMemo } from "react";

export const Route = createFileRoute("/_dashboard/events/$code")({
  component: EventDetailPage,
});

// ==========================================
// TIMEZONE-AWARE DATE HELPERS
// ==========================================

/**
 * Get date parts (year, month, day) in a specific timezone
 */
function getDatePartsInTimezone(
  timestamp: number,
  timezone: string
): { year: number; month: number; day: number } {
  const date = new Date(timestamp);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const getValue = (type: string) => {
    const part = parts.find((p) => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };

  return {
    year: getValue("year"),
    month: getValue("month"),
    day: getValue("day"),
  };
}

/**
 * Parse a date string (YYYY-MM-DD) in a specific timezone and return UTC timestamp.
 * The date is interpreted as midnight (start of day) in the specified timezone.
 */
function parseDateStringToTimestamp(dateString: string, eventTimezone: string): number {
  // Parse the date string
  const [year, month, day] = dateString.split("-").map(Number);
  
  // Create a date at noon UTC as a starting point
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  // Get what this appears as in the event's timezone
  const testParts = getDatePartsInTimezone(testDate.getTime(), eventTimezone);
  
  // Adjust if needed (handles edge cases around day boundaries)
  const dayDiff = day - testParts.day;
  const adjustedDate = new Date(testDate.getTime() + dayDiff * 24 * 60 * 60 * 1000);
  
  // Find midnight in the event's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: eventTimezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const timeParts = formatter.formatToParts(adjustedDate);
  const hour = parseInt(timeParts.find(p => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(timeParts.find(p => p.type === "minute")?.value || "0", 10);
  
  return adjustedDate.getTime() - (hour * 60 + minute) * 60 * 1000;
}

// ==========================================
// TYPE DEFINITIONS (mapped from GraphQL fragments)
// ==========================================

type LocationFields = {
  venue: string | null;
  city: string;
  state: string;
  country: string;
};

type EventCoreFragment = {
  season: number;
  code: string;
  name: string;
  type: EventType;
  address: string | null;
  location: LocationFields;
  regionCode: string | null;
  leagueCode: string | null;
  districtCode: string | null;
  divisionCode: string | null;
  start: string;
  end: string;
  timezone: string;
  remote: boolean;
  hybrid: boolean;
  fieldCount: number;
  published: boolean;
  started: boolean;
  ongoing: boolean;
  finished: boolean;
  hasMatches: boolean;
  website: string | null;
  liveStreamURL: string | null;
  webcasts: string[];
  createdAt: string;
  updatedAt: string;
};

type TeamMatchParticipationCore = {
  season: number;
  eventCode: string;
  matchId: number;
  alliance: Alliance;
  allianceRole: AllianceRole;
  station: Station;
  teamNumber: number;
};

type MatchScores2025Alliance = {
  alliance: Alliance;
  totalPoints: number;
  totalPointsNp: number;
  autoPoints: number;
  dcPoints: number;
  penaltyPointsByOpp: number;
};

type MatchCoreFragment = {
  season: number;
  eventCode: string;
  id: number;
  tournamentLevel: TournamentLevel;
  series: number;
  matchNum: number;
  description: string;
  hasBeenPlayed: boolean;
  scheduledStartTime: string | null;
  actualStartTime: string | null;
  postResultTime: string | null;
  createdAt: string;
  updatedAt: string;
  teams: TeamMatchParticipationCore[];
  scores: {
    season: number;
    eventCode: string;
    matchId: number;
    red: MatchScores2025Alliance;
    blue: MatchScores2025Alliance;
  } | null;
};

type AwardFields = {
  teamNumber: number;
  type: AwardType;
  personName: string | null;
  placement: number;
  divisionName: string | null;
};

type EventType =
  | "Championship"
  | "DemoExhibition"
  | "FIRSTChampionship"
  | "InnovationChallenge"
  | "Kickoff"
  | "LeagueMeet"
  | "LeagueTournament"
  | "OffSeason"
  | "Other"
  | "PracticeDay"
  | "Premier"
  | "Qualifier"
  | "Scrimmage"
  | "SuperQualifier"
  | "VolunteerSignup"
  | "Workshop";

type TournamentLevel = "DoubleElim" | "Finals" | "Quals" | "Semis";
type Alliance = "Blue" | "Red" | "Solo";
type AllianceRole = "Captain" | "FirstPick" | "SecondPick" | "Solo";
type Station = "NotOnField" | "One" | "Solo" | "Two";

type AwardType =
  | "Compass"
  | "ConferenceFinalist"
  | "Connect"
  | "Control"
  | "DeansListFinalist"
  | "DeansListSemiFinalist"
  | "DeansListWinner"
  | "Design"
  | "DivisionFinalist"
  | "DivisionWinner"
  | "Finalist"
  | "Innovate"
  | "Inspire"
  | "JudgesChoice"
  | "Motivate"
  | "Promote"
  | "Reach"
  | "Sustain"
  | "Think"
  | "TopRanked"
  | "Winner";

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getEventTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    Championship: "Championship",
    DemoExhibition: "Demo / Exhibition",
    FIRSTChampionship: "FIRST Championship",
    InnovationChallenge: "Innovation Challenge",
    Kickoff: "Kickoff",
    LeagueMeet: "League Meet",
    LeagueTournament: "League Tournament",
    OffSeason: "Off Season",
    Other: "Other",
    PracticeDay: "Practice Day",
    Premier: "Premier",
    Qualifier: "Qualifier",
    Scrimmage: "Scrimmage",
    SuperQualifier: "Super Qualifier",
    VolunteerSignup: "Volunteer Signup",
    Workshop: "Workshop",
  };
  return labels[type] || type;
}

function getEventTypeBadgeVariant(
  type: EventType
): "default" | "secondary" | "outline" | "destructive" {
  switch (type) {
    case "FIRSTChampionship":
    case "Championship":
      return "destructive";
    case "Qualifier":
    case "SuperQualifier":
    case "LeagueTournament":
      return "default";
    case "LeagueMeet":
      return "secondary";
    default:
      return "outline";
  }
}

function getAwardTypeLabel(type: AwardType): string {
  const labels: Record<AwardType, string> = {
    Compass: "Compass Award",
    ConferenceFinalist: "Conference Finalist",
    Connect: "Connect Award",
    Control: "Control Award",
    DeansListFinalist: "Dean's List Finalist",
    DeansListSemiFinalist: "Dean's List Semi-Finalist",
    DeansListWinner: "Dean's List Winner",
    Design: "Design Award",
    DivisionFinalist: "Division Finalist",
    DivisionWinner: "Division Winner",
    Finalist: "Finalist",
    Innovate: "Innovate Award",
    Inspire: "Inspire Award",
    JudgesChoice: "Judges' Choice",
    Motivate: "Motivate Award",
    Promote: "Promote Award",
    Reach: "Reach Award",
    Sustain: "Sustain Award",
    Think: "Think Award",
    TopRanked: "Top Ranked",
    Winner: "Winner",
  };
  return labels[type] || type;
}

function getTournamentLevelLabel(level: TournamentLevel): string {
  const labels: Record<TournamentLevel, string> = {
    DoubleElim: "Double Elimination",
    Finals: "Finals",
    Quals: "Qualifications",
    Semis: "Semi-Finals",
  };
  return labels[level] || level;
}

function formatLocation(location: LocationFields): string {
  const parts = [location.city, location.state, location.country].filter(
    Boolean
  );
  return parts.join(", ");
}

// ==========================================
// COMPONENTS
// ==========================================

function EventStatusBadge({ event }: { event: EventCoreFragment }) {
  if (event.finished) {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>
    );
  }
  if (event.ongoing) {
    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <Play className="h-3 w-3" />
        Live
      </Badge>
    );
  }
  if (event.started) {
    return (
      <Badge variant="default" className="gap-1">
        <Clock className="h-3 w-3" />
        In Progress
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Circle className="h-3 w-3" />
      Upcoming
    </Badge>
  );
}

function EventHeader({ event }: { event: EventCoreFragment }) {
  const { formatDate, timezone } = useTimezone();

  // Convert string dates to timestamps using the event's timezone
  const startTimestamp = useMemo(
    () => parseDateStringToTimestamp(event.start, event.timezone),
    [event.start, event.timezone]
  );
  const endTimestamp = useMemo(
    () => parseDateStringToTimestamp(event.end, event.timezone),
    [event.end, event.timezone]
  );

  // Check if same day in the user's selected timezone
  const isSameDay = useMemo(() => {
    const startParts = getDatePartsInTimezone(startTimestamp, timezone);
    const endParts = getDatePartsInTimezone(endTimestamp, timezone);
    return (
      startParts.year === endParts.year &&
      startParts.month === endParts.month &&
      startParts.day === endParts.day
    );
  }, [startTimestamp, endTimestamp, timezone]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/events">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {event.name}
            </h1>
            <Badge variant={getEventTypeBadgeVariant(event.type)}>
              {getEventTypeLabel(event.type)}
            </Badge>
            <EventStatusBadge event={event} />
          </div>
          <p className="text-muted-foreground ml-10">
            Season {event.season} • {event.code}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium">
                {isSameDay
                  ? formatDate(startTimestamp, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : `${formatDate(startTimestamp, {
                      month: "short",
                      day: "numeric",
                    })} - ${formatDate(endTimestamp, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-medium truncate">
                {formatLocation(event.location)}
              </p>
              {event.location.venue && (
                <p className="text-xs text-muted-foreground truncate">
                  {event.location.venue}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Competition</p>
              <p className="font-medium">{event.fieldCount} Field(s)</p>
              {(event.remote || event.hybrid) && (
                <p className="text-xs text-muted-foreground">
                  {event.remote ? "Remote" : "Hybrid"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Links</p>
              <div className="flex gap-2">
                {event.website && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={event.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Website
                    </a>
                  </Button>
                )}
                {event.liveStreamURL && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={event.liveStreamURL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Video className="h-3 w-3 mr-1" />
                      Stream
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MatchRow({
  match,
  onTeamClick,
}: {
  match: MatchCoreFragment;
  onTeamClick: (teamNumber: number) => void;
}) {
  const { formatDate } = useTimezone();

  const redTeams = match.teams.filter((t) => t.alliance === "Red");
  const blueTeams = match.teams.filter((t) => t.alliance === "Blue");

  const redScore = match.scores?.red?.totalPoints;
  const blueScore = match.scores?.blue?.totalPoints;

  const redWon =
    redScore !== undefined && blueScore !== undefined && redScore > blueScore;
  const blueWon =
    redScore !== undefined && blueScore !== undefined && blueScore > redScore;

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{match.description}</span>
          <span className="text-xs text-muted-foreground">
            {getTournamentLevelLabel(match.tournamentLevel)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded bg-red-100 dark:bg-red-900/30",
              redWon && "ring-2 ring-red-500"
            )}
          >
            <span className="text-xs font-medium text-red-700 dark:text-red-300">
              Red
            </span>
            <span className="text-sm">
              {redTeams.map((t, i) => (
                <span key={t.teamNumber}>
                  {i > 0 && " / "}
                  <button
                    onClick={() => onTeamClick(t.teamNumber)}
                    className="hover:underline hover:text-primary"
                  >
                    {t.teamNumber}
                  </button>
                </span>
              ))}
            </span>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30",
              blueWon && "ring-2 ring-blue-500"
            )}
          >
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              Blue
            </span>
            <span className="text-sm">
              {blueTeams.map((t, i) => (
                <span key={t.teamNumber}>
                  {i > 0 && " / "}
                  <button
                    onClick={() => onTeamClick(t.teamNumber)}
                    className="hover:underline hover:text-primary"
                  >
                    {t.teamNumber}
                  </button>
                </span>
              ))}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        {match.hasBeenPlayed && match.scores ? (
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                "font-bold text-red-700 dark:text-red-300",
                redWon && "text-lg"
              )}
            >
              {redScore}
            </span>
            <span
              className={cn(
                "font-bold text-blue-700 dark:text-blue-300",
                blueWon && "text-lg"
              )}
            >
              {blueScore}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {match.scheduledStartTime
          ? formatDate(new Date(match.scheduledStartTime).getTime(), {
              hour: "numeric",
              minute: "2-digit",
            })
          : "-"}
      </TableCell>
      <TableCell>
        {match.hasBeenPlayed ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Played
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Scheduled
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function MatchesTab({
  matches,
  onTeamClick,
}: {
  matches: MatchCoreFragment[];
  onTeamClick: (teamNumber: number) => void;
}) {
  const groupedMatches = matches.reduce(
    (acc, match) => {
      const level = match.tournamentLevel;
      if (!acc[level]) acc[level] = [];
      acc[level].push(match);
      return acc;
    },
    {} as Record<TournamentLevel, MatchCoreFragment[]>
  );

  Object.values(groupedMatches).forEach((group) => {
    group.sort((a, b) => {
      if (a.series !== b.series) return a.series - b.series;
      return a.matchNum - b.matchNum;
    });
  });

  const levelOrder: TournamentLevel[] = [
    "Quals",
    "Semis",
    "DoubleElim",
    "Finals",
  ];

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No matches available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {levelOrder.map((level) => {
        const levelMatches = groupedMatches[level];
        if (!levelMatches || levelMatches.length === 0) return null;

        return (
          <Card key={level}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                {getTournamentLevelLabel(level)} ({levelMatches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Match</TableHead>
                      <TableHead>Teams</TableHead>
                      <TableHead className="w-24 text-center">Score</TableHead>
                      <TableHead className="w-24">Time</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levelMatches.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        onTeamClick={onTeamClick}
                      />
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

type QuickStatFields = {
  value: number;
  rank: number;
};

type QuickStatsFields = {
  season: number;
  number: number;
  tot: QuickStatFields;
  auto: QuickStatFields;
  dc: QuickStatFields;
  eg: QuickStatFields;
  count: number;
};

type TeamEventData = {
  teamNumber: number;
  teamName?: string; // Team name - can be set even for placeholder teams
  teamInfoId: string | null; // null if team not in teamEvents yet
  teamData?: {
    number: number;
    name: string;
    schoolName: string | null;
    location: LocationFields;
    quickStats: QuickStatsFields | null;
  };
};

type TeamsViewMode = "all" | "opr";
type SortMetric = "tot" | "auto" | "dc" | "eg";

function TeamsTab({
  teams,
  matches,
  onTeamClick,
  onSyncAllTeams,
  isSyncingTeams,
}: {
  teams: TeamEventData[];
  matches: MatchCoreFragment[];
  onTeamClick: (teamNumber: number) => void;
  onSyncAllTeams: () => void;
  isSyncingTeams: boolean;
}) {
  const [viewMode, setViewMode] = useState<TeamsViewMode>("all");
  const [sortMetric, setSortMetric] = useState<SortMetric>("tot");

  // Build match stats for each team from matches
  const teamStatsMap = useMemo(() => {
    const map = new Map<
      number,
      { matchCount: number; wins: number; losses: number }
    >();

    matches.forEach((match) => {
      const redTeams = match.teams.filter((t) => t.alliance === "Red");
      const blueTeams = match.teams.filter((t) => t.alliance === "Blue");

      const redScore = match.scores?.red?.totalPoints ?? 0;
      const blueScore = match.scores?.blue?.totalPoints ?? 0;
      const redWon = match.hasBeenPlayed && redScore > blueScore;
      const blueWon = match.hasBeenPlayed && blueScore > redScore;

      redTeams.forEach((t) => {
        const existing = map.get(t.teamNumber) ?? {
          matchCount: 0,
          wins: 0,
          losses: 0,
        };
        existing.matchCount++;
        if (redWon) existing.wins++;
        if (blueWon) existing.losses++;
        map.set(t.teamNumber, existing);
      });

      blueTeams.forEach((t) => {
        const existing = map.get(t.teamNumber) ?? {
          matchCount: 0,
          wins: 0,
          losses: 0,
        };
        existing.matchCount++;
        if (blueWon) existing.wins++;
        if (redWon) existing.losses++;
        map.set(t.teamNumber, existing);
      });
    });

    return map;
  }, [matches]);

  // Separate synced and unsynced teams
  const { syncedTeams, unsyncedTeams } = useMemo(() => {
    const synced: TeamEventData[] = [];
    const unsynced: TeamEventData[] = [];
    teams.forEach((team) => {
      if (team.teamData) {
        synced.push(team);
      } else {
        unsynced.push(team);
      }
    });
    return { syncedTeams: synced, unsyncedTeams: unsynced };
  }, [teams]);

  // Teams sorted by selected metric (only synced teams with quickStats)
  const teamsByOpr = useMemo(() => {
    return [...syncedTeams]
      .filter((t) => t.teamData?.quickStats?.tot?.value !== undefined)
      .sort((a, b) => {
        const aValue = a.teamData?.quickStats?.[sortMetric]?.value ?? 0;
        const bValue = b.teamData?.quickStats?.[sortMetric]?.value ?? 0;
        return bValue - aValue; // Descending order
      });
  }, [syncedTeams, sortMetric]);

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No teams available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("all")}
          >
            <Users className="h-4 w-4 mr-2" />
            All Teams ({teams.length})
          </Button>
          <Button
            variant={viewMode === "opr" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("opr")}
            disabled={teamsByOpr.length === 0}
          >
            <Trophy className="h-4 w-4 mr-2" />
            OPR Ranking ({teamsByOpr.length})
          </Button>
        </div>
        {unsyncedTeams.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSyncAllTeams}
            disabled={isSyncingTeams}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isSyncingTeams && "animate-spin")}
            />
            {isSyncingTeams
              ? "Syncing..."
              : `Sync ${unsyncedTeams.length} Unsynced Teams`}
          </Button>
        )}
      </div>

      {/* All Teams View */}
      {viewMode === "all" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teams.map((team) => {
            const stats = teamStatsMap.get(team.teamNumber) ?? {
              matchCount: 0,
              wins: 0,
              losses: 0,
            };
            const isSynced = !!team.teamData;
            return (
              <Card
                key={team.teamNumber}
                className={cn(
                  "hover:shadow-md transition-shadow cursor-pointer",
                  !isSynced && "border-dashed"
                )}
                onClick={() => onTeamClick(team.teamNumber)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Team {team.teamNumber}</h3>
                        {!isSynced && (
                          <Badge variant="outline" className="text-xs">
                            Unsynced
                          </Badge>
                        )}
                      </div>
                      {(team.teamName || team.teamData?.name) && (
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {team.teamName || team.teamData?.name}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {stats.matchCount} matches
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">
                        {stats.wins}W
                      </p>
                      <p className="text-sm font-medium text-red-600">
                        {stats.losses}L
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* OPR Ranking View */}
      {viewMode === "opr" && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-lg">Rankings</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select
                  value={sortMetric}
                  onValueChange={(value) => setSortMetric(value as SortMetric)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tot">Total OPR</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="dc">TeleOp</SelectItem>
                    <SelectItem value="eg">Endgame</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">OPR</TableHead>
                    <TableHead className="text-right">Auto</TableHead>
                    <TableHead className="text-right">TeleOp</TableHead>
                    <TableHead className="text-right">Endgame</TableHead>
                    <TableHead className="text-right">W-L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamsByOpr.map((team, index) => {
                    const stats = teamStatsMap.get(team.teamNumber) ?? {
                      matchCount: 0,
                      wins: 0,
                      losses: 0,
                    };
                    const qs = team.teamData?.quickStats;
                    return (
                      <TableRow
                        key={team.teamNumber}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => onTeamClick(team.teamNumber)}
                      >
                        <TableCell className="font-medium">
                          #{index + 1}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-semibold">
                              {team.teamNumber}
                            </span>
                            {(team.teamName || team.teamData?.name) && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {team.teamName || team.teamData?.name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {qs?.tot?.value?.toFixed(1) ?? "-"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {qs?.auto?.value?.toFixed(1) ?? "-"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {qs?.dc?.value?.toFixed(1) ?? "-"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {qs?.eg?.value?.toFixed(1) ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-600">{stats.wins}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="text-red-600">{stats.losses}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AwardCard({ award }: { award: AwardFields }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-3">
          <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{getAwardTypeLabel(award.type)}</h3>
            {award.placement > 0 && (
              <Badge variant="outline">#{award.placement}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Team {award.teamNumber}
            {award.personName && ` • ${award.personName}`}
          </p>
          {award.divisionName && (
            <p className="text-xs text-muted-foreground">{award.divisionName}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AwardsTab({ awards }: { awards: AwardFields[] }) {
  const sortedAwards = [...awards].sort((a, b) => {
    const typeOrder: AwardType[] = [
      "Winner",
      "Finalist",
      "Inspire",
      "Think",
      "Connect",
      "Innovate",
      "Design",
      "Motivate",
      "Control",
      "Promote",
      "Compass",
    ];
    const aOrder = typeOrder.indexOf(a.type);
    const bOrder = typeOrder.indexOf(b.type);
    if (aOrder !== bOrder) {
      if (aOrder === -1) return 1;
      if (bOrder === -1) return -1;
      return aOrder - bOrder;
    }
    return a.placement - b.placement;
  });

  if (awards.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No awards announced yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {sortedAwards.map((award, idx) => (
        <AwardCard
          key={`${award.type}-${award.teamNumber}-${idx}`}
          award={award}
        />
      ))}
    </div>
  );
}

function DetailsTab({ event }: { event: EventCoreFragment }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-semibold">Location</h3>
            <Separator />
            <div className="space-y-1 text-sm">
              {event.location.venue && (
                <p>
                  <span className="text-muted-foreground">Venue:</span>{" "}
                  {event.location.venue}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">City:</span>{" "}
                {event.location.city}
              </p>
              <p>
                <span className="text-muted-foreground">State:</span>{" "}
                {event.location.state}
              </p>
              <p>
                <span className="text-muted-foreground">Country:</span>{" "}
                {event.location.country}
              </p>
              {event.address && (
                <p>
                  <span className="text-muted-foreground">Address:</span>{" "}
                  {event.address}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Event Information</h3>
            <Separator />
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Event Code:</span>{" "}
                {event.code}
              </p>
              <p>
                <span className="text-muted-foreground">Season:</span>{" "}
                {event.season}
              </p>
              <p>
                <span className="text-muted-foreground">Timezone:</span>{" "}
                {event.timezone}
              </p>
              <p>
                <span className="text-muted-foreground">Field Count:</span>{" "}
                {event.fieldCount}
              </p>
              {event.regionCode && (
                <p>
                  <span className="text-muted-foreground">Region:</span>{" "}
                  {event.regionCode}
                </p>
              )}
              {event.leagueCode && (
                <p>
                  <span className="text-muted-foreground">League:</span>{" "}
                  {event.leagueCode}
                </p>
              )}
              {event.districtCode && (
                <p>
                  <span className="text-muted-foreground">District:</span>{" "}
                  {event.districtCode}
                </p>
              )}
            </div>
          </div>
        </div>

        {event.webcasts && event.webcasts.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Webcasts</h3>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {event.webcasts.map((url, idx) => (
                <Button key={idx} variant="outline" size="sm" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <Video className="h-3 w-3 mr-1" />
                    Stream {idx + 1}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

function EventDetailPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);
  const [isSyncingTeams, setIsSyncingTeams] = useState(false);

  // Fetch event data from Convex
  const eventData = useQuery(api.integrations.ftcScout.getEvent, {
    eventCode: code,
  });

  // Sync actions
  const syncEventData = useAction(
    api.integrations.ftcScoutActions.syncEventData
  );
  const syncTeamData = useAction(
    api.integrations.ftcScoutActions.syncFtcScoutData
  );

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await syncEventData({ eventCode: code });
      if (!result.success) {
        setSyncError(result.message);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }, [syncEventData, code]);

  // Auto-sync when event not found in database
  useEffect(() => {
    if (eventData === null && !autoSyncAttempted && !isSyncing) {
      setAutoSyncAttempted(true);
      handleSync();
    }
  }, [eventData, autoSyncAttempted, isSyncing, handleSync]);

  const handleTeamClick = (teamNumber: number) => {
    navigate({
      to: "/scouting/team/$number",
      params: { number: teamNumber.toString() },
    });
  };

  // Sync all unsynced teams
  const handleSyncAllTeams = useCallback(async () => {
    if (!eventData?.teams) return;
    
    const unsyncedTeams = eventData.teams.filter((t) => !t.teamData);
    if (unsyncedTeams.length === 0) return;

    setIsSyncingTeams(true);
    try {
      // Sync all teams in parallel
      await Promise.all(
        unsyncedTeams.map((team) =>
          syncTeamData({ teamNumber: team.teamNumber })
        )
      );
    } catch (error) {
      console.error("Error syncing teams:", error);
    } finally {
      setIsSyncingTeams(false);
    }
  }, [eventData?.teams, syncTeamData]);

  // Loading state
  if (eventData === undefined || (eventData === null && !autoSyncAttempted)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Syncing state - fetching from FTC Scout API
  if (isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <RefreshCw className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold mb-2">Fetching Event Data</h2>
        <p className="text-muted-foreground">
          Event &quot;{code}&quot; not found in database. Fetching from FTC
          Scout...
        </p>
      </div>
    );
  }

  // Not found state (after sync attempt failed)
  if (eventData === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Event Not Found</h2>
        <p className="text-muted-foreground mb-4 text-center max-w-md">
          {syncError ||
            `The event "${code}" could not be found in the database or FTC Scout. Please check the event code and try again.`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/events">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Link>
          </Button>
          <Button onClick={handleSync}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Parse the event data
  const event = eventData.data as EventCoreFragment;
  const matches = eventData.matches.map((m: { id: string; data: unknown }) => m.data as MatchCoreFragment);
  const awards = eventData.awards.map((a: { id: string; data: unknown }) => a.data as AwardFields);
  const teams = eventData.teams as TeamEventData[];

  return (
    <div className="space-y-6">
      <EventHeader event={event} />

      <Tabs defaultValue="matches" className="w-full">
        <div className="flex items-center justify-between gap-4">
          <TabsList>
          <TabsTrigger value="matches" className="gap-2">
            <Users className="h-4 w-4" />
            Matches ({matches.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="h-4 w-4" />
            Teams ({teams.length})
          </TabsTrigger>
          <TabsTrigger value="awards" className="gap-2">
            <Trophy className="h-4 w-4" />
            Awards ({awards.length})
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-2">
            <Calendar className="h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")}
            />
            {isSyncing ? "Syncing..." : "Reload"}
          </Button>
        </div>

        <TabsContent value="matches" className="mt-4">
          <MatchesTab matches={matches} onTeamClick={handleTeamClick} />
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <TeamsTab
            teams={teams}
            matches={matches}
            onTeamClick={handleTeamClick}
            onSyncAllTeams={handleSyncAllTeams}
            isSyncingTeams={isSyncingTeams}
          />
        </TabsContent>

        <TabsContent value="awards" className="mt-4">
          <AwardsTab awards={awards} />
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <DetailsTab event={event} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
