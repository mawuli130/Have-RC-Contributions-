import React from 'react';
import { ArrowRight, Coins, HandCoins, LineChart, Lock, ReceiptText, ShieldCheck, Users } from 'lucide-react';
import { SchoolHero } from '../components/SchoolHero';
import { isLiveSupabaseConfigured } from '../services/supabaseClient';

export function WelcomeScreen({
  onJoin,
  onLogin,
}: {
  onJoin: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="app-shell pb-10">
      <div className="px-4 pt-4">
        <SchoolHero />

        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">
            Welcome back, old students
          </p>
          <h1 className="mt-1.5 text-[27px] font-extrabold leading-[1.15] tracking-tight text-navy-950">
            Our group fund,
            <br />
            <span className="text-navy-700">open for everyone to see.</span>
          </h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-slate-600">
            A simple way for the Have R/C JHS 2022 Old Students to track contributions, see who has
            paid, follow every group expense, and know exactly how the fund is doing.
          </p>
        </div>

        <div className="mt-5 space-y-2.5">
          <button type="button" onClick={onJoin} className="btn-gold" data-testid="welcome-join">
            Join the Group
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={onLogin} className="btn-outline" data-testid="welcome-login">
            Login to my account
          </button>
        </div>

        <div className="mt-6">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-navy-700">
            What you can see inside
          </h2>
          <div className="mt-2.5 grid grid-cols-1 gap-2.5">
            {[
              {
                icon: <HandCoins size={18} />,
                title: 'Contributions',
                text: 'Your own payments, what is outstanding, and the status of every approved member.',
              },
              {
                icon: <ReceiptText size={18} />,
                title: 'Expenses',
                text: 'Every cedi spent, with the reason, the date, and who recorded it.',
              },
              {
                icon: <LineChart size={18} />,
                title: 'Recorded balance',
                text: 'Money received minus money spent — calculated from the records, not a guess.',
              },
              {
                icon: <Users size={18} />,
                title: 'Members',
                text: 'A clear directory so everyone knows where the group stands.',
              },
            ].map((item) => (
              <div key={item.title} className="card flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-gold-400">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-navy-950">{item.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#E3D2A8] bg-[#FFFBF0] p-3.5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#8A5A08]">
            <ShieldCheck size={15} /> Transparency with privacy
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#7A5A20]">
            Contribution status is shared with approved members so the group stays fair. Payment
            receipts, transaction references and private notes stay private to you and the treasurer.
          </p>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white p-3.5 border border-[#E8EEF7]">
          <Lock size={15} className="mt-0.5 shrink-0 text-navy-500" />
          <p className="text-[12px] leading-relaxed text-slate-500">
            New registrations are marked <strong className="text-navy-800">Awaiting Approval</strong> until
            an administrator approves them. Financial records are hidden until then.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Coins size={13} />
          <span>
            {isLiveSupabaseConfigured
              ? 'Connected to Supabase'
              : 'Demo data mode — connect Supabase in .env for live records'}
          </span>
        </div>
      </div>
    </div>
  );
}
