"use client";

import { utc, duration } from "moment";

import { useDataStore } from "@/stores/useDataStore";
import { useReplayStore } from "@/stores/useReplayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useRaceWeekOverride } from "@/hooks/useRaceWeekOverride";

import Flag from "@/components/Flag";

const sessionPartPrefix = (name: string) => {
	switch (name) {
		case "Sprint Qualifying":
			return "SQ";
		case "Qualifying":
			return "Q";
		default:
			return "";
	}
};

export default function SessionInfo() {
	const clock = useDataStore((state) => state.state?.ExtrapolatedClock);
	const session = useDataStore((state) => state.state?.SessionInfo);
	const timingData = useDataStore((state) => state.state?.TimingData);
	const mode = useReplayStore((state) => state.mode);
	const raceWeekOverride = useRaceWeekOverride();

	const delay = useSettingsStore((state) => state.delay);
	const hasLiveFeedSession = Boolean(clock || timingData || (session && session.Type !== "RaceWeekendOverride" && session.Key !== 0));
	const overrideActive = mode === "live" && !hasLiveFeedSession && Boolean(raceWeekOverride?.active);
	const overrideCountdown =
		overrideActive && raceWeekOverride
			? raceWeekOverride.nextSessionInLabel
			: null;

	const displayMeetingName = overrideActive && raceWeekOverride ? raceWeekOverride.meetingName : session?.Meeting.Name;
	const displaySessionName = overrideActive && raceWeekOverride ? raceWeekOverride.sessionName : session?.Name;
	const displayCountryCode = overrideActive && raceWeekOverride ? raceWeekOverride.countryCode : session?.Meeting.Country.Code;

	const timeRemaining =
		overrideCountdown !== null
			? overrideCountdown
			: !!clock && !!clock.Remaining
			? clock.Extrapolating
				? utc(
						duration(clock.Remaining)
							.subtract(utc().diff(utc(clock.Utc)))
							.asMilliseconds() + (delay ? delay * 1000 : 0),
					).format("HH:mm:ss")
				: clock.Remaining
			: undefined;

	return (
		<div className="flex items-center gap-2">
			<Flag countryCode={displayCountryCode} />

			<div className="flex flex-col justify-center">
				{displayMeetingName ? (
					<h1 className="truncate text-sm leading-none font-medium text-white">
						{displayMeetingName}: {displaySessionName ?? "Unknown"}
						{!overrideActive && timingData?.SessionPart && session?.Name ? ` ${sessionPartPrefix(session.Name)}${timingData.SessionPart}` : ""}
					</h1>
				) : (
					<div className="h-4 w-[250px] animate-pulse rounded-md bg-zinc-800" />
				)}

					{mode === "replay" ? (
						<p className="text-2xl leading-none font-extrabold text-amber-300">WATCHING REPLAY</p>
					) : timeRemaining !== undefined ? (
						<p className="text-2xl leading-none font-extrabold">{overrideActive ? `Next session in ${timeRemaining}` : timeRemaining}</p>
					) : (
						<div className="mt-1 h-6 w-[150px] animate-pulse rounded-md bg-zinc-800 font-semibold" />
					)}
				</div>
			</div>
	);
}
