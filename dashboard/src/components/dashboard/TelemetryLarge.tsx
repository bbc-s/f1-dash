"use client";

import { useMemo, useState } from "react";

import { useDataStore } from "@/stores/useDataStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";

function kmhToMph(kmh: number) {
	return Math.floor(kmh / 1.609344);
}

function clamp(value: number, min = 0, max = 100) {
	return Math.max(min, Math.min(max, value));
}

type TelemetryEntry = {
	nr: string;
	tla: string;
	team: string;
	position: string;
	gap: string;
	speed: number;
	throttle: number;
	brake: number;
	rpm: number;
	gear: number;
};

export default function TelemetryLarge() {
	const favoriteDrivers = useSettingsStore((state) => state.favoriteDrivers);
	const speedUnit = useSettingsStore((state) => state.speedUnit);
	const drivers = useDataStore((state) => state.state?.DriverList);
	const timing = useDataStore((state) => state.state?.TimingData?.Lines);
	const cars = useDataStore((state) => state.carsData);
	const telemetryDrivers = useWidgetLayoutStore((state) => state.options.telemetryDrivers);
	const setTelemetryDrivers = useWidgetLayoutStore((state) => state.setTelemetryDrivers);

	const [pickerOpen, setPickerOpen] = useState(false);
	const [candidate, setCandidate] = useState("");

	const sortedTiming = useMemo(() => {
		if (!timing) return [];
		return Object.values(timing).sort((a, b) => Number(a.Position) - Number(b.Position));
	}, [timing]);

	const availableDrivers = useMemo(() => {
		if (!drivers || sortedTiming.length === 0) return [];
		return sortedTiming.map((entry) => {
			const driver = drivers[entry.RacingNumber];
			return {
				nr: entry.RacingNumber,
				tla: driver?.Tla ?? entry.RacingNumber,
				name: driver?.FullName ?? entry.RacingNumber,
				position: entry.Position,
			};
		});
	}, [drivers, sortedTiming]);

	const selectedNumbers = useMemo(() => {
		if (telemetryDrivers.length > 0) return telemetryDrivers;
		if (sortedTiming.length === 0) return [];
		const favorite = sortedTiming.find((entry) => favoriteDrivers.includes(entry.RacingNumber));
		return [favorite?.RacingNumber ?? sortedTiming[0]?.RacingNumber].filter(Boolean) as string[];
	}, [telemetryDrivers, sortedTiming, favoriteDrivers]);

	const entries = useMemo((): TelemetryEntry[] => {
		if (!drivers || !timing || !cars) return [];
		const next: TelemetryEntry[] = [];
		for (const nr of selectedNumbers) {
			const driver = drivers[nr];
			const line = timing[nr];
			const car = cars[nr]?.Channels;
			if (!driver || !line || !car) continue;
			next.push({
				nr,
				tla: driver.Tla,
				team: driver.TeamName,
				position: line.Position,
				gap: line.GapToLeader || "-",
				speed: speedUnit === "metric" ? car["2"] : kmhToMph(car["2"]),
				throttle: clamp(car["4"]),
				brake: car["5"] === 1 ? 100 : 0,
				rpm: clamp(Math.round((car["0"] / 15000) * 100)),
				gear: car["3"],
			});
		}
		return next;
	}, [drivers, timing, cars, selectedNumbers, speedUnit]);

	const selectedSet = new Set(selectedNumbers);
	const selectable = availableDrivers.filter((driver) => !selectedSet.has(driver.nr));

	return (
		<div className="flex h-full flex-col gap-3">
			<div className="flex items-center justify-between border-b border-zinc-800 pb-2">
				<p className="text-sm font-semibold text-zinc-300">Telemetry drivers</p>
				<div className="flex items-center gap-2">
					<button
						className="rounded border border-zinc-700 px-2 py-0.5 text-sm hover:border-cyan-500"
						onClick={() => setPickerOpen((v) => !v)}
						title="Add driver"
						type="button"
					>
						+
					</button>
				</div>
			</div>

			{pickerOpen && (
				<div className="flex items-center gap-2 rounded border border-zinc-800 p-2">
					<select
						className="min-w-[220px] rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
						value={candidate}
						onChange={(e) => setCandidate(e.target.value)}
					>
						<option value="">Select driver</option>
						{selectable.map((item) => (
							<option key={item.nr} value={item.nr}>{`P${item.position} ${item.tla} (${item.nr})`}</option>
						))}
					</select>
					<button
						className="rounded border border-cyan-500 px-2 py-1 text-xs text-cyan-200"
						onClick={() => {
							if (!candidate) return;
							setTelemetryDrivers([...selectedNumbers, candidate]);
							setCandidate("");
							setPickerOpen(false);
						}}
						type="button"
					>
						Add
					</button>
				</div>
			)}

			<div className="flex flex-wrap gap-2">
				{selectedNumbers.map((nr) => (
					<button
						key={nr}
						className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-red-500"
						onClick={() => setTelemetryDrivers(selectedNumbers.filter((item) => item !== nr))}
						title="Remove driver"
						type="button"
					>
						{nr} x
					</button>
				))}
			</div>

				{entries.length === 0 ? (
					<div className="flex flex-1 items-center justify-center rounded-lg border border-zinc-800">
						<p className="text-zinc-500">Telemetry unavailable</p>
					</div>
				) : (
				<div className={`grid flex-1 gap-2 ${entries.length > 1 ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
					{entries.map((entry) => (
						<div key={entry.nr} className="flex h-full flex-col gap-2 rounded-lg border border-zinc-800 p-2">
							<div className="flex items-end justify-between border-b border-zinc-800 pb-1">
								<div>
									<p className="text-xl font-bold">{entry.tla}</p>
									<p className="text-xs text-zinc-400">
										P{entry.position} - {entry.team}
									</p>
								</div>
								<div className="text-right">
									<p className="text-3xl font-black tabular-nums">{entry.speed}</p>
									<p className="text-xs text-zinc-400">{speedUnit === "metric" ? "km/h" : "mph"}</p>
								</div>
							</div>
							<div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2">
								<MetricBar label="Throttle" value={entry.throttle} color="bg-emerald-500" />
								<MetricBar label="Brake" value={entry.brake} color="bg-red-500" />
								<MetricBar label="RPM %" value={entry.rpm} color="bg-blue-500" />
								<div className="rounded-lg border border-zinc-800 p-2">
									<p className="text-xs text-zinc-400">Gear</p>
									<p className="text-4xl font-black tabular-nums">{entry.gear}</p>
									<p className="mt-1 text-xs text-zinc-500">Delta context: {entry.gap}</p>
								</div>
							</div>
						</div>
					))}
					</div>
				)}
			</div>
		);
	}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
	return (
		<div className="rounded-lg border border-zinc-800 p-2">
			<div className="mb-1 flex items-center justify-between">
				<p className="text-xs text-zinc-300">{label}</p>
				<p className="font-mono text-lg tabular-nums">{value}%</p>
			</div>
			<div className="h-3 rounded bg-zinc-900">
				<div className={`h-full rounded ${color}`} style={{ width: `${value}%` }} />
			</div>
		</div>
	);
}

