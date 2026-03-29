"use client";

import { useMemo } from "react";

import { useDataStore } from "@/stores/useDataStore";

type Availability = "available" | "unavailable" | "not-provided";

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

export default function TyreAvailability() {
	const drivers = useDataStore((state) => state.state?.DriverList);
	const timingAppData = useDataStore((state) => state.state?.TimingAppData?.Lines);

	const rows = useMemo(() => {
		if (!drivers) return [];

		return Object.values(drivers)
			.sort((a, b) => a.Line - b.Line)
			.map((driver) => {
				const appData = timingAppData?.[driver.RacingNumber];
				const stints = appData?.Stints ?? [];

				let status: Availability = "unavailable";
				if (!timingAppData) {
					status = "unavailable";
				} else if (stints.length > 0) {
					status = "not-provided";
				} else {
					status = "unavailable";
				}

				return {
					driver,
					status,
					usedSets: stints.length,
					lastCompound: stints[stints.length - 1]?.Compound ?? "-",
				};
			});
	}, [drivers, timingAppData]);

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
				<p className="text-xs text-zinc-500">Remaining sets are not provided by current feed</p>
			</div>

			<table className="min-w-full border-collapse text-sm">
				<thead className="text-zinc-500">
					<tr className="border-b border-zinc-800">
						<th className="p-2 text-left">Driver</th>
						<th className="p-2 text-left">Used sets</th>
						<th className="p-2 text-left">Last known compound</th>
						<th className="p-2 text-left">Remaining sets status</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.driver.RacingNumber} className="border-b border-zinc-900">
							<td className="p-2">
								{row.driver.Tla} <span className="text-zinc-500">{row.driver.LastName}</span>
							</td>
							<td className="p-2">{row.usedSets > 0 ? row.usedSets : "-"}</td>
							<td className="p-2">{row.lastCompound}</td>
							<td className={`p-2 capitalize ${statusColor(row.status)}`}>{row.status.replace("-", " ")}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
