import { NextResponse } from "next/server";

import { env } from "@/env";

export async function GET() {
	try {
		const response = await fetch(`${env.API_URL}/api/schedule/next`, { cache: "no-store" });
		if (!response.ok) {
			return NextResponse.json({ error: `Upstream failed: ${response.status}` }, { status: 502 });
		}
		const payload = await response.json();
		return NextResponse.json(payload, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Schedule next unavailable" }, { status: 500 });
	}
}
