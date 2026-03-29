import { AnimatePresence, LayoutGroup } from "motion/react";
import clsx from "clsx";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { useDataStore } from "@/stores/useDataStore";

import { sortPos } from "@/lib/sorting";

import Driver from "@/components/driver/Driver";

export default function LeaderBoard() {
	const drivers = useDataStore(({ state }) => state?.DriverList);
	const driversTiming = useDataStore(({ state }) => state?.TimingData);

	const showTableHeader = useSettingsStore((state) => state.tableHeaders);
	const leaderboardColumns = useSettingsStore((state) => state.leaderboardColumns);
	const visibleColumns = leaderboardColumns.filter((col) => col.visible);
	const template = visibleColumns.map((col) => col.width).join(" ");

	return (
		<div className="flex w-fit flex-col gap-0.5">
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
