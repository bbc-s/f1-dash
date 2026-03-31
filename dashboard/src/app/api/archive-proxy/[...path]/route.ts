import { NextRequest, NextResponse } from "next/server";

function bases() {
	const list = [
		process.env.REPLAY_URL,
		process.env.NEXT_PUBLIC_REPLAY_URL,
		"http://archive:80",
		"http://host.docker.internal:4020",
		"http://127.0.0.1:4020",
		"http://localhost:4020",
	].filter((value): value is string => Boolean(value && value.startsWith("http")));
	return Array.from(new Set(list.map((v) => v.replace(/\/+$/, ""))));
}

async function forward(req: NextRequest, path: string[]) {
	const qs = req.nextUrl.search || "";
	const suffix = path.join("/");
	let lastError: unknown = null;
	const init: RequestInit = {
		method: req.method,
		headers: { "content-type": req.headers.get("content-type") ?? "application/json" },
		cache: "no-store",
	};
	if (req.method !== "GET" && req.method !== "HEAD") {
		init.body = await req.text();
	}

	for (const base of bases()) {
		try {
			const response = await fetch(`${base}/api/${suffix}${qs}`, init);
			const text = await response.text();
			return new NextResponse(text, {
				status: response.status,
				headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
			});
		} catch (err) {
			lastError = err;
		}
	}

	return NextResponse.json({ error: String(lastError ?? "proxy request failed") }, { status: 502 });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
	const { path } = await ctx.params;
	return forward(req, path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
	const { path } = await ctx.params;
	return forward(req, path);
}
