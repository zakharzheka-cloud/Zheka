import type { Tier, TierInfo } from '../types';
import './TopBar.css';

interface Props {
  title: string;
  tiers: TierInfo[];
  activeTier: Tier;
  onChangeTier: (tier: Tier) => void;
  sandboxOpen: boolean;
  onToggleSandbox: () => void;
}

export default function TopBar({ title, tiers, activeTier, onChangeTier, sandboxOpen, onToggleSandbox }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>

      <div className="topbar-right">
        <div className="model-switch">
          {tiers
            .filter((t) => t.id !== 'trial')
            .map((t) => (
              <button
                key={t.id}
                className={'model-pill' + (t.id === activeTier ? ' active' : '')}
                onClick={() => onChangeTier(t.id)}
                title={t.description}
              >
                {t.model}
              </button>
            ))}
        </div>

        <button
          className={'sandbox-toggle' + (sandboxOpen ? ' active' : '')}
          onClick={onToggleSandbox}
        >
          <span className="sandbox-icon" aria-hidden="true">▢</span> Пісочниця
        </button>
      </div>
    </header>
  );
}
