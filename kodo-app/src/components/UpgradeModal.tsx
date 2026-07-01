import type { Tier, TierInfo } from '../types';
import './UpgradeModal.css';

interface Props {
  tiers: TierInfo[];
  activeTier: Tier;
  onSelect: (tier: Tier) => void;
  onClose: () => void;
}

export default function UpgradeModal({ tiers, activeTier, onSelect, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Обери підписку</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p className="modal-subtitle">7 днів безкоштовно, потім автоматичне продовження. Скасувати можна будь-коли.</p>

        <div className="tier-grid">
          {tiers.map((t) => (
            <div key={t.id} className={'tier-option' + (t.id === activeTier ? ' selected' : '')}>
              {t.id === 'pro' && <div className="tier-badge">Найпопулярніша</div>}
              <div className="tier-option-name">{t.name}</div>
              <div className="tier-option-price">{t.price}</div>
              <div className="tier-option-model">{t.model}</div>
              <p className="tier-option-desc">{t.description}</p>
              <button className="tier-select-btn" onClick={() => onSelect(t.id)}>
                {t.id === activeTier ? 'Активний тариф' : 'Обрати'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
