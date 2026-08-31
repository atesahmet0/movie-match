/* Hallmark · component: Footer · archetype: Ft2 inline single line · theme: Studio Projection */
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-brand-border">
      <div className="mx-auto flex w-full max-w-[86rem] flex-col gap-3 px-4 py-6 text-sm text-brand-muted sm:px-6 md:flex-row md:items-center md:justify-between lg:px-12">
        <p className="m-0">
          MovieMatch finds public Letterboxd members through shared favorite films and location.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap">
          <Link href="/" className="text-brand-subtext underline-offset-4 hover:text-white hover:underline">
            Match by taste
          </Link>
          <Link href="/scout" className="text-brand-subtext underline-offset-4 hover:text-white hover:underline">
            Scout members
          </Link>
          <a
            href="https://letterboxd.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-subtext underline-offset-4 hover:text-white hover:underline"
          >
            Data from Letterboxd
          </a>
        </div>
      </div>
    </footer>
  );
}
