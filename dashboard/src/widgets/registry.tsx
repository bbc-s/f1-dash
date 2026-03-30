import type { ReactNode } from "react";

import LeaderBoard from "@/components/dashboard/LeaderBoard";
import Map from "@/components/dashboard/Map";
import RaceControl from "@/components/dashboard/RaceControl";
import TeamRadios from "@/components/dashboard/TeamRadios";
import TelemetryLarge from "@/components/dashboard/TelemetryLarge";
import TrackViolations from "@/components/dashboard/TrackViolations";
import TyreAvailability from "@/components/dashboard/TyreAvailability";
import WeatherRadarWidget from "@/components/dashboard/WeatherRadarWidget";
import type { WidgetId } from "@/stores/useWidgetLayoutStore";

type WidgetDefinition = {
	title: string;
	component: () => ReactNode;
};

export const widgetRegistry: Record<WidgetId, WidgetDefinition> = {
	leaderboard: {
		title: "Leaderboard",
		component: () => <LeaderBoard />,
	},
	map: {
		title: "Track Map",
		component: () => <Map />,
	},
	telemetry: {
		title: "Telemetry (Large)",
		component: () => <TelemetryLarge />,
	},
	"race-control": {
		title: "Race Control",
		component: () => <RaceControl />,
	},
	"team-radios": {
		title: "Team Radios",
		component: () => <TeamRadios />,
	},
	"track-violations": {
		title: "Track Violations",
		component: () => <TrackViolations />,
	},
	tyres: {
		title: "Tyre Sets",
		component: () => <TyreAvailability />,
	},
	"weather-radar": {
		title: "Weather Radar",
		component: () => <WeatherRadarWidget />,
	},
};
