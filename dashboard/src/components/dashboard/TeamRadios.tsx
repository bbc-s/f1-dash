import { AnimatePresence } from "motion/react";
import clsx from "clsx";

import { useDataStore } from "@/stores/useDataStore";

import { sortUtc } from "@/lib/sorting";

import RadioMessage from "@/components/dashboard/RadioMessage";

export default function TeamRadios() {
	const drivers = useDataStore((state) => state.state?.DriverList);
	const teamRadios = useDataStore((state) => state.state?.TeamRadio);
	const sessionPath = useDataStore((state) => state.state?.SessionInfo?.Path);
	const sessionLoaded = useDataStore((state) => Boolean(state.state?.SessionInfo));

	const gmtOffset = useDataStore((state) => state.state?.SessionInfo?.GmtOffset);

	const basePath = `https://livetiming.formula1.com/static/${sessionPath}`;
	const captures = teamRadios?.Captures ?? [];

	// TODO add notice that we only show 20

	return (
		<ul className="flex flex-col gap-2">
			{!sessionLoaded && new Array(6).fill("").map((_, index) => <SkeletonMessage key={`radio.loading.${index}`} />)}

			{sessionLoaded && captures.length === 0 && <li className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-sm text-zinc-400">No team radios available for this session/feed yet.</li>}

			{captures.length > 0 && gmtOffset && drivers && (
				<AnimatePresence>
					{captures
						.slice()
						.sort(sortUtc)
							.slice(0, 20)
							.map((teamRadio, i) => (
								<RadioMessage
									key={`radio.${i}`}
									driver={drivers[teamRadio.RacingNumber]}
									capture={teamRadio}
									basePath={basePath}
									gmtOffset={gmtOffset}
								/>
							))}
				</AnimatePresence>
			)}
		</ul>
	);
}

const SkeletonMessage = () => {
	const animateClass = "h-6 animate-pulse rounded-md bg-zinc-800";

	return (
		<li className="flex flex-col gap-1 p-2">
			<div className={clsx(animateClass, "h-4! w-16")} />

			<div
				className="grid place-items-center items-center gap-4"
				style={{
					gridTemplateColumns: "2rem 20rem",
				}}
			>
				<div className="place-self-start">
					<div className={clsx(animateClass, "h-8! w-14")} />
				</div>

				<div className="flex items-center gap-4">
					<div className={clsx(animateClass, "h-6 w-6")} />
					<div className={clsx(animateClass, "h-2! w-60")} />
				</div>
			</div>
		</li>
	);
};
