import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Payment Details | Finance Officer',
  description: 'View auction payment details and timeline',
};

export default async function PaymentDetailsPage() {
  redirect('/finance/payments');
}
