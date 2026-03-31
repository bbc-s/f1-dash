"use client";

import { WeatherMap } from "@/app/dashboard/weather/map";
import { useReplayStore } from "@/stores/useReplayStore";

export default function WeatherPage() {
	const mode = useReplayStore((state) => state.mode);
	return (
		<div className="flex h-full w-full flex-col gap-3">
			{mode === "replay" ? (
				<div className="rounded-lg border border-zinc-800 p-4">
					<p className="mb-2 text-sm font-semibold text-amber-300">Replay weather mode</p>
					<p className="text-sm text-zinc-400">
						Windy radar is live-only. During replay we show recorded F1 numerical weather feed to avoid spoiler/live mismatch.
					</p>
				</div>
			) : (
				<div className="relative min-h-[420px] flex-1">
					<WeatherMap />
				</div>
			)}
		</div>
	);
}
