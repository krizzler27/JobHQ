import React from 'react';

export const AppLoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse max-w-[1440px] w-full mx-auto">
      {/* Top Banner / Sync Status Placeholder */}
      <div className="h-16 rounded-2xl bg-stone-200/60 dark:bg-[#1a2233] border border-[#e5e3dc] dark:border-slate-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-300 dark:bg-slate-700" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 rounded bg-stone-300 dark:bg-slate-700" />
            <div className="h-2 w-48 rounded bg-stone-300/70 dark:bg-slate-700/60" />
          </div>
        </div>
        <div className="h-8 w-24 rounded-lg bg-stone-300/80 dark:bg-slate-700" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="studio-card rounded-2xl p-5 border border-[#e5e3dc] dark:border-slate-800 bg-white dark:bg-[#131926] space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-stone-200 dark:bg-slate-750" />
              <div className="w-6 h-6 rounded bg-stone-200 dark:bg-slate-750" />
            </div>
            <div className="h-7 w-14 rounded bg-stone-300 dark:bg-slate-700" />
            <div className="h-2 w-28 rounded bg-stone-200/70 dark:bg-slate-750" />
          </div>
        ))}
      </div>

      {/* Main Content Area: Left & Right Split or Large Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 studio-card rounded-2xl p-6 border border-[#e5e3dc] dark:border-slate-800 bg-white dark:bg-[#131926] space-y-4 shadow-xs h-[380px]">
          <div className="flex items-center justify-between border-b border-[#eeece6] dark:border-slate-800/80 pb-3">
            <div className="h-4 w-36 rounded bg-stone-300 dark:bg-slate-700" />
            <div className="h-6 w-20 rounded bg-stone-200 dark:bg-slate-800" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center justify-between py-2 border-b border-[#f6f5f2] dark:border-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-200 dark:bg-slate-800" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-40 rounded bg-stone-300 dark:bg-slate-700" />
                    <div className="h-2 w-24 rounded bg-stone-200 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="h-6 w-16 rounded-full bg-stone-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>

        <div className="studio-card rounded-2xl p-6 border border-[#e5e3dc] dark:border-slate-800 bg-white dark:bg-[#131926] space-y-4 shadow-xs h-[380px]">
          <div className="flex items-center justify-between border-b border-[#eeece6] dark:border-slate-800/80 pb-3">
            <div className="h-4 w-28 rounded bg-stone-300 dark:bg-slate-700" />
            <div className="w-5 h-5 rounded bg-stone-200 dark:bg-slate-800" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((row) => (
              <div key={row} className="p-3 rounded-xl bg-[#f6f5f2]/70 dark:bg-slate-800/40 space-y-2 border border-[#eeece6] dark:border-slate-850">
                <div className="h-3 w-32 rounded bg-stone-300 dark:bg-slate-700" />
                <div className="h-2 w-20 rounded bg-stone-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
