import clsx from "clsx";

import type { TimingDataDriver } from "@/types/state.type";

type Props = {
	last: TimingDataDriver["LastLapTime"] | undefined;
	best: TimingDataDriver["BestLapTime"] | undefined;
	hasFastest: boolean;
};

export default function DriverLapTime({ last, best, hasFastest }: Props) {
	const lastValue = last?.Value ?? "";
	const bestValue = best?.Value ?? "";
	return (
		<div className="place-self-start">
			<p
				className={clsx("text-lg leading-none font-medium tabular-nums", {
					"text-violet-600!": Boolean(last?.OverallFastest),
					"text-emerald-500!": Boolean(last?.PersonalFastest),
					"text-zinc-500!": !lastValue,
				})}
			>
				{!!lastValue ? lastValue : "-- -- ---"}
			</p>
			<p
				className={clsx("text-sm leading-none text-zinc-500 tabular-nums", {
					"text-violet-600!": hasFastest,
					"text-zinc-500!": !bestValue,
				})}
			>
				{!!bestValue ? bestValue : "-- -- ---"}
			</p>
		</div>
	);
}
