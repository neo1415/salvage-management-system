/**
 * HTML to PDF Service using Puppeteer
 * Converts HTML pages to PDF with full styling, charts, and tables
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface HtmlToPdfOptions {
  html: string;
  format?: 'A4' | 'Letter';
  landscape?: boolean;
  printBackground?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export class HtmlToPdfService {
  private browser: Browser | null = null;

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--hide-scrollbars',
          '--disable-web-security',
        ],
        ignoreHTTPSErrors: true,
      });
    }
    return this.browser;
  }

  /**
   * Generate PDF from HTML content
   * Note: This method has limitations - it cannot capture CSS, JavaScript, or charts
   * Use generatePdfFromUrl() for full page rendering with all assets
   */
  async generatePdf(options: HtmlToPdfOptions): Promise<Buffer> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport for consistent rendering
      await page.setViewport({
        width: 1200,
        height: 1600, // Taller viewport to capture more content
        deviceScaleFactor: 2, // Higher quality rendering
      });

      // Load HTML content with full page styles
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; }
            @media print {
              body { margin: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${options.html}
        </body>
        </html>
      `;

      await page.setContent(fullHtml, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000,
      });

      // Wait for any dynamic content (charts, images, etc.)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Generate PDF with full page capture
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        landscape: options.landscape || false,
        printBackground: options.printBackground !== false,
        margin: options.margin || {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        preferCSSPageSize: false,
        // This ensures the full page is captured
        scale: 0.8, // Slightly reduce scale to fit more content
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  /**
   * Generate PDF from a URL with authentication
   * This method properly captures all CSS, JavaScript, and rendered charts
   */
  async generatePdfFromUrl(
    url: string, 
    options?: Partial<HtmlToPdfOptions>,
    cookies?: Array<{ name: string; value: string; domain: string }>
  ): Promise<Buffer> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
      // Set cookies for authentication if provided
      if (cookies && cookies.length > 0) {
        await page.setCookie(...cookies);
      }

      // Set viewport for consistent rendering
      await page.setViewport({
        width: 1200,
        height: 1600,
        deviceScaleFactor: 2,
      });

      // Navigate to the page
      await page.goto(url, {
        waitUntil: ['networkidle0', 'load'],
        timeout: 60000, // Increased timeout for complex pages
      });

      // Wait for charts and dynamic content to render
      // Look for common chart containers
      try {
        await page.waitForSelector('canvas, svg, [data-report-content]', {
          timeout: 10000,
        });
      } catch (e) {
        // Continue even if selectors not found
        console.warn('Chart selectors not found, continuing anyway');
      }

      // Additional wait for JavaScript execution
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Hide elements that shouldn't be in PDF
      await page.evaluate(() => {
        // Hide navigation, buttons, and interactive elements
        const elementsToHide = document.querySelectorAll(
          'button, .no-print, nav, header:not([data-report-content] header), [role="navigation"]'
        );
        elementsToHide.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: options?.format || 'A4',
        landscape: options?.landscape || false,
        printBackground: options?.printBackground !== false,
        margin: options?.margin || {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        preferCSSPageSize: false,
        scale: 0.9,
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
 * Singleton instance
 */
let htmlToPdfService: HtmlToPdfService | null = null;

export function getHtmlToPdfService(): HtmlToPdfService {
  if (!htmlToPdfService) {
    htmlToPdfService = new HtmlToPdfService();
  }
  return htmlToPdfService;
}

/**
 * Cleanup on process exit
 */
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    if (htmlToPdfService) {
      await htmlToPdfService.close();
    }
  });
}
