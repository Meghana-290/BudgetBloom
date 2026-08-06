import React, { useState } from 'react';
import { Page, UserProfile } from '../types';
import { 
  Sparkles,
  LayoutDashboard, 
  ArrowLeftRight, 
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp, 
  PieChart, 
  BarChart3, 
  Layers,
  FileSpreadsheet, 
  User, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell
} from 'lucide-react';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  profile: UserProfile | null;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onAddIncome: () => void;
  onAddExpense: () => void;
  unreadCount?: number;
}

export default function Sidebar({ 
  currentPage, 
  setCurrentPage, 
  profile, 
  onLogout,
  collapsed,
  setCollapsed,
  onAddIncome,
  onAddExpense,
  unreadCount = 0
}: SidebarProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Re-organized menu order exactly as specified
  const menuItems = [
    { page: Page.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { page: Page.TRANSACTIONS, label: 'Transactions', icon: ArrowLeftRight },
    { isAction: true, onClick: onAddIncome, label: 'Add Income', icon: ArrowUpRight, actionColor: 'text-emerald-500 hover:text-emerald-400 group-hover:text-emerald-400' },
    { isAction: true, onClick: onAddExpense, label: 'Add Expense', icon: ArrowDownRight, actionColor: 'text-rose-500 hover:text-rose-400 group-hover:text-rose-400' },
    { page: Page.SAVINGS, label: 'Savings Goals', icon: TrendingUp },
    { page: Page.BUDGETS, label: 'Budgets', icon: PieChart },
    { page: Page.ANALYTICS, label: 'Analytics', icon: BarChart3 },
    { page: Page.REPORTS, label: 'Reports', icon: Layers },
    { page: Page.EXPORT, label: 'Export & Print', icon: FileSpreadsheet },
    { page: Page.NOTIFICATIONS, label: 'Reminders & Alerts', icon: Bell },
    { page: Page.PROFILE, label: 'Profile Settings', icon: User },
  ];

  const handleMobileNavClick = (item: typeof menuItems[number]) => {
    setIsMobileDrawerOpen(false);
    if ('isAction' in item && item.isAction && 'onClick' in item && item.onClick) {
      item.onClick();
    } else if ('page' in item && item.page) {
      setCurrentPage(item.page);
    }
  };

  return (
    <>
      {/* MOBILE TOP BAR (Stick at the top for sub-tablet viewports) */}
      <div 
        id="mobile-top-header"
        className="md:hidden flex items-center justify-between p-4 bg-[#1D2E27] text-white border-b border-[#2C4A3C] sticky top-0 z-40 w-full shrink-0 shadow-md"
      >
        <div className="flex items-center space-x-3.5">
          <button 
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-[#2C4A3C]/50 transition-all focus:outline-none"
            aria-label="Toggle Side Drawer Menu"
            id="mobile-hamburger-btn"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-mustard flex items-center justify-center shrink-0 shadow-lg shadow-brand-mustard/20">
              <Sparkles className="w-4.5 h-4.5 text-slate-950" />
            </div>
            <span className="font-display font-extrabold text-base text-white tracking-tight leading-none mt-0.5">
              Budget<span className="text-brand-mustard">Bloom</span>
            </span>
          </div>
        </div>

        {/* Short Profile Initials Link in Mobile Top Bar */}
        <button 
          type="button"
          onClick={() => setCurrentPage(Page.PROFILE)}
          className="w-8 h-8 rounded-full overflow-hidden bg-brand-mustard/20 border border-brand-mustard/30 flex items-center justify-center font-bold text-brand-mustard text-xs shrink-0 transition-opacity active:opacity-85"
          id="mobile-profile-avatar-btn"
        >
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span>
              {(() => {
                const name = profile?.displayName || profile?.name || '';
                if (name) {
                  const parts = name.trim().split(/\s+/);
                  if (parts.length >= 2) {
                    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
                  }
                  return parts[0].substring(0, 2).toUpperCase();
                }
                return (profile?.email || 'B').substring(0, 2).toUpperCase();
              })()}
            </span>
          )}
        </button>
      </div>

      {/* MOBILE SLIDE-OUT DRAWER OVERLAY */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" id="mobile-navigation-drawer-backdrop">
          {/* Shaded backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer container body sliding from left */}
          <aside 
            className="relative flex flex-col w-68 max-w-[280px] h-full bg-[#1D2E27] border-r border-[#2C4A3C] text-slate-200 shadow-2xl p-4 transition-transform duration-300 transform translate-x-0 ease-out animate-scale-up"
            id="mobile-navigation-drawer"
          >
            {/* Drawer Brand Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2C4A3C]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-brand-mustard flex items-center justify-center shrink-0">
                  <Sparkles className="w-4.5 h-4.5 text-slate-950" />
                </div>
                <span className="font-display font-extrabold text-base text-white tracking-tight leading-none mt-0.5">
                  Budget<span className="text-brand-mustard">Bloom</span>
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#2C4A3C]/50 transition-all focus:outline-none"
                aria-label="Close drawer navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Menu Links inside Mobile Drawer */}
            <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {menuItems.map((item, idx) => {
                const IconComponent = item.icon;
                const isActionItem = 'isAction' in item && item.isAction;
                const isActive = !isActionItem && 'page' in item && currentPage === item.page;
                const hasUnread = !isActionItem && 'page' in item && item.page === Page.NOTIFICATIONS && unreadCount > 0;

                return (
                  <button
                    key={'page' in item ? item.page : `mobile-action-link-${idx}`}
                    onClick={() => handleMobileNavClick(item)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all group ${
                      isActive 
                        ? 'bg-brand-mustard text-slate-950 shadow-lg shadow-brand-mustard/25' 
                        : 'text-slate-300 hover:text-white hover:bg-[#263D33]/60'
                    }`}
                    title={item.label}
                    id={'page' in item ? `mobile-link-${item.page}` : `mobile-action-btn-${idx}`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <IconComponent className={`w-5 h-5 shrink-0 ${
                        isActive 
                          ? 'text-slate-950' 
                          : isActionItem && 'actionColor' in item && item.actionColor
                            ? item.actionColor
                            : 'text-slate-400 group-hover:text-white'
                      }`} />
                      <span className="truncate leading-none">{item.label}</span>
                    </div>
                    {hasUnread && (
                      <span className="bg-[#D6A51D] text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* User Profile Info Footer in Mobile Drawer */}
            <div className="pt-4 border-t border-[#2C4A3C] space-y-3">
              {profile && (
                <div className="flex items-center space-x-3 p-2 rounded-xl bg-[#263D33]/45 border border-[#2C4A3C]/45">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-mustard/20 border border-brand-mustard/30 flex items-center justify-center font-bold text-brand-mustard text-sm shrink-0">
                    {profile.photoURL ? (
                      <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span>
                        {(() => {
                          const name = profile.displayName || profile.name || '';
                          if (name) {
                            const parts = name.trim().split(/\s+/);
                            if (parts.length >= 2) {
                              return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
                            }
                            return parts[0].substring(0, 2).toUpperCase();
                          }
                          return (profile.email || 'B').substring(0, 2).toUpperCase();
                        })()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{profile.displayName || 'BudgetBloom User'}</p>
                    <p className="text-[10px] text-slate-400/90 truncate">{profile.email}</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-rose-450 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                title="Log Out Account"
                id="mobile-logout-drawer-btn"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className="leading-none">Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* DESKTOP/TABLET SIDEBAR */}
      <aside 
        id="desktop-sidebar"
        className={`sidebar hidden md:flex flex-col sticky top-0 h-screen z-30 transition-all duration-300 border-r ${
          collapsed ? 'w-20' : 'w-64'
        } bg-[#1D2E27] border-[#2C4A3C] text-slate-200`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#2C4A3C]">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-brand-mustard flex items-center justify-center shrink-0 shadow-lg shadow-brand-mustard/20">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-lg text-white tracking-tight whitespace-nowrap animate-fade-in">
                Budget<span className="text-brand-mustard">Bloom</span>
              </span>
            )}
          </div>

          <button 
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#2C4A3C]/50 hidden lg:block transition-all"
            id="sidebar-collapse-btn"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Navigation Options */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item, idx) => {
            const IconComponent = item.icon;
            const isActionItem = 'isAction' in item && item.isAction;
            const isActive = !isActionItem && 'page' in item && currentPage === item.page;
            const hasUnread = !isActionItem && 'page' in item && item.page === Page.NOTIFICATIONS && unreadCount > 0;
            
            const handleClick = () => {
              if (isActionItem && 'onClick' in item && item.onClick) {
                item.onClick();
              } else if ('page' in item && item.page) {
                setCurrentPage(item.page);
              }
            };

            return (
              <button
                key={'page' in item ? item.page : `action-link-${idx}`}
                onClick={handleClick}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                  isActive 
                    ? 'bg-brand-mustard text-slate-950 shadow-lg shadow-brand-mustard/20 font-semibold' 
                    : 'text-slate-300 hover:text-white hover:bg-[#263D33]/60'
                }`}
                title={item.label}
                id={'page' in item ? `sidebar-link-${item.page}` : `sidebar-action-btn-${idx}`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="relative flex items-center">
                    <IconComponent className={`w-5 h-5 shrink-0 ${
                      isActive 
                        ? 'text-slate-950' 
                        : isActionItem && 'actionColor' in item && item.actionColor
                          ? item.actionColor
                          : 'text-slate-400 group-hover:text-white'
                    }`} />
                    {hasUnread && collapsed && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#D6A51D] text-slate-950 font-extrabold text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center border border-[#1D2E27]">
                        !
                      </span>
                    )}
                  </div>
                  {!collapsed && <span className="truncate whitespace-nowrap animate-fade-in text-left">{item.label}</span>}
                </div>
                {hasUnread && !collapsed && (
                  <span className="bg-[#D6A51D] text-slate-950 font-extrabold text-[10px] px-1.5 py-0.5 rounded-full scale-90 shrink-0 shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Profile & Logout Footer */}
        <div className="p-4 border-t border-[#2C4A3C] space-y-3">
          {!collapsed && profile && (
            <div className="flex items-center space-x-3 p-1.5 rounded-xl bg-[#263D33]/45 border border-[#2C4A3C]/40">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-mustard/20 border border-brand-mustard/30 flex items-center justify-center font-bold text-brand-mustard text-sm shrink-0">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>
                    {(() => {
                      const name = profile.displayName || profile.name || '';
                      if (name) {
                        const parts = name.trim().split(/\s+/);
                        if (parts.length >= 2) {
                          return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
                        }
                        return parts[0].substring(0, 2).toUpperCase();
                      }
                      return (profile.email || 'B').substring(0, 2).toUpperCase();
                    })()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{profile.displayName || 'BudgetBloom User'}</p>
                <p className="text-[10px] text-slate-400 truncate">{profile.email}</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onLogout}
            className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-medium text-rose-450 hover:text-rose-400 hover:bg-rose-500/10 transition-all ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Log Out Account"
            id="logoutBtn"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="animate-fade-in">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
