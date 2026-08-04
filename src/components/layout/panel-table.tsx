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
    <section id={id} className="mt-8">
      <div className="mb-3">
        <h2
          className="text-xl text-[#0b3d2e]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-[#5a6f65]">{description}</p>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#0b3d2e]/10 bg-white/70">
        <table className="w-full text-sm">
          <thead className="bg-[#0b3d2e]/5 text-left">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
