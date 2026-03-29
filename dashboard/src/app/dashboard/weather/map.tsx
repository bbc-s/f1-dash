"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchCoords } from "@/lib/geocode";
import { useDataStore } from "@/stores/useDataStore";

type RaceOption = {
	name: string;
	country: string;
};

type JolpicaRace = {
	raceName: string;
	Circuit: {
		Location: {
			country: string;
		};
	};
};

type JolpicaResponse = {
	MRData: {
		RaceTable: {
			Races: JolpicaRace[];
		};
	};
};

async function loadRaceOptions(): Promise<RaceOption[]> {
	try {
		const response = await fetch("https://api.jolpi.ca/ergast/f1/current.json?limit=100", { cache: "no-store" });
		if (!response.ok) return [];
		const payload = (await response.json()) as JolpicaResponse;
		return (payload.MRData?.RaceTable?.Races ?? []).map((race) => ({
			name: race.raceName,
			country: race.Circuit?.Location?.country ?? "",
		}));
	} catch {
		return [];
	}
}

export function WeatherMap() {
	const meeting = useDataStore((state) => state.state?.SessionInfo?.Meeting);
	const [coords, setCoords] = useState<{ lat: string; lon: string } | null>(null);
	const [races, setRaces] = useState<RaceOption[]>([]);
	const [selectedRace, setSelectedRace] = useState("");

	const currentRaceLabel = useMemo(() => {
		const meetingName = meeting?.Name?.trim();
		const country = meeting?.Country?.Name?.trim();
		return meetingName && country ? `${meetingName} (${country})` : "";
	}, [meeting]);
	const meetingName = useMemo(() => meeting?.Name?.trim().toLowerCase() ?? "", [meeting]);
	const meetingCountry = useMemo(() => meeting?.Country?.Name?.trim().toLowerCase() ?? "", [meeting]);

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			const options = await loadRaceOptions();
			if (cancelled) return;
			setRaces(options);
			if (options.length === 0) return;

			const preferred =
				options.find((option) => {
					const name = option.name.toLowerCase();
					const country = option.country.toLowerCase();
					return (
						(meetingName !== "" && (name.includes(meetingName) || meetingName.includes(name))) ||
						(meetingCountry !== "" && country === meetingCountry)
					);
				}) ?? options[0];
			setSelectedRace(preferred.name);
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [currentRaceLabel, meetingName, meetingCountry]);

	useEffect(() => {
		let cancelled = false;
		const resolve = async () => {
			const race = races.find((item) => item.name === selectedRace);
			if (!race) return;
			const query = `${race.name}, ${race.country} circuit`;
			const fallback = `${race.country} ${race.name} track`;
			const found = (await fetchCoords(query)) ?? (await fetchCoords(fallback));
			if (!cancelled && found) {
				setCoords({ lat: String(found.lat), lon: String(found.lon) });
			}
		};
		void resolve();
		return () => {
			cancelled = true;
		};
	}, [selectedRace, races]);

	const lat = coords?.lat ?? "51.5074";
	const lon = coords?.lon ?? "-0.1278";

	const windyUrl = useMemo(() => {
		const zoom = 7;
		return `https://embed.windy.com/embed2.html?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=${zoom}&level=surface&overlay=rain&menu=&message=&marker=true&calendar=now`;
	}, [lat, lon]);

	return (
		<div className="relative h-full w-full">
			<iframe
				title="Windy Radar"
				src={windyUrl}
				className="absolute inset-0 h-full w-full rounded-lg border border-zinc-800"
				loading="lazy"
			/>

			<div className="absolute top-2 left-2 z-20 flex items-center gap-2 rounded bg-black/70 px-2 py-1 text-xs text-zinc-300">
				<span>Race:</span>
				<select
					className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs"
					value={selectedRace}
					onChange={(e) => setSelectedRace(e.target.value)}
				>
					{races.map((race) => (
						<option key={race.name} value={race.name}>
							{race.name}
						</option>
					))}
				</select>
			</div>

			<div className="absolute top-2 right-2 z-20 rounded bg-black/70 px-2 py-1 text-xs text-zinc-300">
				Numerical weather: F1 feed | Radar: Windy
			</div>
		</div>
	);
}
