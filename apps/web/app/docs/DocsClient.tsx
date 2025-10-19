'use client';

import { useMemo, useState } from 'react';
import type { SectionConfig } from './DocsSections';
import { sections } from './DocsSections';

export default function DocsClient() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSection: SectionConfig = useMemo(() => sections[activeIndex], [activeIndex]);

  const goTo = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= sections.length) return;
    setActiveIndex(newIndex);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-neutral-light/70 backdrop-blur">
            <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-light/60">Documentation</span>
            {sections.map((section, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={section.id}
                  onClick={() => goTo(index)}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-left transition-colors duration-150 ${
                    isActive ? 'bg-white/12 text-neutral-light' : 'hover:bg-white/10 hover:text-neutral-light'
                  }`}
                >
                  <span aria-hidden>{section.icon}</span>
                  <span>{section.title}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-12">
          <header className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#60efff]">Universwap Docs</p>
            <h1 className="text-3xl font-semibold text-neutral-light sm:text-4xl">Product Manual & Developer Guide</h1>
            <p className="text-neutral-light/80">
              Learn how every module of Universwap fits together—from swaps and token factory operations to launchpad workflows,
              governance, treasury management and security best practices. Use the navigation to jump between sections.
            </p>
          </header>

          <article className="space-y-6 rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur">
            <header className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>{activeSection.icon}</span>
              <h2 className="text-2xl font-semibold text-neutral-light">{activeSection.title}</h2>
            </header>

            {activeSection.paragraphs.map((paragraph, index) => (
              <p key={index} className="text-neutral-light/80">
                {paragraph}
              </p>
            ))}

            {activeSection.bulletGroups?.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-2">
                {group.title && <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-light/70">{group.title}</h3>}
                <ul className="grid gap-2 text-neutral-light/80">
                  {group.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="relative pl-5">
                      <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-[#60efff]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </article>

          <footer className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur">
            <button
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-neutral-light/80 transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden>←</span>
              <span>Previous</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-neutral-light/60">
              <span>Section {activeIndex + 1} of {sections.length}</span>
            </div>
            <button
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === sections.length - 1}
              className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-neutral-light/80 transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Next</span>
              <span aria-hidden>→</span>
            </button>
          </footer>
        </div>
      </div>
    </main>
  );
}
