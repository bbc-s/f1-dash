"use client";

import { useEffect, useMemo, useRef } from "react";

import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";

const CHANNEL = "f1dash-widget-layout-v2";

type SyncMessage = {
	type: "layout-sync";
	sourceId: string;
	payload: {
		revision: number;
		order: ReturnType<typeof useWidgetLayoutStore.getState>["order"];
		config: ReturnType<typeof useWidgetLayoutStore.getState>["config"];
		displaced: ReturnType<typeof useWidgetLayoutStore.getState>["displaced"];
		presets: ReturnType<typeof useWidgetLayoutStore.getState>["presets"];
		layoutLocked: boolean;
		snapToGrid: boolean;
	};
};

export function useWidgetLayoutSync() {
	const sourceId = useMemo(() => crypto.randomUUID(), []);
	const channelRef = useRef<BroadcastChannel | null>(null);
	const applyingRemoteRef = useRef(false);

	useEffect(() => {
		if (typeof BroadcastChannel === "undefined") return;
		channelRef.current = new BroadcastChannel(CHANNEL);

		const unsub = useWidgetLayoutStore.subscribe((state, prev) => {
			if (applyingRemoteRef.current) return;
			if (!state.hydrated || state.revision === 0) return;
			if (state.revision === prev.revision) return;
			channelRef.current?.postMessage({
				type: "layout-sync",
				sourceId,
				payload: {
					revision: state.revision,
					order: state.order,
					config: state.config,
					displaced: state.displaced,
					presets: state.presets,
					layoutLocked: state.layoutLocked,
					snapToGrid: state.snapToGrid,
				},
			} satisfies SyncMessage);
		});

		const onMessage = (event: MessageEvent<SyncMessage>) => {
			const message = event.data;
			if (message.type !== "layout-sync") return;
			if (message.sourceId === sourceId) return;
			const local = useWidgetLayoutStore.getState();
			if (!local.hydrated) return;
			if (message.payload.revision <= local.revision) return;

			applyingRemoteRef.current = true;
			useWidgetLayoutStore.setState({
				revision: message.payload.revision,
				order: message.payload.order,
				config: message.payload.config,
				displaced: message.payload.displaced,
				presets: message.payload.presets,
				layoutLocked: message.payload.layoutLocked,
				snapToGrid: message.payload.snapToGrid,
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
