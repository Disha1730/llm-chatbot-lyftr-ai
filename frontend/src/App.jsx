import React, { useState, useEffect, useRef } from 'react';
import { Bot, RefreshCw, AlertCircle, ShieldAlert, CheckCircle2, Terminal } from 'lucide-react';
import ChatInput from './components/ChatInput';
import UserMessage from './components/UserMessage';
import AssistantMessage from './components/AssistantMessage';
import SystemPromptInput from './components/SystemPromptInput';
import { sendChatMessage, checkHealth } from './services/api';

function generateSessionId() {
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `s-${randomPart}`;
}

export default function App() {
  // A new session starts on each page load
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [simulationHeader, setSimulationHeader] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Check backend health on initial load
  useEffect(() => {
    checkHealth()
      .then((data) => setBackendHealth({ status: 'ok', data }))
      .catch((err) => setBackendHealth({ status: 'error', error: err.message }));
  }, []);

  const handleStartNewSession = () => {
    setSessionId(generateSessionId());
    setMessages([]);
  };

  const handleSendMessage = async (userText) => {
    if (!userText.trim() || isLoading) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        sessionId,
        message: userText,
        systemPrompt: systemPrompt || undefined,
        simulationHeader: simulationHeader || undefined,
      });

      const assistantMsg = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        metadata: response.metadata,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      // Errors (422, 503, etc.) show as a readable message in the chat, never a blank screen
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'error',
        content: err.message || 'An error occurred while connecting to the assistant.',
        status: err.status,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen bg-[#08090d] text-zinc-100 overflow-hidden font-sans selection:bg-emerald-500/25">
      {/* Liquid Glass Ambient Backlight Elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-600/10 blur-[128px]" />
        <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-teal-600/[0.07] blur-[150px]" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-amber-600/[0.08] blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.06),rgba(255,255,255,0))]" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 flex items-center justify-between px-5 py-3.5 liquid-glass border-b border-white/[0.08]">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.18)]">
            <Bot className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white">Lyftr AI Gateway</h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20 backdrop-blur-sm">
                Failover & Cache
              </span>
            </div>
            <div className="text-xs text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5">
              <span>Session:</span>
              <span className="text-zinc-200 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-md">{sessionId}</span>
            </div>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-3">
          {backendHealth?.status === 'ok' ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs backdrop-blur-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{backendHealth.data.keys_configured} Keys Ready</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs backdrop-blur-md">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Connected</span>
            </div>
          )}

          <button
            onClick={handleStartNewSession}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl transition-all shadow-sm"
            title="Start new conversation session"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">New Session</span>
          </button>
        </div>
      </header>

      {/* Control Drawer / Toolbar */}
      <section className="relative z-10 liquid-glass-subtle border-b border-white/[0.06] px-5 py-2.5 flex flex-col md:flex-row gap-3.5 items-center justify-between">
        <div className="w-full md:w-1/2">
          <SystemPromptInput value={systemPrompt} onChange={setSystemPrompt} />
        </div>

        {/* Failover Test Hook (X-Simulate-Failure) */}
        <div className="w-full md:w-1/2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              Failover Test Hook (X-Simulate-Failure)
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">Demo Control</span>
          </label>
          <div className="flex gap-2">
            <select
              value={simulationHeader}
              onChange={(e) => setSimulationHeader(e.target.value)}
              className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono transition-colors"
            >
              <option value="" className="bg-[#12151c] text-zinc-200">None (Normal Inference)</option>
              <option value="key_1=429" className="bg-[#12151c] text-zinc-200">key_1=429 (Simulate Rate Limit on Key 1 &rarr; Key 2)</option>
              <option value="key_1=500" className="bg-[#12151c] text-zinc-200">key_1=500 (Simulate Server Error on Key 1 &rarr; Key 2)</option>
              <option value="*=429" className="bg-[#12151c] text-zinc-200">*=429 (Simulate All Keys Failing &rarr; 503)</option>
              <option value="custom" className="bg-[#12151c] text-zinc-200">Custom Header...</option>
            </select>
            {simulationHeader === 'custom' && (
              <input
                type="text"
                placeholder="key_1=429,key_2=500"
                onChange={(e) => setSimulationHeader(e.target.value)}
                className="w-1/2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500/50"
              />
            )}
          </div>
        </div>
      </section>

      {/* Messages Scroll Area */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
              <div className="w-16 h-16 rounded-3xl liquid-glass flex items-center justify-center mb-5 text-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.18)]">
                <Bot className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-100 mb-1.5">
                Lyftr AI Full-Stack Assistant
              </h2>
              <p className="text-xs text-zinc-400 max-w-md leading-relaxed mb-7">
                Featuring multi-turn SQLite persistence, automatic key failover across provider pools,
                and sub-millisecond response caching.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-xl text-left text-xs">
                <button
                  onClick={() => handleSendMessage('What is the capital of France?')}
                  className="p-3.5 liquid-glass hover:bg-white/[0.06] rounded-2xl transition-all text-zinc-300 hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <span className="font-semibold text-emerald-400 block mb-1 group-hover:text-emerald-300">
                    1. Live Inference
                  </span>
                  "What is the capital of France?"
                </button>
                <button
                  onClick={() => handleSendMessage('What is the capital of France?')}
                  className="p-3.5 liquid-glass hover:bg-white/[0.06] rounded-2xl transition-all text-zinc-300 hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <span className="font-semibold text-teal-400 block mb-1 group-hover:text-teal-300">
                    2. Response Cache
                  </span>
                  Send again for LLM_CACHE hit
                </button>
                <button
                  onClick={() => {
                    setSimulationHeader('key_1=429');
                    handleSendMessage('Explain quantum computing in one sentence.');
                  }}
                  className="p-3.5 liquid-glass hover:bg-white/[0.06] rounded-2xl transition-all text-zinc-300 hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <span className="font-semibold text-amber-400 block mb-1 group-hover:text-amber-300">
                    3. Failover Demo
                  </span>
                  Simulate key_1=429 failover
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.role === 'user') {
                return <UserMessage key={msg.id} message={msg} />;
              } else if (msg.role === 'assistant') {
                return <AssistantMessage key={msg.id} message={msg} />;
              } else if (msg.role === 'error') {
                return (
                  <div
                    key={msg.id}
                    className="flex items-start gap-3.5 p-4 liquid-glass border border-rose-500/35 rounded-3xl text-rose-200 text-sm max-w-2xl self-start bg-rose-950/20 backdrop-blur-xl shadow-[0_0_25px_rgba(244,63,94,0.1)]"
                  >
                    <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-rose-300 mb-0.5">
                        {msg.status ? `Error (HTTP ${msg.status})` : 'Request Error'}
                      </div>
                      <div className="text-xs text-rose-200/90 leading-relaxed">{msg.content}</div>
                    </div>
                  </div>
                );
              }
              return null;
            })
          )}

          {isLoading && (
            <div className="flex items-center gap-2.5 p-3.5 liquid-glass rounded-2xl text-zinc-300 text-xs self-start shadow-[0_0_20px_rgba(16,185,129,0.12)]">
              <Bot className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>Generating response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="relative z-10 p-4 liquid-glass border-t border-white/[0.08]">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
        </div>
      </footer>
    </div>
  );
}
