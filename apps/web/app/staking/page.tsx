import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Staking',
  description: 'LP staking and farming via MasterChef + BentoBox.',
};

export default function StakingPage() {
  redirect('/');
}
