/**
 * PDF Generation Service
 * 
 * Generates professional PDF documents for salvage auctions:
 * - Bill of Sale
 * - Release & Waiver of Liability
 * - Pickup Authorization
 * - Salvage Certificate
 * 
 * Uses jsPDF for client-side PDF generation with QR codes for verification.
 * Features NEM Insurance branding with logo, burgundy (#800020), and gold (#FFD700) colors.
 * 
 * Requirements: 21.1, 21.2, 21.5, 21.6
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { PDFTemplateService } from './pdf-template.service';

// NEM Insurance Brand Colors
const NEM_BURGUNDY = '#800020';
const NEM_GOLD = '#FFD700';

export interface BillOfSaleData {
  // Transaction details
  transactionId: string;
  transactionDate: string;
  
  // Buyer information
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerBvn?: string; // Last 4 digits only
  
  // Seller information
  sellerName: string;
  sellerAddress: string;
  sellerContact: string;
  
  // Asset information
  assetType: string;
  assetDescription: string;
  assetCondition: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  
  // Financial information
  salePrice: number;
  paymentMethod: string;
  paymentReference?: string;
  
  // Pickup information
  pickupLocation: string;
  pickupDeadline: string;
  
  // Verification
  verificationUrl: string;
}

export interface LiabilityWaiverData {
  // Vendor information
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string;
  vendorBvn?: string;
  
  // Asset information
  assetDescription: string;
  assetCondition: string;
  
  // Transaction information
  auctionId: string;
  transactionDate: string;
  
  // Signature information (optional - added when signed)
  signatureData?: string;
  signedDate?: string;
  
  // Verification
  verificationUrl: string;
}

export interface PickupAuthorizationData {
  // Authorization details
  authorizationCode: string;
  auctionId: string;
  
  // Vendor information
  vendorName: string;
  vendorPhone: string;
  
  // Asset information
  assetDescription: string;
  
  // Pickup details
  pickupLocation: string;
  pickupDeadline: string;
  pickupContact: string;
  
  // Payment information
  paymentAmount: number;
  paymentReference: string;
  paymentDate: string;
  
  // Verification
  verificationUrl: string;
}

export interface SalvageCertificateData {
  // Vehicle information
  vin: string;
  make: string;
  model: string;
  year: number;
  
  // Damage information
  damageAssessment: string;
  totalLossDeclaration: boolean;
  
  // Insurance information
  claimReference: string;
  insuranceCompany: string;
  
  // Transaction information
  saleDate: string;
  buyerName: string;
  
  // Verification
  verificationUrl: string;
}

/**
 * Generate Bill of Sale PDF
 */
export async function generateBillOfSalePDF(data: BillOfSaleData): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Add professional letterhead with logo using PDFTemplateService
  await PDFTemplateService.addLetterhead(doc, 'BILL OF SALE');
  
  // Transaction details
  let yPos = 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Transaction ID: ${data.transactionId}`, 20, yPos);
  doc.text(`Date: ${data.transactionDate}`, pageWidth - 20, yPos, { align: 'right' });
  
  // Seller information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SELLER INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${data.sellerName}`, 20, yPos);
  yPos += 6;
  doc.text(`Address: ${data.sellerAddress}`, 20, yPos);
  yPos += 6;
  doc.text(`Contact: ${data.sellerContact}`, 20, yPos);
  
  // Buyer information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('BUYER INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${data.buyerName}`, 20, yPos);
  yPos += 6;
  doc.text(`Email: ${data.buyerEmail}`, 20, yPos);
  yPos += 6;
  doc.text(`Phone: ${data.buyerPhone}`, 20, yPos);
  if (data.buyerBvn) {
    yPos += 6;
    doc.text(`BVN: ****${data.buyerBvn}`, 20, yPos);
  }
  
  // Asset information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('ASSET INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Type: ${data.assetType}`, 20, yPos);
  yPos += 6;
  doc.text(`Description: ${data.assetDescription}`, 20, yPos);
  yPos += 6;
  doc.text(`Condition: ${data.assetCondition}`, 20, yPos);
  
  if (data.vin) {
    yPos += 6;
    doc.text(`VIN: ${data.vin}`, 20, yPos);
  }
  if (data.make && data.model && data.year) {
    yPos += 6;
    doc.text(`Vehicle: ${data.year} ${data.make} ${data.model}`, 20, yPos);
  }
  
  // Financial information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('FINANCIAL INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Sale Price: NGN ${data.salePrice.toLocaleString()}`, 20, yPos);
  yPos += 6;
  doc.text(`Payment Method: ${data.paymentMethod}`, 20, yPos);
  if (data.paymentReference) {
    yPos += 6;
    doc.text(`Payment Reference: ${data.paymentReference}`, 20, yPos);
  }
  
  // Pickup information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PICKUP INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Location: ${data.pickupLocation}`, 20, yPos);
  yPos += 6;
  doc.text(`Deadline: ${data.pickupDeadline}`, 20, yPos);
  
  // AS-IS disclaimer
  yPos += 15;
  doc.setFillColor(255, 243, 205); // Light yellow
  doc.rect(15, yPos - 5, pageWidth - 30, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AS-IS, WHERE-IS SALE', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('This asset is sold "AS-IS, WHERE-IS" with NO WARRANTIES, express or implied.', 20, yPos);
  yPos += 5;
  doc.text('Buyer accepts all risks and responsibilities associated with this purchase.', 20, yPos);
  
  // Get max content Y to avoid footer overlap using PDFTemplateService
  const maxContentY = PDFTemplateService.getMaxContentY(doc);
  
  // QR Code section - positioned above footer with proper spacing
  yPos += 20;
  
  // Ensure QR code doesn't overlap footer
  if (yPos + 80 > maxContentY) {
    yPos = maxContentY - 80;
  }
  
  const qrCodeDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    width: 80,
    margin: 1,
  });
  
  // Add QR code description
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan to verify document', pageWidth - 50, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('authenticity online', pageWidth - 50, yPos + 4);
  
  // Add QR code (80x80px max, positioned in bottom-right, above footer)
  doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - 50, yPos + 8, 30, 30);
  
  // Add professional footer using PDFTemplateService
  PDFTemplateService.addFooter(doc);
  
  // Convert to buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

/**
 * Generate Liability Waiver PDF
 */
export async function generateLiabilityWaiverPDF(data: LiabilityWaiverData): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Add professional letterhead with logo using PDFTemplateService
  await PDFTemplateService.addLetterhead(doc, 'RELEASE & WAIVER OF LIABILITY');
  
  // Vendor information
  let yPos = 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`I, ${data.vendorName}, hereby acknowledge and agree:`, 20, yPos);
  
  // Waiver clauses
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('1. AS-IS CONDITION', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  const asIsText = doc.splitTextToSize(
    'I am purchasing the salvage item(s) in "AS-IS, WHERE-IS" condition with ALL FAULTS and NO WARRANTIES, express or implied.',
    pageWidth - 40
  );
  doc.text(asIsText, 20, yPos);
  
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('2. INSPECTION OPPORTUNITY', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  const inspectionText = doc.splitTextToSize(
    'I have had the opportunity to inspect the item(s) through photos, descriptions, and damage assessment provided by NEM Insurance.',
    pageWidth - 40
  );
  doc.text(inspectionText, 20, yPos);
  
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('3. RELEASE OF LIABILITY', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  const releaseText = doc.splitTextToSize(
    'I hereby release, waive, and forever discharge NEM Insurance Plc, its officers, employees, and agents from any and all liability, claims, demands, or causes of action arising from: (a) Injuries or death resulting from use of the salvage item(s); (b) Property damage caused by the salvage item(s); (c) Defects, malfunctions, or failures of the salvage item(s); (d) Any misrepresentation or omission regarding the item\'s condition.',
    pageWidth - 40
  );
  doc.text(releaseText, 20, yPos);
  
  yPos += 30;
  doc.setFont('helvetica', 'bold');
  doc.text('4. ASSUMPTION OF RISK', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  const riskText = doc.splitTextToSize(
    'I understand and accept all risks associated with purchasing and using salvage property, including but not limited to: structural damage not visible in photos, mechanical failures, safety hazards, and environmental contamination.',
    pageWidth - 40
  );
  doc.text(riskText, 20, yPos);
  
  yPos += 25;
  doc.setFont('helvetica', 'bold');
  doc.text('5. INDEMNIFICATION', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  const indemnityText = doc.splitTextToSize(
    'I agree to indemnify and hold harmless NEM Insurance Plc from any claims by third parties arising from my ownership or use of the salvage item(s).',
    pageWidth - 40
  );
  doc.text(indemnityText, 20, yPos);
  
  yPos += 20;
  doc.setFont('helvetica', 'bold');
  doc.text('6. FINAL SALE', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.text('I understand this sale is FINAL and NON-REFUNDABLE.', 20, yPos);
  
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('7. GOVERNING LAW', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.text('This agreement is governed by the laws of Nigeria.', 20, yPos);
  
  // Get max content Y to avoid footer overlap using PDFTemplateService
  const maxContentY = PDFTemplateService.getMaxContentY(doc);
  
  // Signature and QR code section - positioned above footer with more spacing
  yPos += 20;
  
  // Ensure signature section doesn't overlap footer (increased buffer from 80 to 90)
  if (yPos + 90 > maxContentY) {
    yPos = maxContentY - 90;
  }
  
  doc.setDrawColor(0, 0, 0);
  
  // Signature section (left side)
  const signatureStartY = yPos;
  
  // If signature data is provided, add the signature image
  if (data.signatureData) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Vendor Signature:', 20, yPos);
    yPos += 5;
    
    try {
      // Add signature image (max 50px height, 200px width)
      doc.addImage(data.signatureData, 'PNG', 20, yPos, 80, 40);
      yPos += 45;
    } catch (error) {
      console.error('Error adding signature to PDF:', error);
      // Fallback to signature line if image fails
      doc.line(20, yPos + 40, 100, yPos + 40);
      yPos += 45;
    }
    
    // Signature line and label
    doc.line(20, yPos, 100, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Vendor Signature', 20, yPos);
    
    // Add signed date on same line (right side)
    if (data.signedDate) {
      doc.text(`Date: ${data.signedDate}`, 110, yPos);
    }
  } else {
    // No signature yet - show signature line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Vendor Signature:', 20, yPos);
    yPos += 45;
    
    doc.line(20, yPos, 100, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Vendor Signature', 20, yPos);
    
    doc.line(110, yPos - 5, 170, yPos - 5);
    doc.text('Date: ___/___/______', 110, yPos);
  }
  
  // Vendor details below signature (with better spacing)
  yPos += 10;
  doc.setFontSize(8);
  doc.text(`Name: ${data.vendorName}`, 20, yPos);
  yPos += 5;
  doc.text(`Email: ${data.vendorEmail}`, 20, yPos);
  yPos += 5;
  doc.text(`Phone: ${data.vendorPhone}`, 20, yPos);
  if (data.vendorBvn) {
    yPos += 5;
    doc.text(`BVN: ****${data.vendorBvn}`, 20, yPos);
  }
  
  // QR Code (right side, aligned with signature section)
  const qrCodeDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    width: 80,
    margin: 1,
  });
  
  // Position QR code on right side, aligned with signature
  const qrX = pageWidth - 50;
  const qrY = signatureStartY;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan to verify', qrX + 15, qrY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('document online', qrX + 15, qrY + 4, { align: 'center' });
  
  // Add QR code (80x80px max)
  doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY + 8, 30, 30);
  
  // Add professional footer using PDFTemplateService
  PDFTemplateService.addFooter(doc);
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

/**
 * Generate Pickup Authorization PDF
 */
export async function generatePickupAuthorizationPDF(data: PickupAuthorizationData): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Add professional letterhead with logo using PDFTemplateService
  await PDFTemplateService.addLetterhead(doc, 'PICKUP AUTHORIZATION');
  
  // Authorization code (prominent with gold background)
  let yPos = 65;
  doc.setFillColor(255, 215, 0); // Gold
  doc.rect(15, yPos - 10, pageWidth - 30, 25, 'F');
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(128, 0, 32); // Burgundy text on gold background
  doc.text(`Authorization Code: ${data.authorizationCode}`, pageWidth / 2, yPos, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Vendor information
  yPos += 25;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTHORIZED VENDOR', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${data.vendorName}`, 20, yPos);
  yPos += 6;
  doc.text(`Phone: ${data.vendorPhone}`, 20, yPos);
  
  // Asset information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('ASSET INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Description: ${data.assetDescription}`, 20, yPos);
  yPos += 6;
  doc.text(`Auction ID: ${data.auctionId}`, 20, yPos);
  
  // Payment information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PAYMENT CONFIRMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Amount Paid: NGN ${data.paymentAmount.toLocaleString()}`, 20, yPos);
  yPos += 6;
  doc.text(`Payment Reference: ${data.paymentReference}`, 20, yPos);
  yPos += 6;
  doc.text(`Payment Date: ${data.paymentDate}`, 20, yPos);
  
  // Pickup details
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PICKUP DETAILS', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Location: ${data.pickupLocation}`, 20, yPos);
  yPos += 6;
  doc.text(`Contact: ${data.pickupContact}`, 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Deadline: ${data.pickupDeadline}`, 20, yPos);
  
  // Important notice
  yPos += 15;
  doc.setFillColor(255, 243, 205);
  doc.rect(15, yPos - 5, pageWidth - 30, 25, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('IMPORTANT NOTICE', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('• Present this authorization and valid ID at pickup location', 20, yPos);
  yPos += 5;
  doc.text('• Pickup must be completed before deadline to avoid storage fees', 20, yPos);
  yPos += 5;
  doc.text('• Authorization code must match system records', 20, yPos);
  
  // Get max content Y to avoid footer overlap using PDFTemplateService
  const maxContentY = PDFTemplateService.getMaxContentY(doc);
  
  // QR Code section - centered, positioned above footer
  yPos += 20;
  
  // Ensure QR code doesn't overlap footer
  if (yPos + 80 > maxContentY) {
    yPos = maxContentY - 80;
  }
  
  const qrCodeDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    width: 80,
    margin: 1,
  });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan to verify authorization', pageWidth / 2, yPos, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('and view pickup details', pageWidth / 2, yPos + 4, { align: 'center' });
  
  // Add QR code (80x80px max, centered)
  doc.addImage(qrCodeDataUrl, 'PNG', pageWidth / 2 - 15, yPos + 8, 30, 30);
  
  // Add professional footer using PDFTemplateService
  PDFTemplateService.addFooter(doc);
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

/**
 * Generate Salvage Certificate PDF (for vehicles only)
 */
export async function generateSalvageCertificatePDF(data: SalvageCertificateData): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Add professional letterhead with logo using PDFTemplateService
  await PDFTemplateService.addLetterhead(doc, 'SALVAGE CERTIFICATE');
  
  // Vehicle information
  let yPos = 65;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('VEHICLE INFORMATION', 20, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`VIN: ${data.vin}`, 20, yPos);
  yPos += 6;
  doc.text(`Make: ${data.make}`, 20, yPos);
  yPos += 6;
  doc.text(`Model: ${data.model}`, 20, yPos);
  yPos += 6;
  doc.text(`Year: ${data.year}`, 20, yPos);
  
  // Damage assessment
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DAMAGE ASSESSMENT', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const damageText = doc.splitTextToSize(data.damageAssessment, pageWidth - 40);
  doc.text(damageText, 20, yPos);
  
  // Total loss declaration
  yPos += damageText.length * 6 + 10;
  if (data.totalLossDeclaration) {
    doc.setFillColor(255, 0, 0, 0.1);
    doc.rect(15, yPos - 5, pageWidth - 30, 15, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 0, 0);
    doc.text('TOTAL LOSS - NOT ROADWORTHY', 20, yPos);
    doc.setTextColor(0, 0, 0);
  }
  
  // Insurance information
  yPos += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('INSURANCE INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Claim Reference: ${data.claimReference}`, 20, yPos);
  yPos += 6;
  doc.text(`Insurance Company: ${data.insuranceCompany}`, 20, yPos);
  
  // Sale information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SALE INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Sale Date: ${data.saleDate}`, 20, yPos);
  yPos += 6;
  doc.text(`Buyer: ${data.buyerName}`, 20, yPos);
  
  // Disclaimer
  yPos += 15;
  doc.setFillColor(255, 243, 205);
  doc.rect(15, yPos - 5, pageWidth - 30, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SALVAGE VEHICLE NOTICE', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('This vehicle has been declared a total loss and is sold for parts/repair only.', 20, yPos);
  yPos += 5;
  doc.text('It may not be roadworthy and requires inspection before use.', 20, yPos);
  
  // Get max content Y to avoid footer overlap using PDFTemplateService
  const maxContentY = PDFTemplateService.getMaxContentY(doc);
  
  // QR Code section - positioned above footer with proper spacing
  yPos += 20;
  
  // Ensure QR code doesn't overlap footer
  if (yPos + 80 > maxContentY) {
    yPos = maxContentY - 80;
  }
  
  const qrCodeDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    width: 80,
    margin: 1,
  });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan to verify certificate', pageWidth - 50, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('authenticity online', pageWidth - 50, yPos + 4);
  
  // Add QR code (80x80px max, positioned in bottom-right, above footer)
  doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - 50, yPos + 8, 30, 30);
  
  // Add professional footer using PDFTemplateService
  PDFTemplateService.addFooter(doc);
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}
