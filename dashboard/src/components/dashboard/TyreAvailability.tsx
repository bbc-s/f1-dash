"use client";

import { useMemo } from "react";

import { useDataStore } from "@/stores/useDataStore";

type Availability = "available" | "unavailable" | "not-provided";
type Compound = "SOFT" | "MEDIUM" | "HARD";

const STANDARD_ALLOCATION: Record<Compound, number> = { HARD: 2, MEDIUM: 3, SOFT: 8 };
const SPRINT_ALLOCATION: Record<Compound, number> = { HARD: 2, MEDIUM: 4, SOFT: 6 };

function statusColor(status: Availability) {
	switch (status) {
		case "available":
			return "text-emerald-400";
		case "unavailable":
			return "text-zinc-500";
		case "not-provided":
			return "text-amber-400";
	}
}

function compoundClass(compound: string) {
	switch (compound.toUpperCase()) {
		case "SOFT":
			return "border-red-500/60 bg-red-500/15 text-red-200";
		case "MEDIUM":
			return "border-yellow-400/60 bg-yellow-400/15 text-yellow-100";
		case "HARD":
			return "border-zinc-200/60 bg-zinc-200/10 text-zinc-100";
		case "INTERMEDIATE":
			return "border-emerald-400/60 bg-emerald-400/15 text-emerald-100";
		case "WET":
			return "border-sky-400/60 bg-sky-400/15 text-sky-100";
		default:
			return "border-zinc-700 bg-zinc-900 text-zinc-300";
	}
}

function CompoundPill({ compound, label }: { compound: string; label?: string }) {
	return (
		<span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${compoundClass(compound)}`}>
			{label ?? compound}
		</span>
	);
}

function isDryCompound(compound?: string): compound is Compound {
	return compound === "SOFT" || compound === "MEDIUM" || compound === "HARD";
}

function setKey(compound: Compound, newFlag: string | undefined, index: number) {
	// F1 feed does not expose physical tyre set IDs, so we group repeat use of an old set by compound order.
	return newFlag?.toLowerCase() === "true" ? `${compound}-${index}` : `${compound}-reuse-${index}`;
}

export default function TyreAvailability() {
	const drivers = useDataStore((state) => state.state?.DriverList);
	const timingAppData = useDataStore((state) => state.state?.TimingAppData?.Lines);
	const sessionName = useDataStore((state) => state.state?.SessionInfo?.Name ?? "");
	const sessionPath = useDataStore((state) => state.state?.SessionInfo?.Path ?? "");
	const isSprintWeekend = /sprint/i.test(`${sessionName} ${sessionPath}`);
	const allocation = isSprintWeekend ? SPRINT_ALLOCATION : STANDARD_ALLOCATION;

	const rows = useMemo(() => {
		if (!drivers) return [];

		return Object.values(drivers)
			.sort((a, b) => a.Line - b.Line)
			.map((driver) => {
				const appData = timingAppData?.[driver.RacingNumber];
				const stints = appData?.Stints ?? [];
				const dryStints = stints.filter((stint) => isDryCompound(stint.Compound));
				const usedByCompound = dryStints.reduce<Record<Compound, number>>(
					(acc, stint) => {
						if (isDryCompound(stint.Compound) && stint.New?.toLowerCase() === "true") acc[stint.Compound] += 1;
						return acc;
					},
					{ HARD: 0, MEDIUM: 0, SOFT: 0 },
				);
				const displayStints = dryStints.map((stint, index) => ({
					compound: stint.Compound as Compound,
					laps: stint.TotalLaps ?? 0,
					newSet: stint.New?.toLowerCase() === "true",
					key: setKey(stint.Compound as Compound, stint.New, index),
				}));
				const remaining = {
					HARD: Math.max(0, allocation.HARD - usedByCompound.HARD),
					MEDIUM: Math.max(0, allocation.MEDIUM - usedByCompound.MEDIUM),
					SOFT: Math.max(0, allocation.SOFT - usedByCompound.SOFT),
				};

				let status: Availability = "unavailable";
				if (!timingAppData) {
					status = "not-provided";
				} else if (stints.length > 0) {
					status = "available";
				} else {
					status = "unavailable";
				}

				return {
					driver,
					status,
					usedSets: Object.values(usedByCompound).reduce((sum, value) => sum + value, 0),
					lastCompound: stints[stints.length - 1]?.Compound ?? "-",
					displayStints,
					remaining,
				};
			});
	}, [drivers, timingAppData, allocation.HARD, allocation.MEDIUM, allocation.SOFT]);

	if (!rows.length) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-zinc-500">Tyre set data unavailable</p>
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto rounded-lg border border-zinc-800 p-2">
			<div className="mb-2 flex items-center justify-between">
				<h3 className="text-lg">Tyre Sets Per Driver</h3>
				<p className="text-xs text-zinc-500">
					{isSprintWeekend ? "Sprint allocation" : "Standard allocation"}: H{allocation.HARD} / M{allocation.MEDIUM} / S{allocation.SOFT}
				</p>
			</div>

			<table className="min-w-full border-collapse text-sm">
				<thead className="text-zinc-500">
					<tr className="border-b border-zinc-800">
						<th className="p-2 text-left">Driver</th>
						<th className="p-2 text-left">Used sets</th>
						<th className="p-2 text-left">Available dry sets</th>
						<th className="p-2 text-left">Last known compound</th>
						<th className="p-2 text-left">Status</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.driver.RacingNumber} className="border-b border-zinc-900">
							<td className="p-2">
								{row.driver.Tla} <span className="text-zinc-500">{row.driver.LastName}</span>
							</td>
							<td className="p-2">
								{row.displayStints.length > 0 ? (
									<div className="flex flex-wrap gap-1">
										{row.displayStints.map((stint) => (
											<CompoundPill
												key={stint.key}
												compound={stint.compound}
												label={`${stint.compound[0]}${stint.newSet ? "" : "*"} ${stint.laps}L`}
											/>
										))}
									</div>
								) : "-"}
							</td>
							<td className="p-2">
								<div className="flex flex-wrap gap-1">
									<CompoundPill compound="HARD" label={`H ${row.remaining.HARD}`} />
									<CompoundPill compound="MEDIUM" label={`M ${row.remaining.MEDIUM}`} />
									<CompoundPill compound="SOFT" label={`S ${row.remaining.SOFT}`} />
								</div>
							</td>
							<td className="p-2">{row.lastCompound !== "-" ? <CompoundPill compound={row.lastCompound} /> : "-"}</td>
							<td className={`p-2 capitalize ${statusColor(row.status)}`}>{row.status.replace("-", " ")}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
