/**

 * Classifies wallet / payment references for Paystack deposit reconciliation.

 * Internal escrow movements (freeze, settlement, transfer) never appear on Paystack.

 */



const INTERNAL_PREFIXES = [

  'FREEZE_',

  'UNFREEZE_',

  'HYBRID_FREEZE_',

  'AUCTION_SETTLEMENT_',

  'TRANSFER_',

] as const;



const PAYSTACK_DEPOSIT_PREFIXES = ['WALLET_', 'PAY-', 'REG-'] as const;



export function isInternalWalletReference(reference: string): boolean {

  const upper = reference.toUpperCase();

  return INTERNAL_PREFIXES.some((prefix) => upper.startsWith(prefix));

}



/** References that should exist as Paystack charge / transfer records */

export function isPaystackComparableReference(reference: string): boolean {

  if (!reference?.trim()) return false;

  if (isInternalWalletReference(reference)) return false;



  const upper = reference.toUpperCase();

  return PAYSTACK_DEPOSIT_PREFIXES.some((prefix) => upper.startsWith(prefix));

}



/** Automated test / perf vendors that pollute staging wallet totals */

export function isAutomatedTestWalletEmail(email: string | null | undefined): boolean {

  if (!email) return false;

  const lower = email.toLowerCase();

  return (

    lower.endsWith('@example.com') ||

    lower.includes('@salvage-deleted.internal') ||

    lower.startsWith('test-bid') ||

    lower.startsWith('test-perf')

  );

}



export function describeUnmatchedStatus(status: string): string {

  switch (status) {

    case 'missing_in_database':

      return 'Paystack recorded this payment but no matching wallet record was found.';

    case 'missing_in_paystack':

      return 'Wallet record exists but no matching Paystack transaction was found (wrong API key or test account).';

    case 'amount_mismatch':

      return 'Reference matched but amounts differ between Paystack and the database.';

    default:

      return status;

  }

}


