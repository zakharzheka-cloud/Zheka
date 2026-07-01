import { useEffect, useRef, useState } from 'react';
import type { Message } from '../types';
import MessageBubble from './MessageBubble';
import './ChatPanel.css';

interface Props {
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => void;
  onRunCode: (code: string, language: string) => void;
}

const SUGGESTIONS = [
  'Поясни, що таке рекурсія',
  'Напиши гру "Змійка" на Python',
  'Що таке масиви у JavaScript?',
  'Створи просту HTML-сторінку з формою',
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Доброї ночі';
  if (hour < 12) return 'Доброго ранку';
  if (hour < 18) return 'Доброго дня';
  return 'Доброго вечора';
}

export default function ChatPanel({ messages, loading, onSend, onRunCode }: Props) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, loading]);

  function submit() {
    const text = draft.trim();
    if (!text || loading) return;
    onSend(text);
    setDraft('');
  }

  return (
    <div className="chat-panel">
      <div className="message-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">{greeting()}!</div>
            <div className="empty-subtitle">Чим допомогти?</div>
            <div className="empty-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => onSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} onRunCode={onRunCode} />)
        )}
        {loading && (
          <div className="message-row">
            <div className="avatar assistant-avatar">K</div>
            <div className="bubble assistant-bubble typing-bubble">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      <div className="composer">
        <textarea
          className="composer-input"
          placeholder="Запитай про будь-яку тему або мову програмування..."
          value={draft}
          rows={1}
          disabled={loading}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className="send-btn" onClick={submit} disabled={!draft.trim() || loading}>
          ↑
        </button>
      </div>
      <div className="composer-hint">Kodo може помилятись. Код виконується лише в ізольованій пісочниці.</div>
    </div>
  );
}
