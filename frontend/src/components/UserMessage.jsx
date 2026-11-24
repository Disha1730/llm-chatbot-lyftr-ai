import React from 'react';

export default function UserMessage({ message }) {
  return (
    <div className="flex flex-col max-w-2xl self-end bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md">
      <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
        {message.content}
      </div>
    </div>
  );
}
