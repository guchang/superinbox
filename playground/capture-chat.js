import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Inbox, CheckCircle2, Settings, Send, Zap, 
  Database, Bell, Activity, Shield, Music, FileText, 
  Image as ImageIcon, Mic, Globe, LayoutGrid, History, 
  User, MoreHorizontal, ChevronRight, UploadCloud, Sun, Moon,
  Hash, MessageSquare, AtSign, Smile, Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 模拟 AI 意图引擎逻辑 ---
const getIntents = (type, theme) => {
  const isDark = theme === 'dark';
  const map = {
    audio: { intent: '音频解析', route: 'Apple Music', color: isDark ? 'bg-rose-500/20' : 'bg-rose-100', text: isDark ? 'text-rose-400' : 'text-rose-600', accent: 'bg-rose-500' },
    image: { intent: '视觉 OCR', route: 'Notion 资产', color: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100', text: isDark ? 'text-emerald-400' : 'text-emerald-600', accent: 'bg-emerald-500' },
    link: { intent: '网页摘要', route: 'Readwise', color: isDark ? 'bg-blue-500/20' : 'bg-blue-100', text: isDark ? 'text-blue-400' : 'text-blue-600', accent: 'bg-blue-500' },
    file: { intent: '文档结构', route: 'Google Drive', color: isDark ? 'bg-amber-500/20' : 'bg-amber-100', text: isDark ? 'text-amber-400' : 'text-amber-600', accent: 'bg-amber-500' },
    text: { intent: '语义识别', route: 'Obsidian 库', color: isDark ? 'bg-white/5' : 'bg-black/5', text: isDark ? 'text-white/60' : 'text-black/60', accent: isDark ? 'bg-white/40' : 'bg-black/40' },
  };
  return map[type] || map.text;
};

// --- 神经背景 ---
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

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };

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
        this.x += this.vx * (active ? 2.5 : 1);
        this.y += this.vy * (active ? 2.5 : 1);
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? (active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)') : (active ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.02)');
        ctx.fill();
      }
    }

    const init = () => { for (let i = 0; i < particleCount; i++) particles.push(new Particle()); };
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.update(); p.draw();
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.sqrt((p.x - p2.x)**2 + (p.y - p2.y)**2);
          if (dist < 150) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isDark ? `rgba(255,255,255,${(1 - dist / 150) * (active ? 0.1 : 0.03)})` : `rgba(0,0,0,${(1 - dist / 150) * (active ? 0.05 : 0.015)})`;
            ctx.stroke();
          }
        }
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    window.addEventListener('resize', resize); resize(); init(); animate();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animationFrameId); };
  }, [active, theme, isDark]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
};

// --- 对话气泡组件 ---
const MessageBubble = ({ message, theme }) => {
  const { status, type, content, intent, timestamp } = message;
  const isDark = theme === 'dark';
  const config = getIntents(type, theme);
  const Icon = { audio: Mic, image: ImageIcon, link: Globe, file: FileText, text: Zap }[type] || Zap;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1, ...(status === 'synced' ? { scale: [1, 1.02, 1] } : {}) }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="flex gap-4 mb-8 group"
    >
      <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center transition-all ${config.color} ${config.text} ${status === 'analyzing' ? 'animate-pulse' : ''}`}>
        <Icon size={20} className={status === 'analyzing' ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white/80' : 'text-black/80'}`}>
            {type === 'text' ? 'Quick Thought' : `Captured ${type}`}
          </span>
          <span className="text-[10px] text-white/20 font-medium">{timestamp}</span>
        </div>

        <div className={`relative p-4 rounded-2xl rounded-tl-none border transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.05]' : 'bg-white border-black/[0.05] shadow-sm'}`}>
          {/* 分析阶段的粒子背景 */}
          <AnimatePresence>
            {status === 'analyzing' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-2xl"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ x: [Math.random() * 400, Math.random() * 400], y: [Math.random() * 80, Math.random() * 80], opacity: [0, 0.4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                    className={`absolute w-1 h-1 rounded-full blur-[1px] ${config.accent}`}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <p className={`text-sm leading-relaxed relative z-10 ${isDark ? 'text-white/80' : 'text-black/80'}`}>
            {content}
          </p>

          {/* 状态指示栏 */}
          <div className="mt-4 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${config.text}`}>
                {status === 'analyzing' ? 'Analyzing Intent...' : (status === 'routing' ? 'Routing' : intent)}
                {status === 'routing' && (
                  <div className="flex gap-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <motion.div key={i} animate={{ opacity: [0.1, 0.6, 0.1] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }} className={`w-1 h-1 rounded-full ${config.accent}`} />
                    ))}
                  </div>
                )}
              </span>
            </div>
            {status === 'synced' && (
              <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase tracking-tighter">
                <CheckCircle2 size={10} /> Saved to {config.route}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- 主应用组件 ---
export default function App() {
  const [theme, setTheme] = useState('dark');
  const [inputValue, setInputValue] = useState('');
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, type: 'link', content: 'https://linear.app/method - 学习一下他们的设计系统', intent: '产品设计', status: 'synced', timestamp: '10:42 AM' },
    { id: 2, type: 'text', content: '明早提醒我查看 Q1 的服务器预算，可能需要扩容。', intent: '待办事项', status: 'synced', timestamp: '11:15 AM' }
  ]);

  const isDark = theme === 'dark';
  const isAIProcessing = isCollapsing || messages.some(m => m.status === 'analyzing' || m.status === 'routing');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = (type = 'text', customContent = null) => {
    const content = customContent || inputValue;
    if (!content.trim()) return;

    setIsCollapsing(true);
    
    // 0.8s 内容坍缩动效
    setTimeout(() => {
      setIsCollapsing(false);
      setInputValue('');
      
      const newId = Date.now();
      const newMsg = {
        id: newId, type, content,
        status: 'analyzing',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: '...'
      };
      setMessages(prev => [...prev, newMsg]);

      // 生命周期：5s Analyzing -> 10s Routing -> Synced
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === newId ? { ...m, status: 'routing' } : m));
        setTimeout(() => {
          setMessages(prev => prev.map(m => m.id === newId ? { ...m, status: 'synced', intent: getIntents(m.type, theme).intent } : m));
        }, 10000);
      }, 5000);
    }, 800);
  };

  return (
    <div className={`fixed inset-0 flex transition-colors duration-700 font-sans antialiased ${isDark ? 'bg-[#0b0b0f] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}>
      <NeuralBackground active={isAIProcessing} theme={theme} />

      {/* 极简侧边栏 (Slack Style) */}
      <aside className={`hidden lg:flex w-64 flex-col border-r transition-colors z-20 ${isDark ? 'bg-black/20 border-white/[0.05]' : 'bg-white/40 border-black/[0.05]'}`}>
        <div className="p-6 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ${isDark ? 'bg-white' : 'bg-black'}`}>
            <Zap size={18} fill={isDark ? 'black' : 'white'} stroke={isDark ? 'black' : 'white'} />
          </div>
          <span className="font-black text-sm tracking-tighter">SuperInbox</span>
        </div>
        
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto no-scrollbar">
          <SidebarItem icon={Hash} label="all-captured" active theme={theme} />
          <SidebarItem icon={AtSign} label="mentions" theme={theme} />
          <SidebarItem icon={MessageSquare} label="drafts" theme={theme} />
          <div className="pt-8 pb-2 px-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Nodes</div>
          <SidebarItem icon={Database} label="Notion" theme={theme} />
          <SidebarItem icon={FileText} label="Obsidian" theme={theme} />
          <SidebarItem icon={History} label="Archive" theme={theme} />
        </nav>

        <div className="p-4 border-t border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500" />
          <div className="flex-1 min-w-0">
             <div className="text-xs font-bold truncate">Alpha User</div>
             <div className="text-[10px] opacity-40">Local Instance</div>
          </div>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="p-2 opacity-40 hover:opacity-100 transition-opacity">
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </aside>

      {/* 主消息区域 */}
      <main className="flex-1 flex flex-col relative z-10 min-w-0">
        <header className={`h-14 px-6 flex items-center justify-between border-b backdrop-blur-xl ${isDark ? 'border-white/[0.05] bg-black/10' : 'border-black/[0.05] bg-white/30'}`}>
          <div className="flex items-center gap-3">
            <Hash size={18} className="opacity-40" />
            <span className="font-bold text-sm">all-captured</span>
            <div className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-bold">LIVE</div>
          </div>
          <div className="flex items-center gap-4 opacity-40">
             <Search size={16} />
             <Bell size={16} />
             <Settings size={16} />
          </div>
        </header>

        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-10 no-scrollbar">
          <div className="max-w-3xl mx-auto">
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} theme={theme} />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* 底部输入区 (TV Off Collapse Area) */}
        <div className="p-6">
          <div className="max-w-3xl mx-auto relative">
            
            <div className={`relative rounded-2xl border transition-all ${isDark ? 'bg-[#0f0f13] border-white/[0.08] shadow-2xl focus-within:border-white/20' : 'bg-white border-black/[0.1] shadow-lg focus-within:border-black/30'}`}>
              
              {/* 内容坍缩层 (TV Off Effect inside the bar) */}
              <AnimatePresence>
                {isCollapsing && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={`absolute inset-0 z-50 flex items-center justify-center rounded-2xl ${isDark ? 'bg-black/60' : 'bg-white/40'} backdrop-blur-sm`}
                  >
                    <motion.div 
                      initial={{ scaleX: 1, scaleY: 1 }}
                      animate={{ scaleY: [1.3, 0.02, 0.02], scaleX: [1.3, 1.3, 0], opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 0.8, times: [0, 0.7, 0.9, 1], ease: [0.19, 1, 0.22, 1] }}
                      className="relative flex items-center justify-center w-full"
                    >
                       <div className="relative w-48 h-20 flex items-center justify-center">
                         <div className={`absolute inset-0 blur-2xl rounded-full ${isDark ? 'bg-white/20' : 'bg-black/10'}`} />
                         <svg viewBox="0 0 100 100" className={`w-full h-full ${isDark ? 'text-white' : 'text-black'}`}>
                           <path d="M 50 0 C 50 35 65 50 100 50 C 65 50 50 65 50 100 C 50 65 35 50 0 50 C 35 50 50 35 50 0 Z" fill="currentColor" />
                         </svg>
                       </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <textarea 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                placeholder="Message SuperInbox..."
                disabled={isCollapsing}
                className="w-full bg-transparent border-none outline-none px-4 py-4 text-sm min-h-[100px] resize-none no-scrollbar placeholder:opacity-30 disabled:text-transparent transition-colors"
              />

              <div className="flex items-center justify-between px-4 pb-3 border-t border-white/[0.03]">
                <div className="flex items-center gap-1 opacity-40">
                  <InputTool icon={Plus} />
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  <InputTool icon={ImageIcon} />
                  <InputTool icon={Paperclip} />
                  <InputTool icon={Mic} />
                  <InputTool icon={Smile} />
                </div>
                <button 
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isCollapsing}
                  className={`p-2 rounded-lg transition-all ${inputValue.trim() ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : 'opacity-20'}`}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
            
            <div className="mt-3 text-[10px] text-center opacity-20 font-bold uppercase tracking-widest">
              End-to-end Encrypted • Local Brain Node
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}

// --- 小型组件 ---

const SidebarItem = ({ icon: Icon, label, active, theme }) => {
  const isDark = theme === 'dark';
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${active ? (isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-black') : 'opacity-40 hover:opacity-100 hover:bg-white/5'}`}>
      <Icon size={16} />
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
};

const InputTool = ({ icon: Icon }) => (
  <button className="p-1.5 hover:bg-white/5 rounded-md transition-all">
    <Icon size={16} />
  </button>
);