"use client";

import { useMemo, useState } from "react";

import WidgetFrame from "@/components/widgets/WidgetFrame";
import { useWidgetLayoutStore, type WidgetId, widgetIds } from "@/stores/useWidgetLayoutStore";
import { widgetRegistry } from "@/widgets/registry";

export default function WidgetBoard() {
	const [dragging, setDragging] = useState<WidgetId | null>(null);

	const order = useWidgetLayoutStore((state) => state.order);
	const config = useWidgetLayoutStore((state) => state.config);
	const moveWidget = useWidgetLayoutStore((state) => state.moveWidget);
	const setVisible = useWidgetLayoutStore((state) => state.setVisible);
	const resetLayout = useWidgetLayoutStore((state) => state.resetLayout);

	const visibleOrder = useMemo(() => order.filter((id) => config[id].visible), [order, config]);
	const hiddenWidgets = useMemo(() => widgetIds.filter((id) => !config[id].visible), [config]);

	return (
		<div className="flex w-full flex-col gap-3">
			<div className="rounded-lg border border-zinc-800 p-2">
				<div className="mb-2 flex items-center justify-between">
					<h2 className="text-sm text-zinc-300">Widgets</h2>
					<button className="rounded border border-zinc-700 px-2 py-1 text-xs" onClick={resetLayout} type="button">
						reset layout
					</button>
				</div>

				<div className="flex flex-wrap gap-2">
					{hiddenWidgets.length === 0 && <p className="text-xs text-zinc-500">All widgets are visible.</p>}
					{hiddenWidgets.map((id) => (
						<button
							key={id}
							className="rounded border border-zinc-700 px-2 py-1 text-xs"
							onClick={() => setVisible(id, true)}
							type="button"
						>
							show {widgetRegistry[id].title}
						</button>
					))}
				</div>
			</div>

			<div className="flex flex-wrap gap-3">
				{visibleOrder.map((id) => {
					const definition = widgetRegistry[id];
					const Widget = definition.component;

					return (
						<WidgetFrame
							key={id}
							id={id}
							title={definition.title}
							draggable
							onDragStart={() => setDragging(id)}
							onDragOver={(event) => event.preventDefault()}
							onDrop={() => {
								if (!dragging || dragging === id) return;
								moveWidget(dragging, id);
								setDragging(null);
							}}
						>
							<Widget />
						</WidgetFrame>
					);
				})}
			</div>
		</div>
	);
}
