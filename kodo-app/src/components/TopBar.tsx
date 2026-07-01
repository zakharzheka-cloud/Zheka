import type { Tier, TierInfo } from '../types';
import './TopBar.css';

interface Props {
  title: string;
  tiers: TierInfo[];
  activeTier: Tier;
  onChangeTier: (tier: Tier) => void;
  sandboxOpen: boolean;
  onToggleSandbox: () => void;
  onOpenSidebar: () => void;
}

export default function TopBar({ title, tiers, activeTier, onChangeTier, sandboxOpen, onToggleSandbox, onOpenSidebar }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-toggle" onClick={onOpenSidebar} aria-label="Відкрити меню">
          ☰
        </button>
        <div className="topbar-title">{title}</div>
      </div>

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
