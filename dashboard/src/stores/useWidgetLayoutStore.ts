import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const widgetIds = [
	"leaderboard",
	"map",
	"telemetry",
	"race-control",
	"team-radios",
	"track-violations",
	"tyres",
] as const;

export type WidgetId = (typeof widgetIds)[number];

export type WidgetConfig = {
	visible: boolean;
	zoom: number;
	x: number;
	y: number;
	width: number;
	height: number;
};

type WidgetLayoutState = {
	hydrated: boolean;
	layoutLocked: boolean;
	order: WidgetId[];
	config: Record<WidgetId, WidgetConfig>;

	setHydrated: (hydrated: boolean) => void;
	setLayoutLocked: (locked: boolean) => void;
	setVisible: (id: WidgetId, visible: boolean) => void;
	setZoom: (id: WidgetId, zoom: number) => void;
	setSize: (id: WidgetId, width: number, height: number) => void;
	setPosition: (id: WidgetId, x: number, y: number) => void;
	arrangeToGrid: () => void;
	resetLayout: () => void;
};

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 3.2;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 220;
const WIDGET_GAP = 12;

const defaultConfigFactory = (): Record<WidgetId, WidgetConfig> => ({
	leaderboard: { visible: true, zoom: 1, x: 8, y: 8, width: 900, height: 480 },
	map: { visible: true, zoom: 1, x: 920, y: 8, width: 620, height: 480 },
	telemetry: { visible: true, zoom: 1, x: 8, y: 500, width: 620, height: 300 },
	"race-control": { visible: true, zoom: 1, x: 640, y: 500, width: 290, height: 300 },
	"team-radios": { visible: true, zoom: 1, x: 940, y: 500, width: 290, height: 300 },
	"track-violations": { visible: true, zoom: 1, x: 1240, y: 500, width: 300, height: 300 },
	tyres: { visible: true, zoom: 1, x: 8, y: 812, width: 1532, height: 260 },
});

const defaultOrderFactory = (): WidgetId[] => [...widgetIds];

function clampConfigItem(item: WidgetConfig): WidgetConfig {
	return {
		...item,
		zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, item.zoom)),
		x: Math.max(0, Math.round(item.x)),
		y: Math.max(0, Math.round(item.y)),
		width: Math.max(MIN_WIDTH, Math.round(item.width)),
		height: Math.max(MIN_HEIGHT, Math.round(item.height)),
	};
}

function clampConfig(config: Record<WidgetId, WidgetConfig>): Record<WidgetId, WidgetConfig> {
	const next = {} as Record<WidgetId, WidgetConfig>;
	for (const id of widgetIds) {
		next[id] = clampConfigItem(config[id]);
	}
	return next;
}

function intersects(a: WidgetConfig, b: WidgetConfig): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function resolveOverlaps(
	config: Record<WidgetId, WidgetConfig>,
	order: WidgetId[],
	sourceId: WidgetId,
): Record<WidgetId, WidgetConfig> {
	const next = clampConfig(config);
	const source = next[sourceId];
	if (!source.visible) return next;

	const queue = [sourceId];
	const visited = new Set<WidgetId>();

	while (queue.length > 0) {
		const currentId = queue.shift() as WidgetId;
		if (visited.has(currentId)) continue;
		visited.add(currentId);
		const current = next[currentId];
		if (!current.visible) continue;

		for (const otherId of order) {
			if (otherId === currentId) continue;
			const other = next[otherId];
			if (!other.visible) continue;
			if (!intersects(current, other)) continue;

			const pushedY = current.y + current.height + WIDGET_GAP;
			next[otherId] = { ...other, y: pushedY };
			queue.push(otherId);
		}
	}

	return next;
}

function sanitizeOrder(order: WidgetId[] | undefined): WidgetId[] {
	const source = order && order.length > 0 ? order : defaultOrderFactory();
	const uniq = new Set<WidgetId>();
	for (const id of source) {
		if ((widgetIds as readonly string[]).includes(id)) {
			uniq.add(id);
		}
	}
	for (const id of widgetIds) {
		if (!uniq.has(id)) uniq.add(id);
	}
	return Array.from(uniq);
}

function mergePersistedConfig(persisted?: Partial<Record<WidgetId, Partial<WidgetConfig>>>): Record<WidgetId, WidgetConfig> {
	const defaults = defaultConfigFactory();
	if (!persisted) return defaults;

	const merged = {} as Record<WidgetId, WidgetConfig>;
	for (const id of widgetIds) {
		merged[id] = clampConfigItem({ ...defaults[id], ...(persisted[id] ?? {}) });
	}
	return merged;
}

export const useWidgetLayoutStore = create<WidgetLayoutState>()(
	persist(
		(set) => ({
			hydrated: false,
			layoutLocked: true,
			order: defaultOrderFactory(),
			config: defaultConfigFactory(),

			setHydrated: (hydrated) => set({ hydrated }),
			setLayoutLocked: (layoutLocked) => set({ layoutLocked }),

			setVisible: (id, visible) =>
				set((state) => ({
					config: {
						...state.config,
						[id]: { ...state.config[id], visible },
					},
				})),

			setZoom: (id, zoom) =>
				set((state) => ({
					config: {
						...state.config,
						[id]: { ...state.config[id], zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) },
					},
				})),

			setSize: (id, width, height) =>
				set((state) => {
					const updated = {
						...state.config,
						[id]: {
							...state.config[id],
							width: Math.max(MIN_WIDTH, Math.round(width)),
							height: Math.max(MIN_HEIGHT, Math.round(height)),
						},
					};
					return { config: resolveOverlaps(updated, state.order, id) };
				}),

			setPosition: (id, x, y) =>
				set((state) => {
					const updated = {
						...state.config,
						[id]: {
							...state.config[id],
							x: Math.max(0, Math.round(x)),
							y: Math.max(0, Math.round(y)),
						},
					};
					return { config: resolveOverlaps(updated, state.order, id) };
				}),

			arrangeToGrid: () =>
				set((state) => {
					const updated = { ...state.config };
					const visible = state.order.filter((id) => updated[id].visible);
					const boardWidth = 1540;
					const colWidth = 380;
					const columns = Math.max(1, Math.floor((boardWidth + WIDGET_GAP) / (colWidth + WIDGET_GAP)));

					let cursorX = 8;
					let cursorY = 8;
					let col = 0;
					let rowHeight = 0;

					for (const id of visible) {
						const current = updated[id];
						const width = Math.min(current.width, colWidth);
						updated[id] = {
							...current,
							x: cursorX,
							y: cursorY,
							width,
						};
						rowHeight = Math.max(rowHeight, current.height);

						col += 1;
						if (col >= columns) {
							col = 0;
							cursorX = 8;
							cursorY += rowHeight + WIDGET_GAP;
							rowHeight = 0;
						} else {
							cursorX += width + WIDGET_GAP;
						}
					}

					return { config: clampConfig(updated) };
				}),

			resetLayout: () => ({
				order: defaultOrderFactory(),
				config: defaultConfigFactory(),
				layoutLocked: true,
			}),
		}),
		{
			name: "widget-layout-storage-v3",
			storage: createJSONStorage(() => localStorage),
			merge: (persisted, current) => {
				const p = (persisted as Partial<WidgetLayoutState>) ?? {};
				return {
					...current,
					layoutLocked: p.layoutLocked ?? current.layoutLocked,
					order: sanitizeOrder(p.order),
					config: mergePersistedConfig(p.config as Partial<Record<WidgetId, Partial<WidgetConfig>>> | undefined),
				};
			},
			onRehydrateStorage: () => (state) => {
				state?.setHydrated(true);
			},
		},
	),
);
