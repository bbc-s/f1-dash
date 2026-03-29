"use client";

import { useEffect, useRef } from "react";

import type { WidgetId } from "@/stores/useWidgetLayoutStore";
import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";

type Props = {
	id: WidgetId;
	title: string;
	children: React.ReactNode;
	showPopout?: boolean;
	layoutLocked: boolean;
	fixedAtOrigin?: boolean;
};

export default function WidgetFrame({
	id,
	title,
	children,
	showPopout = true,
	layoutLocked,
	fixedAtOrigin = false,
}: Props) {
	const config = useWidgetLayoutStore((state) => state.config[id]);
	const setSize = useWidgetLayoutStore((state) => state.setSize);
	const setVisible = useWidgetLayoutStore((state) => state.setVisible);
	const setZoom = useWidgetLayoutStore((state) => state.setZoom);
	const setPosition = useWidgetLayoutStore((state) => state.setPosition);

	const rootRef = useRef<HTMLDivElement>(null);
	const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
	const draggingRef = useRef(false);

	useEffect(() => {
		const node = rootRef.current;
		if (!node) return;

		node.style.width = `${config.width}px`;
		node.style.height = `${config.height}px`;

		const observer = new ResizeObserver((entries) => {
			if (layoutLocked) return;
			const entry = entries[0];
			if (!entry) return;
			setSize(id, entry.contentRect.width, entry.contentRect.height);
		});

		observer.observe(node);
		return () => observer.disconnect();
	}, [id, config.width, config.height, setSize, layoutLocked]);

	useEffect(() => {
		const onMove = (event: MouseEvent) => {
			if (!draggingRef.current || layoutLocked) return;
			if (!dragOffsetRef.current) return;

			const nextX = event.clientX - dragOffsetRef.current.x;
			const nextY = event.clientY - dragOffsetRef.current.y;
			setPosition(id, nextX, nextY);
		};

		const onUp = () => {
			draggingRef.current = false;
			dragOffsetRef.current = null;
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [id, setPosition, layoutLocked]);

	return (
		<div
			ref={rootRef}
			className={`group ${fixedAtOrigin ? "relative" : "absolute"} min-h-[220px] min-w-[280px] ${layoutLocked ? "resize-none" : "resize"} overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-xl`}
			style={{
				left: fixedAtOrigin ? undefined : `${config.x}px`,
				top: fixedAtOrigin ? undefined : `${config.y}px`,
				fontSize: `${Math.round(config.zoom * 100)}%`,
				width: fixedAtOrigin ? "100%" : undefined,
				height: fixedAtOrigin ? "100%" : undefined,
			}}
		>
			<div
				className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2"
				onMouseDown={(event) => {
					if (layoutLocked) return;
					const rect = rootRef.current?.getBoundingClientRect();
					if (!rect) return;
					draggingRef.current = true;
					dragOffsetRef.current = {
						x: event.clientX - rect.left,
						y: event.clientY - rect.top,
					};
				}}
			>
				<div className="flex items-center gap-2">
					<span className="cursor-grab text-zinc-500">::</span>
					<h3 className="text-sm font-semibold">{title}</h3>
				</div>

				<div className="flex items-center gap-1 text-xs">
					<button
						className="rounded border border-zinc-700 px-2 py-0.5 disabled:opacity-50"
						onClick={() => setZoom(id, config.zoom - 0.1)}
						disabled={layoutLocked}
						type="button"
					>
						-
					</button>
					<button
						className="rounded border border-zinc-700 px-2 py-0.5 disabled:opacity-50"
						onClick={() => setZoom(id, config.zoom + 0.1)}
						disabled={layoutLocked}
						type="button"
					>
						+
					</button>
					{showPopout && (
						<button
							className="rounded border border-zinc-700 px-2 py-0.5"
							onClick={() => window.open(`/dashboard/widget/${id}`, "_blank", "noopener,noreferrer")}
							type="button"
						>
							popout
						</button>
					)}
					<button
						className="rounded border border-zinc-700 px-2 py-0.5 text-red-400 disabled:opacity-50"
						onClick={() => setVisible(id, false)}
						disabled={layoutLocked}
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
