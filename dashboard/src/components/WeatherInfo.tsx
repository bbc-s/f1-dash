import type { ReactNode } from "react";

import TemperatureComplication from "./complications/Temperature";
import HumidityComplication from "./complications/Humidity";
import WindSpeedComplication from "./complications/WindSpeed";
import RainComplication from "./complications/Rain";

import { useDataStore } from "@/stores/useDataStore";

export default function DataWeatherInfo() {
	const weather = useDataStore((state) => state.state?.WeatherData);

	return (
		<div className="flex flex-col gap-1">
			<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
				<span>Live weather source: F1 feed (numerical)</span>
				<span>Numerical weather: F1 feed | Radar: Windy</span>
			</div>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
				{weather ? (
					<>
						<MetricCard label="Track" value={`${Math.round(parseFloat(weather.TrackTemp))}°C`}>
							<TemperatureComplication value={Math.round(parseFloat(weather.TrackTemp))} label="TRC" />
						</MetricCard>
						<MetricCard label="Air" value={`${Math.round(parseFloat(weather.AirTemp))}°C`}>
							<TemperatureComplication value={Math.round(parseFloat(weather.AirTemp))} label="AIR" />
						</MetricCard>
						<MetricCard label="Humidity" value={`${Math.round(parseFloat(weather.Humidity))}%`}>
							<HumidityComplication value={parseFloat(weather.Humidity)} />
						</MetricCard>
						<MetricCard label="Rain" value={weather.Rainfall === "1" ? "Yes" : "No"}>
							<RainComplication rain={weather.Rainfall === "1"} />
						</MetricCard>
						<MetricCard label="Wind" value={`${parseFloat(weather.WindSpeed).toFixed(1)} m/s`}>
							<WindSpeedComplication speed={parseFloat(weather.WindSpeed)} directionDeg={parseInt(weather.WindDirection)} />
						</MetricCard>
					</>
				) : (
					<>
						<Loading />
						<Loading />
						<Loading />
						<Loading />
						<Loading />
					</>
				)}
			</div>
		</div>
	);
}

function Loading() {
	return <div className="h-[62px] animate-pulse rounded-lg bg-zinc-800" />;
}

function MetricCard({ label, value, children }: { label: string; value: string; children: ReactNode }) {
	return (
		<div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1">
			<div className="shrink-0">{children}</div>
			<div className="min-w-0">
				<p className="truncate text-[11px] uppercase tracking-wide text-zinc-400">{label}</p>
				<p className="truncate text-sm font-semibold text-zinc-100">{value}</p>
			</div>
		</div>
	);
}
