import React from 'react';
import { Home, HandCoins, Wallet, Users, Menu } from 'lucide-react';
import type { TabKey } from '../context/AppContext';

const ITEMS: Array<{ key: TabKey; label: string; Icon: typeof Home }> = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'contributions', label: 'Contributions', Icon: HandCoins },
  { key: 'fund', label: 'Group Fund', Icon: Wallet },
  { key: 'members', label: 'Members', Icon: Users },
  { key: 'more', label: 'More', Icon: Menu },
];

export function BottomNav({
  active,
  onChange,
  pendingCount = 0,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  pendingCount?: number;
}) {
  return (
    <nav className="tab-bar" aria-label="Main navigation">
      <div className="flex items-stretch">
        {ITEMS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`tab-${key}`}
              className={`tab-item relative ${isActive ? 'text-navy-900' : 'text-slate-400'}`}
            >
              <span className={`relative flex h-7 w-12 items-center justify-center rounded-full transition ${isActive ? 'bg-navy-50' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.6 : 2} aria-hidden />
                {key === 'more' && pendingCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B8392F] px-1 text-[9.5px] font-bold text-white">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                ) : null}
              </span>
              <span className="leading-none">{label}</span>
              {isActive ? <span className="absolute bottom-0 h-[3px] w-8 rounded-t-full bg-gold-500" /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
