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
	width: number;
	height: number;
};

type WidgetLayoutState = {
	order: WidgetId[];
	config: Record<WidgetId, WidgetConfig>;

	moveWidget: (dragged: WidgetId, target: WidgetId) => void;
	setVisible: (id: WidgetId, visible: boolean) => void;
	setZoom: (id: WidgetId, zoom: number) => void;
	setSize: (id: WidgetId, width: number, height: number) => void;
	resetLayout: () => void;
};

const defaultConfig: Record<WidgetId, WidgetConfig> = {
	leaderboard: { visible: true, zoom: 1, width: 900, height: 540 },
	map: { visible: true, zoom: 1, width: 720, height: 540 },
	telemetry: { visible: true, zoom: 1, width: 720, height: 300 },
	"race-control": { visible: true, zoom: 1, width: 420, height: 420 },
	"team-radios": { visible: true, zoom: 1, width: 420, height: 420 },
	"track-violations": { visible: true, zoom: 1, width: 420, height: 420 },
	tyres: { visible: true, zoom: 1, width: 720, height: 300 },
};

const defaultOrder: WidgetId[] = [...widgetIds];

export const useWidgetLayoutStore = create<WidgetLayoutState>()(
	persist(
		(set) => ({
			order: defaultOrder,
			config: defaultConfig,

			moveWidget: (dragged, target) =>
				set((state) => {
					const order = [...state.order];
					const draggedIndex = order.indexOf(dragged);
					const targetIndex = order.indexOf(target);
					if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return state;

					order.splice(draggedIndex, 1);
					order.splice(targetIndex, 0, dragged);
					return { ...state, order };
				}),

			setVisible: (id, visible) =>
				set((state) => ({
					config: {
						...state.config,
						[id]: {
							...state.config[id],
							visible,
						},
					},
				})),

			setZoom: (id, zoom) =>
				set((state) => ({
					config: {
						...state.config,
						[id]: {
							...state.config[id],
							zoom: Math.max(0.7, Math.min(1.8, zoom)),
						},
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

			resetLayout: () => ({
				order: defaultOrder,
				config: defaultConfig,
			}),
		}),
		{
			name: "widget-layout-storage-v1",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
