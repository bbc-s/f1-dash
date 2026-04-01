"use client";

import { useEffect, useMemo, useRef } from "react";

import { env } from "@/env";
import { useReplayStore } from "@/stores/useReplayStore";
import type { CarsData, Positions, State } from "@/types/state.type";

type Frame = {
	recordingId?: string | null;
	playing: boolean;
	speed: number;
	cursorMs: number;
	durationMs: number;
	state: State | null;
	carsData?: CarsData | null;
	positions?: Positions | null;
};

type ChannelMessage =
	| { type: "leader-heartbeat"; leaderId: string; ts: number }
	| { type: "frame"; leaderId: string; ts: number; payload: Frame };

const CHANNEL = "f1dash-replay-v1";
const LEADER_KEY = "f1dash-replay-leader-v1";
const LEASE_TIMEOUT_MS = 7000;

function now() {
	return Date.now();
}

type Lease = {
	tabId: string;
	ts: number;
};

function readLease() {
	const raw = localStorage.getItem(LEADER_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Lease;
	} catch {
		return null;
	}
}

function writeLease(lease: Lease) {
	localStorage.setItem(LEADER_KEY, JSON.stringify(lease));
}

function proxyPath(path: string) {
	return `/api/archive-proxy/${path.replace(/^\/api\//, "")}`;
}

function replayBase(path: string) {
	const local = proxyPath(path);
	if (typeof window !== "undefined") return local;
	if (!env.NEXT_PUBLIC_REPLAY_URL) return local;
	return `${env.NEXT_PUBLIC_REPLAY_URL}${path}`;
}

async function postReplay(path: string, body?: unknown) {
	const tryUrls = [replayBase(path), env.NEXT_PUBLIC_REPLAY_URL ? `${env.NEXT_PUBLIC_REPLAY_URL}${path}` : null].filter(
		(value): value is string => Boolean(value),
	);
	for (const url of tryUrls) {
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: body ? JSON.stringify(body) : "{}",
			});
			if (!response.ok) continue;
			return response.json().catch(() => null);
		} catch {
			// try next url
		}
	}
	return null;
}

async function getReplay(path: string) {
	const tryUrls = [replayBase(path), env.NEXT_PUBLIC_REPLAY_URL ? `${env.NEXT_PUBLIC_REPLAY_URL}${path}` : null].filter(
		(value): value is string => Boolean(value),
	);
	for (const url of tryUrls) {
		try {
			const response = await fetch(url, { cache: "no-store" });
			if (!response.ok) continue;
			return response.json();
		} catch {
			// try next url
		}
	}
	return null;
}

export function useReplaySync(updateFns: {
	updateState: (state: State) => void;
	updateCarData: (cars: CarsData | null) => void;
	updatePosition: (positions: Positions | null) => void;
}) {
	const mode = useReplayStore((state) => state.mode);
	const setConnected = useReplayStore((state) => state.setConnected);
	const setFrameState = useReplayStore((state) => state.setFrameState);

	const tabId = useMemo(() => crypto.randomUUID(), []);
	const channelRef = useRef<BroadcastChannel | null>(null);
	const leaderRef = useRef(false);
	const pollTimerRef = useRef<number | null>(null);
	const lastHeartbeatRef = useRef(0);
	const updateFnsRef = useRef(updateFns);

	useEffect(() => {
		updateFnsRef.current = updateFns;
	}, [updateFns]);

	useEffect(() => {
		if (typeof BroadcastChannel === "undefined") return;
		channelRef.current = new BroadcastChannel(CHANNEL);

		const applyFrame = (frame: Frame) => {
			updateFnsRef.current.updateState(frame.state ?? ({} as State));
			updateFnsRef.current.updateCarData(frame.carsData ?? null);
			updateFnsRef.current.updatePosition(frame.positions ?? null);
			setFrameState({
				playing: frame.playing,
				speed: frame.speed,
				cursorMs: frame.cursorMs,
				durationMs: frame.durationMs,
				recordingId: frame.recordingId ?? null,
			});
			setConnected(true);
		};

		const stopPolling = () => {
			if (pollTimerRef.current !== null) {
				window.clearInterval(pollTimerRef.current);
				pollTimerRef.current = null;
			}
		};

		const startPolling = () => {
			if (pollTimerRef.current !== null) return;

			pollTimerRef.current = window.setInterval(async () => {
				try {
					const payload = (await getReplay("/api/replay/frame")) as Frame | null;
					if (!payload) {
						setConnected(false);
						return;
					}
					applyFrame(payload);

					channelRef.current?.postMessage({
						type: "frame",
						leaderId: tabId,
						ts: now(),
						payload,
					} satisfies ChannelMessage);
				} catch {
					setConnected(false);
				}
			}, 300);
		};

		const becomeLeader = () => {
			leaderRef.current = true;
			writeLease({ tabId, ts: now() });
			startPolling();
		};

		const becomeFollower = () => {
			leaderRef.current = false;
			stopPolling();
		};

			const electLeader = () => {
				const lease = readLease();
				const stale = !lease || lease.ts > now() + LEASE_TIMEOUT_MS || now() - lease.ts > LEASE_TIMEOUT_MS;
				if (stale || lease?.tabId === tabId) {
					becomeLeader();
				} else {
				becomeFollower();
			}
		};

		const onMessage = (event: MessageEvent<ChannelMessage>) => {
			const message = event.data;
			switch (message.type) {
				case "leader-heartbeat":
					lastHeartbeatRef.current = message.ts;
					if (!leaderRef.current) setConnected(true);
					break;
				case "frame":
					if (message.leaderId === tabId) break;
					lastHeartbeatRef.current = message.ts;
					applyFrame(message.payload);
					break;
			}
		};
		channelRef.current.addEventListener("message", onMessage as EventListener);

		const leaseTimer = window.setInterval(() => {
			if (mode !== "replay") {
				becomeFollower();
				return;
			}

			electLeader();
			if (leaderRef.current) {
				writeLease({ tabId, ts: now() });
				channelRef.current?.postMessage({
					type: "leader-heartbeat",
					leaderId: tabId,
					ts: now(),
				} satisfies ChannelMessage);
			} else if (now() - lastHeartbeatRef.current > LEASE_TIMEOUT_MS) {
				electLeader();
			}
		}, 2000);

		electLeader();

		return () => {
			window.clearInterval(leaseTimer);
			stopPolling();
			channelRef.current?.removeEventListener("message", onMessage as EventListener);
			channelRef.current?.close();
			channelRef.current = null;
			const lease = readLease();
			if (lease?.tabId === tabId) {
				localStorage.removeItem(LEADER_KEY);
			}
		};
	}, [mode, setConnected, setFrameState, tabId]);

	const controls = {
		play: () => postReplay("/api/replay/play"),
		pause: () => postReplay("/api/replay/pause"),
		seek: (positionMs: number) => postReplay("/api/replay/seek", { position_ms: positionMs }),
		speed: (value: number) => postReplay("/api/replay/speed", { speed: value }),
		load: (recordingId: string) => postReplay("/api/replay/load", { recording_id: recordingId }),
		startRecording: (name?: string, streams?: string[]) =>
			postReplay("/api/archive/start", {
				name,
				streams: streams && streams.length > 0 ? streams : undefined,
			}),
		stopRecording: () => postReplay("/api/archive/stop"),
		listRecordings: () => getReplay("/api/archive/recordings"),
		deleteRecording: (recordingId: string) => postReplay(`/api/archive/recordings/${encodeURIComponent(recordingId)}/delete`),
		setAutoRecord: (enabled: boolean) => postReplay("/api/archive/auto", { enabled }),
		status: () => getReplay("/api/archive/status"),
	};

	return controls;
}
