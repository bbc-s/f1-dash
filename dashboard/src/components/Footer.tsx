import Link from "next/link";

export default function Footer() {
	return (
		<footer className="my-2 border-t border-zinc-900 pt-1 text-[11px] text-zinc-500">
			<div className="mb-1 flex flex-wrap gap-x-3 gap-y-1">
				<p>
					Source: <TextLink website="https://github.com/bbc-s/f1-dash">GitHub</TextLink>
				</p>
				<p>
					<Link className="text-blue-500" href="/help">
						Help
					</Link>
				</p>
				<p>Version: {process.env.version}</p>
			</div>
			<p className="leading-tight opacity-80">
				Unofficial project, not associated with Formula 1 companies. Formula 1 related marks are trademarks of Formula One
				Licensing B.V.
			</p>
		</footer>
	);
}

type TextLinkProps = {
	website: string;
	children: string;
};

const TextLink = ({ website, children }: TextLinkProps) => {
	return (
		<a className="text-blue-500" target="_blank" href={website}>
			{children}
		</a>
	);
};