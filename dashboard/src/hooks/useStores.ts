import type { CarsData, Positions, State } from "@/types/state.type";

import { useDataStore } from "@/stores/useDataStore";

type Fns = {
	updateState: (state: State) => void;
	updatePosition: (pos: Positions | null) => void;
	updateCarData: (car: CarsData | null) => void;
};

export const useStores = (): Fns => {
	const dataStore = useDataStore();

	return {
		updateState: (v) => dataStore.setState(v),
		updatePosition: (v) => dataStore.setPositions(v),
		updateCarData: (v) => dataStore.setCarsData(v),
	};
};
