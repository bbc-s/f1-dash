"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { env } from "@/env";

const pendingReplayKey = "f1dash-pending-replay-id-v1";

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
	const router = useRouter();

	return (
		<div className="mt-1">
			<button
				className="cursor-pointer rounded border border-cyan-600 bg-cyan-900/20 px-2 py-0.5 text-[11px] text-cyan-200 hover:bg-cyan-800/30 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={busy}
				onClick={async () => {
					if (!env.NEXT_PUBLIC_REPLAY_URL) {
						setError("Replay API unavailable");
						return;
					}
					setBusy(true);
					setError("");
					try {
						const response = await fetch(`${env.NEXT_PUBLIC_REPLAY_URL}/api/archive/recordings`, { cache: "no-store" });
						if (!response.ok) {
							setError("Cannot load recordings");
							return;
						}
						const payload = (await response.json()) as { recordings?: string[] };
						const recordings = (payload.recordings ?? []).slice().reverse();
						const raceNorm = normalize(raceName);
						const sessionNorm = normalize(sessionName);
						const match =
							recordings.find((id) => normalize(id).includes(raceNorm) && normalize(id).includes(sessionNorm)) ?? null;
						if (!match) {
							setError("No replay");
							return;
						}
						localStorage.setItem(pendingReplayKey, match);
						router.push("/dashboard");
					} finally {
						setBusy(false);
					}
				}}
				type="button"
			>
				{busy ? "Opening..." : "Play replay"}
			</button>
			{error && <p className="text-[10px] text-zinc-500">{error}</p>}
		</div>
	);
}
