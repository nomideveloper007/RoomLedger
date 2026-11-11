import React from 'react';
import { useRoom } from '../../context/RoomContext';
import { UserRole } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';
import {
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Wallet,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    room,
    activeUser,
    authAccount,
    logout,
    activePage,
    setActivePage,
    selectedMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    autoMonthInfo,
  } = useRoom();

  // Format month for display (e.g. "2026-11" -> "November 2026" or "Nov 2026")
  const formatMonthTitle = (mStr: string, short = false) => {
    try {
      const [y, m] = mStr.split('-');
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return date.toLocaleDateString('en-US', {
        month: short ? 'short' : 'long',
        year: 'numeric',
      });
    } catch {
      return mStr;
    }
  };

  const isCurrentMonth = selectedMonth === autoMonthInfo.month;

  const userRole = activeUser?.role || (authAccount?.role as UserRole) || 'viewer';
  const roleDisplay =
    userRole === 'owner'
      ? { label: 'OWNER', textCls: 'text-[#2563EB]', dotCls: 'bg-[#2563EB]' }
      : userRole === 'editor'
      ? { label: 'EDITOR', textCls: 'text-[#16A34A]', dotCls: 'bg-[#16A34A]' }
      : { label: 'VIEWER', textCls: 'text-[#D97706]', dotCls: 'bg-[#D97706]' };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6">
        {/* Main Header Bar */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1.5 sm:gap-3">
          {/* RoomLedger Brand Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
            <button
              type="button"
              onClick={() => setActivePage('register')}
              className="flex items-center gap-1.5 sm:gap-2.5 text-left focus:outline-none cursor-pointer group min-w-0"
              aria-label="RoomLedger home"
            >
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold shadow-xs transition-colors group-hover:bg-[#1D4ED8] shrink-0">
                <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs sm:text-base font-extrabold tracking-tight text-[#142B4A] leading-tight truncate">
                    RoomLedger
                  </span>
                  <span className="hidden sm:inline-block text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1 sm:px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] shrink-0">
                    Pro
                  </span>
                </div>
                <span className="text-[9px] sm:text-[11px] text-[#64748B] block leading-tight font-medium truncate max-w-[65px] xs:max-w-[100px] sm:max-w-none">
                  {room.name}
                </span>
              </div>
            </button>
          </div>

          {/* Month Selector: compact on mobile, expanded on tablet/desktop */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg px-1 sm:px-2 py-0.5 sm:py-1 text-xs shrink-0">
            <button
              type="button"
              onClick={goToPreviousMonth}
              title="Previous Month"
              className="p-1 sm:p-1.5 hover:bg-white hover:text-[#172B4D] rounded text-[#64748B] transition-colors cursor-pointer w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <span className="font-semibold text-[#142B4A] px-0.5 sm:px-1.5 whitespace-nowrap text-[11px] sm:text-xs text-center inline-flex items-center gap-1">
              <span className="sm:hidden">{formatMonthTitle(selectedMonth, true)}</span>
              <span className="hidden sm:inline">{formatMonthTitle(selectedMonth, false)}</span>
              {selectedMonth === autoMonthInfo.nextMonth && autoMonthInfo.isLastDay && (
                <span className="hidden md:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/30">
                  New Month
                </span>
              )}
            </span>

            <button
              type="button"
              onClick={goToNextMonth}
              title="Next Month"
              className="p-1 sm:p-1.5 hover:bg-white hover:text-[#172B4D] rounded text-[#64748B] transition-colors cursor-pointer w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0"
              aria-label="Next month"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {!isCurrentMonth && (
              <button
                type="button"
                onClick={goToCurrentMonth}
                className="ml-0.5 sm:ml-1 px-1 sm:px-2 py-0.5 bg-[#EFF6FF] hover:bg-[#2563EB] hover:text-white text-[#2563EB] font-semibold rounded text-[9px] sm:text-[11px] transition-colors cursor-pointer shrink-0"
              >
                Today
              </button>
            )}
          </div>

          {/* Right section: Desktop Tabs + Account Badge + Logout */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* PWA Install Button */}
            <PWAInstallButton compact />

            {/* Desktop Only 2 Pages Switcher */}
            <div className="hidden sm:flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setActivePage('register')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activePage === 'register'
                    ? 'bg-white text-[#2563EB] shadow-xs border border-[#E2E8F0]/60'
                    : 'text-[#64748B] hover:text-[#172B4D]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePage('settings')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activePage === 'settings'
                    ? 'bg-white text-[#2563EB] shadow-xs border border-[#E2E8F0]/60'
                    : 'text-[#64748B] hover:text-[#172B4D]'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            </div>

            {/* Logged-in User Badge */}
            <div
              className="flex items-center gap-1 sm:gap-2 bg-[#F7F9FC] p-1 sm:px-2.5 sm:py-1 rounded-lg border border-[#E2E8F0] select-none cursor-default shrink-0"
              title={`${activeUser.name || authAccount?.name} (${roleDisplay.label})`}
            >
              <div className="relative shrink-0">
                <div className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#CBD5E1] flex items-center justify-center font-bold text-xs shrink-0">
                  {(activeUser.name || authAccount?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-white ${roleDisplay.dotCls}`} />
              </div>
              <div className="text-left text-xs leading-tight hidden md:block">
                <div className="font-semibold text-[#142B4A] truncate max-w-[100px]">
                  {activeUser.name || authAccount?.name}
                </div>
                <div className={`text-[9px] font-bold tracking-wider ${roleDisplay.textCls}`}>
                  {roleDisplay.label}
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={logout}
              title="Sign Out of Authorized Account"
              className="p-1 sm:p-2 bg-white hover:bg-[#FEF2F2] text-[#64748B] hover:text-[#DC2626] rounded-lg border border-[#CBD5E1] transition-colors cursor-pointer w-8 h-8 sm:w-auto sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center shrink-0"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Sub-Header: Touch-friendly 2-Tab Segmented Control (sm:hidden) */}
        <div className="sm:hidden pb-2.5 pt-0.5">
          <div className="grid grid-cols-2 bg-[#F1F5F9] p-1 rounded-xl border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setActivePage('register')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
                activePage === 'register'
                  ? 'bg-white text-[#2563EB] shadow-xs border border-[#E2E8F0]/70'
                  : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Monthly Register</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage('settings')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
                activePage === 'settings'
                  ? 'bg-white text-[#2563EB] shadow-xs border border-[#E2E8F0]/70'
                  : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings & Access</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
