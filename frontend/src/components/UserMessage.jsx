import React from 'react';

export default function UserMessage({ message }) {
  return (
    <div className="flex flex-col max-w-2xl self-end liquid-glass-bubble text-zinc-100 rounded-3xl rounded-tr-md px-5 py-3.5 transition-all">
      <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base selection:bg-emerald-500/30">
        {message.content}
      </div>
    </div>
  );
}
