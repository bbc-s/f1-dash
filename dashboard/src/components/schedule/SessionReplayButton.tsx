"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const pendingReplayKey = "f1dash-pending-replay-id-v1";
type ReplayRecording = { id: string; label: string };
type ReplayRecordingResponse = string | ReplayRecording;
let recordingsCache: ReplayRecording[] | null = null;
let recordingsPromise: Promise<ReplayRecording[]> | null = null;

async function loadRecordings(): Promise<ReplayRecording[]> {
	if (recordingsCache) return recordingsCache;
	if (!recordingsPromise) {
		recordingsPromise = (async () => {
			const response = await fetch("/api/archive-proxy/archive/recordings", { cache: "no-store" });
			if (!response.ok) return [];
			const payload = (await response.json()) as { recordings?: ReplayRecordingResponse[] };
			recordingsCache = (payload.recordings ?? [])
				.map((recording) => (typeof recording === "string" ? { id: recording, label: recording } : recording))
				.slice()
				.reverse();
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

function parseRecordingLabel(label: string) {
	const [race = "", session = ""] = label.split(" + ");
	return { race: normalize(race), session: normalize(session) };
}

function sessionsMatch(recordingSession: string, scheduleSession: string): boolean {
	if (scheduleSession === "sprint") return recordingSession === "sprint";
	if (scheduleSession === "sprint qualifying") return recordingSession === "sprint qualifying" || /^sprint qualifying sq[123]$/.test(recordingSession);
	if (scheduleSession === "qualifying") return recordingSession === "qualifying" || /^qualifying q[123]$/.test(recordingSession);
	return recordingSession === scheduleSession;
}

export default function SessionReplayButton({ raceName, sessionName, sessionEnd }: { raceName: string; sessionName: string; sessionEnd: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [matchId, setMatchId] = useState<string | null>(null);
	const [checked, setChecked] = useState(false);
	const router = useRouter();
	const raceNorm = useMemo(() => normalize(raceName), [raceName]);
	const sessionNorm = useMemo(() => normalize(sessionName), [sessionName]);
	const sessionFinished = useMemo(() => Date.now() >= Date.parse(sessionEnd), [sessionEnd]);

	useEffect(() => {
		if (checked) return;
		if (!sessionFinished) {
			setChecked(true);
			setMatchId(null);
			return;
		}
		void (async () => {
			try {
				const recordings = await loadRecordings();
				const match = recordings.find((recording) => {
					const parsed = parseRecordingLabel(recording.label);
					return parsed.race === raceNorm && sessionsMatch(parsed.session, sessionNorm);
				}) ?? null;
				setMatchId(match?.id ?? null);
			} catch {
				setMatchId(null);
			} finally {
				setChecked(true);
			}
		})();
	}, [checked, raceNorm, sessionFinished, sessionNorm]);

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
