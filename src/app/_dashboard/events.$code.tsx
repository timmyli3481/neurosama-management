import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimezone } from "@/context/TimezoneContext";

// ==========================================
// TYPE DEFINITIONS (mapped from GraphQL fragments)
// ==========================================

// LocationFieldsFragment
type LocationFields = {
  venue: string | null;
  city: string;
  state: string;
  country: string;
};

// EventCoreFragmentFragment
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
  start: string; // Date
  end: string; // Date
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

// TeamMatchParticipationCoreFragment
type TeamMatchParticipationCore = {
  season: number;
  eventCode: string;
  matchId: number;
  alliance: Alliance;
  allianceRole: AllianceRole;
  station: Station;
  teamNumber: number;
};

// MatchScores2025AllianceFieldsFragment (simplified)
type MatchScores2025Alliance = {
  alliance: Alliance;
  totalPoints: number;
  totalPointsNp: number;
  autoPoints: number;
  dcPoints: number;
  penaltyPointsByOpp: number;
};

// MatchCoreFragmentFragment
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

// AwardFieldsFragment
type AwardFields = {
  teamNumber: number;
  type: AwardType;
  personName: string | null;
  placement: number;
  divisionName: string | null;
};

// Enums
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
  
export const Route = createFileRoute("/_dashboard/events/$code")({
  component: EventDetailPage,
});

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

// Event Status Badge
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

// Event Header Component
function EventHeader({ event }: { event: EventCoreFragment }) {
  const { formatDate } = useTimezone();

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const isSameDay = event.start === event.end;

  return (
    <div className="space-y-4">
      {/* Back button and title */}
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

      {/* Event info cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Date Card */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium">
                {isSameDay
                  ? formatDate(startDate.getTime(), {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : `${formatDate(startDate.getTime(), {
                      month: "short",
                      day: "numeric",
                    })} - ${formatDate(endDate.getTime(), {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Location Card */}
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

        {/* Field Count Card */}
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

        {/* Links Card */}
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

// Match Row Component
function MatchRow({ match }: { match: MatchCoreFragment }) {
  const { formatDate } = useTimezone();

  const redTeams = match.teams.filter((t) => t.alliance === "Red");
  const blueTeams = match.teams.filter((t) => t.alliance === "Blue");

  const redScore = match.scores?.red?.totalPoints;
  const blueScore = match.scores?.blue?.totalPoints;

  const redWon =
    redScore !== undefined &&
    blueScore !== undefined &&
    redScore > blueScore;
  const blueWon =
    redScore !== undefined &&
    blueScore !== undefined &&
    blueScore > redScore;

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
              {redTeams.map((t) => t.teamNumber).join(" / ")}
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
              {blueTeams.map((t) => t.teamNumber).join(" / ")}
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

// Matches Tab Component
function MatchesTab({ matches }: { matches: MatchCoreFragment[] }) {
  // Group matches by tournament level
  const groupedMatches = matches.reduce(
    (acc, match) => {
      const level = match.tournamentLevel;
      if (!acc[level]) acc[level] = [];
      acc[level].push(match);
      return acc;
    },
    {} as Record<TournamentLevel, MatchCoreFragment[]>
  );

  // Sort matches within each group
  Object.values(groupedMatches).forEach((group) => {
    group.sort((a, b) => {
      if (a.series !== b.series) return a.series - b.series;
      return a.matchNum - b.matchNum;
    });
  });

  // Order of tournament levels
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
                      <MatchRow key={match.id} match={match} />
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

// Award Card Component
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
            <p className="text-xs text-muted-foreground">
              {award.divisionName}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Awards Tab Component
function AwardsTab({ awards }: { awards: AwardFields[] }) {
  // Group awards by type
  const sortedAwards = [...awards].sort((a, b) => {
    // Winner/Finalist first, then by placement
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
        <AwardCard key={`${award.type}-${award.teamNumber}-${idx}`} award={award} />
      ))}
    </div>
  );
}

// Event Details Tab Component
function DetailsTab({ event }: { event: EventCoreFragment }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Location Details */}
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

          {/* Event Info */}
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

        {/* Webcasts */}
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

  // Fetch event data from Convex
  const eventData = useQuery(api.integrations.ftcScout.getEvent, {
    eventCode: code,
  });

  // Loading state
  if (eventData === undefined) {
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

  // Not found state
  if (eventData === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold">Event not found</h2>
        <p className="text-muted-foreground mb-4">
          The event &quot;{code}&quot; doesn&apos;t exist or hasn&apos;t been synced yet.
        </p>
        <Button asChild>
          <Link to="/calendar">Back to Calendar</Link>
        </Button>
      </div>
    );
  }

  // Parse the event data from Convex (stored as `data: v.any()`)
  const event = eventData.data as EventCoreFragment;
  const matches = eventData.matches.map((m) => m.data as MatchCoreFragment);
  const awards = eventData.awards.map((a) => a.data as AwardFields);

  return (
    <div className="space-y-6">
      {/* Event Header */}
      <EventHeader event={event} />

      {/* Tabs for Matches, Awards, Details */}
      <Tabs defaultValue="matches" className="w-full">
        <TabsList>
          <TabsTrigger value="matches" className="gap-2">
            <Users className="h-4 w-4" />
            Matches ({matches.length})
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

        <TabsContent value="matches" className="mt-4">
          <MatchesTab matches={matches} />
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
