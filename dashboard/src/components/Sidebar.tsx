"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import Link from "next/link";
import clsx from "clsx";

import { useSidebarStore } from "@/stores/useSidebarStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useWidgetLayoutStore } from "@/stores/useWidgetLayoutStore";

import ConnectionStatus from "@/components/ConnectionStatus";
import DelayInput from "@/components/DelayInput";
import SidenavButton from "@/components/SidenavButton";
import DelayTimer from "@/components/DelayTimer";

const liveTimingItems = [
	{ href: "/dashboard", name: "Dashboard" },
	{ href: "/dashboard/standings", name: "Standings" },
	{ href: "/dashboard/weather", name: "Weather" },
];

type Props = { connected: boolean };

function LockIcon({ locked }: { locked: boolean }) {
	if (locked) {
		return (
			<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<rect x="4" y="11" width="16" height="9" rx="2" />
				<path d="M8 11V8a4 4 0 1 1 8 0v3" />
			</svg>
		);
	}
	return (
		<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<rect x="4" y="11" width="16" height="9" rx="2" />
			<path d="M8 11V8a4 4 0 0 1 7.2-2.4" />
			<path d="M16 4l4 4" />
			<path d="M20 4l-4 4" />
		</svg>
	);
}

export default function Sidebar({ connected }: Props) {
	const pathname = usePathname();
	const { opened, pinned } = useSidebarStore();
	const close = useSidebarStore((state) => state.close);
	const open = useSidebarStore((state) => state.open);
	const pin = useSidebarStore((state) => state.pin);
	const unpin = useSidebarStore((state) => state.unpin);
	const oledMode = useSettingsStore((state) => state.oledMode);
	const layoutLocked = useWidgetLayoutStore((state) => state.layoutLocked);
	const setLayoutLocked = useWidgetLayoutStore((state) => state.setLayoutLocked);
	const showLayoutLock = pathname === "/dashboard";

	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth < 768) unpin();
		};
		window.addEventListener("resize", handleResize);
		handleResize();
		return () => window.removeEventListener("resize", handleResize, false);
	}, [unpin]);

	return (
		<div>
			<motion.div className="hidden md:block" style={{ width: 216 }} animate={{ width: pinned ? 216 : 8 }} />
			<AnimatePresence>
				{opened && (
					<motion.div onTouchEnd={() => close()} className="fixed top-0 right-0 bottom-0 left-0 z-30 bg-black/20 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
				)}
			</AnimatePresence>
			<motion.div className="no-scrollbar fixed top-0 bottom-0 left-0 z-40 flex overflow-y-auto" onHoverEnd={!pinned ? () => close() : undefined} onHoverStart={!pinned ? () => open() : undefined} animate={{ left: pinned || opened ? 0 : -216 }} transition={{ type: "spring", bounce: 0.1 }}>
				<nav className={clsx("m-2 flex w-52 flex-col p-2", { "rounded-lg border border-zinc-800": !pinned, "bg-black": oledMode, "bg-zinc-950": !oledMode })}>
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<DelayInput saveDelay={500} />
							<DelayTimer />
							<ConnectionStatus connected={connected} />
						</div>
						<div className="hidden flex-col items-center gap-1 md:flex">
							<SidenavButton onClick={() => (pinned ? unpin() : pin())} />
							{showLayoutLock && (
								<button className="flex h-7 w-7 items-center justify-center rounded border border-zinc-700 text-zinc-200 hover:border-cyan-500" onClick={() => setLayoutLocked(!layoutLocked)} title={layoutLocked ? "Unlock layout" : "Lock layout"} type="button">
									<LockIcon locked={layoutLocked} />
								</button>
							)}
						</div>
						<SidenavButton className="md:hidden" onClick={() => close()} />
					</div>

					<p className="p-2 text-sm text-zinc-500">Live Timing</p>
					<div className="flex flex-col gap-1">{liveTimingItems.map((item) => <Item key={item.href} item={item} />)}</div>

					<p className="mt-4 p-2 text-sm text-zinc-500">General</p>
					<div className="flex flex-col gap-1">
						<Item item={{ href: "/dashboard/settings", name: "Settings" }} />
						<Item item={{ href: "/schedule", name: "Schedule/Replay" }} />
						<Item item={{ href: "/help", name: "Help" }} />
						<Item item={{ href: "/", name: "Home" }} />
					</div>

					<div className="mt-auto p-2 pt-4 text-xs text-zinc-500">
						Original dev: <a className="text-blue-500" href="https://slowly.dev" target="_blank">Slowly</a>
						<div className="mt-2">Source: <a className="text-blue-500" href="https://github.com/bbc-s/f1-dash" target="_blank">GitHub</a></div>
						<div>Version: {process.env.NEXT_PUBLIC_APP_VERSION ?? "4.0.17"}</div>
					</div>
				</nav>
			</motion.div>
		</div>
	);
}

type ItemProps = { target?: string; item: { href: string; name: string } };

const Item = ({ target, item }: ItemProps) => {
	const active = usePathname() === item.href;
	return (
		<Link href={item.href} target={target}>
			<div className={clsx("rounded-lg p-1 px-2 hover:bg-zinc-900", { "bg-zinc-800!": active })}>{item.name}</div>
		</Link>
	);
};
