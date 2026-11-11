import React from 'react';
import { usePWAInstall } from '../../lib/pwa';
import { Smartphone, X, Share, MoreVertical } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    showIOSInstructions,
    setShowIOSInstructions,
    triggerInstall,
  } = usePWAInstall();

  // If already installed (standalone mode), don't show prompt
  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => triggerInstall()}
        className={`inline-flex items-center justify-center gap-1.5 font-bold rounded-lg transition-all cursor-pointer shadow-xs ${
          compact
            ? 'px-2 py-1 text-[11px] bg-[#EFF6FF] text-[#2563EB] hover:bg-[#2563EB] hover:text-white border border-[#2563EB]/30'
            : 'px-3 py-1.5 text-xs bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-md shadow-[#2563EB]/20'
        }`}
        title="Install RoomLedger app on your phone"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>

      {/* Install Instructions Modal (for iOS or manual browser install) */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#E2E8F0] space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#142B4A]">
                    {isIOS ? 'Install on iPhone / iPad' : 'Install RoomLedger App'}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">Add RoomLedger to your Home Screen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSInstructions(false)}
                className="p-1 rounded-md text-[#94A3B8] hover:text-[#172B4D] hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#334155] leading-relaxed">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      Tap the <strong className="text-[#142B4A] inline-flex items-center gap-1 font-semibold"><Share className="w-3.5 h-3.5 text-[#2563EB]" /> Share</strong> icon at the bottom of Safari.
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      Scroll down and tap <strong className="text-[#142B4A] font-semibold">"Add to Home Screen"</strong> (➕).
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      Tap <strong className="text-[#2563EB] font-bold">Add</strong> in the top right corner. You're done!
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      Tap your browser's menu <strong className="text-[#142B4A] inline-flex items-center gap-1 font-semibold"><MoreVertical className="w-3.5 h-3.5 text-[#2563EB]" /> (three dots)</strong> at the top right.
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      Select <strong className="text-[#142B4A] font-semibold">"Install App"</strong> or <strong className="text-[#142B4A] font-semibold">"Add to Home Screen"</strong>.
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      Tap <strong className="text-[#2563EB] font-bold">Install</strong>. RoomLedger will appear as a standalone app!
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowIOSInstructions(false)}
              className="w-full py-2.5 bg-[#2563EB] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#1D4ED8] transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

