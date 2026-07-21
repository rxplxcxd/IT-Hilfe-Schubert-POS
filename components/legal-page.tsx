import Link from 'next/link';

export default function LegalPage({ html }: { html: string }) {
  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link
          href="/termin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 mb-6"
        >
          <span aria-hidden>&larr;</span> Zurück
        </Link>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 px-6 py-8 sm:px-9 sm:py-10">
          <div className="legal-prose" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">IT-Hilfe Schubert &middot; Leon Schubert</p>
      </div>

      <style>{`
        .legal-prose h1 { font-size: 1.6rem; line-height: 1.25; font-weight: 800; color: #1e40af; margin: 0 0 1.25rem; }
        .legal-prose h2 { font-size: 1.15rem; font-weight: 700; color: #1e3a8a; margin: 2rem 0 0.6rem; padding-top: 0.75rem; border-top: 1px solid #eef2ff; }
        .legal-prose h3 { font-size: 1rem; font-weight: 700; color: #1f2937; margin: 1.35rem 0 0.4rem; }
        .legal-prose h4 { font-size: 0.95rem; font-weight: 600; color: #374151; margin: 1rem 0 0.3rem; }
        .legal-prose p { font-size: 0.9rem; line-height: 1.7; color: #374151; margin: 0 0 0.75rem; }
        .legal-prose a { color: #2563eb; text-decoration: underline; word-break: break-word; }
        .legal-prose h2:first-child, .legal-prose h1:first-child { margin-top: 0; padding-top: 0; border-top: none; }
      `}</style>
    </div>
  );
}
