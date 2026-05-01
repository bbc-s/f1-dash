"use client";

import { useEffect, useState } from "react";

import type { Round } from "@/types/schedule.type";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const countryCodeByName: Record<string, string> = {
	Australia: "AUS",
	China: "CHN",
	Japan: "JPN",
	Bahrain: "BHR",
	"Saudi Arabia": "SAU",
	USA: "USA",
	Italy: "ITA",
	Monaco: "MCO",
	Canada: "CAN",
	Spain: "ESP",
	Austria: "AUT",
	UK: "GBR",
	Belgium: "BEL",
	Hungary: "HUN",
	Netherlands: "NLD",
	Azerbaijan: "AZE",
	Singapore: "SGP",
	Mexico: "MEX",
	Brazil: "BRA",
	Qatar: "QAT",
	"United Arab Emirates": "ARE",
};

export type RaceWeekOverride = {
	active: boolean;
	meetingName: string;
	countryName: string;
	countryCode?: string;
	sessionName: string;
	nextSessionStartUtc: string;
	nextSessionInLabel: string;
};

function formatDuration(ms: number) {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const days = Math.floor(totalSec / 86400);
	const hours = Math.floor((totalSec % 86400) / 3600);
	const minutes = Math.floor((totalSec % 3600) / 60);
	const seconds = totalSec % 60;
	if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toOverride(round: Round | null): RaceWeekOverride | null {
	if (!round) return null;
	const now = Date.now();
	const nextSession = [...(round.sessions ?? [])]
		.filter((item) => Number.isFinite(Date.parse(item.start)))
		.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
		.find((item) => Date.parse(item.start) > now);
	if (!nextSession) return null;
	const msToNext = Date.parse(nextSession.start) - now;
	const active = msToNext > 0 && msToNext <= SEVEN_DAYS_MS;
	return {
		active,
		meetingName: round.name,
		countryName: round.countryName,
		countryCode: countryCodeByName[round.countryName],
		sessionName: nextSession.kind,
		nextSessionStartUtc: nextSession.start,
		nextSessionInLabel: formatDuration(msToNext),
	};
}

export function useRaceWeekOverride() {
	const [round, setRound] = useState<Round | null>(null);
	const [override, setOverride] = useState<RaceWeekOverride | null>(null);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const response = await fetch("/api/schedule-next", { cache: "no-store" });
				if (!response.ok) return;
				const payload = (await response.json()) as Round;
				if (cancelled) return;
				setRound(payload);
				setOverride(toOverride(payload));
			} catch {
				// ignore
			}
		};
		void load();
		const reloadTimer = window.setInterval(load, 15 * 60 * 1000);
		const tickTimer = window.setInterval(() => setOverride(toOverride(round)), 1000);
		return () => {
			cancelled = true;
			window.clearInterval(reloadTimer);
			window.clearInterval(tickTimer);
		};
	}, [round]);

	return override;
}
