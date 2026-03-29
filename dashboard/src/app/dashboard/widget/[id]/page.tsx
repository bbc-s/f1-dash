import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function LegacyWidgetPopoutPage({ params }: Props) {
	const { id } = await params;
	redirect(`/widget/${id}`);
}
