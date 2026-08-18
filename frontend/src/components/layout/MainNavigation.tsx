import React from 'react';
import clsx from 'clsx';
import { MessageSquare, Settings, LogOut, Radio, LayoutDashboard } from 'lucide-react';
import type { Role } from '@/types';

type Tab = 'conversations' | 'dashboard' | 'broadcast' | 'settings';

interface MainNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  agentName?: string;
  agentRole?: Role;
  hideMobileNav?: boolean;
}

export default function MainNavigation({
  activeTab,
  onTabChange,
  onLogout,
  agentName,
  agentRole,
  hideMobileNav,
}: MainNavigationProps) {
  const showSettings = agentRole !== 'AGENT';

  return (
    <>
      {/* Desktop side rail */}
      <div className="hidden md:flex w-20 bg-saas-sidebar-blue flex-col items-center py-5 gap-3 shadow-soft">
        {/* Logo/Brand */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 overflow-hidden">
          <img
            src="/logo.svg"
            alt="WAKU Logo"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Navigation Items */}
        <NavItem
          icon={<MessageSquare className="w-6 h-6" />}
          label="Inbox"
          active={activeTab === 'conversations'}
          onClick={() => onTabChange('conversations')}
          badge={0}
        />

        <NavItem
          icon={<LayoutDashboard className="w-6 h-6" />}
          label="Dashboard"
          active={activeTab === 'dashboard'}
          onClick={() => onTabChange('dashboard')}
        />

        <NavItem
          icon={<Radio className="w-6 h-6" />}
          label="Broadcast"
          active={activeTab === 'broadcast'}
          onClick={() => onTabChange('broadcast')}
        />

        {/* Hide Settings for AGENT role */}
        {showSettings && (
          <NavItem
            icon={<Settings className="w-6 h-6" />}
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => onTabChange('settings')}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Logout at bottom */}
        <button
          onClick={onLogout}
          className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 group relative hover:scale-105"
          title="Logout"
        >
          <LogOut className="w-5 h-5 text-white" />
          {/* Tooltip */}
          <div className="absolute left-full ml-3 px-3 py-2 bg-saas-text-primary text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-soft">
            Logout {agentName && `(${agentName})`}
          </div>
        </button>
      </div>

      {/* Mobile bottom tab bar */}
      <div
        className={clsx(
          'md:hidden order-last w-full bg-saas-sidebar-blue flex items-stretch justify-around shadow-soft flex-shrink-0',
          hideMobileNav && 'hidden'
        )}
      >
        <MobileNavItem
          icon={<MessageSquare className="w-5 h-5" />}
          label="Inbox"
          active={activeTab === 'conversations'}
          onClick={() => onTabChange('conversations')}
        />
        <MobileNavItem
          icon={<LayoutDashboard className="w-5 h-5" />}
          label="Dashboard"
          active={activeTab === 'dashboard'}
          onClick={() => onTabChange('dashboard')}
        />
        <MobileNavItem
          icon={<Radio className="w-5 h-5" />}
          label="Broadcast"
          active={activeTab === 'broadcast'}
          onClick={() => onTabChange('broadcast')}
        />
        {showSettings && (
          <MobileNavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => onTabChange('settings')}
          />
        )}
        <MobileNavItem
          icon={<LogOut className="w-5 h-5" />}
          label="Logout"
          active={false}
          onClick={onLogout}
        />
      </div>
    </>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

function NavItem({ icon, label, active, onClick, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 relative group ${
        active
          ? 'bg-saas-accent-blue text-white shadow-soft-sm scale-105'
          : 'text-white/70 hover:bg-white/10 hover:text-white hover:scale-105'
      }`}
      title={label}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-soft-sm tabular-nums">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {/* Tooltip */}
      <div className="absolute left-full ml-3 px-3 py-2 bg-saas-text-primary text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-soft">
        {label}
      </div>
    </button>
  );
}

interface MobileNavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function MobileNavItem({ icon, label, active, onClick }: MobileNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors duration-200',
        active ? 'text-white' : 'text-white/60'
      )}
    >
      {icon}
      <span className="text-[10px] font-semibold leading-none">{label}</span>
    </button>
  );
}
