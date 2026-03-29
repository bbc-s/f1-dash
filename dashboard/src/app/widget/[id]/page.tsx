import WidgetPopoutClient from "@/app/dashboard/widget/[id]/WidgetPopoutClient";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function WidgetPopoutPage({ params }: Props) {
	const { id } = await params;
	return <WidgetPopoutClient id={id} />;
}
