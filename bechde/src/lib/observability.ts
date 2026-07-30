/**
 * Error reporting, kept behind one function.
 *
 * Sentry is initialised lazily and only when a DSN is present, so a fork, a local
 * checkout or a preview deploy without the env var reports to the console and costs
 * nothing — no SDK boot, no network, no noise. That matters more than it sounds: the
 * error boundaries are the last thing standing when something has already gone wrong,
 * and a reporter that can itself throw makes a bad page worse.
 */
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

let started = false;

async function sentry() {
  if (!DSN) return null;
  const Sentry = await import("@sentry/nextjs");
  if (!started) {
    Sentry.init({
      dsn: DSN,
      // A marketplace's traffic is bursty and the budget isn't the point here —
      // errors are sampled fully, traces lightly.
      tracesSampleRate: 0.1,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
      // Chat bodies, listing notes and email addresses all pass through the client.
      // None of it belongs in an error report.
      sendDefaultPii: false,
    });
    started = true;
  }
  return Sentry;
}

/** Report a caught error. Never throws — a failing reporter must not mask the failure. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  // Always leave a local trace, DSN or not: `vercel logs` and the browser console are
  // the fallback when nothing else is wired up.
  console.error("[bechde]", context ?? "", error);

  if (!DSN) return;
  sentry()
    .then((S) => S?.captureException(error, context ? { extra: context } : undefined))
    .catch(() => {
      /* reporting is best-effort by definition */
    });
}

/** Whether errors are actually going somewhere a human will see them. */
export const errorReportingEnabled = !!DSN;
