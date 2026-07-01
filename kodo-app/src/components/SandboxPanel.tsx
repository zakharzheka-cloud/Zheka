import { useMemo, useState } from 'react';
import './SandboxPanel.css';

interface Props {
  code: string;
  language: string;
  onClose: () => void;
}

type Tab = 'preview' | 'code';

const RUNNABLE_IN_BROWSER = new Set(['javascript', 'js', 'html']);

export default function SandboxPanel({ code, language, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('preview');

  const previewDoc = useMemo(() => {
    if (!code) return '';
    if (language === 'html') return code;
    return `<!doctype html><html><body style="font-family:ui-monospace,monospace;background:#0f1117;color:#eef0f6;padding:12px;margin:0;font-size:13px;">
<div id="out"></div>
<script>
  const log = [];
  const write = (...a) => { log.push(a.map(String).join(' ')); document.getElementById('out').innerText = log.join('\\n'); };
  console.log = write;
  try { ${code} } catch (e) { write('Помилка: ' + e.message); }
<\/script>
</body></html>`;
  }, [code, language]);

  const canRun = RUNNABLE_IN_BROWSER.has(language.toLowerCase());

  return (
    <aside className="sandbox-panel">
      <div className="sandbox-header">
        <div className="sandbox-tabs">
          <button className={'sandbox-tab' + (tab === 'preview' ? ' active' : '')} onClick={() => setTab('preview')}>
            Прев'ю
          </button>
          <button className={'sandbox-tab' + (tab === 'code' ? ' active' : '')} onClick={() => setTab('code')}>
            Код
          </button>
        </div>
        <button className="sandbox-close" onClick={onClose}>×</button>
      </div>

      <div className="sandbox-status">
        <span className="sandbox-status-dot" />
        Ізольована пісочниця · без мережі · без доступу до диска
      </div>

      <div className="sandbox-body">
        {tab === 'code' && <pre className="sandbox-code">{code || '// Немає коду для показу'}</pre>}
        {tab === 'preview' &&
          (canRun ? (
            <iframe
              className="sandbox-iframe"
              sandbox="allow-scripts"
              srcDoc={previewDoc}
              title="sandbox-preview"
            />
          ) : (
            <div className="sandbox-fallback">
              <div className="sandbox-fallback-lang">{language || 'код'}</div>
              <p>
                Виконання коду мовою «{language}» відбувається на сервері в ізольованому
                контейнері без доступу до мережі й файлової системи хоста. У цьому веб-прототипі
                показуємо тільки JS/HTML наживо — реальний бекенд-сандбокс підʼєднається на
                наступному етапі.
              </p>
            </div>
          ))}
      </div>
    </aside>
  );
}
