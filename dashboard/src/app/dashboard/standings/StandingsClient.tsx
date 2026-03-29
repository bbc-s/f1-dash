"use client";

import { useEffect, useMemo, useState } from "react";

import type {
	ConstructorStanding,
	DriverStanding,
	ScheduleRoundLite,
	StandingsResponse,
} from "@/types/standings.type";

type RaceDeltas = Record<string, Record<string, number>>;
type StoredState = {
	driverRaceDeltas: RaceDeltas;
	constructorRaceDeltas: RaceDeltas;
};

const STORAGE_KEY = "standings-calculator-v3";

function safeNumber(value: string): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function sumRaceDeltas(entityId: string, raceDeltas: RaceDeltas): number {
	const perRace = raceDeltas[entityId];
	if (!perRace) return 0;
	return Object.values(perRace).reduce((acc, value) => acc + value, 0);
}

function rankDrivers(drivers: DriverStanding[], raceDeltas: RaceDeltas) {
	return drivers
		.map((driver) => ({
			...driver,
			simulatedPoints: driver.points + sumRaceDeltas(driver.driverId, raceDeltas),
		}))
		.sort((a, b) => b.simulatedPoints - a.simulatedPoints || b.wins - a.wins);
}

function rankConstructors(constructors: ConstructorStanding[], raceDeltas: RaceDeltas) {
	return constructors
		.map((item) => ({
			...item,
			simulatedPoints: item.points + sumRaceDeltas(item.constructorId, raceDeltas),
		}))
		.sort((a, b) => b.simulatedPoints - a.simulatedPoints || b.wins - a.wins);
}

function setRaceDelta(raceDeltas: RaceDeltas, entityId: string, race: string, value: number): RaceDeltas {
	return {
		...raceDeltas,
		[entityId]: {
			...(raceDeltas[entityId] ?? {}),
			[race]: value,
		},
	};
}

function loadInitial(): StoredState {
	if (typeof window === "undefined") return { driverRaceDeltas: {}, constructorRaceDeltas: {} };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { driverRaceDeltas: {}, constructorRaceDeltas: {} };
		const parsed = JSON.parse(raw) as Partial<StoredState>;
		return {
			driverRaceDeltas: parsed.driverRaceDeltas ?? {},
			constructorRaceDeltas: parsed.constructorRaceDeltas ?? {},
		};
	} catch {
		return { driverRaceDeltas: {}, constructorRaceDeltas: {} };
	}
}

function clearRaceDeltasForRace(source: RaceDeltas, race: string): RaceDeltas {
	const next: RaceDeltas = {};
	for (const [entityId, deltas] of Object.entries(source)) {
		const clone = { ...deltas };
		delete clone[race];
		next[entityId] = clone;
	}
	return next;
}

export default function StandingsClient({ data, rounds }: { data: StandingsResponse; rounds: ScheduleRoundLite[] }) {
	const raceNames = useMemo(() => rounds.map((r) => r.name).filter(Boolean), [rounds]);
	const [selectedRace, setSelectedRace] = useState<string>(() => raceNames[0] ?? "Round 1");
	const initial = loadInitial();

	const [driverRaceDeltas, setDriverRaceDeltas] = useState<RaceDeltas>(initial.driverRaceDeltas);
	const [constructorRaceDeltas, setConstructorRaceDeltas] = useState<RaceDeltas>(initial.constructorRaceDeltas);

	useEffect(() => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				driverRaceDeltas,
				constructorRaceDeltas,
			}),
		);
	}, [driverRaceDeltas, constructorRaceDeltas]);

	const activeRace = useMemo(() => {
		if (raceNames.length === 0) return selectedRace;
		return raceNames.includes(selectedRace) ? selectedRace : (raceNames[0] ?? "Round 1");
	}, [raceNames, selectedRace]);

	const simulatedDrivers = useMemo(() => rankDrivers(data.drivers, driverRaceDeltas), [data, driverRaceDeltas]);
	const simulatedConstructors = useMemo(
		() => rankConstructors(data.constructors, constructorRaceDeltas),
		[data, constructorRaceDeltas],
	);

	return (
		<div className="flex flex-col gap-6 pb-8">
			<div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-400">
				<p>
					Official standings source: <span className="text-zinc-200">{data.source}</span> (season {data.season}, round {data.round})
				</p>
				<p>Calculator mode: edit points for one selected race and compare official vs simulated standings instantly.</p>
			</div>

			<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
				<div className="mb-3 flex flex-wrap items-center gap-2">
					<label className="text-xs text-zinc-400">Race</label>
					<select
						className="rounded border border-zinc-700 bg-zinc-950 p-1 text-xs"
						value={activeRace}
						onChange={(e) => setSelectedRace(e.target.value)}
					>
						{raceNames.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</select>
					<button
						className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
						onClick={() => {
							setDriverRaceDeltas((prev) => clearRaceDeltasForRace(prev, activeRace));
							setConstructorRaceDeltas((prev) => clearRaceDeltasForRace(prev, activeRace));
						}}
						type="button"
					>
						Reset selected race edits
					</button>
				</div>

				<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
					<section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
						<h2 className="mb-3 text-xl">Drivers Championship</h2>
						<DriverRaceEditor race={activeRace} drivers={data.drivers} raceDeltas={driverRaceDeltas} setRaceDeltas={setDriverRaceDeltas} />
						<DriverTable official={data.drivers} simulated={simulatedDrivers} />
					</section>

					<section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
						<h2 className="mb-3 text-xl">Constructors Championship</h2>
						<ConstructorRaceEditor
							race={activeRace}
							constructors={data.constructors}
							raceDeltas={constructorRaceDeltas}
							setRaceDeltas={setConstructorRaceDeltas}
						/>
						<ConstructorTable official={data.constructors} simulated={simulatedConstructors} />
					</section>
				</div>
			</div>
		</div>
	);
}

function DriverRaceEditor({
	race,
	drivers,
	raceDeltas,
	setRaceDeltas,
}: {
	race: string;
	drivers: DriverStanding[];
	raceDeltas: RaceDeltas;
	setRaceDeltas: React.Dispatch<React.SetStateAction<RaceDeltas>>;
}) {
	return (
		<div className="mb-3 max-h-64 overflow-auto rounded border border-zinc-800">
			<table className="min-w-full text-xs">
				<thead className="sticky top-0 bg-zinc-900 text-zinc-400">
					<tr>
						<th className="p-2 text-left">Driver</th>
						<th className="p-2 text-right">{race}</th>
					</tr>
				</thead>
				<tbody>
					{drivers.map((driver) => (
						<tr key={driver.driverId} className="border-t border-zinc-900">
							<td className="p-2">{driver.givenName} {driver.familyName}</td>
							<td className="p-2 text-right">
								<input
									className="w-20 rounded border border-zinc-700 bg-zinc-900 p-1 text-right"
									value={String(raceDeltas[driver.driverId]?.[race] ?? 0)}
									onChange={(e) =>
										setRaceDeltas((prev) => setRaceDelta(prev, driver.driverId, race, safeNumber(e.target.value)))
									}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function ConstructorRaceEditor({
	race,
	constructors,
	raceDeltas,
	setRaceDeltas,
}: {
	race: string;
	constructors: ConstructorStanding[];
	raceDeltas: RaceDeltas;
	setRaceDeltas: React.Dispatch<React.SetStateAction<RaceDeltas>>;
}) {
	return (
		<div className="mb-3 max-h-64 overflow-auto rounded border border-zinc-800">
			<table className="min-w-full text-xs">
				<thead className="sticky top-0 bg-zinc-900 text-zinc-400">
					<tr>
						<th className="p-2 text-left">Constructor</th>
						<th className="p-2 text-right">{race}</th>
					</tr>
				</thead>
				<tbody>
					{constructors.map((item) => (
						<tr key={item.constructorId} className="border-t border-zinc-900">
							<td className="p-2">{item.name}</td>
							<td className="p-2 text-right">
								<input
									className="w-20 rounded border border-zinc-700 bg-zinc-900 p-1 text-right"
									value={String(raceDeltas[item.constructorId]?.[race] ?? 0)}
									onChange={(e) =>
										setRaceDeltas((prev) => setRaceDelta(prev, item.constructorId, race, safeNumber(e.target.value)))
									}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function DriverTable({ official, simulated }: { official: DriverStanding[]; simulated: Array<DriverStanding & { simulatedPoints: number }> }) {
	const officialById = useMemo(
		() => Object.fromEntries(official.map((item) => [item.driverId, item])) as Record<string, DriverStanding>,
		[official],
	);

	return (
		<div className="overflow-x-auto rounded border border-zinc-800">
			<table className="min-w-full border-collapse text-sm">
				<thead className="bg-zinc-900 text-zinc-400">
					<tr>
						<th className="p-2 text-left">Sim</th>
						<th className="p-2 text-left">Official</th>
						<th className="p-2 text-left">Driver</th>
						<th className="p-2 text-right">Official pts</th>
						<th className="p-2 text-right">Simulated pts</th>
					</tr>
				</thead>
				<tbody>
					{simulated.map((item, idx) => {
						const officialItem = officialById[item.driverId];
						return (
							<tr key={item.driverId} className="border-t border-zinc-900">
								<td className="p-2">{idx + 1}</td>
								<td className="p-2">{officialItem?.position ?? "-"}</td>
								<td className="p-2">{item.givenName} {item.familyName}</td>
								<td className="p-2 text-right">{item.points.toFixed(0)}</td>
								<td className="p-2 text-right font-semibold">{item.simulatedPoints.toFixed(0)}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function ConstructorTable({
	official,
	simulated,
}: {
	official: ConstructorStanding[];
	simulated: Array<ConstructorStanding & { simulatedPoints: number }>;
}) {
	const officialById = useMemo(
		() => Object.fromEntries(official.map((item) => [item.constructorId, item])) as Record<string, ConstructorStanding>,
		[official],
	);

	return (
		<div className="overflow-x-auto rounded border border-zinc-800">
			<table className="min-w-full border-collapse text-sm">
				<thead className="bg-zinc-900 text-zinc-400">
					<tr>
						<th className="p-2 text-left">Sim</th>
						<th className="p-2 text-left">Official</th>
						<th className="p-2 text-left">Constructor</th>
						<th className="p-2 text-right">Official pts</th>
						<th className="p-2 text-right">Simulated pts</th>
					</tr>
				</thead>
				<tbody>
					{simulated.map((item, idx) => {
						const officialItem = officialById[item.constructorId];
						return (
							<tr key={item.constructorId} className="border-t border-zinc-900">
								<td className="p-2">{idx + 1}</td>
								<td className="p-2">{officialItem?.position ?? "-"}</td>
								<td className="p-2">{item.name}</td>
								<td className="p-2 text-right">{item.points.toFixed(0)}</td>
								<td className="p-2 text-right font-semibold">{item.simulatedPoints.toFixed(0)}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
