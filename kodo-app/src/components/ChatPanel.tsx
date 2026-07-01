import { useEffect, useRef, useState } from 'react';
import type { Message } from '../types';
import MessageBubble from './MessageBubble';
import './ChatPanel.css';

interface Props {
  messages: Message[];
  loading: boolean;
  username: string;
  onSend: (text: string) => void;
  onRunCode: (code: string, language: string) => void;
}

export default function ChatPanel({ messages, loading, username, onSend, onRunCode }: Props) {
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
            <div className="empty-title">Вітаю, {username}!</div>
            <div className="empty-subtitle">Чим допомогти?</div>
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
