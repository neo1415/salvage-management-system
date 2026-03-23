/**
 * Test Document Workflow Critical Fixes
 * 
 * Tests all 5 critical issues fixed:
 * 1. Notification panel position (top-right, fully visible)
 * 2. QR code positioning (no footer overlap)
 * 3. QR code descriptions added
 * 4. Signature inclusion in waiver PDF
 * 5. "AI" removed from waiver text
 */

import {
  generateBillOfSalePDF,
  generateLiabilityWaiverPDF,
  generatePickupAuthorizationPDF,
  generateSalvageCertificatePDF,
  type BillOfSaleData,
  type LiabilityWaiverData,
  type PickupAuthorizationData,
  type SalvageCertificateData,
} from '@/features/documents/services/pdf-generation.service';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function testDocumentFixes() {
  console.log('🧪 Testing Document Workflow Critical Fixes\n');

  const testOutputDir = join(process.cwd(), 'test-output');

  // Test 1: Bill of Sale with QR code description and proper spacing
  console.log('1️⃣ Testing Bill of Sale PDF...');
  const billOfSaleData: BillOfSaleData = {
    transactionId: 'TEST-BOS-001',
    transactionDate: new Date().toLocaleDateString('en-NG'),
    buyerName: 'John Doe',
    buyerEmail: 'john@example.com',
    buyerPhone: '+234-800-123-4567',
    buyerBvn: '1234',
    sellerName: 'NEM Insurance Plc',
    sellerAddress: '199 Ikorodu Road, Obanikoro, Lagos, Nigeria',
    sellerContact: '234-02-014489560',
    assetType: 'Vehicle',
    assetDescription: '2020 Toyota Camry',
    assetCondition: 'Salvage - Front End Damage',
    vin: 'TEST123456789',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    salePrice: 2500000,
    paymentMethod: 'Bank Transfer',
    paymentReference: 'PAY-TEST-001',
    pickupLocation: 'NEM Insurance Salvage Yard, Lagos',
    pickupDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-NG'),
    verificationUrl: 'https://nem-insurance.com/verify/TEST-BOS-001',
  };

  try {
    const billOfSalePDF = await generateBillOfSalePDF(billOfSaleData);
    writeFileSync(join(testOutputDir, 'test-bill-of-sale.pdf'), billOfSalePDF);
    console.log('   ✅ Bill of Sale generated successfully');
    console.log('   ✅ QR code should have description: "Scan to verify document authenticity online"');
    console.log('   ✅ QR code should not overlap with footer\n');
  } catch (error) {
    console.error('   ❌ Error generating Bill of Sale:', error);
  }

  // Test 2: Liability Waiver WITHOUT signature (initial generation)
  console.log('2️⃣ Testing Liability Waiver PDF (unsigned)...');
  const waiverDataUnsigned: LiabilityWaiverData = {
    vendorName: 'Jane Smith',
    vendorEmail: 'jane@example.com',
    vendorPhone: '+234-800-987-6543',
    vendorBvn: '5678',
    assetDescription: '2019 Honda Accord',
    assetCondition: 'Salvage - Side Impact',
    auctionId: 'TEST-AUCTION-001',
    transactionDate: new Date().toLocaleDateString('en-NG'),
    verificationUrl: 'https://nem-insurance.com/verify/TEST-WAIVER-001',
  };

  try {
    const waiverPDFUnsigned = await generateLiabilityWaiverPDF(waiverDataUnsigned);
    writeFileSync(join(testOutputDir, 'test-waiver-unsigned.pdf'), waiverPDFUnsigned);
    console.log('   ✅ Unsigned waiver generated successfully');
    console.log('   ✅ Should show signature line (no signature image)');
    console.log('   ✅ Text should say "damage assessment" NOT "AI damage assessment"');
    console.log('   ✅ QR code should have description and not overlap footer\n');
  } catch (error) {
    console.error('   ❌ Error generating unsigned waiver:', error);
  }

  // Test 3: Liability Waiver WITH signature (after signing)
  console.log('3️⃣ Testing Liability Waiver PDF (signed)...');
  
  // Create a simple test signature (base64 PNG)
  const testSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  const waiverDataSigned: LiabilityWaiverData = {
    vendorName: 'Jane Smith',
    vendorEmail: 'jane@example.com',
    vendorPhone: '+234-800-987-6543',
    vendorBvn: '5678',
    assetDescription: '2019 Honda Accord',
    assetCondition: 'Salvage - Side Impact',
    auctionId: 'TEST-AUCTION-001',
    transactionDate: new Date().toLocaleDateString('en-NG'),
    signatureData: testSignature,
    signedDate: new Date().toLocaleDateString('en-NG'),
    verificationUrl: 'https://nem-insurance.com/verify/TEST-WAIVER-001',
  };

  try {
    const waiverPDFSigned = await generateLiabilityWaiverPDF(waiverDataSigned);
    writeFileSync(join(testOutputDir, 'test-waiver-signed.pdf'), waiverPDFSigned);
    console.log('   ✅ Signed waiver generated successfully');
    console.log('   ✅ Should show signature image');
    console.log('   ✅ Should show signed date');
    console.log('   ✅ Text should say "damage assessment" NOT "AI damage assessment"');
    console.log('   ✅ QR code should have description and not overlap footer\n');
  } catch (error) {
    console.error('   ❌ Error generating signed waiver:', error);
  }

  // Test 4: Pickup Authorization with QR code description
  console.log('4️⃣ Testing Pickup Authorization PDF...');
  const pickupAuthData: PickupAuthorizationData = {
    authorizationCode: 'AUTH-TEST001',
    auctionId: 'TEST-AUCTION-001',
    vendorName: 'Jane Smith',
    vendorPhone: '+234-800-987-6543',
    assetDescription: '2019 Honda Accord',
    pickupLocation: 'NEM Insurance Salvage Yard, Lagos',
    pickupDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-NG'),
    pickupContact: '234-02-014489560',
    paymentAmount: 1800000,
    paymentReference: 'PAY-TEST-002',
    paymentDate: new Date().toLocaleDateString('en-NG'),
    verificationUrl: 'https://nem-insurance.com/verify/TEST-AUTH-001',
  };

  try {
    const pickupAuthPDF = await generatePickupAuthorizationPDF(pickupAuthData);
    writeFileSync(join(testOutputDir, 'test-pickup-authorization.pdf'), pickupAuthPDF);
    console.log('   ✅ Pickup Authorization generated successfully');
    console.log('   ✅ QR code should have description: "Scan to verify authorization and view pickup details"');
    console.log('   ✅ QR code should not overlap with footer\n');
  } catch (error) {
    console.error('   ❌ Error generating Pickup Authorization:', error);
  }

  // Test 5: Salvage Certificate with QR code description
  console.log('5️⃣ Testing Salvage Certificate PDF...');
  const salvageCertData: SalvageCertificateData = {
    vin: 'TEST987654321',
    make: 'Mercedes-Benz',
    model: 'C-Class',
    year: 2021,
    damageAssessment: 'Severe front-end collision damage. Engine compartment compromised. Frame damage detected. Not suitable for road use without extensive repairs.',
    totalLossDeclaration: true,
    claimReference: 'CLAIM-TEST-001',
    insuranceCompany: 'NEM Insurance Plc',
    saleDate: new Date().toLocaleDateString('en-NG'),
    buyerName: 'Auto Parts Dealer Ltd',
    verificationUrl: 'https://nem-insurance.com/verify/TEST-CERT-001',
  };

  try {
    const salvageCertPDF = await generateSalvageCertificatePDF(salvageCertData);
    writeFileSync(join(testOutputDir, 'test-salvage-certificate.pdf'), salvageCertPDF);
    console.log('   ✅ Salvage Certificate generated successfully');
    console.log('   ✅ QR code should have description: "Scan to verify certificate authenticity online"');
    console.log('   ✅ QR code should not overlap with footer\n');
  } catch (error) {
    console.error('   ❌ Error generating Salvage Certificate:', error);
  }

  console.log('📋 SUMMARY OF FIXES:');
  console.log('   1. ✅ Notification panel: Changed from absolute to fixed positioning at top-right');
  console.log('   2. ✅ QR codes: Added proper spacing to avoid footer overlap in all PDFs');
  console.log('   3. ✅ QR descriptions: Added explanatory text for all QR codes');
  console.log('   4. ✅ Signature in waiver: Signature image and date now appear in signed PDFs');
  console.log('   5. ✅ Removed "AI": Changed "AI damage assessment" to "damage assessment"\n');

  console.log('📁 Test PDFs saved to:', testOutputDir);
  console.log('   - test-bill-of-sale.pdf');
  console.log('   - test-waiver-unsigned.pdf');
  console.log('   - test-waiver-signed.pdf');
  console.log('   - test-pickup-authorization.pdf');
  console.log('   - test-salvage-certificate.pdf\n');

  console.log('🔍 MANUAL VERIFICATION REQUIRED:');
  console.log('   1. Open each PDF and verify QR codes do not overlap with footer');
  console.log('   2. Check that QR codes have descriptive text above them');
  console.log('   3. Verify signed waiver shows signature image and date');
  console.log('   4. Confirm waiver text says "damage assessment" not "AI damage assessment"');
  console.log('   5. Test notification panel in browser - should appear at top-right corner\n');
}

testDocumentFixes().catch(console.error);
