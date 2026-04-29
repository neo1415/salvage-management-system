/**
 * Puppeteer-based PDF Generator
 * Renders actual HTML pages with full CSS and chart support
 * 
 * Updated for modern Puppeteer APIs (v21+)
 */

import puppeteer, { Browser } from 'puppeteer';

export interface PuppeteerPDFOptions {
  url: string;
  waitForSelector?: string;
  waitForTimeout?: number;
  cookies?: Array<{ name: string; value: string; domain: string }>;
}

export class PuppeteerPDFGenerator {
  private browser: Browser | null = null;

  /**
   * Initialize browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security', // Allow loading local resources
          '--font-render-hinting=none', // Better font rendering in PDFs
        ],
      });
    }
    return this.browser;
  }

  /**
   * Generate PDF from a URL
   */
  async generateFromURL(options: PuppeteerPDFOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set cookies if provided (for authentication)
      if (options.cookies && options.cookies.length > 0) {
        await page.setCookie(...options.cookies);
      }

      // Set viewport for consistent rendering (A4 size at 96 DPI)
      await page.setViewport({
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
        deviceScaleFactor: 2, // Higher quality for crisp text and images
      });

      // Emulate print media to activate @media print CSS rules
      await page.emulateMediaType('print');

      console.log('Navigating to:', options.url);

      // Navigate to the page
      await page.goto(options.url, {
        waitUntil: 'networkidle0', // Wait for all network requests to finish
        timeout: 60000, // 60 second timeout
      });

      console.log('Page loaded, waiting for content...');

      // Wait for specific selector if provided (e.g., wait for report to be ready)
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: 30000,
        });
        console.log('Report ready signal detected');
      }

      // Additional wait for charts/animations to complete
      // Use setTimeout instead of deprecated waitForTimeout
      if (options.waitForTimeout) {
        await new Promise(resolve => setTimeout(resolve, options.waitForTimeout));
      } else {
        // Default wait for charts to render
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('Generating PDF...');

      // Generate PDF with optimized settings
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true, // Include background colors and images
        margin: {
          top: '0mm', // No margins - letterhead handles spacing
          right: '0mm',
          bottom: '0mm',
          left: '0mm',
        },
        preferCSSPageSize: false,
        displayHeaderFooter: false, // We use custom letterhead/footer
      });

      console.log('PDF generated successfully');

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Generate PDF from HTML content
   */
  async generateFromHTML(html: string, css?: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport (A4 size)
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 2,
      });

      // Set content
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      // Inject additional CSS if provided
      if (css) {
        await page.addStyleTag({ content: css });
      }

      // Wait for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * Singleton instance for reuse
 */
let pdfGeneratorInstance: PuppeteerPDFGenerator | null = null;

export function getPDFGenerator(): PuppeteerPDFGenerator {
  if (!pdfGeneratorInstance) {
    pdfGeneratorInstance = new PuppeteerPDFGenerator();
  }
  return pdfGeneratorInstance;
}

/**
 * Helper function to generate PDF from authenticated page
 */
export async function generateAuthenticatedPDF(
  url: string,
  sessionToken: string,
  domain: string
): Promise<Buffer> {
  const generator = getPDFGenerator();
  
  return generator.generateFromURL({
    url,
    cookies: [
      {
        name: 'authjs.session-token',
        value: sessionToken,
        domain,
      },
    ],
    waitForSelector: '[data-report-ready="true"]', // Wait for report to be ready
    waitForTimeout: 3000, // Extra time for charts
  });
}
