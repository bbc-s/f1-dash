"use client";

import { useEffect, useMemo, useState } from "react";

import WidgetFrame from "@/components/widgets/WidgetFrame";
import { useDataEngine } from "@/hooks/useDataEngine";
import { useLiveSyncSocket } from "@/hooks/useLiveSyncSocket";
import { useReplaySync } from "@/hooks/useReplaySync";
import { useStores } from "@/hooks/useStores";
import { useWidgetLayoutSync } from "@/hooks/useWidgetLayoutSync";
import { markPopoutClosed, markPopoutOpen, updatePopoutGeometry } from "@/lib/widgetPopouts";
import { useReplayStore } from "@/stores/useReplayStore";
import { useWidgetLayoutStore, widgetIds, type WidgetId } from "@/stores/useWidgetLayoutStore";
import { widgetRegistry } from "@/widgets/registry";

function isWidgetId(value: string): value is WidgetId {
	return (widgetIds as readonly string[]).includes(value);
}

export default function WidgetPopoutClient({ id }: { id: string }) {
	useWidgetLayoutSync();

	const valid = isWidgetId(id);
	const resolvedId: WidgetId = valid ? id : "leaderboard";

	const stores = useStores();
	const mode = useReplayStore((state) => state.mode);
	const layoutLocked = useWidgetLayoutStore((state) => state.layoutLocked);
	const { handleInitial, handleUpdate } = useDataEngine({ ...stores, enabled: mode === "live" });
	useLiveSyncSocket({ enabled: mode === "live", handleInitial, handleUpdate });
	useReplaySync(stores);

	const localKey = useMemo(() => `widget-popout-zoom-v1:${resolvedId}`, [resolvedId]);
	const [localZoom, setLocalZoom] = useState<number>(() => {
		if (typeof window === "undefined") return 1;
		const raw = localStorage.getItem(localKey);
		const parsed = Number(raw ?? "1");
		return Number.isFinite(parsed) ? Math.max(0.4, Math.min(3.5, parsed)) : 1;
	});

	useEffect(() => {
		if (!valid) return;
		markPopoutOpen(resolvedId, {
			left: window.screenX,
			top: window.screenY,
			width: window.outerWidth,
			height: window.outerHeight,
		});
		const timer = window.setInterval(() => {
			updatePopoutGeometry(resolvedId, {
				left: window.screenX,
				top: window.screenY,
				width: window.outerWidth,
				height: window.outerHeight,
			});
		}, 400);
		const onClose = () => markPopoutClosed(resolvedId);
		window.addEventListener("beforeunload", onClose);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener("beforeunload", onClose);
			markPopoutClosed(resolvedId);
		};
	}, [resolvedId, valid]);

	if (!valid) {
		return <div className="flex h-screen w-screen items-center justify-center p-4">Unknown widget</div>;
	}

	const setZoom = (next: number) => {
		const clamped = Math.max(0.4, Math.min(3.5, next));
		setLocalZoom(clamped);
		if (typeof window !== "undefined") {
			localStorage.setItem(localKey, String(clamped));
		}
	};

	const Widget = widgetRegistry[resolvedId].component;

	return (
		<div className="h-screen w-screen bg-zinc-950 p-0">
			{!layoutLocked && (
				<div className="flex items-center justify-end gap-2 border-b border-zinc-800 p-2 text-xs">
					<span className="text-zinc-400">Zoom</span>
					<button className="rounded border border-zinc-700 px-2 py-1" onClick={() => setZoom(localZoom - 0.1)} type="button">
						-
					</button>
					<span className="w-14 text-center text-zinc-200">{Math.round(localZoom * 100)}%</span>
					<button className="rounded border border-zinc-700 px-2 py-1" onClick={() => setZoom(localZoom + 0.1)} type="button">
						+
					</button>
				</div>
			)}
			<div className={`${layoutLocked ? "h-full" : "h-[calc(100%-45px)]"} w-full`}>
				<WidgetFrame
					id={resolvedId}
					title={widgetRegistry[resolvedId].title}
					showPopout={false}
					layoutLocked={true}
					fixedAtOrigin={true}
					showChrome={false}
					zoomOverride={localZoom}
				>
					<Widget />
				</WidgetFrame>
			</div>
		</div>
	);
}
