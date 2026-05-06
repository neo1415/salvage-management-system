/**
 * Paystack Balance Service
 * 
 * Fetches real-time balance from Paystack API for reconciliation purposes.
 */

import axios from 'axios';

interface PaystackBalanceResponse {
  status: boolean;
  message: string;
  data: Array<{
    currency: string;
    balance: number; // In kobo (subunit)
  }>;
}

export class PaystackBalanceService {
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.paystack.co';

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    
    if (!this.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }
  }

  /**
   * Fetch current balance from Paystack
   * @returns Balance in Naira (converted from kobo)
   */
  async fetchBalance(): Promise<number> {
    try {
      const response = await axios.get<PaystackBalanceResponse>(
        `${this.baseUrl}/balance`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      if (!response.data.status) {
        throw new Error(`Paystack API error: ${response.data.message}`);
      }

      // Find NGN balance
      const ngnBalance = response.data.data.find((b) => b.currency === 'NGN');

      if (!ngnBalance) {
        throw new Error('NGN balance not found in Paystack response');
      }

      // Convert from kobo to Naira
      return ngnBalance.balance / 100;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Paystack API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error('Paystack API: No response received (network error)');
        }
      }
      
      throw error;
    }
  }

  /**
   * Check if Paystack API is configured and accessible
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.fetchBalance();
      return {
        healthy: true,
        message: 'Paystack API is accessible',
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
