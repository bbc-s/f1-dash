"use client";

import { useEffect, useMemo, useRef } from "react";

import type { WidgetId } from "@/stores/useWidgetLayoutStore";
import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";

type Props = {
	id: WidgetId;
	title: string;
	children: React.ReactNode;
	showPopout?: boolean;
	layoutLocked: boolean;
	fixedAtOrigin?: boolean;
	showChrome?: boolean;
};

export default function WidgetFrame({
	id,
	title,
	children,
	showPopout = true,
	layoutLocked,
	fixedAtOrigin = false,
	showChrome = true,
}: Props) {
	const config = useWidgetLayoutStore((state) => state.config[id]);
	const order = useWidgetLayoutStore((state) => state.order);
	const setSize = useWidgetLayoutStore((state) => state.setSize);
	const setVisible = useWidgetLayoutStore((state) => state.setVisible);
	const setZoom = useWidgetLayoutStore((state) => state.setZoom);
	const setPosition = useWidgetLayoutStore((state) => state.setPosition);

	const rootRef = useRef<HTMLDivElement>(null);
	const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
	const draggingRef = useRef(false);
	const zIndex = useMemo(() => Math.max(1, order.indexOf(id) + 1), [order, id]);

	useEffect(() => {
		const node = rootRef.current;
		if (!node) return;

		node.style.width = `${config.width}px`;
		node.style.height = `${config.height}px`;

		const observer = new ResizeObserver((entries) => {
			if (layoutLocked || fixedAtOrigin) return;
			const entry = entries[0];
			if (!entry) return;
			setSize(id, entry.contentRect.width, entry.contentRect.height);
		});

		observer.observe(node);
		return () => observer.disconnect();
	}, [id, config.width, config.height, setSize, layoutLocked, fixedAtOrigin]);

	useEffect(() => {
		const onMove = (event: MouseEvent) => {
			if (!draggingRef.current || layoutLocked || fixedAtOrigin) return;
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
	}, [id, setPosition, layoutLocked, fixedAtOrigin]);

	const contentScale = config.zoom;
	const contentWidth = `${Math.max(100, Math.round(100 / contentScale))}%`;
	const popoutFeatures = `noopener,noreferrer,width=${Math.max(1000, config.width + 120)},height=${Math.max(700, config.height + 160)}`;

	return (
		<div
			ref={rootRef}
			className={`${fixedAtOrigin ? "relative" : "absolute"} min-h-[220px] min-w-[280px] ${layoutLocked || fixedAtOrigin ? "resize-none" : "resize"} overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-xl`}
			style={{
				left: fixedAtOrigin ? undefined : `${config.x}px`,
				top: fixedAtOrigin ? undefined : `${config.y}px`,
				width: fixedAtOrigin ? "100%" : undefined,
				height: fixedAtOrigin ? "100%" : undefined,
				zIndex,
			}}
		>
			{showChrome && (
				<div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2">
					<div className="flex items-center gap-2">
						<button
							className={`rounded border px-2 py-0.5 text-xs ${layoutLocked ? "cursor-default border-zinc-800 text-zinc-600" : "cursor-grab border-zinc-700 text-zinc-300"}`}
							onMouseDown={(event) => {
								if (layoutLocked || fixedAtOrigin) return;
								event.stopPropagation();
								const rect = rootRef.current?.getBoundingClientRect();
								if (!rect) return;
								draggingRef.current = true;
								dragOffsetRef.current = {
									x: event.clientX - rect.left,
									y: event.clientY - rect.top,
								};
							}}
							type="button"
						>
							move
						</button>
						<h3 className="text-sm font-semibold">{title}</h3>
					</div>

					<div className="flex items-center gap-1 text-xs">
						{!layoutLocked && (
							<>
								<button
									className="rounded border border-zinc-700 px-2 py-0.5"
									onMouseDown={(e) => e.stopPropagation()}
									onClick={() => setZoom(id, config.zoom - 0.1)}
									type="button"
								>
									-
								</button>
								<span className="px-1 text-zinc-400">{Math.round(config.zoom * 100)}%</span>
								<button
									className="rounded border border-zinc-700 px-2 py-0.5"
									onMouseDown={(e) => e.stopPropagation()}
									onClick={() => setZoom(id, config.zoom + 0.1)}
									type="button"
								>
									+
								</button>
								<button
									className="rounded border border-zinc-700 px-2 py-0.5 text-red-400"
									onMouseDown={(e) => e.stopPropagation()}
									onClick={() => setVisible(id, false)}
									type="button"
								>
									hide
								</button>
							</>
						)}
						{showPopout && (
							<button
								className="rounded border border-zinc-700 px-2 py-0.5"
								onMouseDown={(e) => e.stopPropagation()}
								onClick={() => window.open(`/widget/${id}`, "_blank", popoutFeatures)}
								type="button"
							>
								popout
							</button>
						)}
					</div>
				</div>
			)}

			<div className={showChrome ? "h-[calc(100%-46px)] overflow-auto" : "h-full overflow-auto"}>
				<div
					style={{
						transform: `scale(${contentScale})`,
						transformOrigin: "top left",
						width: contentWidth,
						minHeight: contentScale > 1 ? `${Math.round(100 / contentScale)}%` : "100%",
					}}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
