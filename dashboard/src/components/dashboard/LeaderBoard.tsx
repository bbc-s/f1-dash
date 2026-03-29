import { AnimatePresence, LayoutGroup } from "motion/react";
import clsx from "clsx";
import { useState } from "react";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { useDataStore } from "@/stores/useDataStore";

import { sortPos } from "@/lib/sorting";

import Driver from "@/components/driver/Driver";

export default function LeaderBoard() {
	const drivers = useDataStore(({ state }) => state?.DriverList);
	const driversTiming = useDataStore(({ state }) => state?.TimingData);
	const settings = useSettingsStore();
	const [showColumns, setShowColumns] = useState(false);

	const showTableHeader = settings.tableHeaders;
	const leaderboardColumns = settings.leaderboardColumns;
	const visibleColumns = leaderboardColumns.filter((col) => col.visible);
	const template = visibleColumns.map((col) => col.width).join(" ");

	return (
		<div className="flex w-fit flex-col gap-0.5">
			<div className="mb-1 flex items-center justify-between rounded border border-zinc-800 p-1">
				<p className="text-xs text-zinc-400">Leaderboard Columns</p>
				<button className="rounded border border-zinc-700 px-2 py-0.5 text-xs" onClick={() => setShowColumns((v) => !v)}>
					{showColumns ? "hide controls" : "show controls"}
				</button>
			</div>

			{showColumns && (
				<div className="mb-2 grid gap-1 rounded border border-zinc-800 p-2 text-xs">
					{leaderboardColumns.map((column) => (
						<div key={column.id} className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={column.visible}
								onChange={(e) => settings.setLeaderboardColumnVisible(column.id, e.target.checked)}
							/>
							<span className="w-24">{column.label}</span>
							<input
								className="w-20 rounded border border-zinc-700 bg-zinc-900 p-1"
								value={column.width}
								onChange={(e) => settings.setLeaderboardColumnWidth(column.id, e.target.value)}
							/>
							<button
								className="rounded border border-zinc-700 px-1"
								onClick={() => settings.moveLeaderboardColumn(column.id, "left")}
								type="button"
							>
								←
							</button>
							<button
								className="rounded border border-zinc-700 px-1"
								onClick={() => settings.moveLeaderboardColumn(column.id, "right")}
								type="button"
							>
								→
							</button>
						</div>
					))}
				</div>
			)}

			{showTableHeader && <TableHeaders template={template} />}

			{(!drivers || !driversTiming) &&
				new Array(20).fill("").map((_, index) => <SkeletonDriver key={`driver.loading.${index}`} />)}

			<LayoutGroup key="drivers">
				{drivers && driversTiming && (
					<AnimatePresence>
						{Object.values(driversTiming.Lines)
							.sort(sortPos)
							.map((timingDriver, index) => (
								<Driver
									key={`leaderBoard.driver.${timingDriver.RacingNumber}`}
									position={index + 1}
									driver={drivers[timingDriver.RacingNumber]}
									timingDriver={timingDriver}
									template={template}
									columns={visibleColumns}
								/>
							))}
					</AnimatePresence>
				)}
			</LayoutGroup>
		</div>
	);
}

const TableHeaders = ({ template }: { template: string }) => {
	const columns = useSettingsStore((state) => state.leaderboardColumns).filter((col) => col.visible);

	return (
		<div
			className="grid items-center gap-2 p-1 px-2 text-sm font-medium text-zinc-500"
			style={{
				gridTemplateColumns: template,
			}}
		>
			{columns.map((column) => (
				<p key={column.id}>{column.label}</p>
			))}
		</div>
	);
};

const SkeletonDriver = () => {
	const template = useSettingsStore((state) =>
		state.leaderboardColumns
			.filter((col) => col.visible)
			.map((col) => col.width)
			.join(" "),
	);
	const visibleCount = useSettingsStore((state) => state.leaderboardColumns.filter((col) => col.visible).length);

	const animateClass = "h-8 animate-pulse rounded-md bg-zinc-800";

	return (
		<div
			className="grid items-center gap-2 p-1.5"
			style={{
				gridTemplateColumns: template,
			}}
		>
			{new Array(visibleCount).fill(null).map((_, index) => (
				<div className={clsx(animateClass, "h-6")} key={`skeleton.cell.${index}`} style={{ width: "100%" }} />
			))}
		</div>
	);
};
