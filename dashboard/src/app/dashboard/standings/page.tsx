import StandingsClient from "@/app/dashboard/standings/StandingsClient";
import { env } from "@/env";
import type { ScheduleRoundLite, StandingsResponse } from "@/types/standings.type";

async function getStandings(): Promise<StandingsResponse | null> {
	try {
		const response = await fetch(`${env.API_URL}/api/standings`, {
			cache: "no-store",
		});
		if (!response.ok) return null;
		return response.json();
	} catch {
		return null;
	}
}

async function getSchedule(): Promise<ScheduleRoundLite[]> {
	try {
		const response = await fetch(`${env.API_URL}/api/schedule`, {
			cache: "no-store",
		});
		if (!response.ok) return [];
		const rounds = (await response.json()) as Array<{ name: string; start: string }>;
		return rounds.map((round) => ({ name: round.name, start: round.start }));
	} catch {
		return [];
	}
}

export default async function StandingsPage() {
	const [data, rounds] = await Promise.all([getStandings(), getSchedule()]);

	if (!data) {
		return (
			<div className="flex h-full w-full flex-col items-center justify-center gap-2">
				<p>Standings unavailable</p>
				<p className="text-sm text-zinc-500">Failed to fetch data source</p>
			</div>
		);
	}

	return <StandingsClient data={data} rounds={rounds} />;
}
