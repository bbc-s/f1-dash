"use client";

import type { WidgetId } from "@/stores/useWidgetLayoutStore";

type WindowGeometry = {
	left: number;
	top: number;
	width: number;
	height: number;
};

type PopoutEntry = {
	open: boolean;
	geometry?: WindowGeometry;
};

type PopoutState = Partial<Record<WidgetId, PopoutEntry>>;

export type PresetPopout = {
	id: WidgetId;
	geometry?: WindowGeometry;
};

const STORAGE_KEY = "f1dash-widget-popouts-v1";
const WINDOW_REFS_KEY = "__f1dashWidgetPopoutRefs";

function readState(): PopoutState {
	if (typeof window === "undefined") return {};
	try {
		return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as PopoutState) ?? {};
	} catch {
		return {};
	}
}

function writeState(state: PopoutState) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getRefMap(): Partial<Record<WidgetId, Window>> {
	if (typeof window === "undefined") return {};
	const host = window as Window & { [WINDOW_REFS_KEY]?: Partial<Record<WidgetId, Window>> };
	if (!host[WINDOW_REFS_KEY]) host[WINDOW_REFS_KEY] = {};
	return host[WINDOW_REFS_KEY]!;
}

function toFeatures(geometry?: WindowGeometry, fallback?: { width: number; height: number }): string {
	const width = Math.max(960, geometry?.width ?? fallback?.width ?? 1280);
	const height = Math.max(640, geometry?.height ?? fallback?.height ?? 900);
	const left = Math.max(0, geometry?.left ?? 120);
	const top = Math.max(0, geometry?.top ?? 80);
	return `noopener,noreferrer,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;
}

export function markPopoutOpen(id: WidgetId, geometry?: WindowGeometry) {
	const state = readState();
	state[id] = { open: true, geometry: geometry ?? state[id]?.geometry };
	writeState(state);
}

export function markPopoutClosed(id: WidgetId) {
	const state = readState();
	state[id] = { open: false, geometry: state[id]?.geometry };
	writeState(state);
}

export function updatePopoutGeometry(id: WidgetId, geometry: WindowGeometry) {
	const state = readState();
	state[id] = { open: true, geometry };
	writeState(state);
}

export function openWidgetPopout(id: WidgetId, fallback?: { width: number; height: number }) {
	const refs = getRefMap();
	const existing = refs[id];
	if (existing && !existing.closed) {
		existing.focus();
		markPopoutOpen(id);
		return existing;
	}

	const state = readState();
	const geometry = state[id]?.geometry;
	const next = window.open(`/widget/${id}`, "_blank", toFeatures(geometry, fallback));
	if (!next) return null;
	refs[id] = next;
	markPopoutOpen(id, geometry);
	return next;
}

export function captureOpenPopouts(): PresetPopout[] {
	const state = readState();
	const result: PresetPopout[] = [];
	for (const [idRaw, entry] of Object.entries(state)) {
		const id = idRaw as WidgetId;
		if (!entry?.open) continue;
		result.push({ id, geometry: entry.geometry });
	}
	return result;
}

export function applyPopoutPreset(popouts: PresetPopout[], fallbackById: Partial<Record<WidgetId, { width: number; height: number }>>) {
	const wanted = new Set(popouts.map((p) => p.id));
	const refs = getRefMap();

	for (const item of popouts) {
		const state = readState();
		const merged: PopoutEntry = { open: true, geometry: item.geometry ?? state[item.id]?.geometry };
		state[item.id] = merged;
		writeState(state);
		openWidgetPopout(item.id, fallbackById[item.id]);
	}

	for (const [idRaw, ref] of Object.entries(refs)) {
		const id = idRaw as WidgetId;
		if (!wanted.has(id) && ref && !ref.closed) {
			ref.close();
		}
	}

	const nextState = readState();
	for (const [idRaw, entry] of Object.entries(nextState)) {
		const id = idRaw as WidgetId;
		if (!entry) continue;
		nextState[id] = { open: wanted.has(id), geometry: entry.geometry };
	}
	writeState(nextState);
}

