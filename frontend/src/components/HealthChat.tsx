import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'How much water should I drink daily?',
  'What are the best post-workout meals?',
  'How can I reduce belly fat while gaining muscle?',
  'What supplements should I consider for body recomp?',
  'How do I break through a weight loss plateau?',
  'What are signs of overtraining?',
];

function formatMessage(text: string) {
  // Simple markdown-like formatting
  return text.split('\n').map((line, i) => {
    // Bold
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    if (line.match(/^[-•]\s/)) {
      return `<li key="${i}" class="ml-4 mb-1">${line.replace(/^[-•]\s/, '')}</li>`;
    }
    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      return `<li key="${i}" class="ml-4 mb-1 list-decimal">${line.replace(/^\d+\.\s/, '')}</li>`;
    }
    if (line.trim() === '') return '<br/>';
    return `<p key="${i}" class="mb-1.5">${line}</p>`;
  }).join('');
}

export default function HealthChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading) return;

    const userMsg: Message = { role: 'user', content: q };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const { answer } = await api.askHealth(q, newMessages.slice(0, -1));
      setMessages([...newMessages, { role: 'assistant', content: answer }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setMessages([...newMessages, { role: 'assistant', content: `Sorry, I encountered an error: ${msg}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Ask AI</h1>
          <p className="text-slate-500 text-sm mt-1">Get personalized health & fitness advice</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="btn-secondary flex items-center gap-2 text-sm py-2 px-3"
          >
            <Trash2 size={14} />
            Clear Chat
          </button>
        )}
      </div>

      {/* Chat Area */}
      <div className="card min-h-[500px] flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-[500px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/20 mb-4">
                <Sparkles size={28} className="text-emerald-400" />
              </div>
              <h2 className="text-white font-semibold text-lg mb-2">Health AI Assistant</h2>
              <p className="text-slate-500 text-sm text-center max-w-md mb-8">
                Ask me anything about nutrition, exercise, supplements, weight loss, muscle building, or general health. I'll tailor my answers to your goals and data.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="text-left text-sm text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] rounded-xl px-4 py-3 transition-all duration-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Bot size={16} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-500/15 border border-emerald-500/20 text-white'
                    : 'bg-white/[0.04] border border-white/[0.06] text-slate-300'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-3 pt-3 border-t border-white/[0.06]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a health question..."
            rows={1}
            className="input resize-none flex-1"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="btn-primary px-4 flex items-center gap-2 shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-slate-600 text-[11px] mt-2 text-center">
          AI responses are for informational purposes only and not a substitute for professional medical advice.
        </p>
      </div>
    </div>
  );
}
