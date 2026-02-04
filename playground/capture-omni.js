import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Search, Inbox, CheckCircle2, Wallet, Lightbulb, Link2, 
  Settings, Send, Zap, ArrowRightLeft, 
  Database, Bell, X, Activity, Shield, Cpu, Sparkles, 
  Music, FileText, Image as ImageIcon, Mic, Paperclip, 
  Globe, LayoutGrid, List, History, HardDrive, Share2, User,
  MoreHorizontal, ChevronRight, Command, Loader2, UploadCloud,
  Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 模拟 AI 意图引擎逻辑 ---
const getIntents = (type, content, theme) => {
  const isDark = theme === 'dark';
  const map = {
    audio: { 
      intent: '音频解析', 
      route: 'Apple Music', 
      color: isDark ? 'bg-rose-500/20' : 'bg-rose-100', 
      text: isDark ? 'text-rose-400' : 'text-rose-600', 
      accent: 'bg-rose-500' 
    },
    image: { 
      intent: '视觉 OCR', 
      route: 'Notion 资产', 
      color: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100', 
      text: isDark ? 'text-emerald-400' : 'text-emerald-600', 
      accent: 'bg-emerald-500' 
    },
    link: { 
      intent: '网页摘要', 
      route: 'Readwise', 
      color: isDark ? 'bg-blue-500/20' : 'bg-blue-100', 
      text: isDark ? 'text-blue-400' : 'text-blue-600', 
      accent: 'bg-blue-500' 
    },
    file: { 
      intent: '文档结构提取', 
      route: 'Google Drive', 
      color: isDark ? 'bg-amber-500/20' : 'bg-amber-100', 
      text: isDark ? 'text-amber-400' : 'text-amber-600', 
      accent: 'bg-amber-500' 
    },
    text: { 
      intent: '语义识别', 
      route: 'Obsidian 库', 
      color: isDark ? 'bg-white/5' : 'bg-black/5', 
      text: isDark ? 'text-white/60' : 'text-black/60', 
      accent: isDark ? 'bg-white/40' : 'bg-black/40' 
    },
  };
  return map[type] || map.text;
};

// --- 极简神经背景 (Neural Synapses) ---
const NeuralBackground = ({ active, theme }) => {
  const canvasRef = useRef(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let particles = [];
    const particleCount = window.innerWidth < 768 ? 20 : 40;
    const maxDistance = 150;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.size = Math.random() * 1.5 + 0.5;
      }
      update() {
        this.x += this.vx * (active ? 2 : 1);
        this.y += this.vy * (active ? 2 : 1);
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = isDark 
          ? (active ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)')
          : (active ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.03)');
        ctx.fill();
      }
    }

    const init = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.update(); p.draw();
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isDark
              ? `rgba(255, 255, 255, ${(1 - dist / maxDistance) * (active ? 0.1 : 0.03)})`
              : `rgba(0, 0, 0, ${(1 - dist / maxDistance) * (active ? 0.05 : 0.02)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize(); init(); animate();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [active, theme, isDark]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-colors duration-700">
      <div className={`absolute inset-0 ${isDark ? 'bg-[#0b0b0f]' : 'bg-[#f5f5f7]'}`} />
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{ 
          backgroundImage: `linear-gradient(to right, ${isDark ? '#ffffff' : '#000000'} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? '#ffffff' : '#000000'} 1px, transparent 1px)`,
          backgroundSize: '64px 64px'
        }} 
      />
      <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent ${isDark ? 'to-[#0b0b0f]' : 'to-[#f5f5f7]'} opacity-80`} />
    </div>
  );
};

// --- 子组件：Anytype 风格数据方块加载 ---
const DataBlockProgress = ({ active, accentClass }) => {
  return (
    <div className="flex gap-0.5 ml-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.1, scale: 0.8 }}
          animate={active ? { 
            opacity: [0.1, 0.6, 0.1],
            scale: [0.8, 1, 0.8],
          } : { opacity: 0.05 }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
          className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-[1px] md:rounded-[2px] ${accentClass}`}
        />
      ))}
    </div>
  );
};

// --- 子组件：记忆块 ---
const MemoryBlock = ({ memory, theme }) => {
  const { status, type, name, intent, size } = memory;
  const isDark = theme === 'dark';
  const icons = { audio: Music, image: ImageIcon, link: Globe, file: FileText, text: Zap };
  const Icon = icons[type] || Zap;
  const config = getIntents(type, '', theme);

  return (
    <motion.div 
      layout
      initial={{ height: 0, opacity: 0, marginBottom: 0 }}
      animate={{ 
        height: 'auto', opacity: 1, marginBottom: 12,
        ...(status === 'synced' ? { scale: [1, 1.05, 1], y: [0, -5, 0] } : {})
      }}
      transition={{ type: "spring", stiffness: 400, damping: status === 'synced' ? 12 : 30 }}
      className="relative overflow-hidden w-full"
    >
      <motion.div
        initial={status === 'floating' ? { scale: 0.85, opacity: 0, filter: 'blur(10px)', y: 20 } : false}
        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-sm'} border rounded-2xl flex items-center gap-3 md:gap-4 transition-all cursor-default group h-[64px] md:h-[72px] p-3 md:p-4 relative overflow-hidden`}
      >
        <AnimatePresence>
          {status === 'rippling' && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 2.5, opacity: [0, 0.3, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border ${isDark ? 'border-white/20' : 'border-black/10'} rounded-full z-0`}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'analyzing' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ x: [Math.random() * 100, Math.random() * 200], y: [Math.random() * 60, Math.random() * 60], opacity: [0, 0.25, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                  className={`absolute w-1 h-1 rounded-full blur-[1px] ${config.accent} opacity-30`}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl shrink-0 ${config.color} ${config.text} flex items-center justify-center relative z-10 shadow-inner`}>
          {status === 'analyzing' ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }}>
              <Icon size={16} md:size={18} strokeWidth={2} />
            </motion.div>
          ) : (
            <Icon size={16} md:size={18} strokeWidth={2} />
          )}
        </div>

        <div className="flex-1 min-w-0 relative z-10">
          <div className={`text-xs font-bold truncate mb-1 transition-colors ${status === 'rippling' ? 'text-transparent' : (isDark ? 'text-white/80' : 'text-black/80')}`}>
            {name}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors ${status === 'analyzing' ? config.text : (isDark ? 'text-white/20' : 'text-black/20')}`}>
              {status === 'analyzing' ? 'Analyzing' : (status === 'routing' ? 'Routing' : intent)}
              {status === 'routing' && <DataBlockProgress active accentClass={config.accent} />}
            </span>
          </div>
        </div>

        <div className="relative z-10">
          {status === 'synced' ? (
            <CheckCircle2 size={14} className="text-emerald-500/50" />
          ) : (
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === 'analyzing' || status === 'routing' ? config.accent : (isDark ? 'bg-white/10' : 'bg-black/10')}`} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- 主应用组件 ---
export default function App() {
  const [theme, setTheme] = useState('dark');
  const [inputValue, setInputValue] = useState('');
  const [captureType, setCaptureType] = useState('text');
  
  const [isAbsorbing, setIsAbsorbing] = useState(false); 
  const [isCollapsing, setIsCollapsing] = useState(false); 
  const [isDiving, setIsDiving] = useState(false); 
  const [isDragging, setIsDragging] = useState(false); 
  
  const [memories, setMemories] = useState([
    { id: 1, type: 'link', name: 'linear.app/method', intent: '产品设计', time: '1h ago', size: 'URL', status: 'synced' },
    { id: 2, type: 'image', name: 'Invoice_Jan.pdf', intent: '财务账单', time: '3h ago', size: '1.2MB', status: 'synced' },
  ]);

  const isDark = theme === 'dark';
  const isAIProcessing = isAbsorbing || isCollapsing || isDiving || memories.some(m => m.status === 'analyzing' || m.status === 'routing');

  const handleCapture = (type, content) => {
    if (isAbsorbing || isCollapsing || isDiving) return;
    setCaptureType(type);
    setIsAbsorbing(true); 
    const rawContent = content || inputValue;

    setTimeout(() => {
      setIsCollapsing(true);
      setTimeout(() => {
        setIsAbsorbing(false); setIsCollapsing(false); setIsDiving(true); setInputValue(''); 
        const newId = Date.now();
        setTimeout(() => {
          setIsDiving(false);
          const newMemory = {
            id: newId, type: type,
            name: rawContent.length > 30 ? rawContent.substring(0, 30) + '...' : (rawContent || `采集_${type}`),
            intent: '...', size: type === 'text' ? '文本' : (type === 'file' ? '文件' : '资产'),
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
                  setMemories(prev => prev.map(m => m.id === newId ? { ...m, status: 'synced', intent: getIntents(type, rawContent, theme).intent } : m));
                }, 10000);
              }, 5000); 
            }, 800);
          }, 800);
        }, 600);
      }, 800);
    }, 400);
  };

  const onDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleCapture(file.type.startsWith('image/') ? 'image' : 'file', file.name);
    }
  };

  const ActionButton = ({ icon: Icon, onClick }) => (
    <button onClick={onClick} className={`p-2 transition-all rounded-lg ${isDark ? 'text-white/20 hover:text-white hover:bg-white/5' : 'text-black/20 hover:text-black hover:bg-black/5'}`}>
      <Icon size={16} strokeWidth={2} />
    </button>
  );

  return (
    <div 
      className={`fixed inset-0 overflow-hidden font-sans antialiased flex flex-col transition-colors duration-700 ${isDark ? 'text-[#ededed]' : 'text-[#1d1d1f]'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      <NeuralBackground active={isAIProcessing} theme={theme} />
      
      {/* 拖拽感应层 */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[100] backdrop-blur-md flex items-center justify-center p-12 pointer-events-none ${isDark ? 'bg-[#0b0b0f]/80' : 'bg-white/80'}`}
          >
            <div className={`w-full h-full border-2 border-dashed rounded-[40px] flex flex-col items-center justify-center gap-4 ${isDark ? 'border-white/20' : 'border-black/10'}`}>
               <UploadCloud size={40} className={`animate-bounce ${isDark ? 'text-white/40' : 'text-black/20'}`} />
               <p className={`text-sm font-bold uppercase tracking-[0.3em] ${isDark ? 'text-white/40' : 'text-black/40'}`}>释放以采集到大脑</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Header */}
      <header className={`h-14 px-4 md:px-6 flex items-center justify-between border-b backdrop-blur-xl z-20 transition-colors ${isDark ? 'border-white/[0.05] bg-[#0b0b0f]/50' : 'border-black/[0.05] bg-white/50'}`}>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
             <div className={`w-6 h-6 rounded flex items-center justify-center shadow-lg ${isDark ? 'bg-white' : 'bg-black'}`}>
               <Zap size={14} fill={isDark ? 'black' : 'white'} stroke={isDark ? 'black' : 'white'} />
             </div>
             <span className="font-bold text-sm tracking-tight">SuperInbox</span>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setTheme(isDark ? 'light' : 'dark')}
             className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-yellow-400' : 'bg-black/5 hover:bg-black/10 text-indigo-600'}`}
           >
             {isDark ? <Sun size={16} /> : <Moon size={16} />}
           </button>
           <div className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer ${isDark ? 'bg-white/5 border-white/10 text-white/40' : 'bg-black/5 border-black/10 text-black/40'}`}>
              <User size={14} />
           </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className={`hidden md:flex w-14 border-r flex-col items-center py-6 gap-6 transition-colors ${isDark ? 'border-white/[0.05] bg-[#0b0b0f]/30' : 'border-black/[0.05] bg-black/[0.02]'}`}>
           <button className={`p-2 rounded-xl ${isDark ? 'text-white bg-white/5' : 'text-black bg-black/5'}`}><Inbox size={20} strokeWidth={1.5} /></button>
           <button className="p-2 text-white/20"><LayoutGrid size={20} strokeWidth={1.5} /></button>
           <button className="p-2 text-white/20"><History size={20} strokeWidth={1.5} /></button>
           <div className="mt-auto"><button className="p-2 text-white/20"><Settings size={20} strokeWidth={1.5} /></button></div>
        </aside>

        <section className="flex-1 flex flex-col min-w-0">
          {/* 中心舞台 */}
          <div className="flex-[1.2] flex flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-2xl relative">
              
              <AnimatePresence>
                {isDiving && (
                  <motion.div 
                    initial={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                    animate={{ scale: 0, opacity: 0, filter: 'blur(20px)' }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none"
                  >
                     <div className={`w-10 h-10 backdrop-blur-3xl rounded-full border shadow-2xl ${isDark ? 'bg-white/30 border-white/40 shadow-white/20' : 'bg-black/20 border-black/20 shadow-black/10'}`} />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div 
                animate={{ 
                  scale: isAbsorbing ? 0.98 : 1, y: isAbsorbing ? 4 : 0,
                  boxShadow: isAbsorbing ? (isDark ? "inset 0 0 40px rgba(0,0,0,0.5)" : "inset 0 0 40px rgba(0,0,0,0.1)") : "none"
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`relative border rounded-[22px] md:rounded-[26px] p-1 md:p-2 shadow-2xl overflow-hidden z-10 transition-colors ${isDark ? 'bg-[#0f0f13] border-white/[0.08]' : 'bg-white border-black/[0.05]'}`}
              >
                <AnimatePresence>
                  {isCollapsing && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm ${isDark ? 'bg-black/70' : 'bg-white/40'}`}
                    >
                      <motion.div 
                        initial={{ scaleX: 1, scaleY: 1, opacity: 0 }}
                        animate={{ scaleY: [1.3, 0.02, 0.02], scaleX: [1.3, 1.3, 0], opacity: [0, 1, 1, 0] }}
                        transition={{ duration: 0.8, times: [0, 0.7, 0.9, 1], ease: [0.19, 1, 0.22, 1] }}
                        className="relative flex items-center justify-center w-full"
                      >
                        <div className="relative w-48 md:w-72 h-24 md:h-32 flex items-center justify-center">
                          <div className={`absolute inset-0 blur-2xl rounded-full ${isDark ? 'bg-white/20' : 'bg-black/10'}`} />
                          <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-lg ${isDark ? 'text-white' : 'text-black'}`}>
                            <path d="M 50 0 C 50 35 65 50 100 50 C 65 50 50 65 50 100 C 50 65 35 50 0 50 C 35 50 50 35 50 0 Z" fill="currentColor" />
                          </svg>
                          <div className={`absolute w-full h-[1px] shadow-lg ${isDark ? 'bg-white shadow-white' : 'bg-black shadow-black'}`} />
                          <div className={`absolute h-full w-[1px] shadow-lg ${isDark ? 'bg-white shadow-white' : 'bg-black shadow-black'}`} />
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <textarea 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="记录此刻的想法..."
                  disabled={isAbsorbing || isCollapsing || isDiving}
                  className="relative z-10 w-full bg-transparent border-none outline-none px-4 md:px-6 py-4 md:py-6 text-base md:text-lg placeholder:text-black/10 dark:placeholder:text-white/10 resize-none h-28 md:h-40 no-scrollbar leading-relaxed disabled:text-transparent transition-colors"
                />
                
                <div className="relative z-10 flex items-center justify-between px-3 md:px-4 pb-3 md:pb-4">
                  <div className="flex items-center gap-1">
                    <ActionButton icon={Mic} onClick={() => handleCapture('audio', '语音想法')} />
                    <ActionButton icon={ImageIcon} onClick={() => handleCapture('image', '视觉笔记')} />
                    <ActionButton icon={Globe} onClick={() => handleCapture('link', '网页剪藏')} />
                  </div>
                  <button 
                    onClick={() => handleCapture('text', inputValue)}
                    disabled={!inputValue.trim() || isAbsorbing || isCollapsing || isDiving}
                    className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-20 flex items-center gap-2 ${isDark ? 'bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-black text-white hover:bg-black/90 shadow-md'}`}
                  >
                    Capture <ChevronRight size={14} strokeWidth={3} />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* 历史记录 */}
          <div className={`flex-1 min-h-0 border-t p-4 md:p-6 flex flex-col gap-4 transition-colors ${isDark ? 'border-white/[0.05] bg-[#0b0b0f]/40' : 'border-black/[0.05] bg-black/[0.01]'}`}>
            <div className="flex items-center justify-between px-1 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 ${isDark ? 'text-white/20' : 'text-black/30'}`}>
                <History size={12} /> 最近采集记录
              </span>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-8">
                <AnimatePresence initial={false}>
                  {memories.map(m => <MemoryBlock key={m.id} memory={m} theme={theme} />)}
                </AnimatePresence>
                <div className={`h-[64px] md:h-[72px] border border-dashed rounded-2xl flex items-center justify-center opacity-10 shrink-0 ${isDark ? 'border-white' : 'border-black'}`}>
                   <Plus size={18} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .animate-shimmer { animation: shimmer 3s infinite linear; }
      `}} />
    </div>
  );
}