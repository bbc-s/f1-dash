"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const pendingReplayKey = "f1dash-pending-replay-id-v1";

export default function DemoReplayQuickButton() {
	const [demoId, setDemoId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const router = useRouter();

	useEffect(() => {
		void (async () => {
			try {
				const response = await fetch("/api/archive-proxy/archive/recordings", { cache: "no-store" });
				if (!response.ok) return;
				const payload = (await response.json()) as { recordings?: string[] };
				const recordings = payload.recordings ?? [];
				const demo = recordings.filter((id) => id.startsWith("Demo Replay + Snapshot + ")).sort().pop() ?? null;
				setDemoId(demo);
			} catch {
				setDemoId(null);
			}
		})();
	}, []);

	if (!demoId) {
		return <p className="text-xs text-zinc-500">Demo replay unavailable</p>;
	}

	return (
		<button
			className="cursor-pointer rounded border border-cyan-600 bg-cyan-900/20 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-800/30 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={busy}
			onClick={() => {
				setBusy(true);
				localStorage.setItem(pendingReplayKey, demoId);
				router.push("/dashboard");
			}}
			type="button"
		>
			{busy ? "Opening..." : "Play test replay"}
		</button>
	);
}
