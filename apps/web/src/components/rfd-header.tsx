import { MagnifyingGlassIcon, TreeStructureIcon } from "@phosphor-icons/react";
import { useAtomSet } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { searchDialogOpenAtom } from "@/rpc/client";

export function RfdHeader({
  signedIn,
  signingOut,
  onSignOut,
}: {
  signedIn: boolean;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const setOpen = useAtomSet(searchDialogOpenAtom);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2.5 outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center border border-primary bg-primary text-primary-foreground transition-colors group-hover:bg-primary/80">
            <TreeStructureIcon size={18} aria-hidden="true" />
          </span>
          <span className="font-mono text-sm font-medium tracking-[0.2em] text-primary">RFD</span>
          <span className="hidden font-mono text-sm font-medium tracking-[0.2em] sm:inline">
            Archive
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            aria-label="Search RFDs"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <MagnifyingGlassIcon aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
          </Button>
          <ThemeToggle />
          {signedIn ? (
            <Button disabled={signingOut} onClick={onSignOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          ) : (
            <Button nativeButton={false} render={<Link to="/login" />}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
