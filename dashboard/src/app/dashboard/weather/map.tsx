"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchCoords } from "@/lib/geocode";
import { useRaceWeekOverride } from "@/hooks/useRaceWeekOverride";
import { useDataStore } from "@/stores/useDataStore";

type RaceOption = {
	name: string;
	country: string;
	date?: string;
};
type Coords = { lat: string; lon: string };
type ForecastDay = {
	label: string;
	date: string;
	tempMax: number | null;
	tempMin: number | null;
	rainChance: number | null;
	rainMm: number | null;
	windMax: number | null;
};
const WEATHER_RACE_KEY = "weather-radar-selected-race-v1";

const raceCoords: Record<string, Coords> = {
	"Australian Grand Prix": { lat: "-37.8497", lon: "144.968" },
	"Chinese Grand Prix": { lat: "31.3389", lon: "121.2197" },
	"Japanese Grand Prix": { lat: "34.8431", lon: "136.541" },
	"Bahrain Grand Prix": { lat: "26.0325", lon: "50.5106" },
	"Saudi Arabian Grand Prix": { lat: "21.6319", lon: "39.1044" },
	"Miami Grand Prix": { lat: "25.9581", lon: "-80.2389" },
	"Emilia Romagna Grand Prix": { lat: "44.3439", lon: "11.7167" },
	"Monaco Grand Prix": { lat: "43.7347", lon: "7.4206" },
	"Canadian Grand Prix": { lat: "45.5017", lon: "-73.5228" },
	"Spanish Grand Prix": { lat: "41.57", lon: "2.2611" },
	"Austrian Grand Prix": { lat: "47.2197", lon: "14.7647" },
	"British Grand Prix": { lat: "52.0786", lon: "-1.0169" },
	"Belgian Grand Prix": { lat: "50.4372", lon: "5.9714" },
	"Hungarian Grand Prix": { lat: "47.5789", lon: "19.2486" },
	"Dutch Grand Prix": { lat: "52.3888", lon: "4.5409" },
	"Italian Grand Prix": { lat: "45.6156", lon: "9.2811" },
	"Azerbaijan Grand Prix": { lat: "40.3725", lon: "49.8533" },
	"Singapore Grand Prix": { lat: "1.2914", lon: "103.864" },
	"United States Grand Prix": { lat: "30.1328", lon: "-97.6411" },
	"Mexico City Grand Prix": { lat: "19.4042", lon: "-99.0907" },
	"SĂŁo Paulo Grand Prix": { lat: "-23.7036", lon: "-46.6997" },
	"Sao Paulo Grand Prix": { lat: "-23.7036", lon: "-46.6997" },
	"Las Vegas Grand Prix": { lat: "36.1699", lon: "-115.1398" },
	"Qatar Grand Prix": { lat: "25.49", lon: "51.4542" },
	"Abu Dhabi Grand Prix": { lat: "24.4672", lon: "54.6031" },
};

type JolpicaRace = {
	raceName: string;
	date?: string;
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
			date: race.date,
		}));
	} catch {
		return [];
	}
}

function normalizeName(value?: string): string {
	return (value ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();
}

export function WeatherMap({ showForecast = true }: { showForecast?: boolean }) {
	const meeting = useDataStore((state) => state.state?.SessionInfo?.Meeting);
	const raceWeekOverride = useRaceWeekOverride();
	const [coords, setCoords] = useState<{ lat: string; lon: string } | null>(null);
	const [races, setRaces] = useState<RaceOption[]>([]);
	const [selectedRace, setSelectedRace] = useState("");
	const [forecast, setForecast] = useState<ForecastDay[]>([]);
	const overrideActive = Boolean(raceWeekOverride?.active);
	const effectiveMeeting = useMemo(
		() => (overrideActive && raceWeekOverride ? { Name: raceWeekOverride.meetingName, Country: { Name: raceWeekOverride.countryName } } : meeting),
		[overrideActive, raceWeekOverride, meeting],
	);

	const currentRaceLabel = useMemo(() => {
		const meetingName = effectiveMeeting?.Name?.trim();
		const country = effectiveMeeting?.Country?.Name?.trim();
		return meetingName && country ? `${meetingName} (${country})` : "";
	}, [effectiveMeeting]);
	const meetingName = useMemo(() => normalizeName(effectiveMeeting?.Name), [effectiveMeeting]);
	const meetingCountry = useMemo(() => normalizeName(effectiveMeeting?.Country?.Name), [effectiveMeeting]);
	const meetingCoords = useMemo(() => {
		if (!effectiveMeeting?.Name) return null;
		return raceCoords[effectiveMeeting.Name] ?? raceCoords[effectiveMeeting.Name.replaceAll("SĂO", "SĂŁo")] ?? null;
	}, [effectiveMeeting]);

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			const options = await loadRaceOptions();
			if (cancelled) return;
				setRaces(options);
				if (options.length === 0) return;
				const persisted = typeof window !== "undefined" ? localStorage.getItem(WEATHER_RACE_KEY) : null;

				const preferred =
					options.find((option) => {
						const name = normalizeName(option.name);
						const country = normalizeName(option.country);
						return (
							(meetingName !== "" && (name.includes(meetingName) || meetingName.includes(name))) ||
							(meetingCountry !== "" && country === meetingCountry)
						);
					}) ?? null;
				if (preferred) {
					setSelectedRace(preferred.name);
					return;
				}
				if (persisted && options.some((option) => option.name === persisted)) {
					setSelectedRace(persisted);
					return;
				}
				setSelectedRace(options[0].name);
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
			const exact = raceCoords[race.name];
			if (exact) {
				if (!cancelled) setCoords(exact);
				return;
			}
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

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			const race = races.find((item) => item.name === selectedRace);
			if (!race?.date) {
				if (!cancelled) setForecast([]);
				return;
			}
			const resolvedLat = coords?.lat ?? meetingCoords?.lat;
			const resolvedLon = coords?.lon ?? meetingCoords?.lon;
			if (!resolvedLat || !resolvedLon) {
				if (!cancelled) setForecast([]);
				return;
			}
			const raceDay = new Date(`${race.date}T12:00:00Z`);
			if (Number.isNaN(raceDay.getTime())) {
				if (!cancelled) setForecast([]);
				return;
			}
			const dayMs = 24 * 60 * 60 * 1000;
			const friday = new Date(raceDay.getTime() - 2 * dayMs);
			const saturday = new Date(raceDay.getTime() - dayMs);
			const sunday = raceDay;
			const days = [friday, saturday, sunday];
			const isoDays = days.map((d) => d.toISOString().slice(0, 10));
			const start = isoDays[0];
			const end = isoDays[2];
			try {
				const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(resolvedLat)}&longitude=${encodeURIComponent(
					resolvedLon,
				)}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${start}&end_date=${end}`;
				const response = await fetch(url, { cache: "no-store" });
				if (!response.ok) throw new Error("forecast request failed");
				const payload = await response.json();
				const times: string[] = payload?.daily?.time ?? [];
				const tempMax: number[] = payload?.daily?.temperature_2m_max ?? [];
				const tempMin: number[] = payload?.daily?.temperature_2m_min ?? [];
				const rainChance: number[] = payload?.daily?.precipitation_probability_max ?? [];
				const rainMm: number[] = payload?.daily?.precipitation_sum ?? [];
				const windMax: number[] = payload?.daily?.windspeed_10m_max ?? [];
				const labels = ["Friday", "Saturday", "Sunday"];
				const next = isoDays.map((iso, index) => {
					const idx = times.indexOf(iso);
					return {
						label: labels[index] ?? iso,
						date: iso,
						tempMax: idx >= 0 ? Number(tempMax[idx]) : null,
						tempMin: idx >= 0 ? Number(tempMin[idx]) : null,
						rainChance: idx >= 0 ? Number(rainChance[idx]) : null,
						rainMm: idx >= 0 ? Number(rainMm[idx]) : null,
						windMax: idx >= 0 ? Number(windMax[idx]) : null,
					} as ForecastDay;
				});
				if (!cancelled) setForecast(next);
			} catch {
				if (!cancelled) setForecast([]);
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [selectedRace, races, coords, meetingCoords]);

	useEffect(() => {
		if (!selectedRace || typeof window === "undefined") return;
		localStorage.setItem(WEATHER_RACE_KEY, selectedRace);
	}, [selectedRace]);

	const lat = coords?.lat ?? meetingCoords?.lat ?? "34.8431";
	const lon = coords?.lon ?? meetingCoords?.lon ?? "136.541";

	const windyUrl = useMemo(() => {
		const zoom = 14;
		return `https://embed.windy.com/embed2.html?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=${zoom}&level=surface&overlay=rain&menu=&message=&marker=true&calendar=now`;
	}, [lat, lon]);

	return (
		<div className="flex h-full w-full flex-col gap-2">
			{showForecast && <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
				<div className="mb-2 flex items-center justify-between">
					<div className="text-xs font-semibold text-zinc-200">Race weekend forecast (Fri/Sat/Sun)</div>
					<div className="text-[11px] text-zinc-400">Source: Open-Meteo forecast</div>
				</div>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
					{(["Friday", "Saturday", "Sunday"] as const).map((label, idx) => {
						const day = forecast[idx];
						return (
							<div key={label} className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
								<div className="text-sm font-semibold text-white">{label}</div>
								<div className="text-[11px] text-zinc-400">{day?.date ?? "n/a"}</div>
								<div className="mt-1 text-sm text-zinc-200">
									{day?.tempMin != null && day?.tempMax != null ? `${day.tempMin}°C - ${day.tempMax}°C` : "No forecast"}
								</div>
								<div className="text-xs text-zinc-400">
									Rain: {day?.rainChance != null ? `${day.rainChance}%` : "n/a"} | {day?.rainMm != null ? `${day.rainMm} mm` : "n/a"}
								</div>
								<div className="text-xs text-zinc-400">Wind max: {day?.windMax != null ? `${day.windMax} km/h` : "n/a"}</div>
							</div>
						);
					})}
				</div>
			</div>}

			<div className="relative min-h-[420px] flex-1">
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
			</div>
		</div>
	);
}


