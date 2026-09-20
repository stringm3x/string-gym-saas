/**
 * Mock genérico de una cadena de Supabase (`.from(...).select().eq()...`).
 * Cualquier método encadenado (`select`, `eq`, `gt`, `order`, `limit`,
 * `single`, `maybeSingle`, `upsert`...) devuelve la misma cadena; `await`
 * sobre ella resuelve al resultado dado, porque la cadena implementa
 * `.then()` (igual que el builder real de Supabase-js, que también es
 * "thenable" sin necesitar `.single()`/`.maybeSingle()` al final).
 *
 * Uso típico: `vi.mocked(createClient).mockResolvedValue({ from } as never)`
 * con `from = vi.fn().mockReturnValueOnce(supaResult({ data, error }))...`
 * en el mismo orden en que el código bajo prueba llama a `.from(...)`.
 */
export function supaResult<T>(result: T): T {
  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (
            resolve: (v: T) => unknown,
            reject?: (e: unknown) => unknown
          ) => Promise.resolve(result).then(resolve, reject);
        }
        if (prop === "catch" || prop === "finally") {
          return (...args: unknown[]) =>
            (Promise.resolve(result) as unknown as Record<string, (...a: unknown[]) => unknown>)[
              prop as string
            ](...args);
        }
        // Cualquier otro método encadenado (select, eq, gt, lt, order,
        // limit, single, maybeSingle, upsert, in, not...) devuelve la
        // misma cadena para seguir encadenando.
        return () => chain;
      },
    }
  ) as T;
  return chain;
}
