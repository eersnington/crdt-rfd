import { ArrowRightIcon, TagIcon, UserIcon } from "@phosphor-icons/react";
import { createContext, useContext, useState, type ReactNode } from "react";

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
import { rfds, stateLabels, type Rfd, type RfdState } from "@/lib/rfd-data";

const stateOrder: RfdState[] = ["discussion", "published", "committed", "draft", "abandoned"];
const authors = Array.from(new Set(rfds.map((rfd) => rfd.author))).sort();
const labels = Array.from(new Set(rfds.flatMap((rfd) => rfd.labels))).sort();

export const stateDotClass: Record<RfdState, string> = {
  published: "bg-state-published",
  discussion: "bg-state-discussion",
  draft: "bg-state-draft",
  committed: "bg-state-committed",
  abandoned: "bg-state-abandoned",
};

type Filters = {
  states: Set<string>;
  authors: Set<string>;
  labels: Set<string>;
};

type SearchContextValue = {
  setOpen: (open: boolean) => void;
  filters: Filters;
  toggle: (kind: keyof Filters, value: string) => void;
  clear: () => void;
  activeCount: number;
  results: Rfd[];
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function useRfdSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error("useRfdSearch must be used within RfdSearchProvider");
  return context;
}

export function RfdSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState<Set<string>>(new Set());
  const [authorsFilter, setAuthors] = useState<Set<string>>(new Set());
  const [labelsFilter, setLabels] = useState<Set<string>>(new Set());

  const filters = { states, authors: authorsFilter, labels: labelsFilter };
  const activeCount = states.size + authorsFilter.size + labelsFilter.size;
  const results = [...rfds]
    .filter((rfd) => states.size === 0 || states.has(rfd.state))
    .filter((rfd) => authorsFilter.size === 0 || authorsFilter.has(rfd.author))
    .filter((rfd) => labelsFilter.size === 0 || rfd.labels.some((label) => labelsFilter.has(label)))
    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());

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

  const goTo = (rfd: Rfd) => {
    setOpen(false);
    history.replaceState(null, "", `#rfd-${rfd.number}`);
    requestAnimationFrame(() => {
      document
        .getElementById(`rfd-${rfd.number}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <SearchContext.Provider value={{ setOpen, filters, toggle, clear, activeCount, results }}>
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
              {rfds.map((rfd) => (
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
    </SearchContext.Provider>
  );
}
