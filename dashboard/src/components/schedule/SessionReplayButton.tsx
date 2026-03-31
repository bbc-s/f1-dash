"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { env } from "@/env";

const pendingReplayKey = "f1dash-pending-replay-id-v1";
let recordingsCache: string[] | null = null;
let recordingsPromise: Promise<string[]> | null = null;

async function loadRecordings(): Promise<string[]> {
	if (recordingsCache) return recordingsCache;
	if (!recordingsPromise) {
		recordingsPromise = (async () => {
			const response = await fetch(`${env.NEXT_PUBLIC_REPLAY_URL}/api/archive/recordings`, { cache: "no-store" });
			if (!response.ok) return [];
			const payload = (await response.json()) as { recordings?: string[] };
			recordingsCache = (payload.recordings ?? []).slice().reverse();
			return recordingsCache;
		})();
	}
	return recordingsPromise;
}

function normalize(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();
}

export default function SessionReplayButton({ raceName, sessionName }: { raceName: string; sessionName: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [matchId, setMatchId] = useState<string | null>(null);
	const [checked, setChecked] = useState(false);
	const router = useRouter();
	const raceNorm = useMemo(() => normalize(raceName), [raceName]);
	const sessionNorm = useMemo(() => normalize(sessionName), [sessionName]);

	useEffect(() => {
		if (checked) return;
		if (!env.NEXT_PUBLIC_REPLAY_URL) {
			setChecked(true);
			setMatchId(null);
			return;
		}
		void (async () => {
			try {
				const recordings = await loadRecordings();
				const match =
					recordings.find((id) => normalize(id).includes(raceNorm) && normalize(id).includes(sessionNorm)) ?? null;
				setMatchId(match);
			} catch {
				setMatchId(null);
			} finally {
				setChecked(true);
			}
		})();
	}, [checked, raceNorm, sessionNorm]);

	return (
		<div className="mt-1">
			{!checked ? (
				<p className="text-[11px] text-zinc-600">Checking replay...</p>
			) : matchId ? (
				<button
					className="cursor-pointer rounded border border-cyan-600 bg-cyan-900/20 px-2 py-0.5 text-[11px] text-cyan-200 hover:bg-cyan-800/30 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={busy}
					onClick={async () => {
						setBusy(true);
						setError("");
						try {
							localStorage.setItem(pendingReplayKey, matchId);
							router.push("/dashboard");
						} finally {
							setBusy(false);
						}
					}}
					type="button"
				>
					{busy ? "Opening..." : "Play replay"}
				</button>
			) : (
				<p className="text-[11px] text-zinc-500">No replay</p>
			)}
			{error && <p className="text-[10px] text-zinc-500">{error}</p>}
		</div>
	);
}
