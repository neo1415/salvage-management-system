/**
 * Paystack Bank Account Verification
 * Verifies bank account details using Paystack API
 */

export interface BankAccountVerificationResult {
  verified: boolean;
  accountName: string | null;
  accountNumber: string;
  bankCode: string;
  message: string;
}

/**
 * Verify bank account using Paystack Bank Account Resolution API
 * Endpoint: GET https://api.paystack.co/bank/resolve?account_number=X&bank_code=Y
 */
export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<BankAccountVerificationResult> {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    // Check if using test keys
    const isTestMode = secretKey.startsWith('sk_test_');

    // Test mode: Accept test account numbers
    if (isTestMode) {
      console.log('[Paystack Bank Verification] Running in TEST MODE');
      
      // Test account numbers for development
      const testAccounts: Record<string, string> = {
        '0123456789': 'Test Account Name',
        '1234567890': 'Business Test Account',
      };

      if (testAccounts[accountNumber]) {
        return {
          verified: true,
          accountName: testAccounts[accountNumber],
          accountNumber,
          bankCode,
          message: 'Bank account verified successfully (test mode)',
        };
      }
    }

    // Call Paystack API
    const url = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        verified: false,
        accountName: null,
        accountNumber,
        bankCode,
        message: data.message || 'Bank account verification failed',
      };
    }

    if (data.status && data.data) {
      return {
        verified: true,
        accountName: data.data.account_name,
        accountNumber: data.data.account_number,
        bankCode,
        message: 'Bank account verified successfully',
      };
    }

    return {
      verified: false,
      accountName: null,
      accountNumber,
      bankCode,
      message: 'Bank account verification failed',
    };
  } catch (error) {
    console.error('Error verifying bank account:', error);
    throw new Error('Failed to verify bank account');
  }
}

/**
 * Get list of Nigerian banks from Paystack
 */
export async function getNigerianBanks(): Promise<Array<{ name: string; code: string }>> {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.status && data.data) {
      interface PaystackBank {
        name: string;
        code: string;
      }
      
      return data.data.map((bank: PaystackBank) => ({
        name: bank.name,
        code: bank.code,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching Nigerian banks:', error);
    return [];
  }
}
