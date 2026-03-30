"use client";

import { WeatherMap } from "@/app/dashboard/weather/map";

export default function WeatherRadarWidget() {
	return (
		<div className="flex h-full w-full flex-col gap-2">
			<div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-xs text-zinc-400">
				<span>Live weather source: F1 feed (numerical)</span>
				<span>Numerical weather: F1 feed | Radar: Windy</span>
			</div>
			<div className="relative min-h-[240px] flex-1">
				<WeatherMap />
			</div>
		</div>
	);
}
