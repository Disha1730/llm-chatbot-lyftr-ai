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
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700/80 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white">Lyftr AI Gateway</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20">
                Failover & Cache
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <span>Session:</span>
              <span className="text-slate-200 bg-slate-700/50 px-1.5 py-0.2 rounded">{sessionId}</span>
            </div>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-3">
          {backendHealth?.status === 'ok' ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{backendHealth.data.keys_configured} Keys Ready</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Connecting Backend...</span>
            </div>
          )}

          <button
            onClick={handleStartNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-lg transition-all"
            title="Start new conversation session"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Session</span>
          </button>
        </div>
      </header>

      {/* Control Drawer / Toolbar */}
      <section className="bg-slate-800/40 border-b border-slate-800 px-4 py-2 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-1/2">
          <SystemPromptInput value={systemPrompt} onChange={setSystemPrompt} />
        </div>

        {/* Failover Test Hook (X-Simulate-Failure) */}
        <div className="w-full md:w-1/2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              Failover Test Hook (X-Simulate-Failure)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Demo Control</span>
          </label>
          <div className="flex gap-2">
            <select
              value={simulationHeader}
              onChange={(e) => setSimulationHeader(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            >
              <option value="">None (Normal Inference)</option>
              <option value="key_1=429">key_1=429 (Simulate Rate Limit on Key 1 &rarr; Key 2)</option>
              <option value="key_1=500">key_1=500 (Simulate Server Error on Key 1 &rarr; Key 2)</option>
              <option value="*=429">*=429 (Simulate All Keys Failing &rarr; 503)</option>
              <option value="custom">Custom Header...</option>
            </select>
            {simulationHeader === 'custom' && (
              <input
                type="text"
                placeholder="key_1=429,key_2=500"
                onChange={(e) => setSimulationHeader(e.target.value)}
                className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono"
              />
            )}
          </div>
        </div>
      </section>

      {/* Messages Scroll Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center mb-4 text-indigo-400 shadow-inner">
                <Bot className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-semibold text-slate-200 mb-1">
                Lyftr AI Full-Stack Assistant
              </h2>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
                Featuring multi-turn SQLite persistence, automatic key failover across provider pools,
                and sub-millisecond response caching.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl text-left text-xs">
                <button
                  onClick={() => handleSendMessage('What is the capital of France?')}
                  className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all text-slate-300"
                >
                  <span className="font-semibold text-indigo-400 block mb-1">1. Live Inference</span>
                  "What is the capital of France?"
                </button>
                <button
                  onClick={() => handleSendMessage('What is the capital of France?')}
                  className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all text-slate-300"
                >
                  <span className="font-semibold text-emerald-400 block mb-1">2. Response Cache</span>
                  Send again for LLM_CACHE hit
                </button>
                <button
                  onClick={() => {
                    setSimulationHeader('key_1=429');
                    handleSendMessage('Explain quantum computing in one sentence.');
                  }}
                  className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all text-slate-300"
                >
                  <span className="font-semibold text-amber-400 block mb-1">3. Failover Demo</span>
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
                    className="flex items-start gap-3 p-4 bg-rose-950/50 border border-rose-500/40 rounded-2xl text-rose-200 text-sm max-w-2xl self-start"
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
            <div className="flex items-center gap-2 p-3 bg-slate-800/60 border border-slate-700/50 rounded-2xl text-slate-400 text-xs self-start animate-pulse">
              <Bot className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>Generating response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-slate-800/90 border-t border-slate-700/80 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
        </div>
      </footer>
    </div>
  );
}
