import { ArrowsDownUpIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { stateDotClass, useRfdSearch } from "@/components/rfd-search";
import { cn } from "@/lib/utils";
import { stateLabels, type RfdState } from "@/lib/rfd-data";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const filterKindLabel = { states: "State", authors: "Author", labels: "Label" } as const;

export function RfdExplorer() {
  const { setOpen, filters, toggle, clear, activeCount, results } = useRfdSearch();
  const [sortDescending, setSortDescending] = useState(true);
  const sorted = sortDescending ? results : [...results].reverse();
  const chips = [
    ...Array.from(filters.states).map((value) => ({
      kind: "states" as const,
      value,
      label: stateLabels[value as RfdState],
    })),
    ...Array.from(filters.authors).map((value) => ({
      kind: "authors" as const,
      value,
      label: value,
    })),
    ...Array.from(filters.labels).map((value) => ({
      kind: "labels" as const,
      value,
      label: `#${value}`,
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <section className="pt-16 pb-10 sm:pt-24 sm:pb-14">
        <h1 className="text-balance font-heading text-4xl leading-[0.95] tracking-tight sm:text-5xl">
          Requests for <span className="text-primary italic">Discussion</span>
        </h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-8 flex w-full items-center gap-3 rounded-lg border bg-secondary/30 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
        >
          <MagnifyingGlassIcon size={16} className="text-muted-foreground" aria-hidden="true" />
          <span className="flex-1 text-sm text-muted-foreground">
            Search by title, number, or author…
          </span>
        </button>
      </section>

      <section className="pb-24">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            <span className="text-foreground tabular-nums">
              {String(sorted.length).padStart(2, "0")}
            </span>
            <span>{sorted.length === 1 ? "result" : "results"}</span>
          </div>
          <button
            type="button"
            onClick={() => setSortDescending((current) => !current)}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
          >
            <ArrowsDownUpIcon size={14} aria-hidden="true" />
            {sortDescending ? "All Time" : "Popular (24hrs)"}
          </button>
        </div>

        {activeCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-4">
            {chips.map((chip) => (
              <button
                key={`${chip.kind}:${chip.value}`}
                type="button"
                onClick={() => toggle(chip.kind, chip.value)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-1 pr-2 pl-3 font-mono text-xs text-primary"
              >
                <span className="text-primary/60">{filterKindLabel[chip.kind]}</span>
                {chip.label}
                <XIcon size={12} />
              </button>
            ))}
            <button
              type="button"
              onClick={clear}
              className="ml-1 font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        ) : null}

        <ul className="flex flex-col">
          {sorted.map((rfd) => (
            <li key={rfd.number} id={`rfd-${rfd.number}`} className="scroll-mt-24">
              <a
                href={`#rfd-${rfd.number}`}
                className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 border-b py-5 hover:bg-secondary/10"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-xs tabular-nums text-primary">
                      RFD {rfd.number}
                    </span>
                    <h2 className="text-pretty font-heading text-xl leading-tight transition-colors group-hover:text-primary">
                      {rfd.title}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn("size-2 rounded-full", stateDotClass[rfd.state])}
                        aria-hidden="true"
                      />
                      {stateLabels[rfd.state]}
                    </span>
                    <span>{rfd.author}</span>
                    {rfd.labels.map((label) => (
                      <span key={label} className="text-muted-foreground/70">
                        #{label}
                      </span>
                    ))}
                  </div>
                </div>
                <time className="font-mono text-xs tabular-nums text-muted-foreground sm:text-right">
                  {dateFormat.format(new Date(rfd.updated))}
                </time>
              </a>
            </li>
          ))}
        </ul>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="font-heading text-2xl">Nothing in the record.</p>
            <p className="text-sm text-muted-foreground">No RFDs match your current filters.</p>
            <button
              type="button"
              onClick={clear}
              className="mt-2 font-mono text-xs tracking-[0.18em] text-primary uppercase"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
