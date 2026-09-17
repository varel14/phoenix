/**
 * Removes undefined properties (zod `.partial()` leaves `key?: undefined`
 * which Prisma's update inputs reject under exactOptionalPropertyTypes).
 * Explicit nulls are preserved — they mean "clear this field".
 */
export function pruneUndefined<T extends object>(input: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as { [K in keyof T]: Exclude<T[K], undefined> };
}
