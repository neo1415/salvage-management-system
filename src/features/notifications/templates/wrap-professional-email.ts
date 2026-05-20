/**
 * Wraps arbitrary HTML body content in the standard NEM letterhead and footer
 */

import { getBaseEmailTemplate } from './base.template';

export function wrapProfessionalEmail(
  title: string,
  content: string,
  preheader?: string
): string {
  return getBaseEmailTemplate({ title, content, preheader });
}
