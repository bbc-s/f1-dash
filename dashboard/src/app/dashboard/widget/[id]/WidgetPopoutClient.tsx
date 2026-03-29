"use client";

import WidgetFrame from "@/components/widgets/WidgetFrame";
import { useWidgetLayoutSync } from "@/hooks/useWidgetLayoutSync";
import { widgetIds, type WidgetId } from "@/stores/useWidgetLayoutStore";
import { widgetRegistry } from "@/widgets/registry";

function isWidgetId(value: string): value is WidgetId {
	return (widgetIds as readonly string[]).includes(value);
}

export default function WidgetPopoutClient({ id }: { id: string }) {
	useWidgetLayoutSync();

	if (!isWidgetId(id)) {
		return <div className="p-4">Unknown widget</div>;
	}

	const Widget = widgetRegistry[id].component;

	return (
		<div className="p-2">
			<WidgetFrame
				id={id}
				title={widgetRegistry[id].title}
				showPopout={false}
				layoutLocked={true}
				fixedAtOrigin={true}
			>
				<Widget />
			</WidgetFrame>
		</div>
	);
}
