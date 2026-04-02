"use client";

import { useEffect, useMemo, useState } from "react";

import SegmentedControls from "@/components/ui/SegmentedControls";
import Button from "@/components/ui/Button";
import Slider from "@/components/ui/Slider";
import Input from "@/components/ui/Input";
import FavoriteDrivers from "@/components/settings/FavoriteDrivers";
import DelayInput from "@/components/DelayInput";
import DelayTimer from "@/components/DelayTimer";
import Toggle from "@/components/ui/Toggle";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { env } from "@/env";

export default function SettingsPage() {
	const settings = useSettingsStore();
	const [autoRecordOnData, setAutoRecordOnData] = useState(false);
	const [archiveToggleMsg, setArchiveToggleMsg] = useState("");
	const [archiveBusy, setArchiveBusy] = useState(false);

	useEffect(() => {
		void (async () => {
			try {
				const response = await fetch("/api/archive-proxy/archive/status", { cache: "no-store" });
				if (!response.ok) throw new Error(String(response.status));
				const payload = (await response.json()) as { autoRecordOnData?: boolean };
				setAutoRecordOnData(Boolean(payload.autoRecordOnData));
			} catch {
				setArchiveToggleMsg("Archive API unavailable");
			}
		})();
	}, []);

	const defaultAuto = useMemo(() => (env.NEXT_PUBLIC_ARCHIVE_AUTO_RECORD === "true" ? "On" : "Off"), []);

	return (
		<div>
			<h1 className="mb-4 text-3xl">Settings</h1>

			<h2 className="my-4 text-2xl">Visual</h2>
			<div className="flex gap-2"><Toggle enabled={settings.carMetrics} setEnabled={(v) => settings.setCarMetrics(v)} /><p className="text-zinc-500">Legacy car metrics toggle (kept for backward compatibility)</p></div>
			<div className="flex gap-2"><Toggle enabled={settings.showCornerNumbers} setEnabled={(v) => settings.setShowCornerNumbers(v)} /><p className="text-zinc-500">Show Corner Numbers on Track Map</p></div>
			<div className="flex gap-2"><Toggle enabled={settings.tableHeaders} setEnabled={(v) => settings.setTableHeaders(v)} /><p className="text-zinc-500">Show Driver Table Header</p></div>
			<div className="flex gap-2"><Toggle enabled={settings.showBestSectors} setEnabled={(v) => settings.setShowBestSectors(v)} /><p className="text-zinc-500">Show Drivers Best Sectors</p></div>
			<div className="flex gap-2"><Toggle enabled={settings.showMiniSectors} setEnabled={(v) => settings.setShowMiniSectors(v)} /><p className="text-zinc-500">Show Drivers Mini Sectors</p></div>
			<div className="flex gap-2"><Toggle enabled={settings.oledMode} setEnabled={(v) => settings.setOledMode(v)} /><p className="text-zinc-500">OLED Mode (Pure Black Background)</p></div>
			<div className="flex gap-2"><Toggle enabled={settings.useSafetyCarColors} setEnabled={(v) => settings.setUseSafetyCarColors(v)} /><p className="text-zinc-500">Use Safety Car Colors</p></div>
			<div className="flex gap-2"><Toggle enabled={settings.widgetHeadersOnHover} setEnabled={(v) => settings.setWidgetHeadersOnHover(v)} /><p className="text-zinc-500">Widget headers only on hover (overlay, no layout shift)</p></div>
			<div className="flex gap-2"><Toggle enabled={settings.telemetryTransparent} setEnabled={(v) => settings.setTelemetryTransparent(v)} /><p className="text-zinc-500">Telemetry Large transparent background (overlay on video feed)</p></div>

			<h2 className="my-4 text-2xl">Race Control</h2>
			<div className="flex gap-2"><Toggle enabled={settings.raceControlChime} setEnabled={(v) => settings.setRaceControlChime(v)} /><p className="text-zinc-500">Play Chime on new Race Control Message</p></div>
			<div className="flex gap-2"><Toggle enabled={settings.showBlueFlagsInRaceControl} setEnabled={(v) => settings.setShowBlueFlagsInRaceControl(v)} /><p className="text-zinc-500">Show blue flags in Race Control list</p></div>

			{settings.raceControlChime && (
				<div className="flex flex-row items-center gap-2">
					<Input value={String(settings.raceControlChimeVolume)} setValue={(v) => { const numericValue = Number(v); if (!isNaN(numericValue)) settings.setRaceControlChimeVolume(numericValue); }} />
					<Slider className="!w-52" value={settings.raceControlChimeVolume} setValue={(v) => settings.setRaceControlChimeVolume(v)} />
					<p className="text-zinc-500">Race Control Chime Volume</p>
				</div>
			)}

			<h2 className="my-4 text-2xl">Favorite Drivers</h2>
			<p className="mb-4">Select your favorite drivers to highlight them on the dashboard.</p>
			<FavoriteDrivers />

			<h2 className="my-4 text-2xl">Speed Metric</h2>
			<p className="mb-4">Choose the unit in which you want to display speeds.</p>
			<SegmentedControls id="speed-unit" selected={settings.speedUnit} onSelect={settings.setSpeedUnit} options={[{ label: "km/h", value: "metric" }, { label: "mp/h", value: "imperial" }]} />

			<h2 className="my-4 text-2xl">Delay</h2>
			<p className="mb-4">Set delay in seconds. Dashboard has the same quick input in the top bar.</p>
			<div className="flex items-center gap-2"><DelayTimer /><DelayInput /><p className="text-zinc-500">Delay in seconds</p></div>
			<Button className="mt-2 bg-red-500!" onClick={() => settings.setDelay(0)}>Reset delay</Button>

			<h2 className="my-4 text-2xl">Replay Archive</h2>
			<div className="text-sm text-zinc-500"><p>Default auto record: {defaultAuto}</p></div>
			<div className="mt-2 flex items-center gap-2">
				<Toggle
					enabled={autoRecordOnData}
					setEnabled={(next) => {
						if (archiveBusy) return;
						setArchiveBusy(true);
						setArchiveToggleMsg("");
						void (async () => {
							try {
								const response = await fetch("/api/archive-proxy/archive/auto", {
									method: "POST",
									headers: { "content-type": "application/json" },
									body: JSON.stringify({ enabled: next }),
								});
								if (!response.ok) throw new Error(String(response.status));
								setAutoRecordOnData(next);
								setArchiveToggleMsg(`Auto rec on data: ${next ? "On" : "Off"}`);
							} catch {
								setArchiveToggleMsg("Toggle failed (request error)");
							} finally {
								setArchiveBusy(false);
							}
						})();
					}}
				/>
				<p className="text-zinc-500">Auto rec on data: {autoRecordOnData ? "On" : "Off"}</p>
				{archiveToggleMsg && <span className="text-xs text-zinc-400">{archiveToggleMsg}</span>}
			</div>

			<h2 className="my-4 text-2xl">No Spoiler</h2>
			<div className="flex gap-2">
				<Toggle enabled={settings.noSpoiler} setEnabled={(v) => settings.setNoSpoiler(v)} />
				<p className="text-zinc-500">Always hide live data until you confirm on each dashboard page entry (Settings and Weather excluded).</p>
			</div>
		</div>
	);
}
