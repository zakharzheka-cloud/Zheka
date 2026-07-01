import type { Conversation, TierInfo } from '../types';
import './Sidebar.css';

interface Props {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  tier: TierInfo;
  onOpenUpgrade: () => void;
}

export default function Sidebar({ conversations, activeId, onSelect, onNewChat, tier, onOpenUpgrade }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">K</div>
        <span className="brand-name">Kodo</span>
      </div>

      <button className="new-chat-btn" onClick={onNewChat}>
        <span className="plus">+</span> Новий чат
      </button>

      <div className="conversation-list">
        <div className="list-label">Розмови</div>
        {conversations.map((c) => (
          <button
            key={c.id}
            className={'conversation-item' + (c.id === activeId ? ' active' : '')}
            onClick={() => onSelect(c.id)}
          >
            {c.title}
          </button>
        ))}
      </div>

      <button className="tier-card" onClick={onOpenUpgrade}>
        <div className="tier-card-row">
          <span className="tier-dot" />
          <span className="tier-name">{tier.name}</span>
        </div>
        <div className="tier-price">{tier.price}</div>
        <div className="tier-upgrade">Керувати підпискою →</div>
      </button>
    </aside>
  );
}
