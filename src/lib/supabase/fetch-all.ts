type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/** Page through PostgREST's 1000-row cap. `load` must use a stable `.order()`. */
export async function fetchAll<T>(
  load: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await load(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}
