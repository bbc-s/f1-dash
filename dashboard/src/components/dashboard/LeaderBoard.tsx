import { AnimatePresence, LayoutGroup } from "motion/react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { useDataStore } from "@/stores/useDataStore";
import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";

import { sortPos } from "@/lib/sorting";
import type { LeaderboardColumn, LeaderboardColumnId } from "@/types/leaderboard.type";

import Driver from "@/components/driver/Driver";

const MIN_COL_WIDTH = 56;

function widthToPx(width: string): number {
	const trimmed = width.trim();
	if (trimmed.endsWith("px")) return Math.max(MIN_COL_WIDTH, Number.parseInt(trimmed, 10) || MIN_COL_WIDTH);
	if (trimmed.endsWith("rem")) return Math.max(MIN_COL_WIDTH, Math.round((Number.parseFloat(trimmed) || 0) * 16));
	if (trimmed === "auto") return 180;
	const raw = Number.parseInt(trimmed, 10);
	return Math.max(MIN_COL_WIDTH, Number.isFinite(raw) ? raw : 180);
}

function pxToWidth(px: number): string {
	return `${Math.max(MIN_COL_WIDTH, Math.round(px))}px`;
}

export default function LeaderBoard() {
	const drivers = useDataStore(({ state }) => state?.DriverList);
	const driversTiming = useDataStore(({ state }) => state?.TimingData);
	const showTableHeader = useSettingsStore((state) => state.tableHeaders);
	const columns = useSettingsStore((state) => state.leaderboardColumns);
	const visibleColumns = columns.filter((col) => col.visible);
	const template = visibleColumns.map((col) => col.width).join(" ");

	return (
		<div className="flex w-fit flex-col gap-0.5">
			{showTableHeader && <TableHeaders template={template} columns={visibleColumns} />}

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

function TableHeaders({ template, columns }: { template: string; columns: LeaderboardColumn[] }) {
	const allColumns = useSettingsStore((state) => state.leaderboardColumns);
	const setLeaderboardColumnVisible = useSettingsStore((state) => state.setLeaderboardColumnVisible);
	const setLeaderboardColumnWidth = useSettingsStore((state) => state.setLeaderboardColumnWidth);
	const moveLeaderboardColumn = useSettingsStore((state) => state.moveLeaderboardColumn);
	const layoutLocked = useWidgetLayoutStore((state) => state.layoutLocked);
	const [menuOpen, setMenuOpen] = useState(false);

	const resizingRef = useRef<{
		id: LeaderboardColumnId;
		startX: number;
		startWidthPx: number;
	} | null>(null);

	useEffect(() => {
		const onMove = (event: MouseEvent) => {
			if (!resizingRef.current || layoutLocked) return;
			event.preventDefault();
			const delta = event.clientX - resizingRef.current.startX;
			const next = resizingRef.current.startWidthPx + delta;
			setLeaderboardColumnWidth(resizingRef.current.id, pxToWidth(next));
		};
		const onUp = () => {
			resizingRef.current = null;
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [setLeaderboardColumnWidth, layoutLocked]);

	return (
		<div className="mb-1 rounded border border-zinc-800 p-1">
			<div className="mb-1 flex items-center justify-between px-1">
				<p className="text-[11px] text-zinc-400">Columns</p>
				{!layoutLocked && (
					<button
						className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 hover:border-cyan-500"
						onClick={() => setMenuOpen((v) => !v)}
						type="button"
					>
						{menuOpen ? "Hide list" : "Column list"}
					</button>
				)}
			</div>
			{menuOpen && !layoutLocked && (
				<div className="mb-2 grid gap-1 rounded border border-zinc-800 bg-zinc-900/50 p-2 text-xs">
					{allColumns.map((column) => (
						<label key={column.id} className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={column.visible}
								onChange={(e) => setLeaderboardColumnVisible(column.id, e.target.checked)}
							/>
							<span>{column.label}</span>
						</label>
					))}
				</div>
			)}

			<div
				className="grid items-center gap-2 px-1 py-1 text-sm font-medium text-zinc-300"
				style={{
					gridTemplateColumns: template,
				}}
			>
				{columns.map((column) => (
					<div key={column.id} className="group relative flex items-center rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
						<div className="truncate text-xs">{column.label}</div>
						{!layoutLocked && (
							<>
								<div className="ml-auto hidden items-center gap-1 text-[10px] group-hover:flex">
									<button
										className="rounded border border-zinc-700 px-1 hover:border-cyan-500"
										onClick={() => moveLeaderboardColumn(column.id, "left")}
										type="button"
									>
										L
									</button>
									<button
										className="rounded border border-zinc-700 px-1 hover:border-cyan-500"
										onClick={() => moveLeaderboardColumn(column.id, "right")}
										type="button"
									>
										R
									</button>
									<button
										className="rounded border border-zinc-700 px-1 hover:border-cyan-500"
										onClick={() => setLeaderboardColumnVisible(column.id, false)}
										type="button"
									>
										Hide
									</button>
								</div>
								<div
									className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
									onMouseDown={(event) => {
										event.preventDefault();
										event.stopPropagation();
										resizingRef.current = {
											id: column.id,
											startX: event.clientX,
											startWidthPx: widthToPx(column.width),
										};
									}}
								/>
							</>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

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
