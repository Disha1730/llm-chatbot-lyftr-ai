import React from 'react';
import { Sliders } from 'lucide-react';

export default function SystemPromptInput({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
        <Sliders className="w-3.5 h-3.5 text-emerald-400" />
        System Prompt (Session Override)
      </label>
      <input
        type="text"
        data-testid="system-prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. You are a concise, helpful technical assistant..."
        className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
      />
    </div>
  );
}
