import React from 'react';
import { ArrowRight, HandCoins, ReceiptText, ShieldCheck } from 'lucide-react';
import { Crest } from '../components/Crest';
import schoolHero from '../assets/school-hero.jpg';
import { isLiveSupabaseConfigured } from '../services/supabaseClient';
import { InstallAppButton } from '../components/InstallAppButton';

/**
 * Welcome / onboarding — one fixed phone screen, real photo asset
 * (school-inspired image, not an official school photograph).
 */
export function WelcomeScreen({
  onJoin,
  onLogin,
}: {
  onJoin: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="app-shell app-fixed flex flex-col bg-navy-950" data-testid="welcome-screen">
      <div className="shrink-0 bg-navy-900 px-5 pb-3 pt-5 text-center text-white">
        <div className="flex justify-center">
          <Crest size={58} />
        </div>
        <h1 className="mt-2 text-[24px] font-extrabold leading-[1.1] tracking-tight">
          Have R/C JHS 2022
          <br />
          Old Students
        </h1>
        <p className="mt-1 text-[12.5px] text-navy-200">Stay connected. Track your contributions.</p>
      </div>

      <div className="h-[168px] w-full shrink-0 overflow-hidden sm:h-[190px]">
        <img
          src={schoolHero}
          alt="School building with students in navy and gold uniforms"
          className="h-full w-full object-cover"
          loading="eager"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[#EEF3FA] px-5 pt-4">
        <button type="button" onClick={onJoin} className="btn-gold min-h-[52px] shrink-0 text-[16px]" data-testid="welcome-join">
          Join the Group
          <ArrowRight size={19} />
        </button>
        <button
          type="button"
          onClick={onLogin}
          className="btn mt-2 min-h-[52px] shrink-0 border-2 border-navy-800 bg-white text-[16px] font-bold text-navy-800"
          data-testid="welcome-login"
        >
          Login
        </button>
        <div className="mt-2 shrink-0">
          <InstallAppButton variant="welcome" />
        </div>

        <div className="mt-4 grid shrink-0 grid-cols-3 gap-2 text-center">
          {[
            { icon: <HandCoins size={19} />, label: 'Contributions' },
            { icon: <ReceiptText size={19} />, label: 'Expenses' },
            { icon: <ShieldCheck size={19} />, label: 'Transparency' },
          ].map((f) => (
            <div key={f.label} className="rounded-2xl border border-[#E3ECF7] bg-white px-1 py-2.5 shadow-card">
              <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-gold-400">
                {f.icon}
              </span>
              <p className="mt-1 truncate text-[11px] font-extrabold text-navy-950">{f.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-auto shrink-0 pb-4 pt-3 text-center text-[10.5px] text-slate-400">
          {isLiveSupabaseConfigured ? 'Connected to Supabase' : 'Demo mode · New members need admin approval'}
        </p>
      </div>
    </div>
  );
}
