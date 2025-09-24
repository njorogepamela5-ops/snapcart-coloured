// Temporary helper to bypass "any" type errors
// Usage: wrap values that TypeScript complains about

export function suppressAny<T>(value: any): T {
  return value as T;
}
