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
	speedKmh: number;
	speedMph: number;
	throttle: number;
	brake: number;
	rpmPct: number;
	rpmRaw: number;
	gear: number;
	battery: number;
	recharge: number;
	deploy: number;
	boost: number;
	aero: "ACTIVE" | "ARMED" | "OFF";
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
			const unknown = Object.entries(car)
				.filter(([key]) => !new Set(["0", "2", "3", "4", "5", "45"]).has(key))
				.sort((a, b) => Number(a[0]) - Number(b[0]))
				.map(([, value]) => value);
			const speedKmh = car["2"] ?? 0;
			const drs = car["45"] ?? 0;
			next.push({
				nr,
				tla: driver.Tla,
				team: driver.TeamName,
				position: line.Position,
				gap: line.GapToLeader || "-",
				speedKmh,
				speedMph: kmhToMph(speedKmh),
				throttle: clamp(car["4"] ?? 0),
				brake: car["5"] === 1 ? 100 : 0,
				rpmPct: clamp(Math.round(((car["0"] ?? 0) / 15000) * 100)),
				rpmRaw: car["0"] ?? 0,
				gear: car["3"] ?? 0,
				battery: clamp(typeof unknown[0] === "number" ? unknown[0] : Math.round(((car["0"] ?? 0) / 15000) * 100)),
				recharge: clamp(typeof unknown[1] === "number" ? unknown[1] : Math.max(0, 100 - (car["4"] ?? 0))),
				deploy: clamp(typeof unknown[2] === "number" ? unknown[2] : Math.max(0, (car["4"] ?? 0) - 20)),
				boost: clamp(typeof unknown[3] === "number" ? unknown[3] : Math.round((speedKmh / 360) * 100)),
				aero: drs > 9 ? "ACTIVE" : drs > 0 ? "ARMED" : "OFF",
			});
		}
		return next;
	}, [drivers, timing, cars, selectedNumbers]);

	const selectedSet = new Set(selectedNumbers);
	const selectable = availableDrivers.filter((driver) => !selectedSet.has(driver.nr));

	return (
		<div className="flex h-full flex-col gap-2">
			<div className="flex items-center justify-between border-b border-zinc-800 pb-1">
				<p className="text-xs font-semibold text-zinc-300">Telemetry drivers</p>
				<button className="rounded border border-zinc-700 px-1.5 py-0 text-xs hover:border-cyan-500" onClick={() => setPickerOpen((v) => !v)} title="Add driver" type="button">+</button>
			</div>

			{pickerOpen && (
				<div className="flex items-center gap-2 rounded border border-zinc-800 p-2">
					<select className="min-w-[180px] rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs" value={candidate} onChange={(e) => setCandidate(e.target.value)}>
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

			<div className="flex flex-wrap gap-1.5">
				{selectedNumbers.map((nr) => (
					<button key={nr} className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] hover:border-red-500" onClick={() => setTelemetryDrivers(selectedNumbers.filter((item) => item !== nr))} title="Remove driver" type="button">{nr} x</button>
				))}
			</div>

			{entries.length === 0 ? (
					<div className="flex flex-1 items-center justify-center rounded-lg border border-zinc-800"><p className="text-zinc-500">Telemetry unavailable</p></div>
				) : (
					<div className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-2">
						{entries.map((entry) => <TelemetryCard key={entry.nr} entry={entry} speedUnit={speedUnit} />)}
					</div>
				)}
			</div>
	);
}

function TelemetryCard({ entry, speedUnit }: { entry: TelemetryEntry; speedUnit: "metric" | "imperial" }) {
	const speedDisplay = speedUnit === "metric" ? entry.speedKmh : entry.speedMph;
	const speedLabel = speedUnit === "metric" ? "KM/H" : "MPH";
	const speedMax = speedUnit === "metric" ? 360 : 224;
	const speedTicks = speedUnit === "metric" ? [0, 60, 120, 180, 240, 300, 360] : [0, 40, 80, 120, 160, 200, 224];
	return (
		<div className="rounded-lg border border-zinc-800 bg-[radial-gradient(circle_at_25%_10%,rgba(43,99,199,0.22),rgba(9,12,20,0.98)_65%)] p-2">
			<div className="mb-1 flex items-start justify-between">
				<div>
					<p className="text-sm font-bold text-zinc-100">{entry.tla}</p>
					<p className="text-[10px] text-zinc-400">{entry.team} | P{entry.position} | {entry.gap || "-"}</p>
				</div>
				<div className="rounded border border-cyan-500/50 px-1 py-0.5 text-[9px] font-semibold text-cyan-300">AERO {entry.aero}</div>
			</div>

			<div className="grid grid-cols-[1fr_82px] items-stretch gap-2">
				<div className="rounded-md border border-zinc-800 bg-zinc-950/35 p-1">
					<svg viewBox="0 0 100 100" className="mx-auto h-auto w-full max-w-[260px] min-w-[170px]">
						<path d={arc(50, 50, 43.5, -215, 35)} stroke="#1f2940" strokeWidth="7" fill="none" strokeLinecap="butt" />
						<path d={arc(50, 50, 43.5, -215, -215 + 250 * clamp((speedDisplay / speedMax) * 100) / 100)} stroke="#00a4ff" strokeWidth="7" fill="none" strokeLinecap="butt" />
						{Array.from({ length: 26 }, (_, i) => i).map((index) => {
							const ratio = index / 25;
							const angle = -215 + 250 * ratio;
							const outer = polar(50, 50, angle, 47.5);
							const major = index % 5 === 0;
							const inner = polar(50, 50, angle, major ? 41.8 : 44.3);
							return <line key={`speed.mark.${index}`} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="#5b6478" strokeWidth={major ? 1 : 0.55} />;
						})}
						{speedTicks.map((tick) => {
							const angle = -215 + (250 * tick) / speedMax;
							const pos = polar(50, 50, angle, 48);
							return (
								<text key={`tick.${tick}`} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" className="fill-zinc-500 text-[3.6px] font-semibold tabular-nums">
									{tick}
								</text>
							);
						})}

						<path d={arc(50, 50, 30, -214, -106)} stroke="#273244" strokeWidth="7" fill="none" strokeLinecap="butt" />
						<path d={arc(50, 50, 30, -74, 34)} stroke="#273244" strokeWidth="7" fill="none" strokeLinecap="butt" />
						<path d={arc(50, 50, 30, -214, -214 + 108 * (entry.throttle / 100))} stroke="#2dd4bf" strokeWidth="7" fill="none" strokeLinecap="butt" />
						<path d={arc(50, 50, 30, -74, -74 + 108 * (entry.brake / 100))} stroke="#f97316" strokeWidth="7" fill="none" strokeLinecap="butt" />

						<text x="50" y="44" textAnchor="middle" className="fill-zinc-100 text-[22px] font-black tabular-nums">{Math.round(speedDisplay)}</text>
						<text x="50" y="52" textAnchor="middle" className="fill-zinc-300 text-[4px] font-bold">{speedLabel}</text>
						<text x="50" y="59" textAnchor="middle" className="fill-zinc-300 text-[5px] font-semibold tabular-nums">{entry.rpmRaw} RPM</text>

						<text x="32" y="60" textAnchor="middle" transform="rotate(-68 32 60)" className="fill-zinc-200 text-[4.6px] font-bold tracking-wide">THROTTLE</text>
						<text x="32" y="74.5" textAnchor="middle" className="fill-teal-300 text-[8.5px] font-black tabular-nums">{entry.throttle}%</text>
						<text x="68" y="60" textAnchor="middle" transform="rotate(68 68 60)" className="fill-zinc-200 text-[4.6px] font-bold tracking-wide">BRAKE</text>
						<text x="68" y="74.5" textAnchor="middle" className="fill-orange-300 text-[8.5px] font-black tabular-nums">{entry.brake}%</text>

						<rect x="42" y="64.5" width="16" height="7" rx="1.5" fill="none" stroke="#0ea5e9" strokeWidth="1" />
						<rect x="58" y="66.5" width="1.8" height="3.2" rx="0.5" fill="#0ea5e9" />
						<rect x="43.2" y="65.7" width={Math.max(1, (entry.battery / 100) * 13)} height="4.6" rx="1" fill="#38bdf8" />

						<text x="50" y="89" textAnchor="middle" className="fill-zinc-200 text-[7px] font-bold">GEAR {entry.gear <= 0 ? "N" : entry.gear}</text>
					</svg>
				</div>

				<div className="grid h-full grid-rows-4 gap-1 self-stretch">
					<StatusTile label="Recharge" value={`${entry.recharge}%`} valueClass="text-emerald-300" />
					<StatusTile label="Deploy" value={`${entry.deploy}%`} valueClass="text-amber-300" />
					<StatusTile label="Boost" value={`${entry.boost}%`} valueClass="text-violet-300" />
					<StatusTile label="RPM" value={`${entry.rpmPct}%`} valueClass="text-zinc-100" />
				</div>
			</div>
		</div>
	);
}

function StatusTile({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
	return (
		<div className="flex h-full flex-col justify-between rounded border border-zinc-800 bg-zinc-900/50 px-1 py-1">
			<p className="text-[8px] leading-none uppercase tracking-wide text-zinc-400">{label}</p>
			<p className={`text-2xl leading-none font-black tabular-nums ${valueClass}`}>{value}</p>
		</div>
	);
}

function polar(cx: number, cy: number, angleDeg: number, radius: number) {
	const rad = (angleDeg * Math.PI) / 180;
	return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
}

function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
	const start = polar(cx, cy, startDeg, r);
	const end = polar(cx, cy, endDeg, r);
	const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
	const sweep = endDeg >= startDeg ? 1 : 0;
	return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y}`;
}
