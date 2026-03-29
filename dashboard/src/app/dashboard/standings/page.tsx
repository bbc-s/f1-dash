import StandingsClient from "@/app/dashboard/standings/StandingsClient";
import { env } from "@/env";
import type { StandingsResponse } from "@/types/standings.type";

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

export default async function StandingsPage() {
	const data = await getStandings();

	if (!data) {
		return (
			<div className="flex h-full w-full flex-col items-center justify-center gap-2">
				<p>Standings unavailable</p>
				<p className="text-sm text-zinc-500">Failed to fetch data source</p>
			</div>
		);
	}

	return <StandingsClient data={data} />;
}
