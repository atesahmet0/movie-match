export default function Footer() {
  return (
    <footer className="border-t border-brand-border bg-brand-darker py-6 mt-12 text-xs text-brand-muted">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>MovieMatch &bull; Letterboxd Taste Scout</div>
        <div className="font-mono text-[11px]">Letterboxd is a registered trademark of Letterboxd Limited.</div>
      </div>
    </footer>
  );
}
