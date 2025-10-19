import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Launchpad',
  description: 'Discover token sale pools and participate in IDOs.',
};

export default function LaunchpadPage() {
  redirect('/');
}
