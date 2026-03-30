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
	"weather-radar",
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
	revision: number;
	layoutLocked: boolean;
	snapToGrid: boolean;
	displaced: Partial<Record<WidgetId, { by: WidgetId; x: number; y: number }>>;
	order: WidgetId[];
	config: Record<WidgetId, WidgetConfig>;

	setHydrated: (hydrated: boolean) => void;
	setLayoutLocked: (locked: boolean) => void;
	setSnapToGrid: (snap: boolean) => void;
	setVisible: (id: WidgetId, visible: boolean) => void;
	setZoom: (id: WidgetId, zoom: number) => void;
	setSize: (id: WidgetId, width: number, height: number) => void;
	setPosition: (id: WidgetId, x: number, y: number) => void;
	arrangeToGrid: () => void;
	resetLayout: () => void;
};

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3.5;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 220;
const WIDGET_GAP = 12;
const GRID_STEP = 12;

const defaultConfigFactory = (): Record<WidgetId, WidgetConfig> => ({
	leaderboard: { visible: true, zoom: 1, x: 8, y: 8, width: 900, height: 480 },
	map: { visible: true, zoom: 1, x: 920, y: 8, width: 620, height: 480 },
	telemetry: { visible: true, zoom: 1, x: 8, y: 500, width: 620, height: 300 },
	"race-control": { visible: true, zoom: 1, x: 640, y: 500, width: 290, height: 300 },
	"team-radios": { visible: true, zoom: 1, x: 940, y: 500, width: 290, height: 300 },
	"track-violations": { visible: true, zoom: 1, x: 1240, y: 500, width: 300, height: 300 },
	tyres: { visible: true, zoom: 1, x: 8, y: 812, width: 1532, height: 260 },
	"weather-radar": { visible: false, zoom: 1, x: 8, y: 1084, width: 980, height: 420 },
});

const defaultOrderFactory = (): WidgetId[] => [...widgetIds];

function snap(value: number): number {
	return Math.round(value / GRID_STEP) * GRID_STEP;
}

function clampConfigItem(item: WidgetConfig): WidgetConfig {
	return {
		...item,
		zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, item.zoom)),
		x: Math.max(0, item.x),
		y: Math.max(0, item.y),
		width: Math.max(MIN_WIDTH, item.width),
		height: Math.max(MIN_HEIGHT, item.height),
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

function resolveOverlapsOnResize(
	config: Record<WidgetId, WidgetConfig>,
	order: WidgetId[],
	sourceId: WidgetId,
): Record<WidgetId, WidgetConfig> {
	const next = clampConfig(config);
	const source = next[sourceId];
	if (!source.visible) return next;

	for (const otherId of order) {
		if (otherId === sourceId) continue;
		const other = next[otherId];
		if (!other.visible) continue;
		if (!intersects(source, other)) continue;

		next[otherId] = { ...other, y: snap(source.y + source.height + WIDGET_GAP) };
	}

	return next;
}

function resolveOverlapsFromSource(
	config: Record<WidgetId, WidgetConfig>,
	order: WidgetId[],
	sourceId: WidgetId,
): Record<WidgetId, WidgetConfig> {
	const next = clampConfig(config);
	const source = next[sourceId];
	if (!source.visible) return next;

	const queue: WidgetId[] = [sourceId];
	const processed = new Set<WidgetId>();

	while (queue.length > 0) {
		const currentId = queue.shift();
		if (!currentId || processed.has(currentId)) continue;
		processed.add(currentId);
		const current = next[currentId];
		if (!current.visible) continue;

		for (const otherId of order) {
			if (otherId === currentId) continue;
			const other = next[otherId];
			if (!other.visible) continue;
			if (!intersects(current, other)) continue;

			const nextY = snap(current.y + current.height + WIDGET_GAP);
			if (other.y !== nextY) {
				next[otherId] = { ...other, y: nextY };
				queue.push(otherId);
			}
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

function withRevision(
	state: WidgetLayoutState,
	payload: Partial<Pick<WidgetLayoutState, "layoutLocked" | "snapToGrid" | "displaced" | "order" | "config">>,
): Partial<WidgetLayoutState> {
	return {
		...payload,
	revision: state.revision + 1,
	};
}

function canPlace(
	config: Record<WidgetId, WidgetConfig>,
	order: WidgetId[],
	id: WidgetId,
	x: number,
	y: number,
): boolean {
	const candidate = { ...config[id], x, y };
	for (const otherId of order) {
		if (otherId === id) continue;
		const other = config[otherId];
		if (!other.visible) continue;
		if (intersects(candidate, other)) return false;
	}
	return true;
}

function resolveDisplacements(
	currentConfig: Record<WidgetId, WidgetConfig>,
	baseConfig: Record<WidgetId, WidgetConfig>,
	displaced: Partial<Record<WidgetId, { by: WidgetId; x: number; y: number }>>,
	order: WidgetId[],
	sourceId: WidgetId,
): { config: Record<WidgetId, WidgetConfig>; displaced: Partial<Record<WidgetId, { by: WidgetId; x: number; y: number }>> } {
	const next = clampConfig({ ...currentConfig });
	const nextDisplaced = { ...displaced };
	const source = next[sourceId];
	if (!source.visible) return { config: next, displaced: nextDisplaced };

	for (const otherId of order) {
		if (otherId === sourceId) continue;
		const other = next[otherId];
		if (!other.visible) continue;

		if (intersects(source, other)) {
			if (!nextDisplaced[otherId]) {
				nextDisplaced[otherId] = {
					by: sourceId,
					x: baseConfig[otherId].x,
					y: baseConfig[otherId].y,
				};
			}

			const rightX = snap(source.x + source.width + WIDGET_GAP);
			const rightY = other.y;
			const downX = other.x;
			const downY = snap(source.y + source.height + WIDGET_GAP);

			if (canPlace(next, order, otherId, rightX, rightY)) {
				next[otherId] = { ...other, x: rightX, y: rightY };
			} else if (canPlace(next, order, otherId, downX, downY)) {
				next[otherId] = { ...other, x: downX, y: downY };
			} else {
				let tryY = downY;
				let placed = false;
				for (let i = 0; i < 8; i += 1) {
					if (canPlace(next, order, otherId, downX, tryY)) {
						next[otherId] = { ...other, x: downX, y: tryY };
						placed = true;
						break;
					}
					tryY = snap(tryY + other.height + WIDGET_GAP);
				}
				if (!placed) {
					next[otherId] = { ...other, x: rightX, y: downY };
				}
			}
		} else if (nextDisplaced[otherId]?.by === sourceId) {
			const original = nextDisplaced[otherId];
			if (original && canPlace(next, order, otherId, original.x, original.y)) {
				next[otherId] = { ...other, x: original.x, y: original.y };
				delete nextDisplaced[otherId];
			}
		}
	}

	return { config: next, displaced: nextDisplaced };
}

export const useWidgetLayoutStore = create<WidgetLayoutState>()(
	persist(
		(set) => ({
			hydrated: false,
			revision: 0,
			layoutLocked: true,
			snapToGrid: true,
			displaced: {},
			order: defaultOrderFactory(),
			config: defaultConfigFactory(),

			setHydrated: (hydrated) => set({ hydrated }),
			setLayoutLocked: (layoutLocked) =>
				set((state) => withRevision(state, { layoutLocked })),
			setSnapToGrid: (snapToGrid) =>
				set((state) => withRevision(state, { snapToGrid })),

			setVisible: (id, visible) =>
				set((state) =>
					withRevision(state, {
						config: {
							...state.config,
							[id]: { ...state.config[id], visible },
						},
					}),
				),

			setZoom: (id, zoom) =>
				set((state) =>
					withRevision(state, {
						config: {
							...state.config,
							[id]: { ...state.config[id], zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) },
						},
					}),
				),

			setSize: (id, width, height) =>
				set((state) => {
					const applySnap = state.snapToGrid;
					const updated = {
						...state.config,
						[id]: {
							...state.config[id],
							width: Math.max(MIN_WIDTH, applySnap ? snap(width) : width),
							height: Math.max(MIN_HEIGHT, applySnap ? snap(height) : height),
						},
					};
					const resolved = resolveOverlapsOnResize(updated, state.order, id);
					const withDisplacements = resolveDisplacements(resolved, state.config, state.displaced, state.order, id);
					return withRevision(state, { config: withDisplacements.config, displaced: withDisplacements.displaced });
				}),

			setPosition: (id, x, y) =>
				set((state) => {
					const applySnap = state.snapToGrid;
					const updated = {
						...state.config,
						[id]: {
							...state.config[id],
							x: Math.max(0, applySnap ? snap(x) : x),
							y: Math.max(0, applySnap ? snap(y) : y),
						},
					};
					const resolved = resolveOverlapsFromSource(updated, state.order, id);
					const withDisplacements = resolveDisplacements(resolved, state.config, state.displaced, state.order, id);
					return withRevision(state, { config: withDisplacements.config, displaced: withDisplacements.displaced });
				}),

			arrangeToGrid: () =>
				set((state) => {
					const updated = { ...state.config };
					const visible = state.order.filter((id) => updated[id].visible);
					const boardWidth = 1540;
					const columns = Math.max(1, Math.floor((boardWidth + WIDGET_GAP) / (420 + WIDGET_GAP)));

					let cursorX = 8;
					let cursorY = 8;
					let col = 0;
					let rowHeight = 0;

					for (const id of visible) {
						const current = updated[id];
						updated[id] = {
							...current,
							x: snap(cursorX),
							y: snap(cursorY),
						};
						rowHeight = Math.max(rowHeight, current.height);

						col += 1;
						if (col >= columns) {
							col = 0;
							cursorX = 8;
							cursorY += rowHeight + WIDGET_GAP;
							rowHeight = 0;
						} else {
							cursorX += current.width + WIDGET_GAP;
						}
					}

					return withRevision(state, { config: clampConfig(updated) });
				}),

			resetLayout: () =>
				set((state) =>
					withRevision(state, {
						order: defaultOrderFactory(),
						config: defaultConfigFactory(),
						layoutLocked: true,
						snapToGrid: true,
						displaced: {},
					}),
				),
		}),
		{
			name: "widget-layout-storage-v4",
			storage: createJSONStorage(() => localStorage),
			merge: (persisted, current) => {
				const p = (persisted as Partial<WidgetLayoutState>) ?? {};
				return {
					...current,
					revision: p.revision ?? current.revision,
					layoutLocked: p.layoutLocked ?? current.layoutLocked,
					snapToGrid: p.snapToGrid ?? current.snapToGrid,
					displaced: {},
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
