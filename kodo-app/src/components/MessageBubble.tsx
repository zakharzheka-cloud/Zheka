import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types';
import CodeBlock from './CodeBlock';
import './MessageBubble.css';

interface Props {
  message: Message;
  onRunCode?: (code: string, language: string) => void;
}

export default function MessageBubble({ message, onRunCode }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={'message-row' + (isUser ? ' user' : '')}>
      {!isUser && <div className="avatar assistant-avatar">K</div>}
      <div className={'bubble' + (isUser ? ' user-bubble' : ' assistant-bubble')}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code(props) {
              const { className, children } = props;
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match;
              if (isInline) {
                return <code className="inline-code">{children}</code>;
              }
              return (
                <CodeBlock
                  language={match ? match[1] : ''}
                  code={String(children).replace(/\n$/, '')}
                  onRun={onRunCode}
                />
              );
            },
          }}
        >
          {message.text}
        </ReactMarkdown>
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="citations">
            <div className="citations-label">Джерела:</div>
            {dedupeCitations(message.citations).map((c) => (
              <a key={c.url} className="citation-link" href={c.url} target="_blank" rel="noreferrer">
                {c.title || c.url}
              </a>
            ))}
          </div>
        )}
      </div>
      {isUser && <div className="avatar user-avatar">Т</div>}
    </div>
  );
}

function dedupeCitations(citations: NonNullable<Message['citations']>) {
  const seen = new Set<string>();
  return citations.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}
