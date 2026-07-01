import { useState } from 'react';
import type { Conversation, TierInfo } from '../types';
import './Sidebar.css';

interface Props {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onSelectLanguage: (language: string) => void;
  tier: TierInfo;
  onOpenUpgrade: () => void;
  open: boolean;
  onClose: () => void;
}

const LANGUAGES = ['Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'PHP'];

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onSelectLanguage,
  tier,
  onOpenUpgrade,
  open,
  onClose,
}: Props) {
  const [codeOpen, setCodeOpen] = useState(false);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="sidebar-brand">
          <div className="brand-mark">K</div>
          <span className="brand-name">Kodo</span>
          <button className="sidebar-close" onClick={onClose} aria-label="Закрити меню">
            ×
          </button>
        </div>

        <div className="top-actions">
          <button
            className="new-chat-btn"
            onClick={() => {
              onNewChat();
              onClose();
            }}
          >
            <span className="plus">+</span> Новий чат
          </button>

          <button className="code-btn" onClick={() => setCodeOpen((v) => !v)}>
            <span className="code-icon">{'</>'}</span> Code
          </button>

          {codeOpen && (
            <div className="language-list">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  className="language-item"
                  onClick={() => {
                    onSelectLanguage(lang);
                    setCodeOpen(false);
                    onClose();
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="conversation-list">
          <div className="list-label">Розмови</div>
          {conversations.map((c) => (
            <button
              key={c.id}
              className={'conversation-item' + (c.id === activeId ? ' active' : '')}
              onClick={() => {
                onSelect(c.id);
                onClose();
              }}
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
    </>
  );
}
