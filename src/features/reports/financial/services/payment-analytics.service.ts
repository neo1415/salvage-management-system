/**
 * Payment Analytics Service
 * 
 * Implements payment analytics and aging reports
 * Task 6: Payment Analytics Service
 */

import { ReportFilters } from '../../types';
import { FinancialDataRepository } from '../repositories/financial-data.repository';
import { DataAggregationService } from '../../services/data-aggregation.service';

export interface PaymentAnalyticsReport {
  summary: {
    totalPayments: number;
    totalAmount: number;
    completedPayments: number;
    pendingPayments: number;
    averageProcessingTimeHours: number;
    autoVerificationRate: number;
    successRate: number;
  };
  byMethod: Array<{
    method: string;
    count: number;
    totalAmount: number;
    averageAmount: number;
    successRate: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  processingTimes: {
    average: number;
    median: number;
    fastest: number;
    slowest: number;
  };
  aging: {
    current: number;
    overdue1to7: number;
    overdue8to30: number;
    overdue31to60: number;
    overdue60plus: number;
  };
  trend: Array<{
    date: string;
    count: number;
    amount: number;
    successRate: number;
  }>;
}

export class PaymentAnalyticsService {
  /**
   * Generate comprehensive payment analytics report
   */
  static async generateReport(filters: ReportFilters): Promise<PaymentAnalyticsReport> {
    // Get payment data
    const paymentData = await FinancialDataRepository.getPaymentData(filters);
    
    // Get aging data
    const agingData = await FinancialDataRepository.getPaymentAgingData(filters);

    // Calculate summary
    const summary = this.calculateSummary(paymentData);

    // Group by method
    const byMethod = this.calculateByMethod(paymentData);

    // Group by status
    const byStatus = this.calculateByStatus(paymentData);

    // Calculate processing times
    const processingTimes = this.calculateProcessingTimes(paymentData);

    // Calculate trend
    const trend = this.calculateTrend(paymentData);

    return {
      summary,
      byMethod,
      byStatus,
      processingTimes,
      aging: agingData.summary,
      trend,
    };
  }

  /**
   * Calculate summary statistics
   */
  private static calculateSummary(data: any[]) {
    const totalAmount = data.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const completedPayments = data.filter(p => p.status === 'completed' || p.status === 'verified').length;
    const pendingPayments = data.filter(p => p.status === 'pending').length;
    
    const verifiedPayments = data.filter(p => p.processingTimeHours !== null);
    const avgProcessingTime = verifiedPayments.length > 0
      ? verifiedPayments.reduce((sum, p) => sum + (p.processingTimeHours || 0), 0) / verifiedPayments.length
      : 0;

    const autoVerified = data.filter(p => p.processingTimeHours !== null && p.processingTimeHours < 1).length;
    const autoVerificationRate = data.length > 0 ? (autoVerified / data.length) * 100 : 0;

    const successRate = data.length > 0 ? (completedPayments / data.length) * 100 : 0;
    
    const avgPaymentTime = verifiedPayments.length > 0 ? avgProcessingTime : 0;

    return {
      totalPayments: data.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      completedPayments,
      pendingPayments,
      averageProcessingTimeHours: Math.round(avgProcessingTime * 100) / 100,
      averagePaymentTime: Math.round(avgPaymentTime * 100) / 100,
      autoVerificationRate: Math.round(autoVerificationRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Calculate metrics by payment method
   */
  private static calculateByMethod(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped = DataAggregationService.groupBy(data, 'method');
    if (!grouped || Object.keys(grouped).length === 0) return [];
    const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    return Object.entries(grouped).map(([method, items]) => {
      const methodTotal = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const completed = items.filter(item => item.status === 'completed' || item.status === 'verified').length;
      const successRate = items.length > 0 ? (completed / items.length) * 100 : 0;
      const percentage = totalAmount > 0 ? (methodTotal / totalAmount) * 100 : 0;

      return {
        method,
        count: items.length,
        totalAmount: Math.round(methodTotal * 100) / 100,
        amount: Math.round(methodTotal * 100) / 100, // Add for backwards compatibility
        averageAmount: Math.round((methodTotal / items.length) * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * Calculate metrics by status
   */
  private static calculateByStatus(data: any[]) {
    const grouped = DataAggregationService.groupBy(data, 'status');
    if (!grouped || Object.keys(grouped).length === 0) return [];

    return Object.entries(grouped).map(([status, items]) => {
      const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const percentage = data.length > 0 ? (items.length / data.length) * 100 : 0;

      return {
        status,
        count: items.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
      };
    }).sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate processing time statistics
   */
  private static calculateProcessingTimes(data: any[]) {
    const times = data
      .filter(p => p.processingTimeHours !== null)
      .map(p => p.processingTimeHours)
      .sort((a, b) => a - b);

    if (times.length === 0) {
      return {
        average: 0,
        median: 0,
        fastest: 0,
        slowest: 0,
      };
    }

    const average = times.reduce((sum, t) => sum + t, 0) / times.length;
    const median = times[Math.floor(times.length / 2)];
    const fastest = times[0];
    const slowest = times[times.length - 1];

    return {
      average: Math.round(average * 100) / 100,
      median: Math.round(median * 100) / 100,
      fastest: Math.round(fastest * 100) / 100,
      slowest: Math.round(slowest * 100) / 100,
    };
  }

  /**
   * Calculate payment trend over time
   */
  private static calculateTrend(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped: Record<string, {
      count: number;
      amount: number;
      completed: number;
    }> = {};

    for (const item of data) {
      const date = new Date(item.createdAt).toISOString().split('T')[0];
      
      if (!grouped[date]) {
        grouped[date] = { count: 0, amount: 0, completed: 0 };
      }

      grouped[date].count++;
      grouped[date].amount += parseFloat(item.amount);
      if (item.status === 'completed' || item.status === 'verified') {
        grouped[date].completed++;
      }
    }

    return Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        count: data.count,
        amount: Math.round(data.amount * 100) / 100,
        successRate: data.count > 0 
          ? Math.round((data.completed / data.count) * 10000) / 100 
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
