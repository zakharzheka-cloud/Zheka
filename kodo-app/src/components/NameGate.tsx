import { useState } from 'react';
import './NameGate.css';

interface Props {
  onSubmit: (name: string) => void;
}

export default function NameGate({ onSubmit }: Props) {
  const [name, setName] = useState('');

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div className="name-gate">
      <div className="name-gate-card">
        <div className="name-gate-brand">
          <div className="name-gate-mark">K</div>
          <span className="name-gate-brand-text">Kodo</span>
        </div>
        <h1 className="name-gate-title">Як тебе звати?</h1>
        <p className="name-gate-subtitle">Використаємо ім'я, щоб звертатись до тебе особисто.</p>
        <input
          className="name-gate-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Твоє ім'я"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <button className="name-gate-btn" onClick={submit} disabled={!name.trim()}>
          Продовжити
        </button>
      </div>
    </div>
  );
}
