export default function HelpPage() {
	return (
		<div className="pb-8">
			<h1 className="my-4 text-3xl">Help</h1>
			<p className="text-zinc-300">Quick guide for current dashboard behavior and controls.</p>

			<h2 className="my-4 text-2xl">Dashboard</h2>
			<ul className="ml-6 list-disc space-y-1 text-zinc-300">
				<li>Use <span className="text-white">Unlock layout</span> to move/resize widgets.</li>
				<li>Weather and Standings pages keep layout controls hidden.</li>
				<li>Leaderboard columns can be edited directly in table headers.</li>
				<li>Widget presets save layout and opened popup widgets.</li>
			</ul>

			<h2 className="my-4 text-2xl">Replay & Recording</h2>
			<ul className="ml-6 list-disc space-y-1 text-zinc-300">
				<li><span className="text-white">Not rec (manual)</span> toggles manual recording on/off.</li>
				<li><span className="text-white">Auto rec on data</span> starts recording when live data arrives.</li>
				<li>In replay mode select a recording and use Play/Pause/Stop controls.</li>
				<li>Schedule shows <span className="text-white">Play replay</span> only when a recording exists; otherwise <span className="text-white">No replay</span>.</li>
			</ul>

			<h2 className="my-4 text-2xl">Weather</h2>
			<ul className="ml-6 list-disc space-y-1 text-zinc-300">
				<li>Numerical weather values come from F1 feed data.</li>
				<li>Radar map uses Windy, centered on selected or active race location.</li>
				<li>Radar is a live external layer and is not frame-synced to replay timestamps.</li>
			</ul>

			<h2 className="my-4 text-2xl">Credits</h2>
			<p className="text-zinc-300">
				Original dev: <a className="text-blue-500" href="https://slowly.dev" target="_blank">Slowly</a>
			</p>

			<h2 className="my-4 text-2xl">Disclaimer</h2>
			<p className="text-xs leading-relaxed text-zinc-500">
				This project/website is unofficial and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE,
				FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trademarks of Formula One Licensing
				B.V.
			</p>
		</div>
	);
}
