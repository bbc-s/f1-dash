"use client";

import WidgetBoard from "@/components/widgets/WidgetBoard";
import Footer from "@/components/Footer";

export default function DashboardPage() {
	return (
		<div className="flex w-full flex-col gap-3">
			<WidgetBoard />
			<Footer />
		</div>
	);
}
