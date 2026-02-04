import React, { useState, useEffect, useRef, useMemo, forwardRef } from 'react';
import { 
  Plus, Search, Inbox, CheckCircle2, Wallet, Lightbulb, Link2, 
  Settings, Send, Zap, ArrowRightLeft, 
  Database, Bell, X, Activity, Shield, Cpu, Sparkles, 
  Music, FileText, Image as ImageIcon, Mic, Paperclip, 
  Globe, LayoutGrid, List, History, HardDrive, Share2, User,
  MoreHorizontal, ChevronRight, Command, Loader2, Sun, Moon,
  Clock, Eye, Trash2, ChevronDown, ChevronUp, Play, Download,
  Edit3, RotateCcw, Info, Hash, Type, BarChart3, Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 模拟 AI 意图引擎逻辑 (含色彩配置) ---
const getIntents = (type, theme) => {
  const isDark = theme === 'dark';
  const map = {
    todo: { tag: '待办', icon: CheckCircle2, intent: '待办+日程', route: 'todoist', color: isDark ? 'bg-blue-500/20' : 'bg-blue-100', text: isDark ? 'text-blue-400' : 'text-blue-600', accent: 'bg-blue-400' },
    audio: { tag: '音频', icon: Mic, intent: '音频解析', route: 'Apple Music', color: isDark ? 'bg-rose-500/20' : 'bg-rose-100', text: isDark ? 'text-rose-400' : 'text-rose-600', accent: 'bg-rose-500' },
    image: { tag: '资产', icon: ImageIcon, intent: '视觉 OCR', route: 'Notion 资产', color: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100', text: isDark ? 'text-emerald-400' : 'text-emerald-600', accent: 'bg-emerald-400' },
    link: { tag: '收藏', icon: Link2, intent: '网页摘要', route: 'Readwise', color: isDark ? 'bg-indigo-500/20' : 'bg-indigo-100', text: isDark ? 'text-indigo-400' : 'text-indigo-600', accent: 'bg-indigo-500' },
    file: { tag: '文档', icon: Paperclip, intent: '文件存储', route: 'Google Drive', color: isDark ? 'bg-amber-500/20' : 'bg-amber-100', text: isDark ? 'text-amber-400' : 'text-amber-600', accent: 'bg-amber-500' },
    text: { tag: '记录', icon: Type, intent: '意图识别', route: 'Obsidian', color: isDark ? 'bg-white/5' : 'bg-black/5', text: isDark ? 'text-white/60' : 'text-black/60', accent: isDark ? 'bg-white/40' : 'bg-black/40' },
    dev: { tag: '开发', icon: Cpu, intent: 'SuperInbox开发', route: 'todoist', color: isDark ? 'bg-purple-500/20' : 'bg-purple-100', text: isDark ? 'text-purple-400' : 'text-purple-600', accent: 'bg-purple-400' },
    finance: { tag: '账务', icon: Wallet, intent: '财务记录', route: 'Excel', color: isDark ? 'bg-orange-500/20' : 'bg-orange-100', text: isDark ? 'text-orange-400' : 'text-orange-600', accent: 'bg-orange-400' }
  };
  return map[type] || map.text;
};

// --- 子组件：媒体渲染器 ---
const ImageRenderer = ({ theme, seed }) => (
  <div className={`w-full aspect-video rounded-xl mb-4 overflow-hidden relative border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
    <img src={`https://picsum.photos/seed/${seed}/600/400`} alt="Capture" className="w-full h-full object-cover" />
  </div>
);

const AudioPlayerPlaceholder = ({ theme }) => (
  <div className={`w-full p-3 rounded-xl mb-4 flex items-center gap-3 border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`}><Play size={14} fill="currentColor" /></div>
    <div className="flex-1 flex items-end gap-0.5 h-6">{Array.from({ length: 15 }).map((_, i) => (<div key={i} className={`flex-1 rounded-full ${theme === 'dark' ? 'bg-white/20' : 'bg-black/20'}`} style={{ height: `${Math.random() * 100}%` }} />))}</div>
  </div>
);

const FileAttachmentPlaceholder = ({ theme, fileName = "document.pdf" }) => (
  <div className={`w-full p-3 rounded-xl mb-4 flex items-center justify-between border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-amber-500/20 text-amber-500' : 'bg-amber-500/10 text-amber-600'}`}><FileText size={16} /></div>
      <div className="min-w-0"><div className="text-[11px] font-bold truncate opacity-80">{fileName}</div><div className="text-[9px] font-bold opacity-30 uppercase">2.4 MB · PDF</div></div>
    </div>
    <Download size={14} className="opacity-20" />
  </div>
);

// --- 详情模态框 ---
const DetailModal = ({ item, theme, onClose }) => {
  if (!item) return null;
  const isDark = theme === 'dark';
  const config = getIntents(item.type, theme);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] p-8 relative shadow-3xl ${isDark ? 'bg-[#12121a] text-white border border-white/10' : 'bg-white text-black border border-black/5'}`} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-6 right-6 p-2 opacity-40 hover:opacity-100 transition-opacity"><X size={20} /></button>
        <div className="flex items-center gap-3 mb-6"><div className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${config.color} ${config.text}`}>{item.tag || config.tag}</div><span className="opacity-30 text-xs font-bold uppercase">{item.timestamp} · FROM {item.source}</span></div>
        <h2 className="text-2xl font-black mb-8 leading-tight">{item.content}</h2>
        {item.type === 'image' && <div className="mb-8 rounded-2xl overflow-hidden shadow-lg"><ImageRenderer theme={theme} seed={item.id} /></div>}
        <div className={`grid grid-cols-2 gap-4 mb-8 p-6 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
          <div><div className="text-[10px] font-black uppercase opacity-30 mb-1">意图识别</div><div className="text-sm font-bold">{config.intent}</div></div>
          <div><div className="text-[10px] font-black uppercase opacity-30 mb-1">路由目的地</div><div className="text-sm font-bold flex items-center gap-2 text-emerald-500"><CheckCircle2 size={14}/> {config.route}</div></div>
        </div>
        <div className="flex gap-3">
          <button className={`flex-1 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${isDark ? 'bg-white text-black' : 'bg-black text-white'}`}><Edit3 size={16}/> 编辑内容</button>
          <button className={`flex-1 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'}`}><RotateCcw size={16}/> 重新识别</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- 核心：记忆卡片 ---
const MemoryBlock = forwardRef(({ memory, theme, onOpenDetails }, ref) => {
  const { id, status, type, content, timestamp, source, tag, fileName } = memory;
  const isDark = theme === 'dark';
  const config = getIntents(type, theme);
  const [isLongPressed, setIsLongPressed] = useState(false);
  const longPressTimer = useRef(null);

  const handleTouchStart = () => { longPressTimer.current = setTimeout(() => setIsLongPressed(true), 600); };
  const handleTouchEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const OptionItem = ({ icon: Icon, label, color, onClick }) => {
    const textColor = color ? color : (isDark ? 'text-white/90' : 'text-slate-900');
    const hoverBg = isDark ? 'hover:bg-white/10' : 'hover:bg-black/5';
    return (
      <button onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); setIsLongPressed(false); }} className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all active:scale-95 ${hoverBg} ${textColor}`}>
        <Icon size={18} strokeWidth={2.5} /><span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
      </button>
    );
  };

  return (
    <motion.div ref={ref} layout onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={`group border rounded-[24px] p-5 relative transition-all break-inside-avoid mb-4 overflow-hidden ${isDark ? 'bg-white/[0.02] border-white/[0.06] hover:border-white/20' : 'bg-white border-black/[0.04] shadow-sm hover:shadow-xl'}`}>
      
      <AnimatePresence>
        {status === 'analyzing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div key={i} animate={{ x: [Math.random() * 400, Math.random() * 400], y: [Math.random() * 200, Math.random() * 200], opacity: [0, 0.3, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }} className={`absolute w-1 h-1 rounded-full blur-[1px] ${config.accent}`} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-4 backdrop-blur-2xl transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 ${isLongPressed ? 'opacity-100 pointer-events-auto' : 'opacity-0'} ${isDark ? 'bg-slate-900/80 border border-white/10' : 'bg-white/70 border border-black/5'}`}>
        <div className="grid grid-cols-3 gap-2 w-full max-w-[200px] relative z-10">
          <OptionItem icon={Edit3} label="编辑" />
          <OptionItem icon={Info} label="详情" onClick={() => onOpenDetails(memory)} />
          <OptionItem icon={RotateCcw} label="重识" />
          <OptionItem icon={ArrowRightLeft} label="重发" />
          <OptionItem icon={Trash2} label="删除" color="text-rose-500" />
          <button onClick={(e) => { e.stopPropagation(); setIsLongPressed(false); }} className={`flex items-center justify-center rounded-xl transition-all border ${isDark ? 'bg-white/10 text-white border-white/10' : 'bg-black/5 text-slate-900 border-black/5'}`}><X size={18}/></button>
        </div>
      </div>

      <div className="relative z-10 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-white/60 border border-white/10' : 'bg-black/5 text-black/60 border border-black/5'}`}>{status === 'analyzing' ? 'AI 深度识别中...' : (tag || config.tag)}</div>
          <div className="flex items-center gap-2 text-[10px] font-bold opacity-30 uppercase"><Clock size={11} /> {timestamp}</div>
        </div>
        {type === 'image' && <ImageRenderer theme={theme} seed={id} />}
        {type === 'audio' && <AudioPlayerPlaceholder theme={theme} />}
        {type === 'file' && <FileAttachmentPlaceholder theme={theme} fileName={fileName} />}
        <h3 className={`text-lg font-bold leading-tight mb-4 ${isDark ? 'text-white/95' : 'text-black/95'} line-clamp-3`}>{content}</h3>
        
        <div className="flex justify-between items-center pt-2 border-t border-current/5">
          <div className="flex items-center gap-2 min-w-0">
            {status === 'synced' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 truncate">
                <CheckCircle2 size={12} className="shrink-0" /> <span className="truncate">已分发: {config.intent}</span>
              </div>
            ) : (
              <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full text-[10px] font-black border transition-colors cursor-default select-none ${isDark ? 'bg-white/5 border-white/10 text-white/30' : 'bg-black/5 border-black/5 text-black/30'}`}>
                <span className="whitespace-nowrap">{status === 'analyzing' ? '识别意图中...' : '分发至节点...'}</span>
                <div className="flex gap-1 shrink-0">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <motion.div key={i} animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} className={`w-1.5 h-1.5 rounded-[2px] ${config.accent}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="text-[10px] font-bold opacity-20 uppercase tracking-widest hidden md:block shrink-0">{source}</div>
        </div>
      </div>
    </motion.div>
  );
});

MemoryBlock.displayName = 'MemoryBlock';

// --- 主应用 ---
export default function App() {
  const [theme, setTheme] = useState('light'); 
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false); 
  const [activeDetail, setActiveDetail] = useState(null); 
  const [isAbsorbing, setIsAbsorbing] = useState(false); 
  const [isCollapsing, setIsCollapsing] = useState(false); 
  const [isDiving, setIsDiving] = useState(false); 
  
  // 双重筛选状态
  const [activeIntent, setActiveIntent] = useState('all'); // Sidebar: 意图标签
  const [activeType, setActiveType] = useState('all');   // Top Pills: 媒体类型

  const [memories, setMemories] = useState([
    { id: 101, type: 'image', content: '发现一组很有张力的建筑摄影，可以作为品牌官网设计的背景灵感。', intent: 'image', tag: '资产', source: 'MOBILE', status: 'synced', timestamp: '5 分钟前' },
    { id: 102, type: 'audio', content: '关于 SuperInbox 品牌升级的一段语音备忘录。', intent: 'audio', tag: '音频', source: 'MOBILE', status: 'synced', timestamp: '15 分钟前' },
    { id: 103, type: 'text', content: '关于隐私的思考：开源是建立信任的唯一路径，用户必须掌控自己的存储。', intent: 'dev', tag: '开发计划', source: 'LARK', status: 'synced', timestamp: '2 天前' },
    { id: 104, type: 'file', content: '2026 年度产品路线规划书，包含 Q1-Q4 的所有核心功能。', fileName: 'Roadmap_2026.pdf', intent: 'file', tag: '文档', source: 'WEB', status: 'synced', timestamp: '3 天前' },
    { id: 105, type: 'text', content: '明天去星巴克见张总，谈谈 A 轮融资的事情。', intent: 'todo', tag: '日程', source: 'WEB', status: 'synced', timestamp: '刚刚' },
  ]);

  const isDark = theme === 'dark';
  const isExpandedInput = isFocused || inputValue.trim().length > 0;

  // 组合过滤逻辑
  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      const intentMatch = activeIntent === 'all' || m.intent === activeIntent;
      const typeMatch = activeType === 'all' || m.type === activeType;
      return intentMatch && typeMatch;
    });
  }, [memories, activeIntent, activeType]);

  const handleCapture = (type = 'text', customContent = null, extra = {}) => {
    const finalContent = customContent || inputValue;
    if (!finalContent.trim() || isAbsorbing) return;
    setIsAbsorbing(true); 
    setTimeout(() => {
      setIsCollapsing(true);
      setTimeout(() => {
        setIsAbsorbing(false); setIsCollapsing(false); setIsDiving(true); setInputValue(''); setIsFocused(false);
        const newId = Date.now();
        setTimeout(() => {
          setIsDiving(false);
          const newMemory = { id: newId, type: type, content: finalContent, status: 'analyzing', timestamp: '刚刚', source: 'WEB', tag: '识别中...', intent: type === 'text' ? 'todo' : type, ...extra };
          setMemories(prev => [newMemory, ...prev]);
          setTimeout(() => {
            setMemories(prev => prev.map(m => m.id === newId ? { ...m, status: 'routing', tag: getIntents(m.intent, theme).tag } : m));
            setTimeout(() => { setMemories(prev => prev.map(m => m.id === newId ? { ...m, status: 'synced' } : m)); }, 5000);
          }, 5000);
        }, 600);
      }, 800);
    }, 400);
  };

  const InputToolButton = ({ icon: Icon, onClick, title }) => (
    <button onMouseDown={(e) => { e.preventDefault(); onClick(); }} title={title} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-white/40 hover:text-white' : 'hover:bg-black/5 text-black/40 hover:text-black'}`}><Icon size={18} strokeWidth={2.5} /></button>
  );

  // 侧边栏导航项
  const NavItem = ({ id, label, icon: Icon, color = "" }) => {
    const isActive = activeIntent === id;
    return (
      <button 
        onClick={() => setActiveIntent(id)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all group ${
          isActive 
            ? (isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-black font-bold') 
            : 'text-current opacity-40 hover:opacity-100 hover:bg-current/5'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${isActive ? color || 'bg-current/10' : ''}`}>
            <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
          </div>
          <span className="text-sm tracking-tight">{label}</span>
        </div>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
      </button>
    );
  };

  return (
    <div className={`fixed inset-0 transition-colors duration-700 font-sans antialiased flex flex-col ${isDark ? 'bg-[#0b0b0f] text-[#ededed]' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}>
      <AnimatePresence>{activeDetail && <DetailModal item={activeDetail} theme={theme} onClose={() => setActiveDetail(null)} />}</AnimatePresence>
      
      <header className={`h-14 px-6 flex items-center justify-between border-b backdrop-blur-xl shrink-0 z-50 ${isDark ? 'border-white/[0.05] bg-[#0b0b0f]/50' : 'border-black/[0.05] bg-white/50'}`}>
        <div className="flex items-center gap-2"><div className={`w-6 h-6 rounded flex items-center justify-center shadow-lg ${isDark ? 'bg-white' : 'bg-black'}`}><Zap size={14} fill={isDark ? "black" : "white"} stroke={isDark ? "black" : "white"} /></div><span className="font-black text-sm tracking-tight uppercase">SuperInbox</span></div>
        <div className="flex items-center gap-3">
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isDark ? 'bg-white/5 text-yellow-400' : 'bg-black/5 text-indigo-600'}`}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${isDark ? 'bg-white/5 border-white/10 text-white/40' : 'bg-black/5 border-black/10 text-black/40'}`}><User size={14} /></div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Gmail 风格侧边栏：意图标签 */}
        <aside className={`w-64 border-r flex flex-col py-6 px-4 gap-8 transition-colors shrink-0 z-40 hidden lg:flex ${isDark ? 'border-white/[0.05] bg-[#0b0b0f]/30' : 'border-black/[0.05] bg-black/[0.01]'}`}>
           <div className="space-y-1">
             <div className="px-3 mb-2 opacity-20 font-black uppercase text-[10px] tracking-widest">Mailbox</div>
             <NavItem id="all" label="All Memories" icon={Inbox} />
             <NavItem id="starred" label="Starred" icon={Sparkles} />
             <NavItem id="archive" label="Archive" icon={HardDrive} />
           </div>

           <div className="space-y-1">
             <div className="px-3 mb-2 opacity-20 font-black uppercase text-[10px] tracking-widest">Intents (AI Labels)</div>
             <NavItem id="todo" label="Todo & Tasks" icon={CheckCircle2} color="text-blue-500 bg-blue-500/10" />
             <NavItem id="finance" label="Finance" icon={Wallet} color="text-orange-500 bg-orange-500/10" />
             <NavItem id="idea" label="Insights & Ideas" icon={Lightbulb} color="text-yellow-500 bg-yellow-500/10" />
             <NavItem id="text" label="Daily Logs" icon={Type} />
             <NavItem id="link" label="Reading List" icon={Link2} color="text-indigo-500 bg-indigo-500/10" />
             <NavItem id="dev" label="Dev Roadmap" icon={Cpu} color="text-purple-500 bg-purple-500/10" />
           </div>

           <div className="mt-auto pt-6 border-t border-current/5">
              <button className="w-full flex items-center gap-3 px-3 py-2 opacity-40 hover:opacity-100 transition-opacity">
                <Settings size={16} />
                <span className="text-sm">Workspace Settings</span>
              </button>
           </div>
        </aside>

        {/* 窄屏下的简易侧边栏 */}
        <aside className={`w-14 border-r flex flex-col items-center py-6 gap-6 transition-colors shrink-0 z-40 lg:hidden hidden md:flex ${isDark ? 'border-white/[0.05] bg-[#0b0b0f]/30' : 'border-black/[0.05] bg-black/[0.02]'}`}>
           <button onClick={() => setActiveIntent('all')} className={`p-2 rounded-xl ${activeIntent === 'all' ? (isDark ? 'text-white bg-white/10' : 'text-black bg-black/5 font-bold') : 'opacity-40'}`}><Inbox size={20} /></button>
           <button onClick={() => setActiveIntent('todo')} className={`p-2 rounded-xl ${activeIntent === 'todo' ? 'text-blue-500 bg-blue-500/10' : 'opacity-40'}`}><CheckCircle2 size={20} /></button>
           <button onClick={() => setActiveIntent('idea')} className={`p-2 rounded-xl ${activeIntent === 'idea' ? 'text-yellow-500 bg-yellow-500/10' : 'opacity-40'}`}><Lightbulb size={20} /></button>
           <div className="mt-auto opacity-20"><Settings size={20} /></div>
        </aside>

        <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <div className={`shrink-0 z-[60] flex flex-col items-center transition-all duration-500 ease-in-out ${isExpandedInput ? 'md:pt-6 md:pb-6 md:px-8 fixed inset-0 bg-black/20 backdrop-blur-sm md:relative md:bg-transparent md:backdrop-blur-none p-4' : 'md:pt-6 md:pb-6 md:px-8 p-0 fixed bottom-8 right-8 md:relative md:bottom-auto md:right-auto'}`}>
            <div className={`w-full relative transition-all duration-500 ${isExpandedInput ? 'max-w-2xl mt-auto md:mt-0' : 'max-w-none md:max-w-2xl'}`}>
              <motion.div animate={{ height: isExpandedInput ? 220 : 56, width: isExpandedInput ? '100%' : (window.innerWidth < 768 ? 56 : '100%'), borderRadius: isExpandedInput ? 32 : 28 }} className={`relative border overflow-hidden z-10 transition-colors flex flex-col shadow-2xl ${isDark ? 'bg-[#12121a] border-white/[0.1]' : 'bg-white border-black/[0.08]'}`} onClick={() => !isExpandedInput && setIsFocused(true)}>
                <AnimatePresence>
                  {isCollapsing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm ${isDark ? 'bg-black/70' : 'bg-white/40'}`}>
                      <motion.div initial={{ scaleX: 1, scaleY: 1, opacity: 0 }} animate={{ scaleY: [1.3, 0.02, 0.02], scaleX: [1.3, 1.3, 0], opacity: [0, 1, 1, 0] }} transition={{ duration: 0.8 }} className="relative flex items-center justify-center w-full"><svg viewBox="0 0 100 100" className={`w-32 h-32 ${isDark ? 'text-white' : 'text-black'}`}><path d="M 50 0 C 50 35 65 50 100 50 C 65 50 50 65 50 100 C 50 65 35 50 0 50 C 35 50 50 35 50 0 Z" fill="currentColor" /></svg></motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="absolute inset-0 flex items-center justify-center md:hidden pointer-events-none">{!isExpandedInput && <Plus size={24} />}</div>
                <div className={`flex-1 min-h-0 relative transition-opacity duration-300 ${!isExpandedInput ? 'opacity-0 md:opacity-100' : 'opacity-100'}`}><textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} placeholder="捕捉此时此刻的灵感..." className="w-full h-full bg-transparent border-none outline-none px-6 py-5 text-sm md:text-base placeholder:opacity-30 resize-none no-scrollbar" /></div>
                <AnimatePresence>{isExpandedInput && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="shrink-0 p-5 pt-0 flex items-center justify-between z-20"><div className="flex items-center gap-1 opacity-40"><ImageIcon size={18}/><span className="w-4"/><Paperclip size={18}/><span className="w-4"/><Mic size={18}/></div><button onMouseDown={(e) => { e.preventDefault(); handleCapture(); }} disabled={!inputValue.trim()} className={`px-6 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${isDark ? 'bg-white text-black hover:bg-white/90' : 'bg-black text-white hover:bg-black/90'}`}>Capture <ChevronRight size={14} className="inline ml-1" /></button></motion.div>)}</AnimatePresence>
              </motion.div>
            </div>
          </div>

          <div className={`flex-1 border-t p-4 md:p-6 flex flex-col gap-4 overflow-hidden z-20 transition-colors ${isDark ? 'border-white/[0.05] bg-[#0b0b0f]/40' : 'border-black/[0.05] bg-black/[0.01]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 px-1 mb-2">
              <div className="flex items-center gap-2">
                <span className="opacity-40 font-black uppercase text-[10px] tracking-[0.2em]">{activeIntent === 'all' ? 'All Ingested' : `${activeIntent} stream`}</span>
                {filteredMemories.length > 0 && <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>{filteredMemories.length}</span>}
              </div>
              
              {/* 顶部 Pills：媒体类型筛选 (符合载体属性) */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-1 sm:bg-current/5 sm:p-1 sm:rounded-xl">
                 {[
                   { id: 'all', label: 'All Types', icon: LayoutGrid },
                   { id: 'text', label: 'Text', icon: Type },
                   { id: 'image', label: 'Images', icon: ImageIcon },
                   { id: 'audio', label: 'Audios', icon: Mic },
                   { id: 'file', label: 'Docs', icon: Paperclip }
                 ].map((type) => (
                   <button
                     key={type.id}
                     onClick={() => setActiveType(type.id)}
                     className={`whitespace-nowrap px-4 py-2 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg text-[11px] sm:text-[10px] font-black uppercase flex items-center gap-2 transition-all shrink-0 ${
                       activeType === type.id 
                        ? (isDark ? 'bg-white text-black' : 'bg-black text-white') 
                        : (isDark ? 'bg-white/5 opacity-40' : 'bg-black/5 opacity-40')
                     } hover:opacity-100`}
                   >
                     <type.icon size={11} />
                     <span>{type.label}</span>
                   </button>
                 ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 pb-24">
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredMemories.map(m => (
                    <MemoryBlock key={m.id} memory={m} theme={theme} onOpenDetails={setActiveDetail} />
                  ))}
                </AnimatePresence>
              </div>
              {filteredMemories.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 opacity-20 italic text-sm gap-4">
                  <div className="p-4 rounded-full border border-current border-dashed"><Inbox size={32} /></div>
                  No matching memories in this view.
                </motion.div>
              )}
            </div>
          </div>
        </section>
      </main>
      <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar { display: none; } .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }`}} />
    </div>
  );
}