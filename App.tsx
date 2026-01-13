
import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, ChatSession, ImageData, FileData, User, AdminStats } from './types';
import { geminiService } from './services/geminiService';
import ChatMessage from './components/ChatMessage';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ferps_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('ferps_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;

  // Persist sessions
  useEffect(() => {
    localStorage.setItem('ferps_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Initial session logic
  useEffect(() => {
    if (user && sessions.length === 0) {
      createNewChat();
    } else if (user && sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [user]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [currentSession?.messages, isLoading, videoStatus]);

  const login = (email: string, name: string) => {
    const isOwner = email.toLowerCase() === 'ogabek@ferps.ai' || name.toLowerCase().includes('ogabek');
    const newUser = { id: crypto.randomUUID(), name, email, isOwner };
    setUser(newUser);
    localStorage.setItem('ferps_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ferps_user');
    setSessions([]);
    localStorage.removeItem('ferps_sessions');
    setCurrentSessionId(null);
  };

  const createNewChat = () => {
    const newId = crypto.randomUUID();
    const newSession: ChatSession = {
      id: newId,
      title: 'Yangi chat',
      messages: [{
        id: 'welcome', role: Role.ASSISTANT, timestamp: new Date(),
        content: `Salom, ${user?.name}! Men Ferps AI Pro. Men rasm va video yarata olaman, hujjatlarni tahlil qilaman va ovozli muloqot qila olaman. Qanday yordam bera olaman?`
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setSidebarOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const deleteMessage = (msgId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: s.messages.filter(m => m.id !== msgId) };
      }
      return s;
    }));
  };

  const editMessage = async (msgId: string, newContent: string) => {
    // 1. Update the message
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const updatedMessages = s.messages.map(m => m.id === msgId ? { ...m, content: newContent, isEdited: true } : m);
        // Find index of edited message
        const index = updatedMessages.findIndex(m => m.id === msgId);
        // Remove subsequent assistant messages to regenerate
        return { ...s, messages: updatedMessages.slice(0, index + 1) };
      }
      return s;
    }));

    // 2. Trigger regeneration
    setIsLoading(true);
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;
    
    const result = await geminiService.chat(session.messages.filter(m => m.id !== msgId), newContent);
    const assistantMsg: Message = { id: crypto.randomUUID(), role: Role.ASSISTANT, content: result.text, timestamp: new Date() };
    
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s));
    setIsLoading(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage({ data: (reader.result as string).split(',')[1], mimeType: file.type });
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setSelectedFile({ name: file.name, content: e.target?.result as string, type: file.type });
      reader.readAsText(file);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Brauzeringiz ovozli qidiruvni qo'llab-quvvatlamaydi.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'uz-UZ';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => setInput(event.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage && !selectedFile) || isLoading || !currentSessionId) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: Role.USER, content: input, image: selectedImage || undefined, file: selectedFile || undefined, timestamp: new Date() };
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length <= 1 ? (input.slice(0, 30) || 'Yangi chat') : s.title, updatedAt: new Date() } : s));
    
    const text = input; setInput(''); setSelectedImage(null); setSelectedFile(null); setImagePreview(null); setIsLoading(true);

    const result = await geminiService.chat(currentSession?.messages || [], text, userMsg.image, userMsg.file);

    if (result.isVideo) {
      setVideoStatus("Video yaratilmoqda... (1-2 daqiqa kutiladi)");
      try {
        if (!await (window as any).aistudio.hasSelectedApiKey()) {
          await (window as any).aistudio.openSelectKey();
        }
        const videoUrl = await geminiService.generateVideo(text);
        const assistantMsg: Message = { id: crypto.randomUUID(), role: Role.ASSISTANT, content: "Mana siz so'ragan video:", videoUrl, timestamp: new Date() };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s));
      } catch (err) {
        alert("Video yaratishda xatolik. API kalitini tekshiring.");
      } finally { setVideoStatus(null); }
    } else {
      const assistantMsg: Message = { id: crypto.randomUUID(), role: Role.ASSISTANT, content: result.text, generatedImageUrl: result.generatedImageUrl, timestamp: new Date() };
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s));
    }
    setIsLoading(false);
  };

  if (!user) {
    return (
      <div className="h-screen w-full bg-[#0a0f1d] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d1326] border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-black text-white shadow-lg shadow-indigo-500/30 animate-pulse">F</div>
            <h1 className="text-2xl font-black text-white">Ferps AI Pro Login</h1>
            <p className="text-slate-500 text-sm mt-2">Dunyodagi eng aqlli o'zbek AI tizimiga xush kelibsiz</p>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            login(form.email.value, form.username.value);
          }} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Username</label>
              <input name="username" required type="text" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all" placeholder="Ismingizni yozing" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Email Address</label>
              <input name="email" required type="email" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all" placeholder="ogabek@ferps.ai" />
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
              Kirish
            </button>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button type="button" className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl text-xs font-bold transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Google</button>
              <button type="button" className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl text-xs font-bold transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg> GitHub</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0f1d] text-slate-200 overflow-hidden font-sans">
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 w-72 bg-[#0d1326] border-r border-slate-800/50 transition-transform duration-300 z-30 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-4">
          <button onClick={createNewChat} className="flex items-center justify-center gap-2 w-full py-3 mb-6 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all font-semibold shadow-lg shadow-indigo-500/20 active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Yangi chat
          </button>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
            {sessions.map(s => (
              <div key={s.id} onClick={() => { setCurrentSessionId(s.id); setSidebarOpen(false); }} className={`group w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm truncate transition-all cursor-pointer ${currentSessionId === s.id ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'hover:bg-slate-800/50 text-slate-400'}`}>
                <span className="truncate flex-1">{s.title}</span>
                <button onClick={(e) => deleteSession(s.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all">✕</button>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-lg shadow-xl text-white">{user.name.charAt(0)}</div>
                  <div className="min-w-0"><p className="text-sm font-bold truncate">{user.name}</p><p className="text-[10px] text-indigo-500 uppercase font-black tracking-widest">{user.isOwner ? 'Super Admin' : 'Free User'}</p></div>
                </div>
                <button onClick={logout} className="p-2 text-slate-500 hover:text-red-400" title="Logout"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
             </div>
             {user.isOwner && (
               <button onClick={() => setShowAdmin(!showAdmin)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">
                 {showAdmin ? 'Chatga qaytish' : 'Admin Panel'}
               </button>
             )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800/50 bg-[#0a0f1d]/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="p-2 lg:hidden text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg></button>
            <h1 className="font-black text-xl tracking-tight text-white">FERPS <span className="text-indigo-500">AI</span></h1>
          </div>
          <div className="hidden sm:flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800/50">
            <div className={`w-2 h-2 rounded-full animate-pulse ${user.isOwner ? 'bg-indigo-500' : 'bg-green-500'}`}></div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Yaratuvchi: In’omiddinov Og‘abek</span>
          </div>
        </header>

        {showAdmin && user.isOwner ? (
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-black mb-8 text-white flex items-center gap-3"><svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> Super Admin Dashboard</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-[#0d1326] p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <p className="text-slate-500 text-xs font-bold uppercase mb-2">Jami foydalanuvchilar</p>
                  <p className="text-3xl font-black text-white">12,482</p>
                </div>
                <div className="bg-[#0d1326] p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <p className="text-slate-500 text-xs font-bold uppercase mb-2">Jami xabarlar</p>
                  <p className="text-3xl font-black text-white">458,920</p>
                </div>
                <div className="bg-[#0d1326] p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <p className="text-slate-500 text-xs font-bold uppercase mb-2">Aktiv sessiyalar</p>
                  <p className="text-3xl font-black text-white">1,204</p>
                </div>
                <div className="bg-[#0d1326] p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <p className="text-slate-500 text-xs font-bold uppercase mb-2">Sog'lik holati</p>
                  <p className="text-3xl font-black text-green-500">100%</p>
                </div>
              </div>
              <div className="bg-[#0d1326] rounded-3xl border border-slate-800 p-8 shadow-xl">
                <h3 className="text-lg font-bold mb-4">Oxirgi loglar</h3>
                <div className="space-y-4">
                   {[1,2,3,4,5].map(i => (
                     <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-slate-800/50">
                        <span className="text-slate-400">User_{Math.floor(Math.random()*1000)} rasm yaratdi</span>
                        <span className="text-slate-600">{new Date().toLocaleTimeString()}</span>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-6 pb-40">
              <div className="max-w-3xl mx-auto">
                {currentSession?.messages.map((m) => (
                  <ChatMessage key={m.id} message={m} onDelete={deleteMessage} onEdit={editMessage} />
                ))}
                {isLoading && (
                  <div className="flex items-start mb-6">
                    <div className="w-8 h-8 rounded-full bg-slate-800 mr-3 animate-pulse"></div>
                    <div className="bg-slate-800/50 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-700/50 animate-pulse flex items-center gap-3">
                      <div className="flex space-x-1"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div></div>
                      <span className="text-xs text-slate-500 italic">Ferps AI o'ylamoqda...</span>
                    </div>
                  </div>
                )}
                {videoStatus && (
                  <div className="bg-indigo-600/10 border border-indigo-500/20 p-4 rounded-2xl mb-6 text-center text-xs text-indigo-400 animate-pulse">
                    {videoStatus} <br/> <span className="text-[10px] opacity-60 mt-1 block">Video yaratish kutilmoqda, iltimos sahifani yopmang.</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0a0f1d] via-[#0a0f1d]/90 to-transparent">
              <div className="max-w-3xl mx-auto">
                <div className="flex flex-wrap gap-2 mb-3">
                  {imagePreview && <div className="relative group"><img src={imagePreview} className="h-16 w-16 object-cover rounded-xl border-2 border-indigo-500 shadow-xl" /><button onClick={() => {setImagePreview(null); setSelectedImage(null);}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button></div>}
                  {selectedFile && <div className="px-3 py-2 bg-slate-800 rounded-xl flex items-center gap-2 border border-slate-700 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{selectedFile.name} <button onClick={() => setSelectedFile(null)} className="hover:text-red-400">✕</button></div>}
                </div>
                
                <form onSubmit={handleSubmit} className="relative flex items-center gap-2 bg-slate-900/80 backdrop-blur-2xl border border-slate-800/50 p-2 rounded-2xl shadow-2xl focus-within:border-indigo-500/50 transition-all">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                  <input type="file" ref={docInputRef} className="hidden" accept=".txt,.pdf" onChange={handleDocChange} />
                  
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-indigo-400 transition-colors" title="Rasm"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
                  <button type="button" onClick={() => docInputRef.current?.click()} className="p-3 text-slate-400 hover:text-indigo-400 transition-colors" title="Hujjat"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
                  
                  <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Xabar yozing, rasm/video so'rang..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-100 placeholder-slate-500 outline-none" disabled={isLoading} />
                  
                  <button type="button" onClick={startListening} className={`p-3 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-indigo-400'}`} title="Ovozli qidiruv"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
                  
                  <button type="submit" disabled={isLoading || (!input.trim() && !selectedImage && !selectedFile)} className={`p-3 rounded-xl transition-all ${isLoading || (!input.trim() && !selectedImage && !selectedFile) ? 'text-slate-600 cursor-not-allowed' : 'text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 active:scale-95'}`}><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg></button>
                </form>
                <div className="mt-4 flex justify-center items-center gap-6 overflow-x-auto pb-2 scrollbar-hide">
                  {['Uzbek Dialects', 'Real-time Search', 'Veo Video Gen', 'Image Art', 'Super Admin Mode'].map(tag => (
                    <span key={tag} className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] whitespace-nowrap">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
