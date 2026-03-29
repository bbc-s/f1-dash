import { useEffect, useMemo, useRef, useState } from "react";

import type { MessageInitial, MessageUpdate } from "@/types/message.type";

import { env } from "@/env";

type Props = {
	handleInitial: (data: MessageInitial) => void;
	handleUpdate: (data: MessageUpdate) => void;
};

type ChannelMessage =
	| { type: "leader-heartbeat"; leaderId: string; ts: number }
	| { type: "initial"; payload: MessageInitial; leaderId: string; ts: number }
	| { type: "update"; payload: MessageUpdate; leaderId: string; ts: number }
	| { type: "initial-request"; requesterId: string; ts: number };

type LeaderLease = {
	tabId: string;
	ts: number;
};

const LEADER_KEY = "f1dash-live-leader-v1";
const CHANNEL_NAME = "f1dash-live-v1";
const LEASE_TIMEOUT_MS = 7000;

function now() {
	return Date.now();
}

function readLeader(): LeaderLease | null {
	const raw = localStorage.getItem(LEADER_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as LeaderLease;
	} catch {
		return null;
	}
}

function writeLeader(lease: LeaderLease) {
	localStorage.setItem(LEADER_KEY, JSON.stringify(lease));
}

function isLeaderStale(lease: LeaderLease | null) {
	if (!lease) return true;
	return now() - lease.ts > LEASE_TIMEOUT_MS;
}

export const useLiveSyncSocket = ({ handleInitial, handleUpdate }: Props) => {
	const tabId = useMemo(() => crypto.randomUUID(), []);
	const [connected, setConnected] = useState(false);
	const handlersRef = useRef({ handleInitial, handleUpdate });

	const channelRef = useRef<BroadcastChannel | null>(null);
	const leaderRef = useRef(false);
	const sseRef = useRef<EventSource | null>(null);
	const lastInitialRef = useRef<MessageInitial | null>(null);
	const lastLeaderHeartbeatRef = useRef(0);

	useEffect(() => {
		handlersRef.current = { handleInitial, handleUpdate };
	}, [handleInitial, handleUpdate]);

	useEffect(() => {
		if (typeof BroadcastChannel !== "undefined") {
			channelRef.current = new BroadcastChannel(CHANNEL_NAME);
		}

		const openSse = () => {
			if (sseRef.current) return;

			const sse = new EventSource(`${env.NEXT_PUBLIC_LIVE_URL}/api/realtime`);
			sseRef.current = sse;

			sse.onerror = () => setConnected(false);
			sse.onopen = () => setConnected(true);

			sse.addEventListener("initial", (message) => {
				const payload = JSON.parse(message.data) as MessageInitial;
				lastInitialRef.current = payload;
				handlersRef.current.handleInitial(payload);

				channelRef.current?.postMessage({
					type: "initial",
					payload,
					leaderId: tabId,
					ts: now(),
				} satisfies ChannelMessage);
			});

			sse.addEventListener("update", (message) => {
				const payload = JSON.parse(message.data) as MessageUpdate;
				handlersRef.current.handleUpdate(payload);
				channelRef.current?.postMessage({
					type: "update",
					payload,
					leaderId: tabId,
					ts: now(),
				} satisfies ChannelMessage);
			});
		};

		const closeSse = () => {
			sseRef.current?.close();
			sseRef.current = null;
		};

		const becomeLeader = () => {
			leaderRef.current = true;
			writeLeader({ tabId, ts: now() });
			openSse();
		};

		const becomeFollower = () => {
			leaderRef.current = false;
			closeSse();
		};

		const electLeader = () => {
			const lease = readLeader();

			if (!lease || isLeaderStale(lease) || lease.tabId === tabId) {
				becomeLeader();
				return;
			}

			becomeFollower();
		};

		const heartbeatInterval = setInterval(() => {
			electLeader();

			if (leaderRef.current) {
				writeLeader({ tabId, ts: now() });
				channelRef.current?.postMessage({
					type: "leader-heartbeat",
					leaderId: tabId,
					ts: now(),
				} satisfies ChannelMessage);
				return;
			}

			const staleFollower = now() - lastLeaderHeartbeatRef.current > LEASE_TIMEOUT_MS;
			if (staleFollower) {
				electLeader();
			}
		}, 2000);

		const onMessage = (event: MessageEvent<ChannelMessage>) => {
			const message = event.data;

			switch (message.type) {
				case "leader-heartbeat": {
					lastLeaderHeartbeatRef.current = message.ts;
					if (!leaderRef.current) setConnected(true);
					break;
				}
				case "initial": {
					if (message.leaderId === tabId) break;
					lastLeaderHeartbeatRef.current = message.ts;
					handlersRef.current.handleInitial(message.payload);
					setConnected(true);
					break;
				}
				case "update": {
					if (message.leaderId === tabId) break;
					lastLeaderHeartbeatRef.current = message.ts;
					handlersRef.current.handleUpdate(message.payload);
					setConnected(true);
					break;
				}
				case "initial-request": {
					if (!leaderRef.current || message.requesterId === tabId) break;
					if (!lastInitialRef.current) break;
					channelRef.current?.postMessage({
						type: "initial",
						payload: lastInitialRef.current,
						leaderId: tabId,
						ts: now(),
					} satisfies ChannelMessage);
					break;
				}
			}
		};

		channelRef.current?.addEventListener("message", onMessage as EventListener);
		channelRef.current?.postMessage({
			type: "initial-request",
			requesterId: tabId,
			ts: now(),
		} satisfies ChannelMessage);

		electLeader();

		const onBeforeUnload = () => {
			const lease = readLeader();
			if (lease?.tabId === tabId) {
				localStorage.removeItem(LEADER_KEY);
			}
		};

		window.addEventListener("beforeunload", onBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", onBeforeUnload);
			clearInterval(heartbeatInterval);
			channelRef.current?.removeEventListener("message", onMessage as EventListener);
			channelRef.current?.close();
			channelRef.current = null;
			closeSse();

			const lease = readLeader();
			if (lease?.tabId === tabId) {
				localStorage.removeItem(LEADER_KEY);
			}
		};
	}, [tabId]);

	return { connected };
};
