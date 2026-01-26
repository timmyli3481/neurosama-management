import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  Calendar,
  MapPin,
  ExternalLink,
  Search,
  CheckCircle2,
  Play,
  Clock,
  Circle,
  AlertCircle,
} from "lucide-react";
import { useTimezone } from "@/context/TimezoneContext";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_dashboard/events/")({
  component: EventsPage,
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

// ==========================================
// TYPE DEFINITIONS (mapped from GraphQL fragments)
// ==========================================

type LocationFields = {
  venue: string | null;
  city: string;
  state: string;
  country: string;
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

function EventCard({
  event,
  eventCode,
  startTimestamp,
  endTimestamp,
}: {
  event: EventCoreFragment;
  eventCode: string;
  startTimestamp: number;
  endTimestamp: number;
}) {
  const { formatDate, timezone } = useTimezone();

  // Check if same day in the selected timezone
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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getEventTypeBadgeVariant(event.type)}>
                {getEventTypeLabel(event.type)}
              </Badge>
              <EventStatusBadge event={event} />
            </div>
            <CardTitle className="text-lg truncate">{event.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {eventCode} • Season {event.season}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Date */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
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
          </span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{formatLocation(event.location)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button asChild className="flex-1">
            <Link to="/events/$code" params={{ code: eventCode }}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Details
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

function EventsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch current team's events
  const teamEventsData = useQuery(api.integrations.ftcScout.getCurrentTeamEvents, {});

  // Get unique seasons for filter
  const seasons = useMemo(() => {
    if (!teamEventsData?.events) return [];
    const uniqueSeasons = [...new Set(teamEventsData.events.map((e) => e.season))];
    return uniqueSeasons.sort((a, b) => b - a);
  }, [teamEventsData]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!teamEventsData?.events) return [];

    return teamEventsData.events.filter((eventData) => {
      const event = eventData.data as EventCoreFragment;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.name.toLowerCase().includes(query) ||
          eventData.eventCode.toLowerCase().includes(query) ||
          event.location.city.toLowerCase().includes(query) ||
          event.location.state.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Season filter
      if (seasonFilter !== "all" && eventData.season !== parseInt(seasonFilter)) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "upcoming" && (event.started || event.finished))
          return false;
        if (statusFilter === "ongoing" && !event.ongoing) return false;
        if (statusFilter === "completed" && !event.finished) return false;
      }

      return true;
    });
  }, [teamEventsData, searchQuery, seasonFilter, statusFilter]);

  // Sort events by start date (most recent first)
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => b.startDate - a.startDate);
  }, [filteredEvents]);

  // No team configured state
  if (teamEventsData === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Trophy className="h-8 w-8" />
              Team Events
            </h1>
            <p className="text-muted-foreground">
              View your team's FTC events and competitions
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Team Not Configured</h2>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              No FTC team has been configured yet. Please configure your team number in the admin settings to see your team's events.
            </p>
            <Button asChild>
              <Link to="/admin">Go to Admin Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-8 w-8" />
            Team Events
          </h1>
          <p className="text-muted-foreground">
            {teamEventsData ? (
              <>
                Events for Team {teamEventsData.teamNumber}
                {teamEventsData.teamName && ` - ${teamEventsData.teamName}`}
              </>
            ) : (
              "View your team's FTC events and competitions"
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Season Filter */}
            <Select value={seasonFilter} onValueChange={setSeasonFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                {seasons.map((season) => (
                  <SelectItem key={season} value={season.toString()}>
                    {season}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="ongoing">Live</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events Grid */}
      {teamEventsData === undefined ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold mb-2">No events found</h2>
            <p className="text-muted-foreground text-center max-w-md">
              {teamEventsData.events.length === 0
                ? "No events have been synced yet. Events will appear here once your team data is synced from FTC Scout."
                : "No events match your current filters. Try adjusting your search or filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing {sortedEvents.length} event
            {sortedEvents.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedEvents.map((eventData) => (
              <EventCard
                key={eventData.id}
                event={eventData.data as EventCoreFragment}
                eventCode={eventData.eventCode}
                startTimestamp={eventData.startDate}
                endTimestamp={eventData.endDate}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
