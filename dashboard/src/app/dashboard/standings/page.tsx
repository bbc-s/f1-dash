"use client";

import { useEffect, useMemo, useState } from "react";

import { env } from "@/env";

import type { ConstructorStanding, DriverStanding, StandingsResponse } from "@/types/standings.type";

type CalculatorMap = Record<string, number>;

const STORAGE_KEY = "standings-calculator-v1";

function safeNumber(value: string): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function rankDrivers(drivers: DriverStanding[], deltas: CalculatorMap) {
	return drivers
		.map((driver) => ({
			...driver,
			simulatedPoints: driver.points + (deltas[driver.driverId] ?? 0),
		}))
		.sort((a, b) => b.simulatedPoints - a.simulatedPoints || b.wins - a.wins);
}

function rankConstructors(constructors: ConstructorStanding[], deltas: CalculatorMap) {
	return constructors
		.map((item) => ({
			...item,
			simulatedPoints: item.points + (deltas[item.constructorId] ?? 0),
		}))
		.sort((a, b) => b.simulatedPoints - a.simulatedPoints || b.wins - a.wins);
}

export default function StandingsPage() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<StandingsResponse | null>(null);

	const [driverDeltas, setDriverDeltas] = useState<CalculatorMap>({});
	const [constructorDeltas, setConstructorDeltas] = useState<CalculatorMap>({});

	useEffect(() => {
		let active = true;

		const load = async () => {
			try {
				setLoading(true);
				setError(null);

				const response = await fetch(`${env.API_URL}/api/standings`, {
					cache: "no-store",
				});

				if (!response.ok) {
					throw new Error(`standings request failed: ${response.status}`);
				}

				const standings: StandingsResponse = await response.json();
				if (!active) return;

				setData(standings);
			} catch (e) {
				if (!active) return;
				setError(e instanceof Error ? e.message : "unknown standings error");
			} finally {
				if (active) setLoading(false);
			}
		};

		load();

		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw) as { driverDeltas?: CalculatorMap; constructorDeltas?: CalculatorMap };
			setDriverDeltas(parsed.driverDeltas ?? {});
			setConstructorDeltas(parsed.constructorDeltas ?? {});
		} catch {
			// ignore broken persisted value
		}
	}, []);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ driverDeltas, constructorDeltas }));
	}, [driverDeltas, constructorDeltas]);

	const simulatedDrivers = useMemo(
		() => (data ? rankDrivers(data.drivers, driverDeltas) : []),
		[data, driverDeltas],
	);
	const simulatedConstructors = useMemo(
		() => (data ? rankConstructors(data.constructors, constructorDeltas) : []),
		[data, constructorDeltas],
	);

	if (loading) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<p>Loading standings...</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="flex h-full w-full flex-col items-center justify-center gap-2">
				<p>Standings unavailable</p>
				<p className="text-sm text-zinc-500">{error ?? "no data returned"}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 pb-8">
			<div className="rounded-lg border border-zinc-800 p-3 text-sm text-zinc-400">
				<p>
					Official standings source: <span className="text-zinc-200">{data.source}</span> (season {data.season}, round{" "}
					{data.round})
				</p>
				<p>Simulation edits are local-only and do not modify official standings.</p>
			</div>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
				<section className="rounded-lg border border-zinc-800 p-3">
					<h2 className="mb-3 text-xl">Drivers Championship</h2>
					<DriverTable
						official={data.drivers}
						simulated={simulatedDrivers}
						deltas={driverDeltas}
						setDelta={(driverId, value) =>
							setDriverDeltas((prev) => ({
								...prev,
								[driverId]: value,
							}))
						}
					/>
				</section>

				<section className="rounded-lg border border-zinc-800 p-3">
					<h2 className="mb-3 text-xl">Constructors Championship</h2>
					<ConstructorTable
						official={data.constructors}
						simulated={simulatedConstructors}
						deltas={constructorDeltas}
						setDelta={(constructorId, value) =>
							setConstructorDeltas((prev) => ({
								...prev,
								[constructorId]: value,
							}))
						}
					/>
				</section>
			</div>
		</div>
	);
}

function DriverTable({
	official,
	simulated,
	deltas,
	setDelta,
}: {
	official: DriverStanding[];
	simulated: Array<DriverStanding & { simulatedPoints: number }>;
	deltas: CalculatorMap;
	setDelta: (driverId: string, value: number) => void;
}) {
	const officialById = useMemo(
		() =>
			Object.fromEntries(
				official.map((item) => [item.driverId, item]),
			) as Record<string, DriverStanding>,
		[official],
	);

	return (
		<div className="overflow-x-auto">
			<table className="min-w-full border-collapse text-sm">
				<thead className="text-zinc-400">
					<tr className="border-b border-zinc-800">
						<th className="p-2 text-left">Sim</th>
						<th className="p-2 text-left">Official</th>
						<th className="p-2 text-left">Driver</th>
						<th className="p-2 text-right">Official pts</th>
						<th className="p-2 text-right">Edit +/-</th>
						<th className="p-2 text-right">Simulated pts</th>
					</tr>
				</thead>
				<tbody>
					{simulated.map((item, idx) => {
						const officialItem = officialById[item.driverId];
						return (
							<tr key={item.driverId} className="border-b border-zinc-900">
								<td className="p-2">{idx + 1}</td>
								<td className="p-2">{officialItem?.position ?? "-"}</td>
								<td className="p-2">
									{item.givenName} {item.familyName}
								</td>
								<td className="p-2 text-right">{item.points.toFixed(0)}</td>
								<td className="p-2 text-right">
									<input
										className="w-20 rounded border border-zinc-700 bg-zinc-900 p-1 text-right"
										value={String(deltas[item.driverId] ?? 0)}
										onChange={(e) => setDelta(item.driverId, safeNumber(e.target.value))}
									/>
								</td>
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
	deltas,
	setDelta,
}: {
	official: ConstructorStanding[];
	simulated: Array<ConstructorStanding & { simulatedPoints: number }>;
	deltas: CalculatorMap;
	setDelta: (constructorId: string, value: number) => void;
}) {
	const officialById = useMemo(
		() =>
			Object.fromEntries(
				official.map((item) => [item.constructorId, item]),
			) as Record<string, ConstructorStanding>,
		[official],
	);

	return (
		<div className="overflow-x-auto">
			<table className="min-w-full border-collapse text-sm">
				<thead className="text-zinc-400">
					<tr className="border-b border-zinc-800">
						<th className="p-2 text-left">Sim</th>
						<th className="p-2 text-left">Official</th>
						<th className="p-2 text-left">Constructor</th>
						<th className="p-2 text-right">Official pts</th>
						<th className="p-2 text-right">Edit +/-</th>
						<th className="p-2 text-right">Simulated pts</th>
					</tr>
				</thead>
				<tbody>
					{simulated.map((item, idx) => {
						const officialItem = officialById[item.constructorId];
						return (
							<tr key={item.constructorId} className="border-b border-zinc-900">
								<td className="p-2">{idx + 1}</td>
								<td className="p-2">{officialItem?.position ?? "-"}</td>
								<td className="p-2">{item.name}</td>
								<td className="p-2 text-right">{item.points.toFixed(0)}</td>
								<td className="p-2 text-right">
									<input
										className="w-20 rounded border border-zinc-700 bg-zinc-900 p-1 text-right"
										value={String(deltas[item.constructorId] ?? 0)}
										onChange={(e) => setDelta(item.constructorId, safeNumber(e.target.value))}
									/>
								</td>
								<td className="p-2 text-right font-semibold">{item.simulatedPoints.toFixed(0)}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
