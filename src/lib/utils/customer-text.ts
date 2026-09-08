/** Keep generated and saved assessment copy consistent with customer copy style. */
export function customerText(value: string): string {
  return value.replace(/\s*\u2014\s*/g, ', ');
}
