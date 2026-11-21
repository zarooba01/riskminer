"use client";

import { useEffect, useRef } from "react";

import "reveal.js/reveal.css";
import "./pitch.css";

/**
 * Prezentacja reveal.js z jednego pliku Markdown.
 * Sterowanie: strzałki / spacja, F = pełny ekran, S = widok prelegenta, ESC = przegląd slajdów.
 */
export function Deck({ markdown }: { markdown: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let deck: { destroy: () => void } | undefined;

    (async () => {
      const [{ default: Reveal }, { default: Markdown }, { default: Notes }, { default: Highlight }] =
        await Promise.all([
          import("reveal.js"),
          import("reveal.js/plugin/markdown"),
          import("reveal.js/plugin/notes"),
          import("reveal.js/plugin/highlight"),
        ]);
      if (cancelled || !containerRef.current) return;

      const instance = new Reveal(containerRef.current, {
        plugins: [Markdown, Notes, Highlight],
        hash: true,
        slideNumber: "c/t",
        transition: "slide",
        width: 1280,
        height: 720,
        margin: 0.08,
      });
      await instance.initialize();
      if (cancelled) instance.destroy();
      else deck = instance;
    })();

    return () => {
      cancelled = true;
      deck?.destroy();
    };
  }, []);

  return (
    <div ref={containerRef} className="reveal" style={{ height: "100svh" }}>
      <div className="slides">
        <section
          data-markdown=""
          data-separator="^---$"
          data-separator-vertical="^--$"
          data-separator-notes="^Notatki:"
        >
          <textarea data-template="" defaultValue={markdown} readOnly hidden />
        </section>
      </div>
    </div>
  );
}
