import { cn } from '@/utils/cn';

interface Props {
  variant: 'active' | 'inactive' | 'pending' | 'delivered' | 'picked';
  children: React.ReactNode;
}

const styles = {
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-red-50 text-red-600 border-red-200',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  picked: 'bg-blue-50 text-blue-700 border-blue-200',
};

export function Badge({ variant, children }: Props) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border', styles[variant])}>
      {children}
    </span>
  );
}
