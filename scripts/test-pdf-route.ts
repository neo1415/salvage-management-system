/**
 * Test PDF Route Accessibility
 * Verifies that the /pdf route is accessible and returns clean HTML
 */

async function testPDFRoute() {
  const baseUrl = 'http://localhost:3000';
  const pdfUrl = `${baseUrl}/reports/executive/kpi-dashboard/pdf`;

  console.log('Testing PDF route accessibility...');
  console.log('URL:', pdfUrl);
  console.log('');

  try {
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    console.log('Status:', response.status, response.statusText);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('');

    if (response.ok) {
      const html = await response.text();
      
      // Check for dashboard UI elements that should NOT be present
      const hasNavigation = html.includes('nav') || html.includes('sidebar');
      const hasFilters = html.includes('date-filter') || html.includes('DatePicker');
      const hasProfileIcon = html.includes('profile-icon') || html.includes('user-menu');
      const hasCookieBanner = html.includes('cookie') || html.includes('Cookies');
      
      // Check for PDF elements that SHOULD be present
      const hasLetterhead = html.includes('NEM Insurance') || html.includes('Nem-insurance-Logo');
      const hasReportContent = html.includes('data-report-ready');
      const hasPDFLayout = html.includes('pdf-container') || html.includes('pdf-header');

      console.log('✅ Route is accessible!');
      console.log('');
      console.log('Content Analysis:');
      console.log('  Dashboard UI Elements (should be false):');
      console.log('    - Navigation:', hasNavigation ? '❌ FOUND' : '✅ NOT FOUND');
      console.log('    - Filters:', hasFilters ? '❌ FOUND' : '✅ NOT FOUND');
      console.log('    - Profile Icon:', hasProfileIcon ? '❌ FOUND' : '✅ NOT FOUND');
      console.log('    - Cookie Banner:', hasCookieBanner ? '❌ FOUND' : '✅ NOT FOUND');
      console.log('');
      console.log('  PDF Elements (should be true):');
      console.log('    - Letterhead:', hasLetterhead ? '✅ FOUND' : '❌ NOT FOUND');
      console.log('    - Report Content:', hasReportContent ? '✅ FOUND' : '❌ NOT FOUND');
      console.log('    - PDF Layout:', hasPDFLayout ? '✅ FOUND' : '❌ NOT FOUND');
      console.log('');

      if (!hasNavigation && !hasFilters && !hasProfileIcon && hasLetterhead && hasPDFLayout) {
        console.log('🎉 SUCCESS! PDF route is clean and ready for export!');
      } else {
        console.log('⚠️  WARNING: PDF route may still have UI elements or missing PDF components');
        console.log('');
        console.log('First 500 characters of HTML:');
        console.log(html.substring(0, 500));
      }
    } else {
      console.log('❌ Route returned error status');
      const text = await response.text();
      console.log('Response:', text.substring(0, 500));
    }
  } catch (error) {
    console.error('❌ Failed to access PDF route:', error);
    console.log('');
    console.log('Make sure:');
    console.log('  1. Your Next.js dev server is running (npm run dev)');
    console.log('  2. The server has been restarted after creating the /pdf route');
    console.log('  3. You can access http://localhost:3000 in your browser');
  }
}

testPDFRoute();
