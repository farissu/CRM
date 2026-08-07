import React from 'react';

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function TabButton({ icon, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
        active
          ? 'bg-saas-secondary-blue text-white shadow-soft-sm scale-102'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
