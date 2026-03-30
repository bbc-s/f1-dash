"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { useDataEngine } from "@/hooks/useDataEngine";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useStores } from "@/hooks/useStores";
import { useLiveSyncSocket } from "@/hooks/useLiveSyncSocket";
import { useWidgetLayoutSync } from "@/hooks/useWidgetLayoutSync";
import { useReplaySync } from "@/hooks/useReplaySync";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { useDataStore } from "@/stores/useDataStore";
import { useReplayStore } from "@/stores/useReplayStore";
import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";
import { env } from "@/env";

import Sidebar from "@/components/Sidebar";
import SidenavButton from "@/components/SidenavButton";
import SessionInfo from "@/components/SessionInfo";
import WeatherInfo from "@/components/WeatherInfo";
import TrackInfo from "@/components/TrackInfo";
import DelayInput from "@/components/DelayInput";
import DelayTimer from "@/components/DelayTimer";
import ConnectionStatus from "@/components/ConnectionStatus";

type Props = {
	children: ReactNode;
};

export default function DashboardLayout({ children }: Props) {
	const stores = useStores();
	const mode = useReplayStore((state) => state.mode);
	const { handleInitial, handleUpdate, maxDelay } = useDataEngine({ ...stores, enabled: mode === "live" });
	const replayConnected = useReplayStore((state) => state.connected);

	const { connected: liveConnected } = useLiveSyncSocket({
		enabled: mode === "live",
		handleInitial,
		handleUpdate,
	});

	const replayControls = useReplaySync(stores);
	useWidgetLayoutSync();

	const connected = mode === "live" ? liveConnected : replayConnected;

	const delay = useSettingsStore((state) => state.delay);
	const syncing = mode === "live" && delay > maxDelay;

	useWakeLock();

	const ended = useDataStore(({ state }) => state?.SessionStatus?.Status === "Ends");

	return (
		<div className="flex h-screen w-full md:pt-2 md:pr-2 md:pb-2">
			<Sidebar key="sidebar" connected={connected} />

			<motion.div layout="size" className="flex h-full w-full flex-1 flex-col md:gap-2">
				<DesktopStaticBar show={!syncing || ended} replayControls={replayControls} />
				<MobileStaticBar
					show={!syncing || ended}
					connected={connected}
					replayControls={replayControls}
				/>

				<div className={!syncing || ended ? "no-scrollbar w-full flex-1 overflow-auto md:rounded-lg" : "hidden"}>
					<MobileDynamicBar />
					{children}
				</div>

				<div
					className={
						syncing && !ended
							? "flex h-full flex-1 flex-col items-center justify-center gap-2 border-zinc-800 md:rounded-lg md:border"
							: "hidden"
					}
				>
					<h1 className="my-20 text-center text-5xl font-bold">Syncing...</h1>
					<p>Please wait for {delay - maxDelay} seconds.</p>
					<p>Or make your delay smaller.</p>
				</div>
			</motion.div>
		</div>
	);
}

function MobileDynamicBar() {
	return (
		<div className="flex flex-col divide-y divide-zinc-800 border-b border-zinc-800 md:hidden">
			<div className="p-2">
				<SessionInfo />
			</div>
			<div className="p-2">
				<WeatherInfo />
			</div>
		</div>
	);
}

function MobileStaticBar({
	show,
	connected,
	replayControls,
}: {
	show: boolean;
	connected: boolean;
	replayControls: ReturnType<typeof useReplaySync>;
}) {
	const open = useSidebarStore((state) => state.open);

	return (
		<div className="flex w-full flex-col overflow-hidden border-b border-zinc-800 p-2 md:hidden">
			<div className="mb-1 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<SidenavButton key="mobile" onClick={() => open()} />
					<DelayInput saveDelay={500} />
					<DelayTimer />
					<ConnectionStatus connected={connected} />
				</div>
				{show && <TrackInfo />}
			</div>
			<ReplayControls controls={replayControls} compact />
		</div>
	);
}

function DesktopStaticBar({
	show,
	replayControls,
}: {
	show: boolean;
	replayControls: ReturnType<typeof useReplaySync>;
}) {
	const pinned = useSidebarStore((state) => state.pinned);
	const pin = useSidebarStore((state) => state.pin);

	return (
		<div className="hidden w-full flex-col overflow-hidden rounded-lg border border-zinc-800 p-2 md:flex">
			<div className="mb-2 flex w-full flex-row justify-between">
				<div className="flex items-center gap-2">
					<AnimatePresence>
						{!pinned && <SidenavButton key="desktop" className="shrink-0" onClick={() => pin()} />}

						<motion.div key="session-info" layout="position">
							<SessionInfo />
						</motion.div>
					</AnimatePresence>
				</div>

				<div className="hidden md:items-center lg:flex">{show && <WeatherInfo />}</div>

				<div className="flex justify-end">{show && <TrackInfo />}</div>
			</div>
			<ReplayControls controls={replayControls} />
		</div>
	);
}

function ReplayControls({ controls, compact = false }: { controls: ReturnType<typeof useReplaySync>; compact?: boolean }) {
	const mode = useReplayStore((state) => state.mode);
	const setMode = useReplayStore((state) => state.setMode);
	const playing = useReplayStore((state) => state.playing);
	const speed = useReplayStore((state) => state.speed);
	const cursorMs = useReplayStore((state) => state.cursorMs);
	const durationMs = useReplayStore((state) => state.durationMs);
	const layoutLocked = useWidgetLayoutStore((state) => state.layoutLocked);
	const setLayoutLocked = useWidgetLayoutStore((state) => state.setLayoutLocked);
	const sessionInfo = useDataStore((state) => state.state?.SessionInfo);
	const clockUtc = useDataStore((state) => state.state?.ExtrapolatedClock?.Utc);

	type ReplayRecording = { id: string; label: string };
	const pendingReplayKey = "f1dash-pending-replay-id-v1";

	const [loadId, setLoadId] = useState("");
	const [recordings, setRecordings] = useState<ReplayRecording[]>([]);
	const [archiveRecording, setArchiveRecording] = useState(false);
	const [archiveError, setArchiveError] = useState("");
	const [recordToggleBusy, setRecordToggleBusy] = useState(false);
	const [autoRecordOnData, setAutoRecordOnData] = useState(false);
	const autoRecordEnabled = env.NEXT_PUBLIC_ARCHIVE_AUTO_RECORD === "true";
	const lastClockRef = useRef<string | null>(null);
	const autoStartBusyRef = useRef(false);

	const seconds = useMemo(() => Math.floor(cursorMs / 1000), [cursorMs]);
	const totalSeconds = useMemo(() => Math.floor(durationMs / 1000), [durationMs]);

	const buildRecordingName = useCallback(() => {
		const meeting = sessionInfo?.Meeting?.Name?.trim() || "UnknownRace";
		const session = sessionInfo?.Name?.trim() || "UnknownSession";
		const stamp = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").replace("T", "-").slice(0, 15);
		const sanitize = (value: string) => value.replace(/[<>:\"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, " ").trim();
		return `${sanitize(meeting)} + ${sanitize(session)} + ${stamp}`;
	}, [sessionInfo]);

	const refreshArchiveStatus = useCallback(async () => {
		const status = (await controls.status()) as
			| { recording?: boolean; storagePath?: string; recordingId?: string | null; autoRecordOnData?: boolean }
			| null;
		if (!status) return false;
		setArchiveRecording(Boolean(status.recording));
		setAutoRecordOnData(Boolean(status.autoRecordOnData));
		setArchiveError("");
		return true;
	}, [controls]);

	const loadRecordings = useCallback(async () => {
		const res = (await controls.listRecordings()) as { recordings?: string[] } | null;
		const raw = res?.recordings ?? [];
		const next = raw
			.map((id) => ({ id, label: id }))
			.sort((a, b) => a.id.localeCompare(b.id))
			.reverse();
		setRecordings(next);
	}, [controls]);

	useEffect(() => {
		let mounted = true;
		const loadStatus = async () => {
			if (!mounted) return;
			await refreshArchiveStatus();
		};
		void loadStatus();
		void loadRecordings();
		const timer = window.setInterval(() => {
			void loadStatus();
			void loadRecordings();
		}, 2000);
		return () => {
			mounted = false;
			window.clearInterval(timer);
		};
	}, [refreshArchiveStatus, controls, loadRecordings]);

	useEffect(() => {
		if (!autoRecordOnData || archiveRecording || mode !== "live") return;
		if (!clockUtc) return;
		if (lastClockRef.current === clockUtc) return;
		lastClockRef.current = clockUtc;
		if (autoStartBusyRef.current) return;
		autoStartBusyRef.current = true;
		void (async () => {
			try {
				await controls.startRecording(buildRecordingName());
				await refreshArchiveStatus();
				await loadRecordings();
			} finally {
				autoStartBusyRef.current = false;
			}
		})();
	}, [autoRecordOnData, archiveRecording, clockUtc, mode, controls, buildRecordingName, refreshArchiveStatus, loadRecordings]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const pending = localStorage.getItem(pendingReplayKey);
		if (!pending) return;
		localStorage.removeItem(pendingReplayKey);
		void (async () => {
			setMode("replay");
			setLoadId(pending);
			await controls.load(pending);
			await controls.play();
		})();
	}, [controls, setMode]);

	const actionButton = "cursor-pointer rounded border border-zinc-500 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 shadow-sm hover:border-cyan-500 hover:bg-zinc-700";
	const actionPrimary = "cursor-pointer rounded border border-cyan-400 bg-cyan-700/35 px-2 py-1 text-xs font-semibold text-cyan-100 shadow-sm hover:bg-cyan-700/50";
	const iconButton = "cursor-pointer rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 hover:border-cyan-500 hover:bg-zinc-700";

	return (
		<div className={`flex ${compact ? "flex-col" : "flex-row items-center"} gap-2 border-t border-zinc-800 pt-2`}>
			<div className="flex items-center gap-1">
				<button className={mode === "live" ? actionPrimary : actionButton} onClick={() => setMode("live")} type="button">
					Live
				</button>
				<button className={mode === "replay" ? actionPrimary : actionButton} onClick={() => setMode("replay")} type="button">
					Replay
				</button>
			</div>
			<div className="rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
				Mode: <span className={autoRecordOnData || autoRecordEnabled ? "text-amber-300" : "text-zinc-300"}>{autoRecordOnData || autoRecordEnabled ? "AUTO" : "MANUAL"}</span>
				{" | "}Rec: {archiveRecording ? <span className="text-emerald-300">ON</span> : <span className="text-zinc-500">OFF</span>}
			</div>
			<div className="flex items-center gap-1">
				<button
					className="cursor-pointer rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 hover:border-cyan-500 hover:bg-zinc-700"
					onClick={async () => {
						try {
							setRecordToggleBusy(true);
							if (archiveRecording) {
								await controls.stopRecording();
							} else {
								await controls.startRecording(buildRecordingName());
							}
							const ok = await refreshArchiveStatus();
							await loadRecordings();
							if (!ok) setArchiveError("recorder status unavailable");
						} catch {
							setArchiveError("recording request failed");
						} finally {
							setRecordToggleBusy(false);
						}
					}}
					disabled={recordToggleBusy}
					type="button"
				>
					{recordToggleBusy ? (
						<>Updating…</>
					) : archiveRecording ? (
						<>
							Recording (manual) <span className="text-red-400">●</span>
						</>
					) : (
						<>
							Not rec (manual) <span className="text-zinc-500">●</span>
						</>
					)}
				</button>
				<button
					className={autoRecordOnData ? actionPrimary : actionButton}
					onClick={async () => {
						const next = !autoRecordOnData;
						await controls.setAutoRecord(next);
						await refreshArchiveStatus();
					}}
					type="button"
				>
					Auto rec on data: {autoRecordOnData ? "On" : "Off"}
				</button>
			</div>
			{archiveError && <div className="text-xs text-red-300">{archiveError}</div>}
			{mode === "replay" && (
				<>
					<select
						className="rounded border border-zinc-700 bg-zinc-900 p-1 text-xs"
						value={loadId}
						onChange={(e) => {
							const value = e.target.value;
							setLoadId(value);
							if (value) void controls.load(value);
						}}
					>
						<option value="">select recording</option>
						{recordings.map((recording) => (
							<option key={recording.id} value={recording.id}>
								{recording.label}
							</option>
						))}
					</select>
					<button
						className="cursor-pointer rounded border border-red-500 bg-zinc-800 px-2 py-1 text-xs text-red-200 shadow-sm hover:bg-zinc-700"
						disabled={!loadId}
						onClick={async () => {
							if (!loadId) return;
							await controls.deleteRecording(loadId);
							setLoadId("");
							void loadRecordings();
						}}
						type="button"
					>
						Delete
					</button>
					<div className="flex items-center gap-1">
						{playing ? (
							<button className={iconButton} onClick={() => void controls.pause()} type="button" title="Pause">
								⏸
							</button>
						) : (
							<button className={iconButton} onClick={() => void controls.play()} type="button" title="Play">
								▶
							</button>
						)}
						<button
							className={iconButton}
							onClick={() => {
								void controls.pause();
								void controls.seek(0);
							}}
							type="button"
							title="Stop"
						>
							⏹
						</button>
						<span className={`text-xs ${playing ? "text-emerald-300" : "text-zinc-500"}`}>{playing ? "Playing" : "Stopped"}</span>
					</div>
					<select className="rounded border border-zinc-700 bg-zinc-900 p-1 text-xs" value={String(speed)} onChange={(e) => void controls.speed(Number(e.target.value))}>
						<option value="0.25">0.25x</option>
						<option value="0.5">0.5x</option>
						<option value="1">1x</option>
						<option value="2">2x</option>
						<option value="4">4x</option>
						<option value="8">8x</option>
					</select>
					<input
						type="range"
						className="w-56"
						min={0}
						max={Math.max(durationMs, 1)}
						value={Math.min(cursorMs, Math.max(durationMs, 1))}
						onChange={(e) => void controls.seek(Number(e.target.value))}
					/>
					<span className="text-xs text-zinc-400">
						{seconds}s / {totalSeconds}s
					</span>
				</>
			)}
			<div className={compact ? "w-full" : "ml-auto"}>
				<button
					className={`rounded border px-2 py-1 text-xs ${layoutLocked ? "border-zinc-600 bg-zinc-900 text-zinc-300" : "border-emerald-500 bg-emerald-700/25 text-emerald-200"}`}
					onClick={() => setLayoutLocked(!layoutLocked)}
					type="button"
				>
					{layoutLocked ? "Unlock layout" : "Lock layout"}
				</button>
			</div>
		</div>
	);
}

