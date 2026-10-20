import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  headerRight?: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function DashboardCard({ title, subtitle, action, headerRight, className = '', children }: DashboardCardProps) {
  return (
    <section className={`bg-white rounded-2xl border border-saas-border shadow-soft-sm p-5 min-w-0 ${className}`}>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-saas-text-primary">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {headerRight}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            {action.label}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({ message, heightClassName = 'h-40' }: { message: string; heightClassName?: string }) {
  return (
    <div className={`flex items-center justify-center ${heightClassName}`}>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
