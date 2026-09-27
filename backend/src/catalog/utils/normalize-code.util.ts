export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}