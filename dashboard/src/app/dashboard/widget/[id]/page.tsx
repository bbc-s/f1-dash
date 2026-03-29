"use client";

import WidgetFrame from "@/components/widgets/WidgetFrame";
import { useWidgetLayoutSync } from "@/hooks/useWidgetLayoutSync";
import { widgetIds, type WidgetId } from "@/stores/useWidgetLayoutStore";
import { widgetRegistry } from "@/widgets/registry";

type Props = {
	params: { id: string };
};

function isWidgetId(value: string): value is WidgetId {
	return (widgetIds as readonly string[]).includes(value);
}

export default function WidgetPopoutPage({ params }: Props) {
	useWidgetLayoutSync();

	if (!isWidgetId(params.id)) {
		return <div className="p-4">Unknown widget</div>;
	}

	const Widget = widgetRegistry[params.id].component;

	return (
		<div className="p-2">
			<WidgetFrame id={params.id} title={widgetRegistry[params.id].title} showPopout={false}>
				<Widget />
			</WidgetFrame>
		</div>
	);
}
