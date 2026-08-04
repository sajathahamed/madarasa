"use client";

export default function BranchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl text-[#0b3d2e]">Branch operations failed</h1>
      <p className="text-sm text-[#5a6f65]">
        {error.message || "Something went wrong loading this page."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-[#0b3d2e] px-4 py-2 text-sm text-white"
      >
        Try again
      </button>
    </main>
  );
}
