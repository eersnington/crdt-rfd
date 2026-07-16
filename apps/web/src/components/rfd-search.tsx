import { ArrowRightIcon, TagIcon, UserIcon } from "@phosphor-icons/react";
import type { RfdState, RfdSummary } from "@crdt-rfd/domain";
import { useAtom, useAtomValue } from "@effect/atom-react";
import type { ReactNode } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { stateLabels, stateOrder } from "@/lib/rfd-presentation";
import {
  activeFilterCountAtom,
  availableAuthorsAtom,
  availableLabelsAtom,
  catalogAtom,
  catalogItemsAtom,
  filteredRfdsAtom,
  searchDialogOpenAtom,
  selectedAuthorsAtom,
  selectedLabelsAtom,
  selectedStatesAtom,
  sortDescendingAtom,
  sortedRfdsAtom,
} from "@/rpc/client";

export const stateDotClass: Record<RfdState, string> = {
  published: "bg-state-published",
  discussion: "bg-state-discussion",
  draft: "bg-state-draft",
  committed: "bg-state-committed",
  abandoned: "bg-state-abandoned",
};

export type Filters = {
  states: Set<string>;
  authors: Set<string>;
  labels: Set<string>;
};

export function useRfdSearch() {
  const [open, setOpen] = useAtom(searchDialogOpenAtom);
  const [states, setStates] = useAtom(selectedStatesAtom);
  const [authorsFilter, setAuthors] = useAtom(selectedAuthorsAtom);
  const [labelsFilter, setLabels] = useAtom(selectedLabelsAtom);
  const [sortDescending, setSortDescending] = useAtom(sortDescendingAtom);
  const catalog = useAtomValue(catalogAtom);
  const catalogItems = useAtomValue(catalogItemsAtom);
  const authors = useAtomValue(availableAuthorsAtom);
  const labels = useAtomValue(availableLabelsAtom);
  const results = useAtomValue(filteredRfdsAtom);
  const sortedResults = useAtomValue(sortedRfdsAtom);
  const activeCount = useAtomValue(activeFilterCountAtom);

  const filters = { states, authors: authorsFilter, labels: labelsFilter };

  const toggle = (kind: keyof Filters, value: string) => {
    const setter = kind === "states" ? setStates : kind === "authors" ? setAuthors : setLabels;
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const clear = () => {
    setStates(new Set());
    setAuthors(new Set());
    setLabels(new Set());
  };

  return {
    open,
    setOpen,
    filters,
    toggle,
    clear,
    activeCount,
    catalog,
    catalogItems,
    authors,
    labels,
    results,
    sortedResults,
    sortDescending,
    setSortDescending,
  };
}

export function RfdSearchProvider({ children }: { children: ReactNode }) {
  const { open, setOpen, filters, toggle, catalogItems, authors, labels } = useRfdSearch();

  const goTo = (rfd: RfdSummary) => {
    setOpen(false);
    history.replaceState(null, "", `#rfd-${rfd.number}`);
    requestAnimationFrame(() => {
      document
        .getElementById(`rfd-${rfd.number}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search RFDs"
        description="Search by title, number, or author, and filter the index."
        className="max-w-xl border"
      >
        <Command>
          <CommandInput placeholder="Search by title, number, or author…" />
          <CommandList>
            <CommandEmpty>No matching RFDs.</CommandEmpty>
            <CommandGroup heading="Documents">
              {catalogItems.map((rfd) => (
                <CommandItem
                  key={rfd.number}
                  value={`rfd ${rfd.number} ${rfd.title} ${rfd.author}`}
                  onSelect={() => goTo(rfd)}
                  className="gap-3"
                >
                  <span className="font-mono text-xs tabular-nums text-primary">
                    {String(rfd.number).padStart(3, "0")}
                  </span>
                  <span className="truncate text-foreground">{rfd.title}</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    <span
                      className={cn("size-1.5 rounded-full", stateDotClass[rfd.state])}
                      aria-hidden="true"
                    />
                    {stateLabels[rfd.state]}
                  </span>
                  <ArrowRightIcon className="text-muted-foreground opacity-0 group-data-selected/command-item:opacity-100" />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Filter by state">
              {stateOrder.map((state) => (
                <CommandItem
                  key={state}
                  value={`state ${stateLabels[state]}`}
                  data-checked={filters.states.has(state)}
                  onSelect={() => toggle("states", state)}
                >
                  <span
                    className={cn("size-2 rounded-full", stateDotClass[state])}
                    aria-hidden="true"
                  />
                  <span>{stateLabels[state]}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Filter by author">
              {authors.map((author) => (
                <CommandItem
                  key={author}
                  value={`author ${author}`}
                  data-checked={filters.authors.has(author)}
                  onSelect={() => toggle("authors", author)}
                >
                  <UserIcon />
                  <span>{author}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Filter by label">
              {labels.map((label) => (
                <CommandItem
                  key={label}
                  value={`label ${label}`}
                  data-checked={filters.labels.has(label)}
                  onSelect={() => toggle("labels", label)}
                >
                  <TagIcon />
                  <span>{label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
