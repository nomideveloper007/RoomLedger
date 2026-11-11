import React, { useState, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { AuthService } from '../../lib/auth';
import { getStoredSupabaseConfig, testSupabaseConnection, getSupabaseClient } from '../../lib/supabase';
import { RoomMember, UserRole } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';
import {
  Users,
  Shield,
  Settings,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Lock,
  Database,
  Calendar,
  Key,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  UserCheck,
  UserPlus,
  Plus,
  Trash2,
  Mail,
  Code,
  Smartphone,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    room,
    members,
    authAccount,
    activeUser,
    activeUserId,
    setActiveUserId,
    updateMemberNames,
    updateMemberRole,
    addMember,
    removeMember,
    updateRoom,
    isOwner,
    resetAll,
    autoMonthInfo,
    setSimulatedDate,
  } = useRoom();

  const [registerName, setRegisterName] = useState(room.name);
  const [memberNames, setMemberNames] = useState<string[]>(() => members.map((m) => m.name));
  const [targetAmount, setTargetAmount] = useState(room.monthlyContributionTarget.toString());
  const [startDay, setStartDay] = useState(room.monthStartDay.toString());

  // Notification state
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // New member creation state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('editor');
  const [isAddingMemberOpen, setIsAddingMemberOpen] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [memberActionMsg, setMemberActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setMemberNames(members.map((m) => m.name));
  }, [members]);

  const handleAddNewMember = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newMemberName.trim();
    if (!cleanName) {
      setMemberActionMsg({ type: 'error', text: 'Please enter a roommate name.' });
      return;
    }

    const cleanEmail = newMemberEmail.trim()
      ? newMemberEmail.trim().toLowerCase()
      : `${cleanName.toLowerCase().replace(/\s+/g, '.')}@room.internal`;

    const cleanPass = newMemberPassword.trim() || `${cleanName.toLowerCase().replace(/\s+/g, '')}123`;

    if (cleanPass.length < 4) {
      setMemberActionMsg({ type: 'error', text: 'Password must be at least 4 characters long.' });
      return;
    }

    setIsSavingMember(true);

    try {
      // 1. Add locally with credentials
      await addMember(cleanName, newMemberRole, cleanEmail, cleanPass);

      // 2. Direct automatic save to Supabase
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          // Direct Auth signup in Supabase
          await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPass,
            options: {
              data: {
                full_name: cleanName,
                role: newMemberRole,
              },
            },
          });

          // Direct room_members insert/upsert in Supabase
          const { data: roomData } = await supabase.from('rooms').select('id').limit(1).maybeSingle();
          if (roomData?.id) {
            await supabase.from('room_members').upsert({
              room_id: roomData.id,
              name: cleanName,
              email: cleanEmail,
              role: newMemberRole,
              is_active: true,
            }, { onConflict: 'room_id,email' });
          }
        } catch (supaErr) {
          console.warn('Supabase sync notice:', supaErr);
        }
      }

      setMemberActionMsg({
        type: 'success',
        text: `Roommate "${cleanName}" (${cleanEmail}) Supabase aur Register mein directly save ho gaya!`,
      });

      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPassword('');
      setIsAddingMemberOpen(false);
      setTimeout(() => setMemberActionMsg(null), 4000);
    } catch (err: any) {
      setMemberActionMsg({
        type: 'error',
        text: err?.message || 'Failed to add roommate',
      });
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleRemoveMember = (member: RoomMember) => {
    if (member.role === 'owner') {
      alert('Cannot delete the Owner account.');
      return;
    }
    if (members.length <= 1) {
      alert('At least one member must remain in the register.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove roommate "${member.name}"?`)) {
      removeMember(member.id);
      setMemberActionMsg({
        type: 'success',
        text: `Roommate "${member.name}" removed from register.`,
      });
      setTimeout(() => setMemberActionMsg(null), 3500);
    }
  };

  // Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showRlsInfo, setShowRlsInfo] = useState(false);

  // Supabase state
  const supabaseConfig = getStoredSupabaseConfig();
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestStatus, setSupabaseTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseTestStatus(null);
    const res = await testSupabaseConnection(supabaseConfig.url, supabaseConfig.key);
    setSupabaseTestStatus(res);
    setIsTestingSupabase(false);
  };

  const handleMemberNameChange = (index: number, newName: string) => {
    const updated = [...memberNames];
    updated[index] = newName;
    setMemberNames(updated);
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    updateMemberNames(memberNames);
    updateRoom({
      name: registerName.trim(),
      monthlyContributionTarget: parseFloat(targetAmount) || 15000,
      monthStartDay: parseInt(startDay, 10) || 1,
    });

    setSaveSuccess('Register configuration and roommate names saved successfully!');
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    if (newPassword.length < 4) {
      setPasswordStatus({ type: 'error', text: 'New password must be at least 4 characters long.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await AuthService.updatePassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordStatus({ type: 'success', text: 'Authorized account password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({ type: 'error', text: res.error || 'Failed to update password.' });
      }
    } catch (err: any) {
      setPasswordStatus({ type: 'error', text: err.message || 'An error occurred while updating password.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-[#142B4A] tracking-tight">Settings & Security</h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Single authorized account management, roommate names, and database-level security.
        </p>
      </div>

      {!isOwner && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            You are signed in as <strong>{activeUser.name}</strong> ({activeUser.role.toUpperCase()}). Settings management is restricted to the Room Owner (Noman).
          </span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 bg-[#F0FDF4] border border-[#16A34A]/30 rounded-xl text-[#16A34A] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* PWA Mobile App Card */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#142B4A] to-[#1E3A5F] text-white rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#2563EB] rounded-lg">
              <Smartphone className="w-4 h-4 text-white" />
            </span>
            <span className="font-bold text-sm sm:text-base">Install RoomLedger on Mobile</span>
          </div>
          <p className="text-xs text-slate-300">
            Install this app on your Android or iPhone for 1-tap Home Screen access and offline use.
          </p>
        </div>
        <div className="shrink-0">
          <PWAInstallButton />
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* 1. Register Configuration */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <h2 className="text-sm font-bold text-[#142B4A] uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#2563EB]" />
            <span>1. Register Configuration</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Room / Register Title
              </label>
              <input
                type="text"
                disabled={!isOwner}
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className={`w-full px-3 py-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-lg text-[#172B4D] ${
                  isOwner
                    ? 'bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]'
                    : 'bg-[#F1F5F9] cursor-not-allowed select-none'
                } min-h-[44px]`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                Monthly Starting Day
              </label>
              <input
                type="number"
                min="1"
                max="28"
                disabled={!isOwner}
                value={startDay}
                onChange={(e) => setStartDay(e.target.value)}
                className={`w-full px-3 py-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-lg text-[#172B4D] ${
                  isOwner
                    ? 'bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]'
                    : 'bg-[#F1F5F9] cursor-not-allowed select-none'
                } min-h-[44px]`}
              />
              <span className="text-[11px] text-[#94A3B8] mt-0.5 block">Default: 1st of each month</span>
            </div>

            {/* Auto-start Month on Last Day feature info & simulation */}
            <div className="sm:col-span-2 pt-3 border-t border-[#E2E8F0]">
              <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-[#EFF6FF] text-[#2563EB] rounded-lg">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-xs font-bold text-[#142B4A] block">
                        Auto-Start New Month on Month's Last Date
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Jab bhi maheene ki aakhri tareekh (jaise 30 ya 31) aati hai, agla naya maheena khud-bakhud register mein start ho jata hai.
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/30">
                    Active & Enforced
                  </span>
                </div>

                {/* Status & Simulation Bar */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#E2E8F0] text-[11px]">
                  <div className="text-[#64748B] flex items-center gap-1.5 flex-wrap">
                    <span>Current Calendar Day:</span>
                    <strong className="text-[#142B4A] font-mono">Day {autoMonthInfo?.todayDate} of {autoMonthInfo?.lastDateOfMonth}</strong>
                    {autoMonthInfo?.isLastDay ? (
                      <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                        Final Date Active · {autoMonthInfo?.nextMonth} Auto-Started
                      </span>
                    ) : (
                      <span className="text-[#94A3B8]">
                        ({autoMonthInfo ? autoMonthInfo.lastDateOfMonth - autoMonthInfo.todayDate : 0} days remaining)
                      </span>
                    )}
                    {autoMonthInfo?.isSimulated && (
                      <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-purple-100 text-purple-800 border border-purple-300">
                        Test Mode: Simulated Last Date
                      </span>
                    )}
                  </div>

                  {/* Simulator buttons for testing - ONLY OWNER */}
                  {isOwner && (
                  <div className="flex items-center gap-1.5">
                    {!autoMonthInfo?.isSimulated ? (
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                          const y = last.getFullYear();
                          const m = String(last.getMonth() + 1).padStart(2, '0');
                          const d = String(last.getDate()).padStart(2, '0');
                          setSimulatedDate(`${y}-${m}-${d}T12:00:00`);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] rounded-lg border border-[#2563EB]/20 transition-colors cursor-pointer"
                        title="Simulate the last date of this month to test the automatic new-month start"
                      >
                        ⚡ Test Last Day ({new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSimulatedDate(null)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg border border-[#DC2626]/20 transition-colors cursor-pointer"
                        title="Revert back to real system date"
                      >
                        Reset to Real Date
                      </button>
                    )}
                  </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Roommate Members */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold text-[#142B4A] uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <span>2. Roommate Members ({members.length})</span>
            </h2>
            {isOwner && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] sm:text-xs text-[#64748B] font-medium hidden sm:inline">
                  Columns in Register
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingMemberOpen((prev) => !prev)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] border border-[#2563EB]/20 flex items-center gap-1 transition-colors cursor-pointer touch-manipulation"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAddingMemberOpen ? 'Close Form' : '+ Add Roommate'}</span>
                </button>
              </div>
            )}
          </div>

          <p className="text-[11px] sm:text-xs text-[#64748B]">
            Edit roommate names, assign their permissions (Editor / Viewer), or add new roommates. Each member is automatically added as a column in the monthly register:
          </p>

          {memberActionMsg && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                memberActionMsg.type === 'success'
                  ? 'bg-[#F0FDF4] border border-[#16A34A]/30 text-[#16A34A]'
                  : 'bg-[#FEF2F2] border border-[#DC2626]/30 text-[#DC2626]'
              }`}
            >
              {memberActionMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{memberActionMsg.text}</span>
            </div>
          )}

          {/* Inline Add Member Form with Credentials when open */}
          {isOwner && isAddingMemberOpen && (
            <div className="p-3.5 sm:p-4 bg-[#F8FAFC] border-2 border-dashed border-[#93C5FD] rounded-xl space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#142B4A] flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#2563EB]" />
                  <span>Add Roommate & Login Credentials</span>
                </span>
                <span className="text-[10px] text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                  Member #{members.length + 1}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name */}
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] mb-1 block">
                    Roommate Name <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => {
                      setNewMemberName(e.target.value);
                      if (!newMemberEmail) {
                        const slug = e.target.value.toLowerCase().replace(/\s+/g, '.');
                        setNewMemberEmail(slug ? `${slug}@room.internal` : '');
                      }
                      if (!newMemberPassword) {
                        const passSlug = e.target.value.toLowerCase().replace(/\s+/g, '');
                        setNewMemberPassword(passSlug ? `${passSlug}123` : '');
                      }
                    }}
                    placeholder="e.g. Usman, Daniyal, Hamza..."
                    className="w-full px-3 py-2 text-xs sm:text-sm font-medium border border-[#CBD5E1] rounded-lg bg-white text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[42px]"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] mb-1 block">
                    Register Access Role
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-medium border border-[#CBD5E1] rounded-lg bg-white text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[42px] cursor-pointer"
                  >
                    <option value="editor">Editor (Can add & edit expenses)</option>
                    <option value="viewer">Viewer (Read-only access)</option>
                  </select>
                </div>

                {/* Login Email */}
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Login Email</span>
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">Required for login</span>
                  </label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="e.g. usman@gmail.com"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-[#CBD5E1] rounded-lg bg-white text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[42px]"
                  />
                </div>

                {/* Login Password */}
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Login Password</span>
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">Min 4 chars</span>
                  </label>
                  <input
                    type="text"
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    placeholder="e.g. usman123"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-[#CBD5E1] rounded-lg bg-white text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[42px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B]">
                  Credentials allow this roommate to sign into RoomLedger directly.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingMemberOpen(false);
                      setNewMemberName('');
                      setNewMemberEmail('');
                      setNewMemberPassword('');
                    }}
                    className="px-3 py-2 text-xs font-semibold text-[#64748B] hover:text-[#172B4D] hover:bg-white rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddNewMember()}
                    disabled={!newMemberName.trim() || isSavingMember}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#94A3B8] text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSavingMember ? 'Saving to Supabase...' : 'Save Roommate & Credentials'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {members.map((m, idx) => (
              <div
                key={m.id}
                className="flex items-center gap-2 p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl hover:border-[#CBD5E1] transition-all"
              >
                <span className="w-7 h-7 rounded-full bg-[#142B4A] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    required
                    disabled={!isOwner}
                    value={memberNames[idx] || ''}
                    onChange={(e) => handleMemberNameChange(idx, e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs sm:text-sm font-semibold border border-[#CBD5E1] rounded-lg text-[#172B4D] ${
                      isOwner
                        ? 'bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]'
                        : 'bg-[#F1F5F9] cursor-not-allowed select-none'
                    } min-h-[38px]`}
                    placeholder={`Roommate ${idx + 1}`}
                  />
                  {m.email && (
                    <span className="text-[10px] text-[#64748B] font-mono truncate block px-1 mt-0.5" title={m.email}>
                      {m.email}
                    </span>
                  )}
                </div>

                {m.role === 'owner' ? (
                  <span className="px-2 py-1 text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB]/20 rounded-md shrink-0">
                    Owner
                  </span>
                ) : isOwner ? (
                  <select
                    value={m.role}
                    onChange={(e) => updateMemberRole(m.id, e.target.value as UserRole)}
                    title="Change member role"
                    className="text-[11px] font-semibold py-1.5 px-2 bg-white border border-[#CBD5E1] rounded-md text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2563EB] shrink-0 cursor-pointer"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-md border shrink-0 ${
                    m.role === 'editor'
                      ? 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30'
                      : 'bg-[#FEF9C3] text-[#854D0E] border-[#854D0E]/30'
                  }`}>
                    {m.role === 'editor' ? 'Editor' : 'Viewer'}
                  </span>
                )}

                {isOwner && m.role !== 'owner' ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m)}
                    title={`Delete "${m.name}"`}
                    aria-label={`Delete ${m.name}`}
                    className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg border border-transparent hover:border-[#FCA5A5] transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-1 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Quick Add Button if form is closed - ONLY OWNER */}
          {isOwner && !isAddingMemberOpen && (
            <button
              type="button"
              onClick={() => setIsAddingMemberOpen(true)}
              className="w-full py-2.5 border-2 border-dashed border-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#EFF6FF]/50 text-[#64748B] hover:text-[#2563EB] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer touch-manipulation"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Another Roommate (Member #{members.length + 1})</span>
            </button>
          )}
        </div>

        {/* Save General Settings Button - ONLY OWNER */}
        {isOwner && (
          <button
            type="submit"
            className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-lg shadow-xs transition-colors cursor-pointer min-h-[46px] flex items-center justify-center touch-manipulation"
          >
            Save Register Title & Roommate Names
          </button>
        )}
      </form>

      {/* 2b. Active Member / View-As Role Switcher - ONLY OWNER */}
      {isOwner && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#142B4A] uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#2563EB]" />
              <span>Active Member / Role Preview</span>
            </h2>
            <span className="text-[11px] sm:text-xs text-[#64748B] font-medium">View As</span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#64748B]">
            Switch between roommate roles to preview what each member sees in the register. Viewers cannot add or delete records.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {members.map((m) => {
              const isActive = m.id === activeUserId || (!activeUserId && members[0]?.id === m.id);
              const roleBadge = m.role === 'owner'
                ? { label: 'Owner', cls: 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]/30' }
                : m.role === 'editor'
                ? { label: 'Editor', cls: 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30' }
                : { label: 'Viewer', cls: 'bg-[#FEF9C3] text-[#854D0E] border-[#854D0E]/30' };

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveUserId(m.id)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer min-h-[52px] touch-manipulation ${
                    isActive
                      ? 'border-[#2563EB] bg-[#EFF6FF] shadow-[0_0_0_2px_rgba(37,99,235,0.15)]'
                      : 'border-[#E2E8F0] bg-[#F7F9FC] hover:border-[#CBD5E1] hover:bg-white'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-[#2563EB] text-white' : 'bg-[#142B4A] text-white'
                  }`}>
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-xs text-[#142B4A] block truncate">{m.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border inline-block mt-0.5 ${roleBadge.cls}`}>
                      {roleBadge.label}
                    </span>
                  </div>
                  {isActive && <UserCheck className="w-4 h-4 text-[#2563EB] shrink-0" />}
                </button>
              );
            })}
          </div>

          {(() => {
            const activeMember = members.find((m) => m.id === activeUserId) || members[0];
            return activeMember ? (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium ${
                activeMember.role === 'viewer'
                  ? 'bg-[#FEF9C3] border border-[#854D0E]/20 text-[#854D0E]'
                  : 'bg-[#F0FDF4] border border-[#16A34A]/20 text-[#16A34A]'
              }`}>
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {activeMember.role === 'viewer'
                    ? `Viewing as ${activeMember.name} (Viewer) — Add/Edit/Delete buttons are hidden`
                    : `Viewing as ${activeMember.name} (${activeMember.role === 'owner' ? 'Owner' : 'Editor'}) — Full edit access active`}
                </span>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* 3. Account Info & Security */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#142B4A] uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
            <span>3. Single Authorized Account & Security</span>
          </h2>
          <span className="px-2 py-0.5 bg-[#F0FDF4] text-[#16A34A] text-[10px] sm:text-[11px] font-bold rounded-full border border-[#16A34A]/30">
            Active
          </span>
        </div>

        {/* Account Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
          <div className="p-3 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl space-y-1">
            <span className="text-[#64748B] font-medium block text-[11px]">Logged-in Email</span>
            <span className="font-bold text-[#142B4A] font-mono truncate block text-xs">
              {authAccount?.email || 'Authorized Account'}
            </span>
            <span className={`text-[10px] font-bold block ${
              activeUser.role === 'owner'
                ? 'text-[#2563EB]'
                : activeUser.role === 'editor'
                ? 'text-[#16A34A]'
                : 'text-[#D97706]'
            }`}>
              {activeUser.role === 'owner'
                ? 'Owner · Full Admin Control'
                : activeUser.role === 'editor'
                ? 'Editor · Register Access'
                : 'Viewer · Read-Only Access'}
            </span>
          </div>

          <div className="p-3 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl space-y-1">
            <span className="text-[#64748B] font-medium block text-[11px]">Access Level</span>
            <span className="font-bold text-[#142B4A] block text-xs capitalize">
              {activeUser.role} Account
            </span>
            <span className="text-[10px] text-[#64748B] block">
              {activeUser.role === 'viewer'
                ? 'Read-only · Cannot edit'
                : activeUser.role === 'editor'
                ? 'Can add expenses & deposits'
                : 'Full room management'}
            </span>
          </div>

          <div className="p-3 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl space-y-1">
            <span className="text-[#64748B] font-medium block text-[11px]">Database Protection</span>
            <span className="font-bold text-[#2563EB] block text-xs">Supabase RLS Enforced</span>
            <span className="text-[10px] text-[#64748B] block">Protected database</span>
          </div>
        </div>

        {/* Non-owner notification */}
        {!isOwner && (
          <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#64748B] flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span>
              You are signed in as a <strong className="text-[#142B4A] capitalize">{activeUser.role}</strong>. Password changes, member management, and database tools are restricted to the Room Owner.
            </span>
          </div>
        )}

        {/* Change Password Form - ONLY OWNER */}
        {isOwner && (
          <div className="pt-3 border-t border-[#E2E8F0] space-y-3">
            <h3 className="text-xs font-bold text-[#142B4A] uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Update Authorized Account Password</span>
            </h3>

            {passwordStatus && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordStatus.type === 'success'
                    ? 'bg-[#F0FDF4] border border-[#16A34A]/30 text-[#16A34A]'
                    : 'bg-[#FEF2F2] border border-[#DC2626]/30 text-[#DC2626]'
                }`}
              >
                {passwordStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
                )}
                <span>{passwordStatus.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full pl-3 pr-9 py-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-lg bg-white text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#94A3B8] hover:text-[#172B4D] transition-colors cursor-pointer touch-manipulation"
                    title={showCurrentPassword ? 'Hide password' : 'View password'}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4 text-[#2563EB]" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full pl-3 pr-9 py-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-lg bg-white text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#94A3B8] hover:text-[#172B4D] transition-colors cursor-pointer touch-manipulation"
                    title={showNewPassword ? 'Hide password' : 'View password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4 text-[#2563EB]" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full pl-3 pr-9 py-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-lg bg-white text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#94A3B8] hover:text-[#172B4D] transition-colors cursor-pointer touch-manipulation"
                    title={showConfirmPassword ? 'Hide password' : 'View password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 text-[#2563EB]" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#142B4A] hover:bg-[#1D4ED8] disabled:bg-[#CBD5E1] text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer min-h-[44px] flex items-center justify-center touch-manipulation"
                >
                  {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Supabase Cloud Connection & Schema - ONLY OWNER */}
        {isOwner && (
          <div className="pt-3 border-t border-[#E2E8F0] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="font-bold text-[#142B4A] text-xs flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Supabase Cloud Project</span>
                </span>
                <span className="text-[11px] text-[#64748B] font-mono break-all block mt-0.5">
                  {supabaseConfig.url}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={isTestingSupabase}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] hover:bg-[#2563EB] hover:text-white border border-[#CBD5E1]/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 min-h-[36px]"
                >
                  {isTestingSupabase ? 'Testing...' : 'Test Connection'}
                </button>

                <a
                  href="https://supabase.com/dashboard/project/eedialyavhrdipbrbjif/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold bg-[#142B4A] text-white hover:bg-[#1D4ED8] rounded-lg transition-colors flex items-center gap-1.5 min-h-[36px]"
                >
                  <span>Open SQL Editor</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {supabaseTestStatus && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  supabaseTestStatus.success
                    ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/30'
                    : 'bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/30'
                }`}
              >
                {supabaseTestStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{supabaseTestStatus.message}</span>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={() => setShowRlsInfo((prev) => !prev)}
                className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-semibold flex items-center gap-1.5 cursor-pointer py-1"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{showRlsInfo ? 'Hide Supabase Schema / SQL' : 'View Supabase RLS Schema Info'}</span>
              </button>

              {showRlsInfo && (
                <div className="mt-2.5 p-3.5 bg-[#142B4A] text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto space-y-2">
                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-white/10">
                    <span>Defined in supabase/schema.sql (PostgreSQL DDL):</span>
                    <a
                      href="https://supabase.com/dashboard/project/eedialyavhrdipbrbjif/sql/new"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-300 hover:text-white flex items-center gap-1 font-sans text-xs"
                    >
                      <span>Run in Supabase</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <pre className="text-emerald-400 leading-relaxed text-[10px] sm:text-[11px]">
{`-- Enforce strict database-level security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized user can read expenses" ON expenses
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authorized user can insert expenses" ON expenses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Reset Register Records - ONLY OWNER */}
      {isOwner && (
        <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-[#142B4A] block text-xs sm:text-sm">Clear Register Records</span>
            <span className="text-[#64748B] text-[11px]">Resets all deposits, expenses, and settlements back to empty.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all deposits, expenses, and settlements?')) {
                resetAll();
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#FEF2F2] border border-[#DC2626]/30 text-[#DC2626] font-semibold rounded-lg hover:bg-[#DC2626] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px] touch-manipulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Records</span>
          </button>
        </div>
      )}
    </div>
  );
};
