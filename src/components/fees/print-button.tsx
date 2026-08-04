"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-6 w-full rounded-lg bg-[#0b3d2e] px-4 py-2 text-sm text-white print:hidden"
    >
      Print / Save PDF
    </button>
  );
}
