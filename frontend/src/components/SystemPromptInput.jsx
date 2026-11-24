import React from 'react';
import { Sliders } from 'lucide-react';

export default function SystemPromptInput({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
        <Sliders className="w-3.5 h-3.5 text-indigo-400" />
        System Prompt (Session Override)
      </label>
      <input
        type="text"
        data-testid="system-prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. You are a pirate AI who speaks in pirate slang..."
        className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
      />
    </div>
  );
}
