"use client";

import { useEffect, useRef } from "react";

import type { WidgetId } from "@/stores/useWidgetLayoutStore";
import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";

type Props = {
	id: WidgetId;
	title: string;
	children: React.ReactNode;
	draggable?: boolean;
	onDragStart?: () => void;
	onDrop?: () => void;
	onDragOver?: (event: React.DragEvent) => void;
	showPopout?: boolean;
};

export default function WidgetFrame({
	id,
	title,
	children,
	draggable = false,
	onDragStart,
	onDrop,
	onDragOver,
	showPopout = true,
}: Props) {
	const config = useWidgetLayoutStore((state) => state.config[id]);
	const setSize = useWidgetLayoutStore((state) => state.setSize);
	const setVisible = useWidgetLayoutStore((state) => state.setVisible);
	const setZoom = useWidgetLayoutStore((state) => state.setZoom);

	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const node = rootRef.current;
		if (!node) return;

		node.style.width = `${config.width}px`;
		node.style.height = `${config.height}px`;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			setSize(id, entry.contentRect.width, entry.contentRect.height);
		});

		observer.observe(node);
		return () => observer.disconnect();
	}, [id, config.width, config.height, setSize]);

	return (
		<div
			ref={rootRef}
			draggable={draggable}
			onDragStart={onDragStart}
			onDrop={onDrop}
			onDragOver={onDragOver}
			className="group relative min-h-[220px] min-w-[280px] resize overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2"
			style={{
				fontSize: `${Math.round(config.zoom * 100)}%`,
			}}
		>
			<div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2">
				<div className="flex items-center gap-2">
					<span className="cursor-grab text-zinc-500">::</span>
					<h3 className="text-sm font-semibold">{title}</h3>
				</div>

				<div className="flex items-center gap-1 text-xs">
					<button
						className="rounded border border-zinc-700 px-2 py-0.5"
						onClick={() => setZoom(id, config.zoom - 0.1)}
						type="button"
					>
						-
					</button>
					<button
						className="rounded border border-zinc-700 px-2 py-0.5"
						onClick={() => setZoom(id, config.zoom + 0.1)}
						type="button"
					>
						+
					</button>
					{showPopout && (
						<button
							className="rounded border border-zinc-700 px-2 py-0.5"
							onClick={() => window.open(`/dashboard/widget/${id}`, `_blank`, "noopener,noreferrer")}
							type="button"
						>
							popout
						</button>
					)}
					<button
						className="rounded border border-zinc-700 px-2 py-0.5 text-red-400"
						onClick={() => setVisible(id, false)}
						type="button"
					>
						hide
					</button>
				</div>
			</div>

			<div className="h-[calc(100%-46px)]">{children}</div>
		</div>
	);
}
