/**
 * Wraps arbitrary HTML body content in the configured brand letterhead and footer.
 */

import { getPolicyAwareBaseEmailTemplate } from './base.template';

export async function wrapProfessionalEmail(
  title: string,
  content: string,
  preheader?: string
): Promise<string> {
  return getPolicyAwareBaseEmailTemplate({ title, content, preheader });
}
