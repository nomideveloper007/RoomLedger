/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RoomProvider, useRoom } from './context/RoomContext';
import { Navbar } from './components/layout/Navbar';
import { MonthlyRegisterView } from './components/register/MonthlyRegisterView';
import { SettingsView } from './components/settings/SettingsView';
import { LoginView } from './components/auth/LoginView';

const AppContent: React.FC = () => {
  const { activePage, room, isAuthenticated, authAccount } = useRoom();

  // Protect the entire application behind Single Account Authentication
  if (!isAuthenticated) {
    return <LoginView onSuccess={() => {}} roomName={room.name} />;
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col text-[#172B4D] antialiased selection:bg-[#2563EB] selection:text-white">
      {/* Top Navbar with Page 1 / Page 2 switcher and Month Navigation */}
      <Navbar />

      {/* Main Container: Exact 2 Pages */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 overflow-x-hidden">
        {activePage === 'register' && <MonthlyRegisterView />}
        {activePage === 'settings' && <SettingsView />}
      </main>

      {/* Clean Fintech Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] py-3.5 sm:py-4 text-center text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#142B4A]">RoomLedger</span>
            <span className="text-[#CBD5E1]">•</span>
            <span>{room.name}</span>
          </div>
          <p className="text-[#94A3B8] text-[11px] sm:text-xs">
            Equal 5-way division · All records in Pakistani Rupee (PKR)
          </p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <RoomProvider>
      <AppContent />
    </RoomProvider>
  );
}
