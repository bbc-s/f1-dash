"use client";

import { useEffect, useMemo, useRef } from "react";

import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";

const CHANNEL = "f1dash-widget-layout-v1";

type SyncMessage = {
	type: "layout-sync";
	sourceId: string;
	payload: {
		order: ReturnType<typeof useWidgetLayoutStore.getState>["order"];
		config: ReturnType<typeof useWidgetLayoutStore.getState>["config"];
		layoutLocked: boolean;
	};
};

export function useWidgetLayoutSync() {
	const sourceId = useMemo(() => crypto.randomUUID(), []);
	const channelRef = useRef<BroadcastChannel | null>(null);
	const applyingRemoteRef = useRef(false);

	useEffect(() => {
		if (typeof BroadcastChannel === "undefined") return;
		channelRef.current = new BroadcastChannel(CHANNEL);

		const unsub = useWidgetLayoutStore.subscribe((state) => {
			if (applyingRemoteRef.current) return;
			if (!state.hydrated) return;
			channelRef.current?.postMessage({
				type: "layout-sync",
				sourceId,
				payload: {
					order: state.order,
					config: state.config,
					layoutLocked: state.layoutLocked,
				},
			} satisfies SyncMessage);
		});

		const onMessage = (event: MessageEvent<SyncMessage>) => {
			const message = event.data;
			if (message.type !== "layout-sync") return;
			if (message.sourceId === sourceId) return;
			if (!useWidgetLayoutStore.getState().hydrated) return;

			applyingRemoteRef.current = true;
			useWidgetLayoutStore.setState({
				order: message.payload.order,
				config: message.payload.config,
				layoutLocked: message.payload.layoutLocked,
			});
			applyingRemoteRef.current = false;
		};

		channelRef.current.addEventListener("message", onMessage as EventListener);

		return () => {
			unsub();
			channelRef.current?.removeEventListener("message", onMessage as EventListener);
			channelRef.current?.close();
			channelRef.current = null;
		};
	}, [sourceId]);
}
