import dynamic from 'next/dynamic';

const PoolClient = dynamic(() => import('./PoolClient'), { ssr: false });

export default function PoolPage(props: any) {
  return <PoolClient {...props} />;
}
