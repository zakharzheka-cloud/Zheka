import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './CodeBlock.css';

interface Props {
  language: string;
  code: string;
  onRun?: (code: string, language: string) => void;
}

export default function CodeBlock({ language, code, onRun }: Props) {
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang">{language || 'text'}</span>
        <div className="code-actions">
          {onRun && (
            <button className="code-run-btn" onClick={() => onRun(code, language)}>
              ▶ Виконати в пісочниці
            </button>
          )}
          <button className="code-copy-btn" onClick={() => navigator.clipboard.writeText(code)}>
            Копіювати
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{ margin: 0, borderRadius: '0 0 10px 10px', fontSize: '13px', padding: '14px', overflowX: 'auto', maxWidth: '100%' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
