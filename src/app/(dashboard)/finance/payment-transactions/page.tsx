import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Payment Transactions | Finance Officer',
  description: 'Manage auction payment transactions and deposits',
};

export default async function PaymentTransactionsPage() {
  redirect('/finance/payments');
}
