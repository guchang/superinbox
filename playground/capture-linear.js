import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Inbox, CheckCircle2, Wallet, Lightbulb, Link2, 
  Settings, Send, Zap, ArrowRightLeft, 
  Database, Bell, X, Activity, Shield, Cpu, Sparkles, 
  Music, FileText, Image as ImageIcon, Mic, Paperclip, 
  Globe, LayoutGrid, List, History, HardDrive, Share2, User,
  MoreHorizontal, ChevronRight, Command, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 模拟 AI 意图引擎逻辑 ---
const getIntents = (type, content) => {
  const map = {
    audio: { intent: 'Audio Parsing', route: 'Apple Music', color: 'bg-rose-500/20', text: 'text-rose-400' },
    image: { intent: 'Vision OCR', route: 'Notion Assets', color: 'bg-emerald-500/20', text: 'text-emerald-400' },
    link: { intent: 'URL Summary', route: 'Readwise', color: 'bg-blue-500/20', text: 'text-blue-400' },
    file: { intent: 'Doc Structure', route: 'Google Drive', color: 'bg-amber-500/20', text: 'text-amber-400' },
    text: { intent: 'Semantic Intent', route: 'Obsidian', color: 'bg-white/5', text: 'text-white/60' },
  };
  return map[type] || map.text;
};

// --- 背景网格组件 ---
const MinimalGrid = () => (
  <div className="fixed inset-0 pointer-events-none z-0">
    <div className="absolute inset-0 bg-[#0b0b0f]" />
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
    <div 
      className="absolute inset-0 opacity-[0.04]" 
      style={{ 
        backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
        backgroundSize: '48px 48px'
      }} 
    />
  </div>
);

// --- 基础 UI 颗粒组件 ---
const HeaderNavItem = ({ label, active }) => (
  <button className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'text-white bg-white/5' : 'text-white/30 hover:text-white/60'}`}>
    {label}
  </button>
);

const SideIcon = ({ icon: Icon, active }) => (
  <button className={`p-2 rounded-xl transition-all ${active ? 'text-white bg-white/5' : 'text-white/20 hover:text-white/50'}`}>
    <Icon size={20} strokeWidth={1.5} />
  </button>
);

const ActionButton = ({ icon: Icon, onClick }) => (
  <button 
    onClick={onClick}
    className="p-2 text-white/20 hover:text-white hover:bg-white/5 rounded-lg transition-all"
  >
    <Icon size={16} strokeWidth={2} />
  </button>
);

// --- 核心：动态记忆块 ---
const MemoryBlock = ({ memory }) => {
  const { status, type, name, intent, size } = memory;
  const icons = { audio: Music, image: ImageIcon, link: Globe, file: FileText, text: Zap };
  const Icon = icons[type] || Zap;
  const config = getIntents(type, '');

  return (
    <motion.div 
      layout
      initial={{ height: 0, opacity: 0, marginBottom: 0 }}
      animate={{ 
        height: 'auto', 
        opacity: 1, 
        marginBottom: 12,
        // 最终成功时的拉伸回弹
        ...(status === 'synced' ? { scale: [1, 1.04, 1], y: [0, -4, 0] } : {})
      }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: status === 'synced' ? 12 : 30 
      }}
      className="relative overflow-hidden"
    >
      <motion.div
        initial={status === 'floating' ? { scale: 0.85, opacity: 0, filter: 'blur(10px)', y: 20 } : false}
        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white/[0.02] border border-white/[0.06] rounded-2xl flex items-center gap-4 transition-all cursor-default group h-[72px] p-4 relative"
      >
        {/* 槽位中的涟漪 (rippling 阶段) */}
        <AnimatePresence>
          {status === 'rippling' && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 2.5, opacity: [0, 0.3, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-white/20 rounded-full z-0"
            />
          )}
        </AnimatePresence>

        {/* 背景脉冲 (analyzing 阶段) */}
        <AnimatePresence>
          {status === 'analyzing' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.06, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 bg-white z-0"
            />
          )}
        </AnimatePresence>

        <div className={`w-10 h-10 rounded-xl shrink-0 ${config.color} ${config.text} flex items-center justify-center relative z-10`}>
          {status === 'analyzing' ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
              <Icon size={18} strokeWidth={2} />
            </motion.div>
          ) : (
            <Icon size={18} strokeWidth={2} />
          )}
        </div>

        <div className="flex-1 min-w-0 relative z-10">
          <div className={`text-xs font-bold truncate mb-0.5 transition-colors ${status === 'rippling' ? 'text-white/0' : 'text-white/80'}`}>
            {name}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-white/20 tracking-tighter">
              {status === 'analyzing' ? 'Analyzing Intent...' : (status === 'routing' ? 'Routing to Node...' : intent)}
            </span>
          </div>
        </div>

        {/* 传输光条 (routing 阶段) */}
        {status === 'routing' && (
          <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-white/[0.02] overflow-hidden">
            <motion.div 
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
          </div>
        )}

        <div className="relative z-10">
          {status === 'synced' ? (
            <CheckCircle2 size={14} className="text-emerald-500/50" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-white/10 animate-pulse" />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- 主应用组件 ---
export default function App() {
  const [inputValue, setInputValue] = useState('');
  const [captureType, setCaptureType] = useState('text');
  
  const [isAbsorbing, setIsAbsorbing] = useState(false); 
  const [isCollapsing, setIsCollapsing] = useState(false); 
  const [isDiving, setIsDiving] = useState(false); 
  
  const [memories, setMemories] = useState([
    { id: 1, type: 'link', name: 'linear.app/method', intent: 'Product Concept', time: '1h ago', size: 'URL', status: 'synced' },
    { id: 2, type: 'image', name: 'Invoice_Jan.pdf', intent: 'Finance', time: '3h ago', size: '1.2MB', status: 'synced' },
  ]);

  const isAIProcessing = isAbsorbing || isCollapsing || isDiving || memories.some(m => m.status === 'analyzing' || m.status === 'routing');

  const handleCapture = (type, content) => {
    if (isAbsorbing || isCollapsing || isDiving) return;
    
    setCaptureType(type);
    setIsAbsorbing(true); 
    const rawContent = content || inputValue;

    setTimeout(() => {
      setIsCollapsing(true);
      
      setTimeout(() => {
        setIsAbsorbing(false);
        setIsCollapsing(false);
        setIsDiving(true); 
        setInputValue(''); 
        
        const newId = Date.now();
        
        setTimeout(() => {
          setIsDiving(false);
          
          const newMemory = {
            id: newId,
            type: type,
            name: rawContent.length > 30 ? rawContent.substring(0, 30) + '...' : (rawContent || `Capture_${type}`),
            intent: '...',
            size: type === 'text' ? 'Text' : 'Asset',
            status: 'rippling' 
          };
          setMemories(prev => [newMemory, ...prev]);

          setTimeout(() => {
            setMemories(prev => prev.map(m => m.id === newId ? { ...m, status: 'floating' } : m));

            setTimeout(() => {
              setMemories(prev => prev.map(m => m.id === newId ? { ...m, status: 'analyzing' } : m));

              setTimeout(() => {
                setMemories(prev => prev.map(m => m.id === newId ? { ...m, status: 'routing' } : m));

                setTimeout(() => {
                  setMemories(prev => prev.map(m => m.id === newId ? { 
                    ...m, 
                    status: 'synced', 
                    intent: getIntents(type, rawContent).intent 
                  } : m));
                }, 10000);
              }, 1000); 
            }, 800);
          }, 800);
        }, 600);
      }, 800);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-[#ededed] selection:bg-white/10 overflow-hidden font-sans antialiased">
      <MinimalGrid />
      
      <div className="relative z-10 h-screen flex flex-col">
        {/* Header */}
        <header className="h-14 px-6 flex items-center justify-between border-b border-white/[0.05] bg-[#0b0b0f]/50 backdrop-blur-xl">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
               <div className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                 <Zap size={14} fill="black" stroke="black" />
               </div>
               <span className="font-bold text-sm tracking-tight">SuperInbox</span>
             </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
             <User size={14} className="text-white/40" />
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          <aside className="w-14 border-r border-white/[0.05] flex flex-col items-center py-6 gap-6 bg-[#0b0b0f]/30">
             <SideIcon icon={Inbox} active />
             <SideIcon icon={LayoutGrid} />
             <SideIcon icon={History} />
             <div className="mt-auto">
               <SideIcon icon={Settings} />
             </div>
          </aside>

          <section className="flex-1 flex flex-col bg-[#0b0b0f]/10">
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-full max-w-2xl relative">
                
                {/* 深度沉降水滴 */}
                <AnimatePresence>
                  {isDiving && (
                    <motion.div 
                      initial={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                      animate={{ scale: 0, opacity: 0, filter: 'blur(20px)' }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none"
                    >
                       <div className="w-10 h-10 bg-white/30 backdrop-blur-3xl rounded-full border border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 输入框主容器 */}
                <motion.div 
                  animate={{ 
                    scale: isAbsorbing ? 0.98 : 1,
                    y: isAbsorbing ? 4 : 0,
                    boxShadow: isAbsorbing ? "inset 0 0 40px rgba(0,0,0,0.5)" : "none"
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="relative bg-[#0f0f13] border border-white/[0.08] rounded-[26px] p-2 shadow-2xl overflow-hidden z-10"
                >
                  {/* 内容坍缩动画层 (内凹曲线星形 TV Off Effect) */}
                  <AnimatePresence>
                    {isCollapsing && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center"
                      >
                        <div className="relative flex items-center justify-center w-full">
                          <motion.div 
                            initial={{ scaleX: 1, scaleY: 1, opacity: 0 }}
                            animate={{ 
                              scaleY: [1.3, 0.02, 0.02],
                              scaleX: [1.3, 1.3, 0],
                              opacity: [0, 1, 1, 0],
                            }}
                            transition={{ duration: 0.8, times: [0, 0.7, 0.9, 1], ease: [0.19, 1, 0.22, 1] }}
                            className="relative flex items-center justify-center"
                          >
                            <div className="relative w-72 h-32 flex items-center justify-center">
                              <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full" />
                              <svg viewBox="0 0 100 100" className="w-full h-full text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
                                <motion.path 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  d="M 50 0 C 50 35 65 50 100 50 C 65 50 50 65 50 100 C 50 65 35 50 0 50 C 35 50 50 35 50 0 Z" 
                                  fill="currentColor"
                                />
                              </svg>
                              <div className="absolute w-full h-[1px] bg-white shadow-[0_0_15px_white]" />
                              <div className="absolute h-full w-[1px] bg-white shadow-[0_0_15px_white]" />
                            </div>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <textarea 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Capture anything to your digital brain..."
                    disabled={isAbsorbing || isCollapsing || isDiving}
                    className="relative z-10 w-full bg-transparent border-none outline-none px-6 py-6 text-lg placeholder:text-white/10 resize-none h-40 no-scrollbar leading-relaxed disabled:text-transparent transition-colors"
                  />
                  
                  <div className="relative z-10 flex items-center justify-between px-4 pb-4">
                    <div className="flex items-center gap-1">
                      <ActionButton icon={Mic} onClick={() => handleCapture('audio', 'Audio Thought')} />
                      <ActionButton icon={ImageIcon} onClick={() => handleCapture('image', 'Visual Note')} />
                      <ActionButton icon={Globe} onClick={() => handleCapture('link', 'Web Clipping')} />
                    </div>
                    <button 
                      onClick={() => handleCapture('text', inputValue)}
                      disabled={!inputValue.trim() || isAbsorbing || isCollapsing || isDiving}
                      className="px-6 py-2.5 bg-white text-black rounded-xl text-xs font-bold hover:bg-white/90 transition-all disabled:opacity-20 flex items-center gap-2"
                    >
                      Capture <ChevronRight size={14} strokeWidth={3} />
                    </button>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {isAIProcessing && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute -inset-1 rounded-[30px] bg-white/[0.02] blur-xl -z-10"
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="h-80 border-t border-white/[0.05] p-6 flex flex-col gap-4 bg-[#0b0b0f]/40">
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
                  <History size={12} /> Recent Memories
                </span>
                <span className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">Sync Active</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto no-scrollbar pb-6 pr-2">
                <AnimatePresence initial={false}>
                  {memories.map(m => (
                    <MemoryBlock key={m.id} memory={m} />
                  ))}
                </AnimatePresence>
                <div className="h-[72px] border border-dashed border-white/[0.05] rounded-2xl flex items-center justify-center opacity-5 shrink-0">
                   <Plus size={18} />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite linear;
        }
      `}} />
    </div>
  );
}