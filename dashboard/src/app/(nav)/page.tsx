import Image from "next/image";
import Link from "next/link";

import Button from "@/components/ui/Button";
import ScrollHint from "@/components/ScrollHint";

import icon from "public/tag-logo.svg";

export default function Home() {
	return (
		<div className="pb-10">
			<section className="flex min-h-[78vh] w-full flex-col items-center justify-center pt-8 sm:pt-0">
				<Image src={icon} alt="f1-dash tag logo" width={200} />

				<h1 className="my-14 text-center text-5xl font-bold">
					Real-time Formula 1 <br />
					telemetry and timing
				</h1>

				<div className="flex flex-wrap items-center justify-center gap-4">
					<Link href="/dashboard">
						<Button className="rounded-xl! border-2 border-transparent p-4 font-medium">Go to Dashboard</Button>
					</Link>

					<Link href="/schedule">
						<Button className="rounded-xl! border-2 border-zinc-700 bg-transparent! p-4 font-medium">
							Check Schedule + Replay
						</Button>
					</Link>
				</div>

				<ScrollHint />
			</section>
		</div>
	);
}
