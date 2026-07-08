import { redirect } from 'next/navigation';

// The Subscriptions module grew into Bills & Commitments; old bookmarks land there.
export default function SubscriptionsRedirect() {
  redirect('/bills');
}
