import React, { useState } from 'react';
import { Send, CornerDownLeft } from 'lucide-react';

export default function ChatInput({ onSendMessage, disabled }) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setText(''); // Empty after sending as strictly required
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex items-center bg-slate-800 border border-slate-700 rounded-xl p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
      <textarea
        data-testid="chat-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
        disabled={disabled}
        rows={1}
        className="w-full bg-transparent text-slate-100 placeholder-slate-400 focus:outline-none resize-none px-3 py-2 text-sm md:text-base max-h-32 min-h-[44px]"
      />
      <button
        type="button"
        data-testid="send-button"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className={`ml-2 p-2.5 rounded-lg flex items-center justify-center transition-all ${
          disabled || !text.trim()
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm'
        }`}
        title="Send message (Enter)"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
