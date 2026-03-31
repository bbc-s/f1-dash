"use client";

import { useMemo } from "react";

import { useDataStore } from "@/stores/useDataStore";
import { getTrackStatusMessage } from "@/lib/getTrackStatusMessage";

export default function TrackStatusFadeOverlay() {
	const trackStatus = useDataStore((state) => state.state?.TrackStatus?.Status);
	const sessionEnded = useDataStore((state) => state.state?.SessionStatus?.Status === "Ends");

	const color = useMemo(() => {
		if (sessionEnded) return "#d4d4d8";
		const parsed = trackStatus ? Number.parseInt(trackStatus, 10) : undefined;
		return getTrackStatusMessage(parsed)?.hex ?? null;
	}, [trackStatus, sessionEnded]);

	if (!color) return null;

	return (
		<div
			aria-hidden
			className="pointer-events-none fixed inset-y-0 right-0 z-10 w-1/2"
			style={{
				background: sessionEnded
					? "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(228,228,231,0.1) 70%, rgba(228,228,231,0.22) 100%)"
					: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${color}22 70%, ${color}66 100%)`,
			}}
		/>
	);
}
