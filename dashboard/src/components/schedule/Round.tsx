"use client";

import { now, utc } from "moment";
import clsx from "clsx";

import type { Round as RoundType } from "@/types/schedule.type";

import { groupSessionByDay } from "@/lib/groupSessionByDay";
import { formatDayRange, formatMonth } from "@/lib/dateFormatter";
import Flag from "@/components/Flag";
import SessionReplayButton from "@/components/schedule/SessionReplayButton";

type Props = {
	round: RoundType;
	nextName?: string;
};

const countryCodeMap: Record<string, string> = {
	Australia: "aus",
	Austria: "aut",
	Azerbaijan: "aze",
	Bahrain: "brn",
	Belgium: "bel",
	Brazil: "bra",
	Canada: "can",
	China: "chn",
	Spain: "esp",
	France: "fra",
	"Great Britain": "gbr",
	"United Kingdom": "gbr",
	Germany: "ger",
	Hungary: "hun",
	Italy: "ita",
	Japan: "jpn",
	"Saudi Arabia": "ksa",
	Mexico: "mex",
	Monaco: "mon",
	Netherlands: "ned",
	Portugal: "por",
	Qatar: "qat",
	Singapore: "sgp",
	"United Arab Emirates": "uae",
	UAE: "uae",
	"United States": "usa",
	USA: "usa",
	"Great Britain (UK)": "gbr",
	UK: "gbr",
};

function resolveCountryCode(countryName: string, roundName: string): string | undefined {
	const direct = countryCodeMap[countryName];
	if (direct) return direct;
	const normalizedRace = roundName.toLowerCase();
	if (normalizedRace.includes("sao paulo") || normalizedRace.includes("brazil")) return "bra";
	if (normalizedRace.includes("abu dhabi")) return "uae";
	if (normalizedRace.includes("las vegas") || normalizedRace.includes("united states")) return "usa";
	return undefined;
}

export default function Round({ round, nextName }: Props) {
	const countryCode = resolveCountryCode(round.countryName, round.name);

	return (
		<div className={clsx(round.over && "opacity-50")}>
			<div className="flex items-center justify-between border-b border-zinc-800 pb-2">
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-2">
						<Flag countryCode={countryCode} className="h-8 w-11"></Flag>
						<p className="text-2xl">{round.countryName}</p>
					</div>
					{round.name === nextName && (
						<>
							{utc().isBetween(utc(round.start), utc(round.end)) ? (
								<p className="text-indigo-500">Current</p>
							) : (
								<p className="text-indigo-500">Up Next</p>
							)}
						</>
					)}
					{round.over && <p className="text-red-500">Over</p>}
				</div>

				<div className="flex gap-1">
					<p className="text-xl">{formatMonth(round.start, round.end)}</p>
					<p className="text-zinc-500">{formatDayRange(round.start, round.end)}</p>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-8 pt-2">
				{groupSessionByDay(round.sessions).map((day, i) => (
					<div className="flex flex-col" key={`round.day.${i}`}>
						<p className="my-3 text-xl text-white">{utc(day.date).local().format("dddd")}</p>

						<div className="grid grid-rows-2 gap-2">
							{day.sessions.map((session, j) => (
								<div
									key={`round.day.${i}.session.${j}`}
									className={clsx("flex flex-col", !round.over && utc(session.end).isBefore(now()) && "opacity-50")}
									>
										<p className="w-28 overflow-hidden text-ellipsis whitespace-nowrap sm:w-auto">{session.kind}</p>
										<SessionReplayButton raceName={round.name} sessionName={session.kind} />

										<p className="text-sm leading-none text-zinc-500">
											{utc(session.start).local().format("HH:mm")} - {utc(session.end).local().format("HH:mm")}
										</p>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
