import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { nextRfdStatuses, type RfdStatus } from "@crdt-rfd/domain";

import { statusDotClass } from "@/components/rfd-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { statusDescriptions, statusLabels } from "@/lib/rfd-presentation";
import { cn } from "@/lib/utils";

export function RfdStatusBadge({
  status,
  className,
}: {
  readonly status: RfdStatus;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs text-foreground",
        className,
      )}
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", statusDotClass[status])}
        aria-hidden="true"
      />
      {statusLabels[status]}
    </span>
  );
}

export function RfdStatusControl({
  status,
  canEdit,
  onChange,
  appearance = "display",
}: {
  readonly status: RfdStatus;
  readonly canEdit: boolean;
  readonly onChange?: (status: RfdStatus) => void;
  /** `editor` keeps a fixed control chrome so live loading does not swap badge ↔ button. */
  readonly appearance?: "display" | "editor";
}) {
  const next = nextRfdStatuses(status);
  const editable = canEdit && next.length > 0 && onChange !== undefined;

  if (appearance === "display" && !editable) {
    return (
      <div className="min-w-0">
        <RfdStatusBadge status={status} />
        {canEdit && next.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground text-pretty">
            {statusDescriptions[status]}
          </p>
        ) : null}
      </div>
    );
  }

  if (!editable) {
    return (
      <div className="min-w-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="h-8 gap-2 px-2.5 font-mono text-xs"
          aria-label={`Status ${statusLabels[status]}`}
        >
          <span
            className={cn("size-2 shrink-0 rounded-full", statusDotClass[status])}
            aria-hidden="true"
          />
          {statusLabels[status]}
          <CaretDownIcon aria-hidden="true" className="opacity-40" />
        </Button>
        {canEdit && next.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground text-pretty">
            {statusDescriptions[status]}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-2.5 font-mono text-xs"
            aria-label={`Change status from ${statusLabels[status]}`}
          />
        }
      >
        <span
          className={cn("size-2 shrink-0 rounded-full", statusDotClass[status])}
          aria-hidden="true"
        />
        {statusLabels[status]}
        <CaretDownIcon aria-hidden="true" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Current</DropdownMenuLabel>
          <div className="flex items-start gap-2 px-3 py-2.5" role="presentation">
            <span
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", statusDotClass[status])}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-xs text-foreground">
                {statusLabels[status]}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground text-pretty">
                {statusDescriptions[status]}
              </span>
            </span>
            <CheckIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 opacity-60" />
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {next.map((candidate) => (
            <DropdownMenuItem
              key={candidate}
              className="items-start"
              onClick={() => onChange(candidate)}
            >
              <span
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", statusDotClass[candidate])}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-xs">{statusLabels[candidate]}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground text-pretty normal-case">
                  {statusDescriptions[candidate]}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
