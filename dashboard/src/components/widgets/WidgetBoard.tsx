"use client";

import { useMemo, useState } from "react";

import WidgetFrame from "@/components/widgets/WidgetFrame";
import { applyPopoutPreset } from "@/lib/widgetPopouts";
import { useWidgetLayoutStore, widgetIds } from "@/stores/useWidgetLayoutStore";
import { widgetRegistry } from "@/widgets/registry";

export default function WidgetBoard() {
	const hydrated = useWidgetLayoutStore((state) => state.hydrated);
	const order = useWidgetLayoutStore((state) => state.order);
	const config = useWidgetLayoutStore((state) => state.config);
	const layoutLocked = useWidgetLayoutStore((state) => state.layoutLocked);
	const snapToGrid = useWidgetLayoutStore((state) => state.snapToGrid);
	const presets = useWidgetLayoutStore((state) => state.presets);
	const setSnapToGrid = useWidgetLayoutStore((state) => state.setSnapToGrid);
	const setVisible = useWidgetLayoutStore((state) => state.setVisible);
	const arrangeToGrid = useWidgetLayoutStore((state) => state.arrangeToGrid);
	const resetLayout = useWidgetLayoutStore((state) => state.resetLayout);
	const createPreset = useWidgetLayoutStore((state) => state.createPreset);
	const applyPreset = useWidgetLayoutStore((state) => state.applyPreset);
	const updatePreset = useWidgetLayoutStore((state) => state.updatePreset);
	const renamePreset = useWidgetLayoutStore((state) => state.renamePreset);
	const deletePreset = useWidgetLayoutStore((state) => state.deletePreset);

	const [presetName, setPresetName] = useState("");
	const [selectedPresetId, setSelectedPresetId] = useState("");
	const [presetActionMessage, setPresetActionMessage] = useState("");
	const [presetActionTone, setPresetActionTone] = useState<"ok" | "error">("ok");

	const setPresetFeedback = (message: string, tone: "ok" | "error" = "ok") => {
		setPresetActionMessage(message);
		setPresetActionTone(tone);
		window.setTimeout(() => {
			setPresetActionMessage("");
		}, 1800);
	};

	const safeOrder = useMemo(() => {
		const ordered = order.filter((id) => widgetIds.includes(id));
		for (const id of widgetIds) {
			if (!ordered.includes(id)) ordered.push(id);
		}
		return ordered;
	}, [order]);

	const hiddenWidgets = useMemo(() => safeOrder.filter((id) => !config[id].visible), [safeOrder, config]);
	const visibleWidgets = useMemo(() => safeOrder.filter((id) => config[id].visible), [safeOrder, config]);

	const boardHeight = useMemo(() => {
		const maxY = visibleWidgets.reduce((max, id) => Math.max(max, config[id].y + config[id].height), 0);
		return Math.max(1000, maxY + 48);
	}, [visibleWidgets, config]);

	if (!hydrated) {
		return <div className="h-[700px] w-full animate-pulse rounded-lg bg-zinc-900" />;
	}

	return (
		<div className="flex w-full flex-col gap-3">
			{!layoutLocked && (
				<div className="rounded-lg border border-zinc-800 p-2">
					<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-sm text-zinc-300">Widgets</h2>

						<div className="flex items-center gap-2">
							<button
								className={`rounded border px-2 py-1 text-xs ${snapToGrid ? "border-cyan-500 text-cyan-300" : "border-zinc-700 text-zinc-300"}`}
								onClick={() => setSnapToGrid(!snapToGrid)}
								type="button"
							>
								Snap to grid: {snapToGrid ? "On" : "Off"}
							</button>
							<button className="rounded border border-zinc-700 px-2 py-1 text-xs" onClick={arrangeToGrid} type="button">
								Arrange to grid
							</button>
							<button className="rounded border border-zinc-700 px-2 py-1 text-xs" onClick={resetLayout} type="button">
								Reset layout
							</button>
						</div>
					</div>

					<div className="mb-2 grid grid-cols-1 gap-2 rounded border border-zinc-800 p-2 lg:grid-cols-[1fr_auto_auto_auto_auto_auto]">
						<input
							className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
							placeholder="Preset name"
							value={presetName}
							onChange={(e) => setPresetName(e.target.value)}
						/>
							<button
								className="rounded border border-cyan-500 px-2 py-1 text-xs text-cyan-200"
								onClick={() => {
									const createdId = createPreset(presetName || `Preset ${presets.length + 1}`);
									if (createdId) {
										setSelectedPresetId(createdId);
										setPresetFeedback("Preset created");
									} else {
										setPresetFeedback("Preset name required", "error");
									}
								}}
								type="button"
							>
							Create
						</button>
						<select
							className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
							value={selectedPresetId}
							onChange={(e) => setSelectedPresetId(e.target.value)}
						>
							<option value="">Select preset</option>
							{presets.map((preset) => (
								<option key={preset.id} value={preset.id}>{preset.name}</option>
							))}
						</select>
							<button
								className="rounded border border-zinc-700 px-2 py-1 text-xs"
								onClick={() => {
									if (!selectedPresetId) return;
									applyPreset(selectedPresetId);
									const preset = presets.find((item) => item.id === selectedPresetId);
									if (preset) {
										const fallbackById = Object.fromEntries(
											widgetIds.map((id) => [id, { width: config[id].width, height: config[id].height }]),
										);
										applyPopoutPreset(preset.popouts ?? [], fallbackById);
									}
									setPresetFeedback("Preset applied");
								}}
								disabled={!selectedPresetId}
								type="button"
							>
							Apply
						</button>
							<button
								className="rounded border border-zinc-700 px-2 py-1 text-xs"
								onClick={() => {
									if (!selectedPresetId) return;
									updatePreset(selectedPresetId);
									setPresetFeedback("Preset overwritten");
								}}
								disabled={!selectedPresetId}
								type="button"
							>
							Overwrite
						</button>
						<div className="flex gap-2">
								<button
									className="rounded border border-zinc-700 px-2 py-1 text-xs"
									onClick={() => {
										if (!selectedPresetId || !presetName.trim()) return;
										renamePreset(selectedPresetId, presetName.trim());
										setPresetFeedback("Preset renamed");
									}}
									disabled={!selectedPresetId || !presetName.trim()}
									type="button"
								>
								Rename
							</button>
								<button
									className="rounded border border-red-500 px-2 py-1 text-xs text-red-200"
									onClick={() => {
										if (!selectedPresetId) return;
										deletePreset(selectedPresetId);
										setSelectedPresetId("");
										setPresetFeedback("Preset deleted");
									}}
									disabled={!selectedPresetId}
									type="button"
							>
								Delete
							</button>
						</div>
						{presetActionMessage && (
							<p className={`text-xs ${presetActionTone === "ok" ? "text-emerald-300" : "text-red-300"}`}>{presetActionMessage}</p>
						)}
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
								Show {widgetRegistry[id].title}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="relative w-full overflow-auto rounded-lg border border-zinc-800 bg-zinc-950" style={{ height: "75vh" }}>
				<div className="relative min-w-[1600px]" style={{ height: `${boardHeight}px` }} data-widget-board-canvas="true">
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
