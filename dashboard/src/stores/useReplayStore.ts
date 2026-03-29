import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DataMode = "live" | "replay";

type ReplayStore = {
	mode: DataMode;
	setMode: (mode: DataMode) => void;

	playing: boolean;
	speed: number;
	cursorMs: number;
	durationMs: number;
	recordingId: string | null;
	connected: boolean;

	setConnected: (connected: boolean) => void;
	setFrameState: (state: {
		playing: boolean;
		speed: number;
		cursorMs: number;
		durationMs: number;
		recordingId?: string | null;
	}) => void;
};

export const useReplayStore = create<ReplayStore>()(
	persist(
		(set) => ({
			mode: "live",
			setMode: (mode) => set({ mode }),

			playing: false,
			speed: 1,
			cursorMs: 0,
			durationMs: 0,
			recordingId: null,
			connected: false,

			setConnected: (connected) => set({ connected }),
			setFrameState: (state) =>
				set({
					playing: state.playing,
					speed: state.speed,
					cursorMs: state.cursorMs,
					durationMs: state.durationMs,
					recordingId: state.recordingId ?? null,
				}),
		}),
		{
			name: "replay-storage-v1",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({ mode: state.mode }),
		},
	),
);
