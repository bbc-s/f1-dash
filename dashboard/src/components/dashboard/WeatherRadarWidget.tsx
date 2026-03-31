"use client";

import { useEffect, useMemo, useState } from "react";

import { WeatherMap } from "@/app/dashboard/weather/map";
import { useDataStore } from "@/stores/useDataStore";
import { useReplayStore } from "@/stores/useReplayStore";

type WeatherSample = {
	cursorMs: number;
	air: number;
	track: number;
	humidity: number;
	rain: number;
};

export default function WeatherRadarWidget() {
	const mode = useReplayStore((state) => state.mode);
	const cursorMs = useReplayStore((state) => state.cursorMs);
	const weather = useDataStore((state) => state.state?.WeatherData);
	const [samples, setSamples] = useState<WeatherSample[]>([]);

	useEffect(() => {
		if (mode !== "replay") return;
		if (!weather) return;
		const sample: WeatherSample = {
			cursorMs,
			air: Number.parseFloat(weather.AirTemp || "0"),
			track: Number.parseFloat(weather.TrackTemp || "0"),
			humidity: Number.parseFloat(weather.Humidity || "0"),
			rain: weather.Rainfall === "1" ? 100 : 0,
		};
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setSamples((prev) => {
			const filtered = prev.filter((entry) => Math.abs(entry.cursorMs - sample.cursorMs) > 500);
			const next = [...filtered, sample].sort((a, b) => a.cursorMs - b.cursorMs);
			return next.slice(-180);
		});
	}, [mode, cursorMs, weather]);

	return (
		<div className="flex h-full w-full flex-col gap-2">
			{mode === "replay" ? <ReplayWeatherTimeline samples={samples} /> : <div className="relative min-h-[240px] flex-1"><WeatherMap /></div>}
		</div>
	);
}

function ReplayWeatherTimeline({ samples }: { samples: WeatherSample[] }) {
	const points = useMemo(() => {
		if (samples.length === 0) return { air: "", track: "", hum: "", rain: "" };
		const maxX = Math.max(...samples.map((s) => s.cursorMs), 1);
		const minTemp = Math.min(...samples.map((s) => Math.min(s.air, s.track)));
		const maxTemp = Math.max(...samples.map((s) => Math.max(s.air, s.track)));
		const tempRange = Math.max(maxTemp - minTemp, 1);

		const mk = (value: number, index: number) => {
			const x = (samples[index].cursorMs / maxX) * 100;
			return `${x},${value}`;
		};

		const air = samples.map((s, i) => mk(90 - ((s.air - minTemp) / tempRange) * 80, i)).join(" ");
		const track = samples.map((s, i) => mk(90 - ((s.track - minTemp) / tempRange) * 80, i)).join(" ");
		const hum = samples.map((s, i) => mk(90 - (s.humidity / 100) * 80, i)).join(" ");
		const rain = samples.map((s, i) => mk(90 - (s.rain / 100) * 80, i)).join(" ");
		return { air, track, hum, rain };
	}, [samples]);

	if (samples.length === 0) {
		return (
			<div className="flex min-h-[240px] flex-1 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/40">
				<p className="text-sm text-zinc-500">Replay weather timeline is building...</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-[240px] flex-1 flex-col rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
			<p className="mb-2 text-sm font-semibold text-zinc-200">Replay weather timeline</p>
			<svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full rounded bg-zinc-950">
				<polyline points={points.track} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
				<polyline points={points.air} fill="none" stroke="#38bdf8" strokeWidth="1.5" />
				<polyline points={points.hum} fill="none" stroke="#22c55e" strokeWidth="1.2" />
				<polyline points={points.rain} fill="none" stroke="#a78bfa" strokeWidth="1.2" />
			</svg>
			<div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
				<span className="text-amber-300">Track temp</span>
				<span className="text-sky-300">Air temp</span>
				<span className="text-emerald-300">Humidity</span>
				<span className="text-violet-300">Rain</span>
			</div>
		</div>
	);
}
