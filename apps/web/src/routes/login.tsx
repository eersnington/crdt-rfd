import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in | CRDT RFD" }] }),
});

function LoginPage() {
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");

  const signIn = async () => {
    setStatus("pending");
    const result = await authClient.signIn.social({
      provider: "github",
      callbackURL: "/",
    });

    if (result.error) setStatus("error");
  };

  return (
    <main className="grid min-h-svh bg-muted/30 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.72fr)]">
      <section className="relative hidden overflow-hidden border-r bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
        <div className="font-heading text-xs tracking-[0.18em] uppercase">CRDT / RFD</div>
        <div className="max-w-xl">
          <p className="mb-5 text-balance font-heading text-xs tracking-[0.16em] text-background/55 uppercase">
            Collaborative decisions, kept in history
          </p>
          <h1 className="text-5xl leading-[1.04] font-medium tracking-[-0.04em]">
            Write proposals.
            <br />
            Review changes.
            <br />
            Keep the record.
          </h1>
        </div>
        <p className="max-w-sm text-balance text-sm leading-6 text-background/55">
          A shared workspace for proposals that need more than a comment thread.
        </p>
      </section>

      <section className="flex min-h-svh items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-16 inline-block font-heading text-xs tracking-[0.18em] uppercase lg:hidden"
          >
            CRDT / RFD
          </Link>

          <div className="border bg-background p-7 shadow-[6px_6px_0_0_var(--border)] sm:p-9">
            <div className="mb-8">
              <p className="mb-3 text-balance font-heading text-xs tracking-[0.14em] text-muted-foreground uppercase">
                Workspace access
              </p>
              <h2 className="text-2xl font-medium tracking-[-0.025em]">Continue to your RFDs</h2>
              <p className="mt-2 text-balance text-sm leading-6 text-muted-foreground">
                Sign in with the GitHub account connected to this workspace.
              </p>
            </div>

            <Button
              className="h-11 w-full gap-2.5 text-sm"
              disabled={status === "pending"}
              onClick={signIn}
            >
              <GitHubLogo />
              {status === "pending" ? "Connecting to GitHub..." : "Continue with GitHub"}
            </Button>

            {status === "error" ? (
              <p role="alert" className="mt-4 text-balance text-sm text-destructive">
                GitHub sign-in could not be started. Please try again.
              </p>
            ) : null}

            <p className="mt-6 border-t pt-5 text-balance text-xs leading-5 text-muted-foreground">
              GitHub is used only to verify your identity. Repository access is not requested.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function GitHubLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-icon="inline-start" fill="currentColor">
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.3-5.28-1.29-5.28-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.39-5.29 5.68.42.36.78 1.06.78 2.14v3.18c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}
