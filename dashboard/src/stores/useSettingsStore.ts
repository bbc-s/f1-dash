import { persist, createJSONStorage, subscribeWithSelector } from "zustand/middleware";
import { create } from "zustand";
import { leaderboardColumnsDefault, type LeaderboardColumn, type LeaderboardColumnId } from "@/types/leaderboard.type";

type SpeedUnit = "metric" | "imperial";

type SettingsStore = {
	delay: number;
	setDelay: (delay: number) => void;

	speedUnit: SpeedUnit;
	setSpeedUnit: (speedUnit: SpeedUnit) => void;

	showCornerNumbers: boolean;
	setShowCornerNumbers: (showCornerNumbers: boolean) => void;

	carMetrics: boolean;
	setCarMetrics: (carMetrics: boolean) => void;

	tableHeaders: boolean;
	setTableHeaders: (tableHeaders: boolean) => void;

	showBestSectors: boolean;
	setShowBestSectors: (showBestSectors: boolean) => void;

	showMiniSectors: boolean;
	setShowMiniSectors: (showMiniSectors: boolean) => void;

	oledMode: boolean;
	setOledMode: (oledMode: boolean) => void;

	useSafetyCarColors: boolean;
	setUseSafetyCarColors: (useSafetyCarColors: boolean) => void;

	favoriteDrivers: string[];
	setFavoriteDrivers: (favoriteDrivers: string[]) => void;
	removeFavoriteDriver: (driver: string) => void;

	raceControlChime: boolean;
	setRaceControlChime: (raceControlChime: boolean) => void;

	raceControlChimeVolume: number;
	setRaceControlChimeVolume: (raceControlChimeVolume: number) => void;
	showBlueFlagsInRaceControl: boolean;
	setShowBlueFlagsInRaceControl: (showBlueFlagsInRaceControl: boolean) => void;

	delayIsPaused: boolean;
	setDelayIsPaused: (delayIsPaused: boolean) => void;

	leaderboardColumns: LeaderboardColumn[];
	setLeaderboardColumns: (columns: LeaderboardColumn[]) => void;
	setLeaderboardColumnVisible: (id: LeaderboardColumnId, visible: boolean) => void;
	setLeaderboardColumnWidth: (id: LeaderboardColumnId, width: string) => void;
	moveLeaderboardColumn: (id: LeaderboardColumnId, direction: "left" | "right") => void;
};

function normalizeLeaderboardColumns(input?: LeaderboardColumn[]): LeaderboardColumn[] {
	const current = Array.isArray(input) ? input : [];
	const byId = new Map(current.map((column) => [column.id, column]));
	return leaderboardColumnsDefault.map((base) => ({ ...base, ...(byId.get(base.id) ?? {}) }));
}

export const useSettingsStore = create<SettingsStore>()(
	subscribeWithSelector(
		persist(
			(set) => ({
				delay: 0,
				setDelay: (delay: number) => set({ delay }),

				speedUnit: "metric",
				setSpeedUnit: (speedUnit: SpeedUnit) => set({ speedUnit }),

				showCornerNumbers: false,
				setShowCornerNumbers: (showCornerNumbers: boolean) => set({ showCornerNumbers }),

				carMetrics: false,
				setCarMetrics: (carMetrics: boolean) => set({ carMetrics }),

				tableHeaders: false,
				setTableHeaders: (tableHeaders: boolean) => set({ tableHeaders }),

				showBestSectors: true,
				setShowBestSectors: (showBestSectors: boolean) => set({ showBestSectors }),

				showMiniSectors: true,
				setShowMiniSectors: (showMiniSectors: boolean) => set({ showMiniSectors }),

				oledMode: false,
				setOledMode: (oledMode: boolean) => set({ oledMode }),

				useSafetyCarColors: true,
				setUseSafetyCarColors: (useSafetyCarColors: boolean) => set({ useSafetyCarColors }),

				favoriteDrivers: [],
				setFavoriteDrivers: (favoriteDrivers: string[]) => set({ favoriteDrivers }),
				removeFavoriteDriver: (driver: string) =>
					set((state) => ({ favoriteDrivers: state.favoriteDrivers.filter((d) => d !== driver) })),

				raceControlChime: false,
				setRaceControlChime: (raceControlChime: boolean) => set({ raceControlChime }),

				raceControlChimeVolume: 50,
				setRaceControlChimeVolume: (raceControlChimeVolume: number) => set({ raceControlChimeVolume }),
				showBlueFlagsInRaceControl: false,
				setShowBlueFlagsInRaceControl: (showBlueFlagsInRaceControl: boolean) => set({ showBlueFlagsInRaceControl }),

				delayIsPaused: true,
				setDelayIsPaused: (delayIsPaused: boolean) => set({ delayIsPaused }),

				leaderboardColumns: leaderboardColumnsDefault,
				setLeaderboardColumns: (leaderboardColumns: LeaderboardColumn[]) =>
					set({ leaderboardColumns: normalizeLeaderboardColumns(leaderboardColumns) }),
				setLeaderboardColumnVisible: (id: LeaderboardColumnId, visible: boolean) =>
					set((state) => {
						const normalized = normalizeLeaderboardColumns(state.leaderboardColumns);
						return {
							leaderboardColumns: normalized.map((col) => (col.id === id ? { ...col, visible } : col)),
						};
					}),
				setLeaderboardColumnWidth: (id: LeaderboardColumnId, width: string) =>
					set((state) => {
						const normalized = normalizeLeaderboardColumns(state.leaderboardColumns);
						return {
							leaderboardColumns: normalized.map((col) => (col.id === id ? { ...col, width } : col)),
						};
					}),
				moveLeaderboardColumn: (id: LeaderboardColumnId, direction: "left" | "right") =>
					set((state) => {
						const cols = [...normalizeLeaderboardColumns(state.leaderboardColumns)];
						const index = cols.findIndex((c) => c.id === id);
						if (index === -1) return state;
						const target = direction === "left" ? index - 1 : index + 1;
						if (target < 0 || target >= cols.length) return state;
						const [item] = cols.splice(index, 1);
						cols.splice(target, 0, item);
						return { leaderboardColumns: cols };
					}),
			}),
				{
					name: "settings-storage",
					storage: createJSONStorage(() => localStorage),
					merge: (persisted, current) => {
						const source = (persisted as Partial<SettingsStore>) ?? {};
						return {
							...current,
							...source,
							leaderboardColumns: normalizeLeaderboardColumns(source.leaderboardColumns),
						};
					},
					onRehydrateStorage: (state) => {
						return () => state.setDelayIsPaused(false);
					},
			},
		),
	),
);
