import React from 'react';
import { Zap, Database, Cpu, Clock, Key, AlertTriangle } from 'lucide-react';

export default function AssistantMessage({ message }) {
  const { content, metadata } = message;
  const isCache = metadata?.resolution_source === 'LLM_CACHE';

  return (
    <div
      data-testid="assistant-message"
      className="flex flex-col gap-2.5 max-w-3xl self-start liquid-glass rounded-3xl p-5 text-zinc-100 transition-all"
    >
      {/* Assistant Reply Text */}
      <div className="whitespace-pre-wrap leading-relaxed text-zinc-200 text-sm md:text-base selection:bg-emerald-500/30">
        {content}
      </div>

      {/* Metadata Container */}
      {metadata && (
        <div className="mt-2 pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-2 text-xs">
          {/* Resolution Source */}
          <span
            data-testid="meta-source"
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold border backdrop-blur-md transition-all ${
              isCache
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
            }`}
          >
            {isCache ? <Database className="w-3 h-3 text-emerald-400" /> : <Zap className="w-3 h-3 text-amber-400" />}
            {metadata.resolution_source}
          </span>

          {/* Model Name */}
          <span
            data-testid="meta-model"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.04] text-zinc-300 border border-white/10 font-mono backdrop-blur-sm"
          >
            <Cpu className="w-3 h-3 text-zinc-400" />
            {metadata.model || 'unknown-model'}
          </span>

          {/* Latency */}
          <span
            data-testid="meta-latency"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.04] text-zinc-300 border border-white/10 font-mono backdrop-blur-sm"
          >
            <Clock className="w-3 h-3 text-amber-400" />
            {metadata.latency_ms !== undefined ? `${metadata.latency_ms} ms` : '0 ms'}
          </span>

          {/* Token Usage: Input Tokens */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.04] text-zinc-300 border border-white/10 backdrop-blur-sm">
            <span className="text-zinc-500">in:</span>
            <span data-testid="meta-input-tokens" className="font-mono font-medium text-zinc-200">
              {metadata.input_tokens ?? 0}
            </span>
          </span>

          {/* Token Usage: Output Tokens */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.04] text-zinc-300 border border-white/10 backdrop-blur-sm">
            <span className="text-zinc-500">out:</span>
            <span data-testid="meta-output-tokens" className="font-mono font-medium text-zinc-200">
              {metadata.output_tokens ?? 0}
            </span>
          </span>

          {/* Key ID (if available, null on cache) */}
          {metadata.key_id ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/30 font-mono backdrop-blur-sm">
              <Key className="w-3 h-3 text-teal-400" />
              {metadata.key_id}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.02] text-zinc-500 border border-white/5 font-mono">
              key: null
            </span>
          )}

          {/* Fallback Attempts Indicator (if fallback occurred) */}
          {metadata.fallback_attempts > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium backdrop-blur-sm">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              Failovers: {metadata.fallback_attempts}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
