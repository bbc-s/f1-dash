"use client";

import { useEffect, useMemo, useState } from "react";

import type {
	ConstructorStanding,
	DriverStanding,
	ScheduleRoundLite,
	StandingsResponse,
} from "@/types/standings.type";

const STORAGE_KEY = "standings-calculator-v5";
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

type RaceOrderDraft = Record<string, string[]>;
type AppliedSimulation = {
	race: string;
	order: string[];
} | null;

function loadDraft(): RaceOrderDraft {
	if (typeof window === "undefined") return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		return (JSON.parse(raw) as RaceOrderDraft) ?? {};
	} catch {
		return {};
	}
}

function moveItem(order: string[], sourceId: string, targetId: string): string[] {
	if (sourceId === targetId) return order;
	const sourceIndex = order.indexOf(sourceId);
	const targetIndex = order.indexOf(targetId);
	if (sourceIndex === -1 || targetIndex === -1) return order;

	const next = [...order];
	const [item] = next.splice(sourceIndex, 1);
	next.splice(targetIndex, 0, item);
	return next;
}

function buildDefaultOrder(drivers: DriverStanding[]) {
	return [...drivers]
		.sort((a, b) => a.position - b.position)
		.map((d) => d.driverId);
}

function formatDriverName(driver: DriverStanding) {
	return `${driver.givenName} ${driver.familyName}`;
}

export default function StandingsClient({ data, rounds }: { data: StandingsResponse; rounds: ScheduleRoundLite[] }) {
	const driversById = useMemo(() => Object.fromEntries(data.drivers.map((d) => [d.driverId, d])) as Record<string, DriverStanding>, [data.drivers]);
	const defaultOrder = useMemo(() => buildDefaultOrder(data.drivers), [data.drivers]);
	const currentRound = useMemo(() => Math.max(0, Number.parseInt(data.round, 10) || 0), [data.round]);
	const remainingRaces = useMemo(() => rounds.slice(currentRound), [rounds, currentRound]);
	const raceNames = useMemo(() => remainingRaces.map((r) => r.name).filter(Boolean), [remainingRaces]);

	const [draft, setDraft] = useState<RaceOrderDraft>(() => loadDraft());
	const [selectedRace, setSelectedRace] = useState<string>(() => raceNames[0] ?? "");
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [appliedSimulation, setAppliedSimulation] = useState<AppliedSimulation>(null);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
	}, [draft]);

	const activeRace = useMemo(() => {
		if (raceNames.length === 0) return selectedRace;
		return raceNames.includes(selectedRace) ? selectedRace : (raceNames[0] ?? "");
	}, [raceNames, selectedRace]);

	const selectedOrder = useMemo(() => {
		if (!activeRace) return defaultOrder;
		const stored = draft[activeRace];
		if (!stored || stored.length === 0) return defaultOrder;
		const filtered = stored.filter((id) => Boolean(driversById[id]));
		for (const id of defaultOrder) {
			if (!filtered.includes(id)) filtered.push(id);
		}
		return filtered;
	}, [activeRace, draft, defaultOrder, driversById]);

	const appliedBonusByDriver = useMemo(() => {
		if (!appliedSimulation) return {} as Record<string, number>;
		const bonus: Record<string, number> = {};
		appliedSimulation.order.forEach((driverId, idx) => {
			bonus[driverId] = RACE_POINTS[idx] ?? 0;
		});
		return bonus;
	}, [appliedSimulation]);

	const simulatedDrivers = useMemo(() => {
		return [...data.drivers]
			.map((driver) => ({
				...driver,
				simulatedPoints: driver.points + (appliedBonusByDriver[driver.driverId] ?? 0),
			}))
			.sort((a, b) => b.simulatedPoints - a.simulatedPoints || b.wins - a.wins);
	}, [data.drivers, appliedBonusByDriver]);

	const constructorBonusById = useMemo(() => {
		const nameToId = Object.fromEntries(data.constructors.map((c) => [c.name.toLowerCase(), c.constructorId])) as Record<string, string>;
		const bonus: Record<string, number> = {};
		for (const [driverId, points] of Object.entries(appliedBonusByDriver)) {
			const driver = driversById[driverId];
			if (!driver) continue;
			const constructorId = nameToId[driver.constructorName.toLowerCase()];
			if (!constructorId) continue;
			bonus[constructorId] = (bonus[constructorId] ?? 0) + points;
		}
		return bonus;
	}, [data.constructors, appliedBonusByDriver, driversById]);

	const simulatedConstructors = useMemo(() => {
		return [...data.constructors]
			.map((item) => ({
				...item,
				simulatedPoints: item.points + (constructorBonusById[item.constructorId] ?? 0),
			}))
			.sort((a, b) => b.simulatedPoints - a.simulatedPoints || b.wins - a.wins);
	}, [data.constructors, constructorBonusById]);

	const onDropToDriver = (targetId: string) => {
		if (!activeRace || !draggingId) return;
		const moved = moveItem(selectedOrder, draggingId, targetId);
		setDraft((prev) => ({ ...prev, [activeRace]: moved }));
		setDraggingId(null);
	};

	return (
		<div className="flex flex-col gap-6 pb-8">
			<div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-400">
				<p>
					Official standings source: <span className="text-zinc-200">{data.source}</span> (season {data.season}, round {data.round})
				</p>
				<p>Drag drivers for one selected race, then confirm simulation with the button.</p>
			</div>

				<div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
				<section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
					<div className="mb-3 flex items-center gap-2">
						<label className="text-xs text-zinc-400">Race</label>
						<select
							className="w-full rounded border border-zinc-700 bg-zinc-950 p-1 text-xs"
							value={activeRace}
							onChange={(e) => setSelectedRace(e.target.value)}
						>
							{raceNames.map((name) => (
								<option key={name} value={name}>{name}</option>
							))}
						</select>
					</div>

						<div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 text-xs whitespace-nowrap text-zinc-300">
						<button
							className="rounded border border-cyan-500 bg-cyan-700/30 px-2 py-1 font-semibold text-cyan-100"
							onClick={() => activeRace && setAppliedSimulation({ race: activeRace, order: selectedOrder })}
							type="button"
						>
							Confirm race simulation
						</button>
						<button
							className="rounded border border-zinc-700 px-2 py-1"
							onClick={() => activeRace && setDraft((prev) => ({ ...prev, [activeRace]: defaultOrder }))}
							type="button"
						>
							Reset race order
						</button>
						<button
							className="rounded border border-red-500 bg-red-700/20 px-2 py-1 text-red-100"
							onClick={() => setAppliedSimulation(null)}
							type="button"
						>
							Clear simulation
						</button>
					</div>

					{appliedSimulation?.race && (
						<p className="mb-2 text-xs text-emerald-300">Applied race: {appliedSimulation.race}</p>
					)}

					<div className="max-h-[70vh] space-y-1 overflow-auto rounded border border-zinc-800 p-2">
						{selectedOrder.map((driverId, index) => {
							const driver = driversById[driverId];
							if (!driver) return null;
							const racePts = RACE_POINTS[index] ?? 0;
							return (
								<div
									key={`${activeRace}.${driverId}`}
									draggable
									onDragStart={() => setDraggingId(driverId)}
									onDragOver={(event) => event.preventDefault()}
									onDrop={() => onDropToDriver(driverId)}
									className="flex cursor-grab items-center justify-between rounded border border-zinc-800 bg-zinc-900/70 px-2 py-2 text-sm"
								>
									<div className="flex items-center gap-2">
										<span className="inline-flex w-8 justify-center rounded bg-zinc-800 py-0.5 text-xs">{index + 1}</span>
										<div>
											<p className="font-medium text-zinc-100">{formatDriverName(driver)}</p>
											<p className="text-[11px] text-zinc-400">{driver.constructorName}</p>
										</div>
									</div>
									<span className="text-xs text-zinc-300">+{racePts}</span>
								</div>
							);
						})}
					</div>
				</section>

					<section className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
						<DriverTable official={data.drivers} simulated={simulatedDrivers} />
						<ConstructorTable official={data.constructors} simulated={simulatedConstructors} />
					</section>
			</div>
		</div>
	);
}

function DriverTable({ official, simulated }: { official: DriverStanding[]; simulated: Array<DriverStanding & { simulatedPoints: number }> }) {
	const officialById = useMemo(() => Object.fromEntries(official.map((item) => [item.driverId, item])) as Record<string, DriverStanding>, [official]);

	return (
		<section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
			<h2 className="mb-3 text-xl">Drivers Championship</h2>
			<div className="overflow-x-auto rounded border border-zinc-800">
					<table className="min-w-full table-fixed border-collapse text-sm">
						<thead className="bg-zinc-900 text-zinc-400">
							<tr>
								<th className="w-12 p-2 text-left">Official</th>
								<th className="w-12 p-2 text-left">Sim</th>
									<th className="w-32 p-2 text-left">Driver</th>
								<th className="w-20 p-2 text-right">Official pts</th>
								<th className="w-24 p-2 text-right">Sim pts</th>
							</tr>
						</thead>
					<tbody>
						{simulated.map((item, idx) => {
							const officialItem = officialById[item.driverId];
							return (
								<tr key={item.driverId} className="border-t border-zinc-900">
									<td className="p-2">{officialItem?.position ?? "-"}</td>
									<td className="p-2">{idx + 1}</td>
										<td className="truncate p-2">{item.givenName} {item.familyName}</td>
									<td className="p-2 text-right">{item.points.toFixed(0)}</td>
									<td className="p-2 text-right font-semibold">{item.simulatedPoints.toFixed(0)}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</section>
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
		<section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
			<h2 className="mb-3 text-xl">Constructors Championship</h2>
			<div className="overflow-x-auto rounded border border-zinc-800">
					<table className="min-w-full table-fixed border-collapse text-sm">
						<thead className="bg-zinc-900 text-zinc-400">
							<tr>
								<th className="w-12 p-2 text-left">Official</th>
								<th className="w-12 p-2 text-left">Sim</th>
									<th className="w-28 p-2 text-left">Constructor</th>
								<th className="w-20 p-2 text-right">Official pts</th>
								<th className="w-24 p-2 text-right">Sim pts</th>
							</tr>
						</thead>
					<tbody>
						{simulated.map((item, idx) => {
							const officialItem = officialById[item.constructorId];
							return (
								<tr key={item.constructorId} className="border-t border-zinc-900">
									<td className="p-2">{officialItem?.position ?? "-"}</td>
									<td className="p-2">{idx + 1}</td>
										<td className="truncate p-2">{item.name}</td>
									<td className="p-2 text-right">{item.points.toFixed(0)}</td>
									<td className="p-2 text-right font-semibold">{item.simulatedPoints.toFixed(0)}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</section>
	);
}
