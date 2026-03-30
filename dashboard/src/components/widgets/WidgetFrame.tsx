"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import { openWidgetPopout } from "@/lib/widgetPopouts";
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
	zoomOverride?: number;
};

export default function WidgetFrame({
	id,
	title,
	children,
	showPopout = true,
	layoutLocked,
	fixedAtOrigin = false,
	showChrome = true,
	zoomOverride,
}: Props) {
	const config = useWidgetLayoutStore((state) => state.config[id]);
	const order = useWidgetLayoutStore((state) => state.order);
	const setSize = useWidgetLayoutStore((state) => state.setSize);
	const setVisible = useWidgetLayoutStore((state) => state.setVisible);
	const setZoom = useWidgetLayoutStore((state) => state.setZoom);
	const setPosition = useWidgetLayoutStore((state) => state.setPosition);

	const rootRef = useRef<HTMLDivElement>(null);
	const dragStartRef = useRef<{ mouseX: number; mouseY: number; x: number; y: number } | null>(null);
	const isResizingRef = useRef(false);
	const sizeStartRef = useRef<{ width: number; height: number } | null>(null);
	const draggingRef = useRef(false);
	const zIndex = useMemo(() => Math.max(1, order.indexOf(id) + 1), [order, id]);

	useEffect(() => {
		const node = rootRef.current;
		if (!node || fixedAtOrigin) return;

		node.style.width = `${config.width}px`;
		node.style.height = `${config.height}px`;
	}, [id, config.width, config.height, fixedAtOrigin]);

	useEffect(() => {
		const onMove = (event: MouseEvent) => {
			if (!draggingRef.current || layoutLocked || fixedAtOrigin) return;
			if (!dragStartRef.current) return;
			const nextX = dragStartRef.current.x + (event.clientX - dragStartRef.current.mouseX);
			const nextY = dragStartRef.current.y + (event.clientY - dragStartRef.current.mouseY);
			setPosition(id, nextX, nextY);
		};

			const onUp = () => {
				draggingRef.current = false;
				dragStartRef.current = null;
				if (!isResizingRef.current) return;
				isResizingRef.current = false;
				const node = rootRef.current;
				if (!node) return;
				const nextWidth = node.offsetWidth;
				const nextHeight = node.offsetHeight;
				if (!sizeStartRef.current) return;
				if (Math.abs(nextWidth - sizeStartRef.current.width) < 2 && Math.abs(nextHeight - sizeStartRef.current.height) < 2) return;
				setSize(id, nextWidth, nextHeight);
				sizeStartRef.current = null;
			};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [id, setPosition, setSize, layoutLocked, fixedAtOrigin]);

	const activeZoom = zoomOverride ?? config.zoom;
	const zoomStyle = useMemo<CSSProperties>(() => {
		if (activeZoom === 1) return {};
		return {
			zoom: activeZoom as unknown as CSSProperties["zoom"],
		};
	}, [activeZoom]);

	return (
		<div
			ref={rootRef}
			className={`${fixedAtOrigin ? "relative" : "absolute"} min-h-[220px] min-w-[280px] ${layoutLocked || fixedAtOrigin ? "resize-none" : "resize"} overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-xl`}
			onMouseDown={(event) => {
				if (layoutLocked || fixedAtOrigin) return;
				const node = rootRef.current;
				if (!node) return;
				const rect = node.getBoundingClientRect();
				const nearBottomRight = rect.right - event.clientX <= 20 && rect.bottom - event.clientY <= 20;
				if (!nearBottomRight) return;
				isResizingRef.current = true;
				sizeStartRef.current = { width: node.offsetWidth, height: node.offsetHeight };
			}}
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
						{!layoutLocked && !fixedAtOrigin && (
							<button
								className="cursor-grab rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
								onMouseDown={(event) => {
									event.preventDefault();
									event.stopPropagation();
									draggingRef.current = true;
									dragStartRef.current = {
										mouseX: event.clientX,
										mouseY: event.clientY,
										x: config.x,
										y: config.y,
									};
								}}
								type="button"
							>
								move
							</button>
						)}
						<h3 className="text-sm font-semibold">{title}</h3>
					</div>

					<div className="flex items-center gap-1 text-xs">
						{!layoutLocked && zoomOverride === undefined && (
							<>
								<button className="rounded border border-zinc-700 px-2 py-0.5" onClick={() => setZoom(id, config.zoom - 0.1)} type="button">
									-
								</button>
								<span className="px-1 text-zinc-400">{Math.round(config.zoom * 100)}%</span>
								<button className="rounded border border-zinc-700 px-2 py-0.5" onClick={() => setZoom(id, config.zoom + 0.1)} type="button">
									+
								</button>
								<button className="rounded border border-zinc-700 px-2 py-0.5 text-red-400" onClick={() => setVisible(id, false)} type="button">
									hide
								</button>
							</>
						)}
							{showPopout && (
								<button
									className="rounded border border-zinc-700 px-2 py-0.5"
									onClick={() => openWidgetPopout(id, { width: Math.max(1280, config.width + 240), height: Math.max(900, config.height + 260) })}
									type="button"
								>
									popout
							</button>
						)}
					</div>
				</div>
			)}

			<div className={showChrome ? "h-[calc(100%-46px)] overflow-auto" : "h-full overflow-auto"} style={zoomStyle}>
				{children}
			</div>
		</div>
	);
}
