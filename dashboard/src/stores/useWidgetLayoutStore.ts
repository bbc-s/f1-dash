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

export type LayoutPreset = {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	order: WidgetId[];
	config: Record<WidgetId, WidgetConfig>;
	snapToGrid: boolean;
};

type WidgetLayoutState = {
	hydrated: boolean;
	revision: number;
	layoutLocked: boolean;
	snapToGrid: boolean;
	displaced: Partial<Record<WidgetId, { by: WidgetId; x: number; y: number }>>;
	order: WidgetId[];
	config: Record<WidgetId, WidgetConfig>;
	presets: LayoutPreset[];

	setHydrated: (hydrated: boolean) => void;
	setLayoutLocked: (locked: boolean) => void;
	setSnapToGrid: (snap: boolean) => void;
	setVisible: (id: WidgetId, visible: boolean) => void;
	setZoom: (id: WidgetId, zoom: number) => void;
	setSize: (id: WidgetId, width: number, height: number) => void;
	setPosition: (id: WidgetId, x: number, y: number) => void;
	arrangeToGrid: () => void;
	resetLayout: () => void;

	createPreset: (name: string) => string | null;
	applyPreset: (id: string) => void;
	updatePreset: (id: string, name?: string) => void;
	renamePreset: (id: string, name: string) => void;
	deletePreset: (id: string) => void;
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

function overlapArea(a: WidgetConfig, b: WidgetConfig): number {
	const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
	const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
	return xOverlap * yOverlap;
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

function findSpot(
	config: Record<WidgetId, WidgetConfig>,
	order: WidgetId[],
	id: WidgetId,
	anchor: WidgetConfig,
	source: WidgetConfig,
): { x: number; y: number } {
	const candidates: Array<{ x: number; y: number }> = [
		{ x: snap(source.x + source.width + WIDGET_GAP), y: snap(source.y) },
		{ x: Math.max(0, snap(source.x - anchor.width - WIDGET_GAP)), y: snap(source.y) },
		{ x: snap(source.x), y: snap(source.y + source.height + WIDGET_GAP) },
		{ x: snap(source.x), y: Math.max(0, snap(source.y - anchor.height - WIDGET_GAP)) },
		{ x: snap(anchor.x + anchor.width + WIDGET_GAP), y: snap(anchor.y) },
		{ x: Math.max(0, snap(anchor.x - anchor.width - WIDGET_GAP)), y: snap(anchor.y) },
		{ x: snap(anchor.x), y: snap(anchor.y + anchor.height + WIDGET_GAP) },
		{ x: snap(anchor.x), y: Math.max(0, snap(anchor.y - anchor.height - WIDGET_GAP)) },
	];
	for (const candidate of candidates) {
		if (canPlace(config, order, id, candidate.x, candidate.y)) return candidate;
	}

	for (let ring = 1; ring <= 24; ring += 1) {
		const dx = ring * GRID_STEP;
		const dy = ring * GRID_STEP;
		const tries = [
			{ x: snap(source.x + source.width + WIDGET_GAP + dx), y: snap(source.y) },
			{ x: Math.max(0, snap(source.x - anchor.width - WIDGET_GAP - dx)), y: snap(source.y) },
			{ x: snap(source.x), y: snap(source.y + source.height + WIDGET_GAP + dy) },
			{ x: snap(source.x), y: Math.max(0, snap(source.y - anchor.height - WIDGET_GAP - dy)) },
			{ x: snap(anchor.x + dx), y: snap(anchor.y + dy) },
			{ x: Math.max(0, snap(anchor.x - dx)), y: snap(anchor.y + dy) },
			{ x: snap(anchor.x + dx), y: Math.max(0, snap(anchor.y - dy)) },
			{ x: Math.max(0, snap(anchor.x - dx)), y: Math.max(0, snap(anchor.y - dy)) },
		];
		for (const candidate of tries) {
			if (canPlace(config, order, id, candidate.x, candidate.y)) return candidate;
		}
	}
	return { x: anchor.x, y: snap(anchor.y + anchor.height + WIDGET_GAP) };
}

function resolveFromSource(
	currentConfig: Record<WidgetId, WidgetConfig>,
	baseConfig: Record<WidgetId, WidgetConfig>,
	currentDisplaced: Partial<Record<WidgetId, { by: WidgetId; x: number; y: number }>>,
	order: WidgetId[],
	sourceId: WidgetId,
): { config: Record<WidgetId, WidgetConfig>; displaced: Partial<Record<WidgetId, { by: WidgetId; x: number; y: number }>> } {
	const next = clampConfig({ ...currentConfig });
	const displaced = { ...currentDisplaced };
	const source = next[sourceId];
	if (!source.visible) return { config: next, displaced };

	const queue: WidgetId[] = [sourceId];
	const seen = new Set<WidgetId>();

	while (queue.length > 0) {
		const currentId = queue.shift();
		if (!currentId || seen.has(currentId)) continue;
		seen.add(currentId);
		const current = next[currentId];
		if (!current.visible) continue;

			for (const otherId of order) {
			if (otherId === currentId) continue;
			const other = next[otherId];
			if (!other.visible) continue;
			if (!intersects(current, other)) continue;

				if (!displaced[otherId]) {
					displaced[otherId] = { by: sourceId, x: baseConfig[otherId].x, y: baseConfig[otherId].y };
				}

			const spot = findSpot(next, order, otherId, other, current);
			next[otherId] = { ...other, x: spot.x, y: spot.y };
			queue.push(otherId);
		}
	}

	let restored = true;
	while (restored) {
		restored = false;
		for (const [idRaw, original] of Object.entries(displaced)) {
			const id = idRaw as WidgetId;
			const item = next[id];
			if (!item?.visible) {
				delete displaced[id];
				continue;
			}
			if (canPlace(next, order, id, original.x, original.y)) {
				next[id] = { ...item, x: original.x, y: original.y };
				delete displaced[id];
				restored = true;
			}
		}
	}

	return { config: next, displaced };
}

function findBiggestCollision(config: Record<WidgetId, WidgetConfig>, order: WidgetId[], sourceId: WidgetId): WidgetId | null {
	const source = config[sourceId];
	let bestId: WidgetId | null = null;
	let bestArea = 0;
	for (const otherId of order) {
		if (otherId === sourceId) continue;
		const other = config[otherId];
		if (!other.visible) continue;
		if (!intersects(source, other)) continue;
		const area = overlapArea(source, other);
		if (area > bestArea) {
			bestArea = area;
			bestId = otherId;
		}
	}
	return bestId;
}

function sanitizeOrder(order: WidgetId[] | undefined): WidgetId[] {
	const source = order && order.length > 0 ? order : defaultOrderFactory();
	const uniq = new Set<WidgetId>();
	for (const id of source) {
		if ((widgetIds as readonly string[]).includes(id)) uniq.add(id);
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

function mergePersistedPresets(persisted?: Array<Partial<LayoutPreset>>): LayoutPreset[] {
	if (!persisted || !Array.isArray(persisted)) return [];
	return persisted
		.filter((p): p is Partial<LayoutPreset> & { id: string; name: string } => typeof p.id === "string" && typeof p.name === "string")
		.map((p) => ({
			id: p.id,
			name: p.name,
			createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
			updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : Date.now(),
			order: sanitizeOrder(p.order as WidgetId[] | undefined),
			config: mergePersistedConfig(p.config as Partial<Record<WidgetId, Partial<WidgetConfig>>> | undefined),
			snapToGrid: typeof p.snapToGrid === "boolean" ? p.snapToGrid : true,
		}));
}

function withRevision(
	state: WidgetLayoutState,
	payload: Partial<Pick<WidgetLayoutState, "layoutLocked" | "snapToGrid" | "displaced" | "order" | "config" | "presets">>,
): Partial<WidgetLayoutState> {
	return {
		...payload,
		revision: state.revision + 1,
	};
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
			presets: [],

			setHydrated: (hydrated) => set({ hydrated }),
			setLayoutLocked: (layoutLocked) => set((state) => withRevision(state, { layoutLocked })),
			setSnapToGrid: (snapToGrid) => set((state) => withRevision(state, { snapToGrid })),

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
					const resolved = resolveFromSource(updated, state.config, state.displaced, state.order, id);
					return withRevision(state, { config: resolved.config, displaced: resolved.displaced });
				}),

				setPosition: (id, x, y) =>
					set((state) => {
						const applySnap = state.snapToGrid;
						const previous = state.config[id];
						const movedX = Math.max(0, applySnap ? snap(x) : x);
						const movedY = Math.max(0, applySnap ? snap(y) : y);
						let updated = {
							...state.config,
							[id]: {
								...state.config[id],
								x: movedX,
								y: movedY,
							},
						};

						const collided = findBiggestCollision(updated, state.order, id);
						if (collided) {
							const other = updated[collided];
							updated = {
								...updated,
								[collided]: { ...other, x: previous.x, y: previous.y },
							};
						}

					const resolved = resolveFromSource(updated, state.config, state.displaced, state.order, id);
					return withRevision(state, { config: resolved.config, displaced: resolved.displaced });
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

					return withRevision(state, { config: clampConfig(updated), displaced: {} });
				}),

			resetLayout: () =>
				set((state) =>
					withRevision(state, {
						order: defaultOrderFactory(),
						config: defaultConfigFactory(),
						layoutLocked: false,
						snapToGrid: true,
						displaced: {},
					}),
				),

			createPreset: (name) => {
				const trimmed = name.trim();
				if (!trimmed) return null;
				const id = crypto.randomUUID();
				set((state) =>
					withRevision(state, {
						presets: [
							...state.presets,
							{
								id,
								name: trimmed,
								createdAt: Date.now(),
								updatedAt: Date.now(),
								order: [...state.order],
								config: clampConfig({ ...state.config }),
								snapToGrid: state.snapToGrid,
							},
						],
					}),
				);
				return id;
			},

			applyPreset: (id) =>
				set((state) => {
					const preset = state.presets.find((p) => p.id === id);
					if (!preset) return state;
					return withRevision(state, {
						order: sanitizeOrder(preset.order),
						config: mergePersistedConfig(preset.config),
						snapToGrid: preset.snapToGrid,
						layoutLocked: false,
						displaced: {},
					});
				}),

			updatePreset: (id, name) =>
				set((state) => ({
					...withRevision(state, {
						presets: state.presets.map((p) =>
							p.id === id
								? {
									...p,
									name: name?.trim() ? name.trim() : p.name,
									updatedAt: Date.now(),
									order: [...state.order],
									config: clampConfig({ ...state.config }),
									snapToGrid: state.snapToGrid,
								}
								: p,
						),
					}),
				})),

			renamePreset: (id, name) =>
				set((state) => {
					const trimmed = name.trim();
					if (!trimmed) return state;
					return withRevision(state, {
						presets: state.presets.map((p) => (p.id === id ? { ...p, name: trimmed, updatedAt: Date.now() } : p)),
					});
				}),

			deletePreset: (id) =>
				set((state) =>
					withRevision(state, {
						presets: state.presets.filter((p) => p.id !== id),
					}),
				),
		}),
		{
			name: "widget-layout-storage-v5",
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
					presets: mergePersistedPresets(p.presets as Array<Partial<LayoutPreset>> | undefined),
				};
			},
			onRehydrateStorage: () => (state) => {
				state?.setHydrated(true);
			},
		},
	),
);
