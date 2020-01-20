export function isNonNullable<TValue>(
  value: TValue
): value is NonNullable<TValue> {
  return value !== undefined && value !== null;
}
