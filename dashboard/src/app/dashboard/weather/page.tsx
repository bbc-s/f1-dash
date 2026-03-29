"use client";

import { WeatherMap } from "@/app/dashboard/weather/map";
import WeatherInfo from "@/components/WeatherInfo";

export default function WeatherPage() {
	return (
		<div className="flex h-full w-full flex-col gap-3">
			<div className="rounded-lg border border-zinc-800 p-3">
				<WeatherInfo />
			</div>
			<div className="relative min-h-[420px] flex-1">
				<WeatherMap />
			</div>
		</div>
	);
}
