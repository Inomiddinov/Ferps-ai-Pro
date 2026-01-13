
import React, { useState } from 'react';
import { Message, Role } from '../types';
import { geminiService } from '../services/geminiService';

interface ChatMessageProps {
  message: Message;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onEdit, onDelete }) => {
  const isUser = message.role === Role.USER;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);

  const handlePlayAudio = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    const audioData = await geminiService.generateSpeech(message.content);
    if (audioData) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binaryString = atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } else setIsPlaying(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    alert('Nusxa olindi!');
  };

  const saveEdit = () => {
    if (onEdit && editValue.trim() !== message.content) {
      onEdit(message.id, editValue);
    }
    setIsEditing(false);
  };

  return (
    <div className={`flex w-full mb-6 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg
          ${isUser ? 'bg-indigo-600 ml-3' : 'bg-slate-700 mr-3'}`}>
          {isUser ? 'U' : 'F'}
        </div>
        <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed relative
          ${isUser 
            ? 'bg-indigo-600 text-white rounded-tr-none' 
            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'}`}>
          
          {message.image && (
            <div className="mb-3"><img src={`data:${message.image.mimeType};base64,${message.image.data}`} className="max-w-full rounded-lg border border-white/10" /></div>
          )}

          {message.file && (
            <div className="mb-3 p-2 bg-slate-900/50 rounded-lg flex items-center gap-2 border border-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="text-[11px] truncate">{message.file.name}</span>
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <textarea 
                value={editValue} 
                onChange={(e) => setEditValue(e.target.value)}
                className="bg-slate-900/50 border border-indigo-500/50 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditing(false)} className="px-2 py-1 bg-slate-700 rounded text-[10px]">Bekor qilish</button>
                <button onClick={saveEdit} className="px-2 py-1 bg-indigo-600 rounded text-[10px]">Saqlash</button>
              </div>
            </div>
          ) : (
            <>
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.isEdited && <span className="text-[9px] opacity-40 italic mt-1 block">(tahrirlandi)</span>}
            </>
          )}

          {message.videoUrl && (
            <div className="mt-4"><video src={message.videoUrl} controls className="max-w-full rounded-lg border border-white/10 shadow-lg" /></div>
          )}

          {message.generatedImageUrl && (
            <div className="mt-4"><img src={message.generatedImageUrl} className="max-w-full rounded-lg border border-white/10 shadow-lg" /></div>
          )}

          <div className={`mt-2 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {!isUser && (
              <button onClick={handlePlayAudio} className={`p-1 rounded-md ${isPlaying ? 'text-indigo-400' : 'text-slate-500 hover:text-white'}`}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              </button>
            )}
            <button onClick={handleCopy} className="p-1 text-slate-500 hover:text-white" title="Nusxa olish">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            {isUser && (
              <button onClick={() => setIsEditing(true)} className="p-1 text-slate-500 hover:text-white" title="Tahrirlash">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            )}
            <button onClick={() => onDelete && onDelete(message.id)} className="p-1 text-slate-500 hover:text-red-400" title="O'chirish">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>

          <div className={`text-[10px] mt-1 opacity-50 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
