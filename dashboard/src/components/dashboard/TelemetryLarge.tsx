"use client";

import { useMemo } from "react";

import { useDataStore } from "@/stores/useDataStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

function kmhToMph(kmh: number) {
	return Math.floor(kmh / 1.609344);
}

function clamp(value: number, min = 0, max = 100) {
	return Math.max(min, Math.min(max, value));
}

export default function TelemetryLarge() {
	const favoriteDrivers = useSettingsStore((state) => state.favoriteDrivers);
	const speedUnit = useSettingsStore((state) => state.speedUnit);
	const drivers = useDataStore((state) => state.state?.DriverList);
	const timing = useDataStore((state) => state.state?.TimingData?.Lines);
	const cars = useDataStore((state) => state.carsData);

	const selected = useMemo(() => {
		if (!drivers || !timing || !cars) return null;

		const sorted = Object.values(timing).sort((a, b) => Number(a.Position) - Number(b.Position));
		const favorite = sorted.find((entry) => favoriteDrivers.includes(entry.RacingNumber));
		const target = favorite ?? sorted[0];
		if (!target) return null;

		const driver = drivers[target.RacingNumber];
		const car = cars[target.RacingNumber]?.Channels;
		if (!driver || !car) return null;

		return { driver, timing: target, car };
	}, [drivers, timing, cars, favoriteDrivers]);

	if (!selected) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-zinc-500">Telemetry unavailable</p>
			</div>
		);
	}

	const speed = speedUnit === "metric" ? selected.car["2"] : kmhToMph(selected.car["2"]);
	const throttle = clamp(selected.car["4"]);
	const brake = selected.car["5"] === 1 ? 100 : 0;
	const rpm = clamp(Math.round((selected.car["0"] / 15000) * 100));
	const gear = selected.car["3"];

	return (
		<div className="flex h-full flex-col gap-4">
			<div className="flex items-end justify-between border-b border-zinc-800 pb-2">
				<div>
					<p className="text-3xl font-bold">{selected.driver.Tla}</p>
					<p className="text-zinc-400">
						P{selected.timing.Position} • {selected.driver.TeamName}
					</p>
				</div>
				<div className="text-right">
					<p className="text-5xl font-black tabular-nums">{speed}</p>
					<p className="text-zinc-400">{speedUnit === "metric" ? "km/h" : "mph"}</p>
				</div>
			</div>

			<div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
				<MetricBar label="Throttle" value={throttle} color="bg-emerald-500" />
				<MetricBar label="Brake" value={brake} color="bg-red-500" />
				<MetricBar label="RPM %" value={rpm} color="bg-blue-500" />
				<div className="rounded-lg border border-zinc-800 p-3">
					<p className="text-zinc-400">Gear</p>
					<p className="text-6xl font-black tabular-nums">{gear}</p>
					<p className="mt-2 text-sm text-zinc-500">Delta context: {selected.timing.GapToLeader || "-"}</p>
				</div>
			</div>
		</div>
	);
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
	return (
		<div className="rounded-lg border border-zinc-800 p-3">
			<div className="mb-2 flex items-center justify-between">
				<p className="text-zinc-300">{label}</p>
				<p className="font-mono text-2xl tabular-nums">{value}%</p>
			</div>
			<div className="h-6 rounded bg-zinc-900">
				<div className={`h-full rounded ${color}`} style={{ width: `${value}%` }} />
			</div>
		</div>
	);
}
