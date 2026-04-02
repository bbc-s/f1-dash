"use client";

import type { WidgetId } from "@/stores/useWidgetLayoutStore";

type WindowGeometry = {
	left: number;
	top: number;
	width: number;
	height: number;
};

type PopoutEntry = {
	key: string;
	id: WidgetId;
	open: boolean;
	geometry?: WindowGeometry;
	telemetryDrivers?: string[];
};

type PopoutState = {
	entries: PopoutEntry[];
};

export type PresetPopout = {
	id: WidgetId;
	key?: string;
	geometry?: WindowGeometry;
	telemetryDrivers?: string[];
};

const STORAGE_KEY = "f1dash-widget-popouts-v1";
const WINDOW_REFS_KEY = "__f1dashWidgetPopoutRefs";

function readState(): PopoutState {
	if (typeof window === "undefined") return { entries: [] };
	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as PopoutState | Partial<Record<WidgetId, PopoutEntry>>;
		if ("entries" in raw && Array.isArray(raw.entries)) return raw;
		const migrated: PopoutEntry[] = Object.entries(raw ?? {}).flatMap(([idRaw, entry]) => {
			if (!entry) return [];
			return [{
				id: idRaw as WidgetId,
				key: "default",
				open: Boolean(entry.open),
				geometry: entry.geometry,
				telemetryDrivers: Array.isArray(entry.telemetryDrivers) ? entry.telemetryDrivers : undefined,
			}];
		});
		return { entries: migrated };
	} catch {
		return { entries: [] };
	}
}

function writeState(state: PopoutState) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getRefMap(): Partial<Record<string, Window>> {
	if (typeof window === "undefined") return {};
	const host = window as Window & { [WINDOW_REFS_KEY]?: Partial<Record<string, Window>> };
	if (!host[WINDOW_REFS_KEY]) host[WINDOW_REFS_KEY] = {};
	return host[WINDOW_REFS_KEY]!;
}

function getEntryKey(id: WidgetId, key?: string) {
	return `${id}::${key ?? "default"}`;
}

function upsertEntry(state: PopoutState, entry: PopoutEntry) {
	const nextEntries = state.entries.filter((item) => !(item.id === entry.id && item.key === entry.key));
	nextEntries.push(entry);
	return { entries: nextEntries };
}

function toFeatures(geometry?: WindowGeometry, fallback?: { width: number; height: number }): string {
	const width = Math.max(960, geometry?.width ?? fallback?.width ?? 1280);
	const height = Math.max(640, geometry?.height ?? fallback?.height ?? 900);
	const left = Math.max(0, geometry?.left ?? 120);
	const top = Math.max(0, geometry?.top ?? 80);
	return `noopener,noreferrer,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;
}

export function markPopoutOpen(id: WidgetId, geometry?: WindowGeometry, key = "default", telemetryDrivers?: string[]) {
	const state = readState();
	const previous = state.entries.find((item) => item.id === id && item.key === key);
	writeState(
		upsertEntry(state, {
			id,
			key,
			open: true,
			geometry: geometry ?? previous?.geometry,
			telemetryDrivers: telemetryDrivers ?? previous?.telemetryDrivers,
		}),
	);
}

export function markPopoutClosed(id: WidgetId, key = "default") {
	const state = readState();
	const previous = state.entries.find((item) => item.id === id && item.key === key);
	writeState(
		upsertEntry(state, {
			id,
			key,
			open: false,
			geometry: previous?.geometry,
			telemetryDrivers: previous?.telemetryDrivers,
		}),
	);
}

export function updatePopoutGeometry(id: WidgetId, geometry: WindowGeometry, key = "default", telemetryDrivers?: string[]) {
	const state = readState();
	const previous = state.entries.find((item) => item.id === id && item.key === key);
	writeState(
		upsertEntry(state, {
			id,
			key,
			open: true,
			geometry,
			telemetryDrivers: telemetryDrivers ?? previous?.telemetryDrivers,
		}),
	);
}

export function openWidgetPopout(
	id: WidgetId,
	fallback?: { width: number; height: number },
	options?: { instanceKey?: string; telemetryDrivers?: string[] },
) {
	const instanceKey = options?.instanceKey ?? (id === "telemetry" ? crypto.randomUUID() : "default");
	const refKey = getEntryKey(id, instanceKey);
	const refs = getRefMap();
	const existing = refs[refKey];
	if (existing && !existing.closed && id !== "telemetry") {
		existing.focus();
		markPopoutOpen(id, undefined, instanceKey, options?.telemetryDrivers);
		return existing;
	}

	const state = readState();
	const known = state.entries.find((item) => item.id === id && item.key === instanceKey);
	const geometry = known?.geometry;
	const query = new URLSearchParams();
	query.set("k", instanceKey);
	if (id === "telemetry" && options?.telemetryDrivers && options.telemetryDrivers.length > 0) {
		query.set("d", options.telemetryDrivers.join(","));
	}
	const next = window.open(`/widget/${id}?${query.toString()}`, "_blank", toFeatures(geometry, fallback));
	if (!next) return null;
	refs[refKey] = next;
	markPopoutOpen(id, geometry, instanceKey, options?.telemetryDrivers);
	return next;
}

export function captureOpenPopouts(): PresetPopout[] {
	const state = readState();
	const result: PresetPopout[] = [];
	for (const entry of state.entries) {
		if (!entry.open) continue;
		result.push({ id: entry.id, key: entry.key, geometry: entry.geometry, telemetryDrivers: entry.telemetryDrivers });
	}
	return result;
}

export function applyPopoutPreset(popouts: PresetPopout[], fallbackById: Partial<Record<WidgetId, { width: number; height: number }>>) {
	const wanted = new Set(popouts.map((p) => getEntryKey(p.id, p.key)));
	const refs = getRefMap();

	for (const item of popouts) {
		const state = readState();
		const existing = state.entries.find((entry) => entry.id === item.id && entry.key === (item.key ?? "default"));
		const merged: PopoutEntry = {
			id: item.id,
			key: item.key ?? "default",
			open: true,
			geometry: item.geometry ?? existing?.geometry,
			telemetryDrivers: item.telemetryDrivers ?? existing?.telemetryDrivers,
		};
		writeState(upsertEntry(state, merged));
		openWidgetPopout(item.id, fallbackById[item.id], { instanceKey: merged.key, telemetryDrivers: merged.telemetryDrivers });
	}

	for (const [key, ref] of Object.entries(refs)) {
		if (!wanted.has(key) && ref && !ref.closed) {
			ref.close();
		}
	}

	const nextState = readState();
	writeState({
		entries: nextState.entries.map((entry) => ({
			...entry,
			open: wanted.has(getEntryKey(entry.id, entry.key)),
		})),
	});
}
