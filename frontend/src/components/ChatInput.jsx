import React, { useState } from 'react';
import { Send, CornerDownLeft } from 'lucide-react';

export default function ChatInput({ onSendMessage, disabled }) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setText(''); // Empty after sending as strictly required by contract
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex items-center liquid-glass-input rounded-2xl p-2 focus-within:border-emerald-500/50 focus-within:shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all">
      <textarea
        data-testid="chat-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
        disabled={disabled}
        rows={1}
        className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none px-3.5 py-2.5 text-sm md:text-base max-h-32 min-h-[44px]"
      />
      <button
        type="button"
        data-testid="send-button"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className={`ml-2 p-3 rounded-xl flex items-center justify-center transition-all ${
          disabled || !text.trim()
            ? 'bg-white/[0.04] text-zinc-600 border border-white/5 cursor-not-allowed'
            : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] hover:scale-[1.03] active:scale-[0.97]'
        }`}
        title="Send message (Enter)"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
