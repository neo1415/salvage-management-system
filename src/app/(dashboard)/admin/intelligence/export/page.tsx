/**
 * Admin Intelligence Data Export Page
 * 
 * Task 11.5.1: Create data export page
 * 
 * Provides interface for exporting intelligence data with filters,
 * progress tracking, and export history.
 * 
 * @module app/(dashboard)/admin/intelligence/export
 */

import { Metadata } from 'next';
import { DataExportContent } from '@/components/intelligence/admin/export/data-export-content';

export const metadata: Metadata = {
  title: 'Data Export | Intelligence Admin',
  description: 'Export intelligence data for analysis and ML training',
};

export default function DataExportPage() {
  return <DataExportContent />;
}
