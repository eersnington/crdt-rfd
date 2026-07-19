import { ArrowRightIcon, TagIcon, UserIcon } from "@phosphor-icons/react";
import type { RfdStatus, RfdSummary } from "@crdt-rfd/domain";
import { useAtom, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
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
import { useMountEffect } from "@/lib/use-mount-effect";
import { statusLabels, statusOrder } from "@/lib/rfd-presentation";
import {
  activeFilterCountAtom,
  availableAuthorsAtom,
  availableLabelsAtom,
  catalogAtom,
  catalogItemsAtom,
  searchDialogOpenAtom,
  selectedAuthorsAtom,
  selectedLabelsAtom,
  selectedStatusesAtom,
  sortDescendingAtom,
  sortedRfdsAtom,
} from "@/rpc/client";

export const statusDotClass: Record<RfdStatus, string> = {
  accepted: "bg-status-accepted",
  discussion: "bg-state-discussion",
  draft: "bg-state-draft",
  rejected: "bg-status-rejected",
  superseded: "bg-status-superseded",
};

export type Filters = {
  statuses: Set<RfdStatus>;
  authors: Set<string>;
  labels: Set<string>;
};

export type Filter =
  | { readonly kind: "statuses"; readonly value: RfdStatus }
  | { readonly kind: "authors"; readonly value: string }
  | { readonly kind: "labels"; readonly value: string };

const toggled = <A,>(values: Set<A>, value: A) => {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

export function useRfdSearch() {
  const [open, setOpen] = useAtom(searchDialogOpenAtom);
  const [statuses, setStatuses] = useAtom(selectedStatusesAtom);
  const [authorsFilter, setAuthors] = useAtom(selectedAuthorsAtom);
  const [labelsFilter, setLabels] = useAtom(selectedLabelsAtom);
  const [sortDescending, setSortDescending] = useAtom(sortDescendingAtom);
  const catalog = useAtomValue(catalogAtom);
  const catalogItems = useAtomValue(catalogItemsAtom);
  const authors = useAtomValue(availableAuthorsAtom);
  const labels = useAtomValue(availableLabelsAtom);
  const sortedResults = useAtomValue(sortedRfdsAtom);
  const activeCount = useAtomValue(activeFilterCountAtom);

  const filters = { statuses, authors: authorsFilter, labels: labelsFilter };

  const toggle = (filter: Filter) => {
    switch (filter.kind) {
      case "statuses":
        setStatuses((previous) => toggled(previous, filter.value));
        break;
      case "authors":
        setAuthors((previous) => toggled(previous, filter.value));
        break;
      case "labels":
        setLabels((previous) => toggled(previous, filter.value));
        break;
    }
  };

  const clear = () => {
    setStatuses(new Set());
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
    sortedResults,
    sortDescending,
    setSortDescending,
  };
}

export function RfdSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useAtom(searchDialogOpenAtom);
  useMountEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      setOpen((current) => !current);
    };

    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  });

  return (
    <>
      {children}
      {open ? <RfdSearchDialog /> : null}
    </>
  );
}

function RfdSearchDialog() {
  const navigate = useNavigate();
  const { open, setOpen, filters, toggle, clear, catalogItems, authors, labels } = useRfdSearch();

  const goTo = async (rfd: RfdSummary) => {
    clear();
    setOpen(false);
    await navigate({ to: "/rfd/$rfdId", params: { rfdId: rfd.rfdId } });
  };

  return (
    <>
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
                  onSelect={() => void goTo(rfd)}
                  className="gap-3"
                >
                  <span className="font-mono text-xs tabular-nums text-primary">
                    {String(rfd.number).padStart(3, "0")}
                  </span>
                  <span className="truncate text-foreground">{rfd.title}</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    <span
                      className={cn("size-1.5 rounded-full", statusDotClass[rfd.status])}
                      aria-hidden="true"
                    />
                    {statusLabels[rfd.status]}
                  </span>
                  <ArrowRightIcon className="text-muted-foreground opacity-0 group-data-selected/command-item:opacity-100" />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Filter by status">
              {statusOrder.map((status) => (
                <CommandItem
                  key={status}
                  value={`status ${statusLabels[status]}`}
                  data-checked={filters.statuses.has(status)}
                  role="menuitemcheckbox"
                  aria-checked={filters.statuses.has(status)}
                  onSelect={() => toggle({ kind: "statuses", value: status })}
                >
                  <span
                    className={cn("size-2 rounded-full", statusDotClass[status])}
                    aria-hidden="true"
                  />
                  <span>{statusLabels[status]}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Filter by author">
              {authors.map((author) => (
                <CommandItem
                  key={author}
                  value={`author ${author}`}
                  data-checked={filters.authors.has(author)}
                  role="menuitemcheckbox"
                  aria-checked={filters.authors.has(author)}
                  onSelect={() => toggle({ kind: "authors", value: author })}
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
                  role="menuitemcheckbox"
                  aria-checked={filters.labels.has(label)}
                  onSelect={() => toggle({ kind: "labels", value: label })}
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
