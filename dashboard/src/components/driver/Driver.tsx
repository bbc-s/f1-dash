"use client";

import clsx from "clsx";
import { motion } from "motion/react";

import type { Driver, TimingDataDriver } from "@/types/state.type";
import type { LeaderboardColumn } from "@/types/leaderboard.type";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { useDataStore } from "@/stores/useDataStore";

import DriverTag from "./DriverTag";
import DriverDRS from "./DriverDRS";
import DriverGap from "./DriverGap";
import DriverTire from "./DriverTire";
import DriverMiniSectors from "./DriverMiniSectors";
import DriverLapTime from "./DriverLapTime";
import DriverInfo from "./DriverInfo";

type Props = {
	position: number;
	driver: Driver;
	timingDriver: TimingDataDriver;
	template: string;
	columns: LeaderboardColumn[];
};

const hasDRS = (drs: number) => drs > 9;
const possibleDRS = (drs: number) => drs === 8;

const inDangerZone = (position: number, sessionPart: number) => {
	switch (sessionPart) {
		case 1:
			return position > 15;
		case 2:
			return position > 10;
		case 3:
		default:
			return false;
	}
};

function renderExtraChannels(channels: Record<string, number>) {
	const known = new Set(["0", "2", "3", "4", "5", "45"]);
	const pairs = Object.entries(channels)
		.filter(([key]) => !known.has(key))
		.sort((a, b) => Number(a[0]) - Number(b[0]))
		.slice(0, 6)
		.map(([key, value]) => `${key}:${value}`);
	if (pairs.length === 0) return "-";
	return pairs.join(" | ");
}

export default function Driver({ driver, timingDriver, position, template, columns }: Props) {
	const sessionPart = useDataStore((state) => state.state?.TimingData?.SessionPart);
	const timingStatsDriver = useDataStore((state) => state.state?.TimingStats?.Lines[driver.RacingNumber]);
	const appTimingDriver = useDataStore((state) => state.state?.TimingAppData?.Lines[driver.RacingNumber]);
	const carData = useDataStore((state) => (state?.carsData ? state.carsData[driver.RacingNumber].Channels : undefined));

	const hasFastest = timingStatsDriver?.PersonalBestLapTime.Position == 1;
	const favoriteDriver = useSettingsStore((state) => state.favoriteDrivers.includes(driver.RacingNumber));

	return (
		<motion.div
			layout="position"
			className={clsx("flex flex-col gap-1 rounded-lg p-1.5 select-none", {
				"opacity-50": timingDriver.KnockedOut || timingDriver.Retired || timingDriver.Stopped,
				"bg-sky-800/30": favoriteDriver,
				"bg-violet-800/30": hasFastest,
				"bg-red-800/30": sessionPart != undefined && inDangerZone(position, sessionPart),
			})}
		>
			<div className="grid items-center gap-2" style={{ gridTemplateColumns: template }}>
				{columns.map((column) => {
					switch (column.id) {
						case "position":
							return (
								<DriverTag key={column.id} className="min-w-full!" short={driver.Tla} teamColor={driver.TeamColour} position={position} />
							);
						case "drs":
							return (
								<DriverDRS
									key={column.id}
									on={carData ? hasDRS(carData["45"] ?? 0) : false}
									possible={carData ? possibleDRS(carData["45"] ?? 0) : false}
									inPit={timingDriver.InPit}
									pitOut={timingDriver.PitOut}
								/>
							);
						case "tire":
							return <DriverTire key={column.id} stints={appTimingDriver?.Stints} />;
						case "info":
							return <DriverInfo key={column.id} timingDriver={timingDriver} gridPos={appTimingDriver ? parseInt(appTimingDriver.GridPos) : 0} />;
						case "gap":
							return <DriverGap key={column.id} timingDriver={timingDriver} sessionPart={sessionPart} />;
						case "laptime":
							return <DriverLapTime key={column.id} last={timingDriver.LastLapTime} best={timingDriver.BestLapTime} hasFastest={hasFastest} />;
						case "sectors":
							return <DriverMiniSectors key={column.id} sectors={timingDriver.Sectors} bestSectors={timingStatsDriver?.BestSectors} />;
						case "speed":
							return <p key={column.id} className="font-mono">{carData ? `${carData["2"]} km/h` : "-"}</p>;
						case "gear":
							return <p key={column.id} className="font-mono text-xl">{carData ? carData["3"] : "-"}</p>;
						case "throttle":
							return <p key={column.id} className="font-mono">{carData ? `${carData["4"]}%` : "-"}</p>;
						case "brake":
							return <p key={column.id} className="font-mono">{carData ? (carData["5"] === 1 ? "ON" : "OFF") : "-"}</p>;
						case "extra":
							return <p key={column.id} className="truncate font-mono text-[11px] text-zinc-300">{carData ? renderExtraChannels(carData) : "-"}</p>;
					}
				})}
			</div>
		</motion.div>
	);
}
