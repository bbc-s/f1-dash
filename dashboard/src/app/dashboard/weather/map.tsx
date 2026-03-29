"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchCoords } from "@/lib/geocode";
import { useDataStore } from "@/stores/useDataStore";

export function WeatherMap() {
	const meeting = useDataStore((state) => state.state?.SessionInfo?.Meeting);
	const [coords, setCoords] = useState<{ lat: string; lon: string } | null>(null);

	useEffect(() => {
		let cancelled = false;
		const resolve = async () => {
			if (!meeting) return;
			const country = meeting.Country?.Name ?? "";
			const location = meeting.Location ?? "";
			const candidate = `${country}, ${location} circuit`;
			const alt = `${country}, ${location} autodrome`;
			const found = (await fetchCoords(candidate)) ?? (await fetchCoords(alt));
			if (!cancelled && found) {
				setCoords({ lat: String(found.lat), lon: String(found.lon) });
			}
		};
		void resolve();
		return () => {
			cancelled = true;
		};
	}, [meeting]);

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

			<div className="absolute top-2 left-2 z-20 rounded bg-black/70 px-2 py-1 text-xs text-zinc-300">
				Numerical weather: F1 live feed | Radar/map: Windy.com
			</div>
		</div>
	);
}
