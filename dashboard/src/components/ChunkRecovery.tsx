"use client";

import { useEffect } from "react";

import { env } from "@/env";

const isChunkFailure = (value: unknown) => {
	const message = value instanceof Error ? value.message : typeof value === "string" ? value : String(value ?? "");
	return /ChunkLoadError|Loading chunk|Failed to load chunk|_next\/static\/chunks/i.test(message);
};

export default function ChunkRecovery() {
	useEffect(() => {
		const version = env.NEXT_PUBLIC_APP_VERSION ?? "dev";
		const reloadKey = `f1dash-chunk-reload-${version}`;

		const recover = (reason: unknown) => {
			if (!isChunkFailure(reason)) return;
			if (sessionStorage.getItem(reloadKey) === "1") return;
			sessionStorage.setItem(reloadKey, "1");
			window.location.reload();
		};

		const handleError = (event: ErrorEvent) => recover(event.error ?? event.message);
		const handleRejection = (event: PromiseRejectionEvent) => recover(event.reason);

		window.addEventListener("error", handleError);
		window.addEventListener("unhandledrejection", handleRejection);
		return () => {
			window.removeEventListener("error", handleError);
			window.removeEventListener("unhandledrejection", handleRejection);
		};
	}, []);

	return null;
}
