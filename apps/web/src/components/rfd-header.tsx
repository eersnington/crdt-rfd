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
        <Link to="/" className="flex items-center gap-2.5">
          <TreeStructureIcon size={22} />
          <span className="font-mono text-sm font-medium tracking-[0.2em] text-primary">RFD</span>
          <span className="hidden font-mono text-sm font-medium tracking-[0.2em] sm:inline">
            Archive
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Search RFDs"
            variant={"outline"}
            className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <MagnifyingGlassIcon size={16} aria-hidden="true" />
            <span className="hidden text-xs sm:inline">Search</span>
          </Button>
          <ThemeToggle />
          {signedIn ? (
            <Button
              className="px-2 text-xs sm:px-4 sm:text-sm"
              disabled={signingOut}
              onClick={onSignOut}
            >
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
