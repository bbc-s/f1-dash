"use client";

import { useMemo } from "react";

import WidgetFrame from "@/components/widgets/WidgetFrame";
import { useWidgetLayoutStore, widgetIds } from "@/stores/useWidgetLayoutStore";
import { widgetRegistry } from "@/widgets/registry";

export default function WidgetBoard() {
	const hydrated = useWidgetLayoutStore((state) => state.hydrated);
	const config = useWidgetLayoutStore((state) => state.config);
	const layoutLocked = useWidgetLayoutStore((state) => state.layoutLocked);
	const setLayoutLocked = useWidgetLayoutStore((state) => state.setLayoutLocked);
	const setVisible = useWidgetLayoutStore((state) => state.setVisible);
	const resetLayout = useWidgetLayoutStore((state) => state.resetLayout);

	const hiddenWidgets = useMemo(() => widgetIds.filter((id) => !config[id].visible), [config]);
	const visibleWidgets = useMemo(() => widgetIds.filter((id) => config[id].visible), [config]);

	const boardHeight = useMemo(() => {
		const maxY = visibleWidgets.reduce((max, id) => Math.max(max, config[id].y + config[id].height), 0);
		return Math.max(1000, maxY + 48);
	}, [visibleWidgets, config]);

	if (!hydrated) {
		return <div className="h-[700px] w-full animate-pulse rounded-lg bg-zinc-900" />;
	}

	return (
		<div className="flex w-full flex-col gap-3">
			<div className="rounded-lg border border-zinc-800 p-2">
				<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-sm text-zinc-300">Widgets</h2>

					<div className="flex items-center gap-2">
						<button
							className="rounded border border-zinc-700 px-2 py-1 text-xs"
							onClick={() => setLayoutLocked(!layoutLocked)}
							type="button"
						>
							{layoutLocked ? "Unlock layout" : "Lock layout"}
						</button>
						<button
							className="rounded border border-zinc-700 px-2 py-1 text-xs disabled:opacity-50"
							onClick={resetLayout}
							disabled={layoutLocked}
							type="button"
						>
							Reset layout
						</button>
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					{hiddenWidgets.length === 0 && <p className="text-xs text-zinc-500">All widgets are visible.</p>}
					{hiddenWidgets.map((id) => (
						<button
							key={id}
							className="rounded border border-zinc-700 px-2 py-1 text-xs disabled:opacity-50"
							onClick={() => setVisible(id, true)}
							disabled={layoutLocked}
							type="button"
						>
							Show {widgetRegistry[id].title}
						</button>
					))}
				</div>
			</div>

			<div className="relative w-full overflow-auto rounded-lg border border-zinc-800 bg-zinc-950" style={{ height: "75vh" }}>
				<div className="relative min-w-[1850px]" style={{ height: `${boardHeight}px` }}>
					{visibleWidgets.map((id) => {
						const Widget = widgetRegistry[id].component;
						return (
							<WidgetFrame key={id} id={id} title={widgetRegistry[id].title} layoutLocked={layoutLocked}>
								<Widget />
							</WidgetFrame>
						);
					})}
				</div>
			</div>
		</div>
	);
}
