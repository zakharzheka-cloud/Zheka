import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ChatPanel from './components/ChatPanel';
import SandboxPanel from './components/SandboxPanel';
import UpgradeModal from './components/UpgradeModal';
import NameGate from './components/NameGate';
import { mockConversations } from './data/mockData';
import { sendChat } from './api';
import { TIERS } from './types';
import type { Conversation, Message, Tier } from './types';
import './App.css';

const USERNAME_KEY = 'kodo_username';

export default function App() {
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USERNAME_KEY));
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeId, setActiveId] = useState(mockConversations[0].id);
  const [tier, setTier] = useState<Tier>('trial');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [sandbox, setSandbox] = useState<{ code: string; language: string } | null>(null);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const active = conversations.find((c) => c.id === activeId)!;
  const activeTierInfo = TIERS.find((t) => t.id === tier)!;

  function appendMessage(conversationId: string, message: Message, titleFromFirst?: string) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              title: titleFromFirst && c.messages.length === 0 ? titleFromFirst : c.title,
              messages: [...c.messages, message],
            }
          : c
      )
    );
  }

  async function sendMessage(text: string, targetId?: string) {
    const conversationId = targetId ?? activeId;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text, createdAt: Date.now() };
    const priorMessages = targetId ? [] : active.messages;
    const history = [...priorMessages, userMsg];
    appendMessage(conversationId, userMsg, targetId ? undefined : text.slice(0, 40));

    setLoading(true);
    try {
      const result = await sendChat(history, tier);
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: result.text,
        createdAt: Date.now(),
        citations: result.citations,
      };
      appendMessage(conversationId, assistantMsg);
    } catch (err) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `⚠️ ${err instanceof Error ? err.message : 'Не вдалося звʼязатися з AI-бекендом.'}`,
        createdAt: Date.now(),
      };
      appendMessage(conversationId, errorMsg);
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    const id = crypto.randomUUID();
    setConversations((prev) => [{ id, title: 'Нова розмова', messages: [] }, ...prev]);
    setActiveId(id);
  }

  function startLanguageChat(language: string) {
    const id = crypto.randomUUID();
    setConversations((prev) => [{ id, title: language, messages: [] }, ...prev]);
    setActiveId(id);
    sendMessage(`Хочу вивчати ${language}. З чого почати?`, id);
  }

  function runCode(code: string, language: string) {
    setSandbox({ code, language });
    setSandboxOpen(true);
  }

  if (!username) {
    return (
      <NameGate
        onSubmit={(name) => {
          localStorage.setItem(USERNAME_KEY, name);
          setUsername(name);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNewChat={newChat}
        onSelectLanguage={startLanguageChat}
        tier={activeTierInfo}
        onOpenUpgrade={() => setUpgradeOpen(true)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-column">
        <TopBar
          title={active.title}
          tiers={TIERS}
          activeTier={tier}
          onChangeTier={setTier}
          sandboxOpen={sandboxOpen}
          onToggleSandbox={() => setSandboxOpen((v) => !v)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <div className="workspace">
          <ChatPanel
            messages={active.messages}
            loading={loading}
            username={username}
            onSend={sendMessage}
            onRunCode={runCode}
          />
          {sandboxOpen && (
            <SandboxPanel
              code={sandbox?.code ?? ''}
              language={sandbox?.language ?? ''}
              onClose={() => setSandboxOpen(false)}
            />
          )}
        </div>
      </div>

      {upgradeOpen && (
        <UpgradeModal
          tiers={TIERS}
          activeTier={tier}
          onSelect={(t) => {
            setTier(t);
            setUpgradeOpen(false);
          }}
          onClose={() => setUpgradeOpen(false)}
        />
      )}
    </div>
  );
}
