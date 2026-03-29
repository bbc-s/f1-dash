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
	resetLayout: () => void;
};

const defaultConfigFactory = (): Record<WidgetId, WidgetConfig> => ({
	leaderboard: { visible: true, zoom: 1, x: 8, y: 8, width: 980, height: 520 },
	map: { visible: true, zoom: 1, x: 1000, y: 8, width: 780, height: 520 },
	telemetry: { visible: true, zoom: 1, x: 8, y: 540, width: 780, height: 300 },
	"race-control": { visible: true, zoom: 1, x: 800, y: 540, width: 320, height: 300 },
	"team-radios": { visible: true, zoom: 1, x: 1130, y: 540, width: 320, height: 300 },
	"track-violations": { visible: true, zoom: 1, x: 1460, y: 540, width: 320, height: 300 },
	tyres: { visible: true, zoom: 1, x: 8, y: 850, width: 1770, height: 280 },
});

const defaultOrderFactory = (): WidgetId[] => [...widgetIds];

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
						[id]: { ...state.config[id], zoom: Math.max(0.7, Math.min(1.8, zoom)) },
					},
				})),

			setSize: (id, width, height) =>
				set((state) => ({
					config: {
						...state.config,
						[id]: {
							...state.config[id],
							width: Math.max(280, Math.round(width)),
							height: Math.max(220, Math.round(height)),
						},
					},
				})),

			setPosition: (id, x, y) =>
				set((state) => ({
					config: {
						...state.config,
						[id]: {
							...state.config[id],
							x: Math.max(0, Math.round(x)),
							y: Math.max(0, Math.round(y)),
						},
					},
				})),

			resetLayout: () => ({
				order: defaultOrderFactory(),
				config: defaultConfigFactory(),
				layoutLocked: true,
			}),
		}),
		{
			name: "widget-layout-storage-v2",
			storage: createJSONStorage(() => localStorage),
			onRehydrateStorage: () => (state) => {
				state?.setHydrated(true);
			},
		},
	),
);
