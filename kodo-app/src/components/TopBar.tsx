import { useState } from 'react';
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
  const [moreOpen, setMoreOpen] = useState(false);
  const selectableTiers = tiers.filter((t) => t.id !== 'trial');

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
          {selectableTiers.map((t) => (
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

        <button className={'sandbox-toggle' + (sandboxOpen ? ' active' : '')} onClick={onToggleSandbox}>
          <span className="sandbox-icon" aria-hidden="true">▢</span> Пісочниця
        </button>

        <button className="more-toggle" onClick={() => setMoreOpen(true)} aria-label="Ще опції">
          ⋯
        </button>
      </div>

      {moreOpen && (
        <>
          <div className="more-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="more-sheet">
            <div className="more-label">Модель</div>
            {selectableTiers.map((t) => (
              <button
                key={t.id}
                className={'more-item' + (t.id === activeTier ? ' active' : '')}
                onClick={() => {
                  onChangeTier(t.id);
                  setMoreOpen(false);
                }}
              >
                {t.model}
                <span className="more-item-sub">{t.name}</span>
              </button>
            ))}
            <div className="more-divider" />
            <button
              className={'more-item' + (sandboxOpen ? ' active' : '')}
              onClick={() => {
                onToggleSandbox();
                setMoreOpen(false);
              }}
            >
              ▢ Пісочниця
            </button>
          </div>
        </>
      )}
    </header>
  );
}
