import dynamic from 'next/dynamic';

const CreatePoolClient = dynamic(() => import('./CreatePoolClient'), { ssr: false });

export const metadata = {
  title: 'Create Launchpad Pool',
  description: 'Create a new IDO pool.',
};

export default function CreatePoolPage() {
  return <CreatePoolClient />;
}
