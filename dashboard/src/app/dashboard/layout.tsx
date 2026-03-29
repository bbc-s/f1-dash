"use client";

import { type ReactNode, useMemo, useState } from "react";
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
	const recordingId = useReplayStore((state) => state.recordingId);

	const [loadId, setLoadId] = useState("");
	const [recordings, setRecordings] = useState<string[]>([]);

	const seconds = useMemo(() => Math.floor(cursorMs / 1000), [cursorMs]);
	const totalSeconds = useMemo(() => Math.floor(durationMs / 1000), [durationMs]);

	return (
		<div className={`flex ${compact ? "flex-col" : "flex-row items-center"} gap-2 border-t border-zinc-800 pt-2`}>
			<div className="flex items-center gap-1">
				<button
					className={`rounded border px-2 py-1 text-xs ${mode === "live" ? "border-cyan-400" : "border-zinc-700"}`}
					onClick={() => setMode("live")}
					type="button"
				>
					Live
				</button>
				<button
					className={`rounded border px-2 py-1 text-xs ${mode === "replay" ? "border-cyan-400" : "border-zinc-700"}`}
					onClick={() => setMode("replay")}
					type="button"
				>
					Replay
				</button>
			</div>

			{mode === "replay" && (
				<>
					<div className="flex items-center gap-1">
						<button
							className="rounded border border-zinc-700 px-2 py-1 text-xs"
							onClick={() => controls.startRecording()}
							type="button"
						>
							Start rec
						</button>
						<button
							className="rounded border border-zinc-700 px-2 py-1 text-xs"
							onClick={() => controls.stopRecording()}
							type="button"
						>
							Stop rec
						</button>
						<button
							className="rounded border border-zinc-700 px-2 py-1 text-xs"
							onClick={async () => {
								const res = (await controls.listRecordings()) as { recordings?: string[] } | null;
								setRecordings(res?.recordings ?? []);
							}}
							type="button"
						>
							Refresh list
						</button>
					</div>
					<select
						className="rounded border border-zinc-700 bg-zinc-900 p-1 text-xs"
						value={loadId}
						onChange={(e) => setLoadId(e.target.value)}
					>
						<option value="">select recording</option>
						{recordings.map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</select>
					<div className="flex items-center gap-1">
						<input
							className="w-44 rounded border border-zinc-700 bg-zinc-900 p-1 text-xs"
							placeholder="recording id"
							value={loadId}
							onChange={(e) => setLoadId(e.target.value)}
						/>
						<button
							className="rounded border border-zinc-700 px-2 py-1 text-xs"
							onClick={() => {
								const target = loadId || recordingId || "";
								if (!target) return;
								controls.load(target);
							}}
							type="button"
						>
							Load
						</button>
					</div>
					<button
						className="rounded border border-zinc-700 px-2 py-1 text-xs"
						onClick={() => (playing ? controls.pause() : controls.play())}
						type="button"
					>
						{playing ? "Pause" : "Play"}
					</button>
					<select
						className="rounded border border-zinc-700 bg-zinc-900 p-1 text-xs"
						value={String(speed)}
						onChange={(e) => controls.speed(Number(e.target.value))}
					>
						<option value="0.5">0.5x</option>
						<option value="1">1x</option>
						<option value="2">2x</option>
						<option value="4">4x</option>
					</select>
					<input
						type="range"
						className="w-56"
						min={0}
						max={Math.max(durationMs, 1)}
						value={Math.min(cursorMs, Math.max(durationMs, 1))}
						onChange={(e) => controls.seek(Number(e.target.value))}
					/>
					<span className="text-xs text-zinc-400">
						{seconds}s / {totalSeconds}s
					</span>
				</>
			)}
		</div>
	);
}
