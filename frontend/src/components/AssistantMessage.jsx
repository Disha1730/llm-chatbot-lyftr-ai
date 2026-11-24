import React from 'react';
import { Zap, Database, Cpu, Clock, Key, AlertTriangle } from 'lucide-react';

export default function AssistantMessage({ message }) {
  const { content, metadata } = message;
  const isCache = metadata?.resolution_source === 'LLM_CACHE';

  return (
    <div
      data-testid="assistant-message"
      className="flex flex-col gap-2 max-w-3xl self-start bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-sm text-slate-100"
    >
      {/* Assistant Reply Text */}
      <div className="whitespace-pre-wrap leading-relaxed text-slate-200 text-sm md:text-base">
        {content}
      </div>

      {/* Metadata Container */}
      {metadata && (
        <div className="mt-2 pt-2.5 border-t border-slate-700/60 flex flex-wrap items-center gap-2 text-xs">
          {/* Resolution Source */}
          <span
            data-testid="meta-source"
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold border ${
              isCache
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'bg-indigo-950/70 border-indigo-500/40 text-indigo-300'
            }`}
          >
            {isCache ? <Database className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
            {metadata.resolution_source}
          </span>

          {/* Model Name */}
          <span
            data-testid="meta-model"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 border border-slate-600/40 font-mono"
          >
            <Cpu className="w-3 h-3 text-slate-400" />
            {metadata.model || 'unknown-model'}
          </span>

          {/* Latency */}
          <span
            data-testid="meta-latency"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 border border-slate-600/40 font-mono"
          >
            <Clock className="w-3 h-3 text-amber-400" />
            {metadata.latency_ms !== undefined ? `${metadata.latency_ms} ms` : '0 ms'}
          </span>

          {/* Token Usage: Input Tokens */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 border border-slate-600/40">
            <span className="text-slate-400">in:</span>
            <span data-testid="meta-input-tokens" className="font-mono font-medium text-slate-200">
              {metadata.input_tokens ?? 0}
            </span>
          </span>

          {/* Token Usage: Output Tokens */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 border border-slate-600/40">
            <span className="text-slate-400">out:</span>
            <span data-testid="meta-output-tokens" className="font-mono font-medium text-slate-200">
              {metadata.output_tokens ?? 0}
            </span>
          </span>

          {/* Key ID (if available, null on cache) */}
          {metadata.key_id ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/60 text-sky-300 border border-sky-500/30 font-mono">
              <Key className="w-3 h-3 text-sky-400" />
              {metadata.key_id}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              key: null
            </span>
          )}

          {/* Fallback Attempts Indicator (if fallback occurred) */}
          {metadata.fallback_attempts > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-500/40 font-medium">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Failovers: {metadata.fallback_attempts}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
