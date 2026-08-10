export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td className="px-3 py-6 text-[#5a6f65]" colSpan={colSpan}>
        {children}
      </td>
    </tr>
  );
}

export function PanelTable({
  title,
  description,
  headers,
  children,
  id,
}: {
  title: string;
  description?: string;
  headers: string[];
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mt-6 scroll-mt-24 sm:mt-8">
      <div className="mb-3">
        <h2
          className="text-lg text-[#0b3d2e] sm:text-xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-[#5a6f65]">{description}</p>
        ) : null}
        <p className="mt-1 text-xs text-[#5a6f65] md:hidden">
          Swipe sideways to see all columns
        </p>
      </div>
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0">
        <div className="min-w-0 overflow-hidden rounded-lg border border-[#0b3d2e]/10 bg-white/70">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-[#0b3d2e]/5">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-3 py-2.5 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
