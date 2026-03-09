import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCw, 
  Activity, 
  Layers, 
  Info, 
  ChevronRight, 
  Search,
  FlaskConical,
  Play,
  Pause,
  Download,
  Share2,
  History,
  Beaker,
  Wind,
  Zap
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Substituent {
  name: string;
  color: string;
  size: number;
}

interface Compound {
  name: string;
  type?: 'acyclic' | 'cyclohexane';
  frontSubstituents: Substituent[];
  backSubstituents: Substituent[];
  ringSubstituents?: { axial: Substituent; equatorial: Substituent }[];
}

const ATOMS: Record<string, Substituent> = {
  H: { name: 'H', color: '#94A3B8', size: 1 },
  CH3: { name: 'CH3', color: '#6366F1', size: 3 },
  Cl: { name: 'Cl', color: '#10B981', size: 2.5 },
  Br: { name: 'Br', color: '#8B5CF6', size: 3.5 },
  OH: { name: 'OH', color: '#3B82F6', size: 2 },
  F: { name: 'F', color: '#F59E0B', size: 1.5 },
};

const DEFAULT_COMPOUNDS: Record<string, Compound> = {
  'Ethane': {
    name: 'Ethane',
    type: 'acyclic',
    frontSubstituents: [ATOMS.H, ATOMS.H, ATOMS.H],
    backSubstituents: [ATOMS.H, ATOMS.H, ATOMS.H],
  },
  'n-Butane': {
    name: 'n-Butane',
    type: 'acyclic',
    frontSubstituents: [ATOMS.CH3, ATOMS.H, ATOMS.H],
    backSubstituents: [ATOMS.CH3, ATOMS.H, ATOMS.H],
  },
  'Cyclohexane': {
    name: 'Cyclohexane',
    type: 'cyclohexane',
    frontSubstituents: [],
    backSubstituents: [],
    ringSubstituents: Array(6).fill({ axial: ATOMS.H, equatorial: ATOMS.H })
  }
};

// --- Components ---

const AtomNode = ({ sub, x, y, r = 14, isBack = false }: { sub: Substituent; x: number; y: number; r?: number; isBack?: boolean }) => (
  <motion.g
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: 'spring', damping: 12 }}
  >
    <defs>
      <radialGradient id={`grad-${sub.name}-${isBack ? 'back' : 'front'}-${x}-${y}`}>
        <stop offset="0%" stopColor={sub.color} />
        <stop offset="100%" stopColor={isBack ? '#1E293B' : '#475569'} />
      </radialGradient>
    </defs>
    <circle 
      cx={x} cy={y} r={r} 
      fill={`url(#grad-${sub.name}-${isBack ? 'back' : 'front'}-${x}-${y})`}
      className="drop-shadow-md"
    />
    <text
      x={x} y={y}
      textAnchor="middle" dy=".3em"
      fill="white" fontSize={r * 0.7} fontWeight="800"
      className="pointer-events-none select-none"
    >
      {sub.name}
    </text>
  </motion.g>
);

const NewmanProjection = ({ compound, angle, editingPos }: { compound: Compound; angle: number; editingPos: any }) => {
  const size = 320;
  const center = size / 2;
  const radius = 65;
  const bondLength = 90;

  if (compound.type === 'cyclohexane') {
    const offset = 65;
    const subs = compound.ringSubstituents || [];
    // Eclipsing factor: 1 at boat (90/270), 0 at chair (0/180)
    const eclipsing = Math.pow(Math.sin((angle * Math.PI) / 180), 2);

    const renderCircle = (cx: number, cy: number, isLeft: boolean, frontSub: any, backSub: any, frontIdx: number, backIdx: number) => {
      const isC1 = isLeft;
      const fAxAngle = isC1 ? 180 : 0;
      const fEqAngle = isC1 ? 60 : 240;

      // In chair, they are staggered (offset by 60)
      // In boat, they are eclipsed (offset by 0)
      const stagger = 60 * (1 - eclipsing);
      const bAxAngle = (isC1 ? 0 : 180) + stagger;
      const bEqAngle = (isC1 ? 120 : 300) + stagger;

      const getSubPos = (deg: number, len: number) => {
        const r = ((deg - 90) * Math.PI) / 180;
        return { x: cx + len * Math.cos(r), y: cy + len * Math.sin(r) };
      };

      const isEditingFront = editingPos?.carbon === frontIdx;
      const isEditingBack = editingPos?.carbon === backIdx;

      return (
        <g>
          {backSub && (
            <>
              <line x1={cx} y1={cy} x2={getSubPos(bAxAngle, 45).x} y2={getSubPos(bAxAngle, 45).y} stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
              <AtomNode sub={backSub.axial} x={getSubPos(bAxAngle, 45).x} y={getSubPos(bAxAngle, 45).y} r={11} isBack />
              <line x1={cx} y1={cy} x2={getSubPos(bEqAngle, 45).x} y2={getSubPos(bEqAngle, 45).y} stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
              <AtomNode sub={backSub.equatorial} x={getSubPos(bEqAngle, 45).x} y={getSubPos(bEqAngle, 45).y} r={11} isBack />
            </>
          )}
          <circle 
            cx={cx} cy={cy} r={45} 
            fill="white" 
            stroke={isEditingBack ? "#6366F1" : "#334155"} 
            strokeWidth={isEditingBack ? "6" : "4"} 
            className="transition-all"
          />
          <text x={cx} y={cy - 55} textAnchor="middle" fontSize="10" fontWeight="900" fill="#94A3B8">C{backIdx + 1}</text>
          
          {frontSub && (
            <>
              <line x1={cx} y1={cy} x2={getSubPos(fAxAngle, 45).x} y2={getSubPos(fAxAngle, 45).y} stroke="#334155" strokeWidth="5" strokeLinecap="round" />
              <AtomNode sub={frontSub.axial} x={getSubPos(fAxAngle, 45).x} y={getSubPos(fAxAngle, 45).y} r={11} />
              <line x1={cx} y1={cy} x2={getSubPos(fEqAngle, 45).x} y2={getSubPos(fEqAngle, 45).y} stroke="#334155" strokeWidth="5" strokeLinecap="round" />
              <AtomNode sub={frontSub.equatorial} x={getSubPos(fEqAngle, 45).x} y={getSubPos(fEqAngle, 45).y} r={11} />
            </>
          )}
          <circle 
            cx={cx} cy={cy} r="6" 
            fill={isEditingFront ? "#6366F1" : "#334155"} 
            className="transition-all"
          />
          <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fontWeight="900" fill={isEditingFront ? "#6366F1" : "#334155"}>C{frontIdx + 1}</text>
        </g>
      );
    };

    return (
      <div className="glass-card rounded-[2rem] p-8 flex flex-col items-center group transition-all hover:scale-[1.02]">
        <div className="flex items-center gap-2 mb-6">
          <Layers className="text-indigo-500" size={18} />
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Double Newman Projection</h3>
        </div>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <path 
            d={`M ${center - offset} ${center - 22} Q ${center} ${center - 65 + (eclipsing * 20)} ${center + offset} ${center - 22}`} 
            fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" 
          />
          <path 
            d={`M ${center - offset} ${center + 22} Q ${center} ${center + 65 - (eclipsing * 20)} ${center + offset} ${center + 22}`} 
            fill="none" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" 
          />
          {renderCircle(center - offset, center, true, subs[0], subs[1], 0, 1)}
          {renderCircle(center + offset, center, false, subs[4], subs[3], 4, 3)}
        </svg>
        <div className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          {eclipsing > 0.8 ? 'Eclipsed (Boat)' : 'Staggered (Chair)'}
        </div>
      </div>
    );
  }

  const getPos = (baseAngle: number, length: number, rotation: number = 0) => {
    const rad = ((baseAngle + rotation - 90) * Math.PI) / 180;
    return { x: center + length * Math.cos(rad), y: center + length * Math.sin(rad) };
  };

  const isEditingFront = editingPos?.carbon === 'front';
  const isEditingBack = editingPos?.carbon === 'back';

  return (
    <div className="glass-card rounded-[2rem] p-8 flex flex-col items-center group transition-all hover:scale-[1.02]">
      <div className="flex items-center gap-2 mb-6">
        <Layers className="text-indigo-500" size={18} />
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Newman Projection</h3>
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {compound.backSubstituents.map((sub, i) => {
          const pos = getPos(i * 120, bondLength, angle);
          return (
            <g key={`back-${i}`}>
              <line x1={center} y1={center} x2={pos.x} y2={pos.y} stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />
              <AtomNode sub={sub} x={pos.x} y={pos.y} isBack />
            </g>
          );
        })}
        <circle 
          cx={center} cy={center} r={radius} 
          fill="white" 
          stroke={isEditingBack ? "#6366F1" : "#334155"} 
          strokeWidth={isEditingBack ? "6" : "4"} 
          className="transition-all"
        />
        <text x={center} y={center - radius - 10} textAnchor="middle" fontSize="10" fontWeight="900" fill="#94A3B8">Back Carbon</text>
        
        {compound.frontSubstituents.map((sub, i) => {
          const pos = getPos(i * 120, bondLength);
          return (
            <g key={`front-${i}`}>
              <line x1={center} y1={center} x2={pos.x} y2={pos.y} stroke="#334155" strokeWidth="6" strokeLinecap="round" />
              <AtomNode sub={sub} x={pos.x} y={pos.y} />
            </g>
          );
        })}
        <circle 
          cx={center} cy={center} r="6" 
          fill={isEditingFront ? "#6366F1" : "#334155"} 
          className="transition-all"
        />
        <text x={center} y={center + 20} textAnchor="middle" fontSize="10" fontWeight="900" fill={isEditingFront ? "#6366F1" : "#334155"}>Front Carbon</text>
      </svg>
    </div>
  );
};

const SawhorseProjection = ({ compound, angle, editingPos }: { compound: Compound; angle: number; editingPos: any }) => {
  const size = 320;
  const center = size / 2;

  if (compound.type === 'cyclohexane') {
    const subs = compound.ringSubstituents || [];
    // Flip factor: -1 (Chair A), 0 (Boat), 1 (Chair B)
    const flip = Math.cos((angle * Math.PI) / 180);

    const getRingPoint = (i: number) => {
      const basePoints = [
        { x: -90, y: 15 },   // C1 (left flap)
        { x: -45, y: 50 },   // C2
        { x: 45, y: 30 },    // C3
        { x: 90, y: -15 },   // C4 (right flap)
        { x: 45, y: -50 },   // C5
        { x: -45, y: -30 },  // C6
      ];
      
      const p = basePoints[i];
      let y = p.y;
      
      if (i === 0) y -= flip * 40;
      if (i === 3) y += flip * 40;
      
      const boatEffect = 1 - Math.abs(flip);
      if (i === 1 || i === 2) y -= boatEffect * 15;
      if (i === 4 || i === 5) y += boatEffect * 15;

      return { x: center + p.x, y: center + y };
    };

    const points = Array.from({ length: 6 }, (_, i) => getRingPoint(i));

    return (
      <div className="glass-card rounded-[2rem] p-8 flex flex-col items-center group transition-all hover:scale-[1.02]">
        <div className="flex items-center gap-2 mb-6">
          <Wind className="text-indigo-500" size={18} />
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Chair Conformation</h3>
        </div>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <path 
            d={`M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y} L ${points[4].x} ${points[4].y} L ${points[5].x} ${points[5].y} Z`} 
            fill="none" stroke="#1E293B" strokeWidth="5" strokeLinejoin="round" 
          />
          {points.map((p, i) => {
            const sub = subs[i];
            const isUpCarbon = i % 2 === 0;
            const axialDir = (isUpCarbon ? -1 : 1) * flip;
            
            const axialEnd = { x: p.x, y: p.y + axialDir * 35 };
            const eqEnd = { x: p.x + (i < 3 ? -30 : 30), y: p.y - axialDir * 15 };
            
            const isEditing = editingPos?.carbon === i;

            return (
              <g key={i}>
                <line x1={p.x} y1={p.y} x2={axialEnd.x} y2={axialEnd.y} stroke="#94A3B8" strokeWidth="2.5" />
                {sub && <AtomNode sub={sub.axial} x={axialEnd.x} y={axialEnd.y} r={9} />}
                
                <line x1={p.x} y1={p.y} x2={eqEnd.x} y2={eqEnd.y} stroke="#CBD5E1" strokeWidth="2.5" />
                {sub && <AtomNode sub={sub.equatorial} x={eqEnd.x} y={eqEnd.y} r={9} />}
                
                <circle 
                  cx={p.x} cy={p.y} r={isEditing ? "8" : "5"} 
                  fill={isEditing ? "#6366F1" : "#1E293B"} 
                  className="transition-all"
                />
                <text 
                  x={p.x + (i < 3 ? -15 : 15)} 
                  y={p.y + (i % 2 === 0 ? -10 : 10)} 
                  textAnchor="middle" 
                  fontSize="10" 
                  fontWeight="900" 
                  fill={isEditing ? "#6366F1" : "#94A3B8"}
                >
                  C{i + 1}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          {Math.abs(flip) < 0.3 ? 'Boat Transition' : 'Chair Conformer'}
        </div>
      </div>
    );
  }

  const c1 = { x: center - 70, y: center + 50 };
  const c2 = { x: center + 70, y: center - 50 };
  const bondLen = 70;

  const getPos = (c: { x: number; y: number }, baseAngle: number, rotation: number = 0) => {
    const rad = ((baseAngle + rotation - 90) * Math.PI) / 180;
    return { x: c.x + bondLen * Math.cos(rad) * 0.8, y: c.y + bondLen * Math.sin(rad) };
  };

  const isEditingFront = editingPos?.carbon === 'front';
  const isEditingBack = editingPos?.carbon === 'back';

  return (
    <div className="glass-card rounded-[2rem] p-8 flex flex-col items-center group transition-all hover:scale-[1.02]">
      <div className="flex items-center gap-2 mb-6">
        <Wind className="text-indigo-500" size={18} />
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Sawhorse Formula</h3>
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <line x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} stroke="#1E293B" strokeWidth="8" strokeLinecap="round" />
        {compound.backSubstituents.map((sub, i) => {
          const pos = getPos(c2, i * 120, angle);
          return (
            <g key={`back-${i}`}>
              <line x1={c2.x} y1={c2.y} x2={pos.x} y2={pos.y} stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
              <AtomNode sub={sub} x={pos.x} y={pos.y} r={12} isBack />
            </g>
          );
        })}
        {compound.frontSubstituents.map((sub, i) => {
          const pos = getPos(c1, i * 120, 0);
          return (
            <g key={`front-${i}`}>
              <line x1={c1.x} y1={c1.y} x2={pos.x} y2={pos.y} stroke="#475569" strokeWidth="5" strokeLinecap="round" />
              <AtomNode sub={sub} x={pos.x} y={pos.y} r={12} />
            </g>
          );
        })}
        <circle 
          cx={c1.x} cy={c1.y} r={isEditingFront ? "10" : "7"} 
          fill={isEditingFront ? "#6366F1" : "#1E293B"} 
          className="transition-all"
        />
        <text x={c1.x} y={c1.y + 25} textAnchor="middle" fontSize="10" fontWeight="900" fill={isEditingFront ? "#6366F1" : "#334155"}>Front C</text>
        
        <circle 
          cx={c2.x} cy={c2.y} r={isEditingBack ? "10" : "7"} 
          fill={isEditingBack ? "#6366F1" : "#1E293B"} 
          className="transition-all"
        />
        <text x={c2.x} y={c2.y - 20} textAnchor="middle" fontSize="10" fontWeight="900" fill={isEditingBack ? "#6366F1" : "#94A3B8"}>Back C</text>
      </svg>
    </div>
  );
};

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentCompound, setCurrentCompound] = useState<Compound>(DEFAULT_COMPOUNDS['Ethane']);
  const [angle, setAngle] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [history, setHistory] = useState<string[]>(['Ethane', 'n-Butane', 'Cyclohexane']);
  const [editingPos, setEditingPos] = useState<{ carbon: 'front' | 'back' | number, index: number, type?: 'axial' | 'equatorial' } | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setAngle(prev => (prev + 2) % 360);
      }, 30);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying]);

  const calculateEnergy = (phi: number, compound: Compound) => {
    if (compound.type === 'cyclohexane') {
      const rad = (phi * Math.PI) / 180;
      return 22 * Math.pow(Math.sin(rad), 2);
    }
    const front = compound.frontSubstituents;
    const back = compound.backSubstituents;
    let energy = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const relativeAngle = (phi + (j - i) * 120) % 360;
        const rad = (relativeAngle * Math.PI) / 180;
        const sizeFactor = front[i].size * back[j].size;
        energy += sizeFactor * (1 + Math.cos(rad)) * 1.8;
      }
    }
    return Math.max(0, energy - 12);
  };

  const energyData = useMemo(() => {
    const data = [];
    for (let a = 0; a <= 360; a += 5) {
      data.push({ angle: a, energy: calculateEnergy(a, currentCompound) });
    }
    return data;
  }, [currentCompound]);

  const currentEnergy = useMemo(() => calculateEnergy(angle, currentCompound), [angle, currentCompound]);

  const updateSubstituent = (sub: Substituent) => {
    if (!editingPos) return;
    
    const newCompound = { ...currentCompound };
    if (editingPos.carbon === 'front') {
      newCompound.frontSubstituents = [...newCompound.frontSubstituents];
      newCompound.frontSubstituents[editingPos.index] = sub;
    } else if (editingPos.carbon === 'back') {
      newCompound.backSubstituents = [...newCompound.backSubstituents];
      newCompound.backSubstituents[editingPos.index] = sub;
    } else if (typeof editingPos.carbon === 'number' && newCompound.ringSubstituents) {
      newCompound.ringSubstituents = [...newCompound.ringSubstituents];
      const pos = { ...newCompound.ringSubstituents[editingPos.carbon] };
      if (editingPos.type === 'axial') pos.axial = sub;
      else pos.equatorial = sub;
      newCompound.ringSubstituents[editingPos.carbon] = pos;
    }
    
    newCompound.name = 'Custom Molecule';
    setCurrentCompound(newCompound);
  };

  const handleSearch = async (val?: string) => {
    const searchTerm = val || query;
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Identify substituents for: "${searchTerm}". 
        Return JSON: { "type": "acyclic" | "cyclohexane", "front": ["H"...], "back": ["H"...], "ring": [{"axial": "H", "equatorial": "H"}...] }
        Substituents: H, CH3, Cl, Br, OH, F.`,
        config: { responseMimeType: "application/json" }
      });
      const result = JSON.parse(response.text);
      const newCompound: Compound = {
        name: searchTerm,
        type: result.type || 'acyclic',
        frontSubstituents: (result.front || []).map((name: string) => ATOMS[name] || ATOMS.H),
        backSubstituents: (result.back || []).map((name: string) => ATOMS[name] || ATOMS.H),
        ringSubstituents: (result.ring || []).map((pos: any) => ({
          axial: ATOMS[pos.axial] || ATOMS.H,
          equatorial: ATOMS[pos.equatorial] || ATOMS.H
        }))
      };
      setCurrentCompound(newCompound);
      if (!history.includes(searchTerm)) setHistory(prev => [searchTerm, ...prev].slice(0, 5));
    } catch (error) {
      console.error(error);
      if (DEFAULT_COMPOUNDS[searchTerm]) setCurrentCompound(DEFAULT_COMPOUNDS[searchTerm]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Sidebar-like Header */}
      <nav className="fixed left-0 top-0 h-full w-20 bg-slate-900 flex flex-col items-center py-8 gap-8 z-50 hidden md:flex">
        <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Beaker size={24} />
        </div>
        <div className="flex flex-col gap-6">
          <button className="p-3 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-xl"><Layers size={20} /></button>
          <button className="p-3 text-slate-400 hover:text-white transition-colors"><Activity size={20} /></button>
          <button className="p-3 text-slate-400 hover:text-white transition-colors"><History size={20} /></button>
        </div>
        <div className="mt-auto">
          <button className="p-3 text-slate-400 hover:text-white transition-colors"><Info size={20} /></button>
        </div>
      </nav>

      <div className="md:ml-20">
        {/* Top Bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="font-extrabold text-xl tracking-tight text-slate-900">StereoChem <span className="text-indigo-500">Lab</span></h1>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.3em]">Advanced Conformational Analysis</p>
            </div>
            
            <div className="flex-1 max-w-xl mx-12">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Search compound (e.g. 1,2-Dibromoethane)..."
                  className="w-full pl-12 pr-4 py-3 neo-input rounded-2xl outline-none text-sm font-medium"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                {loading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"><Share2 size={18} /></button>
              <button className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"><Download size={18} /></button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Left: Dashboard Content */}
            <div className="lg:col-span-8 space-y-10">
              
              {/* Compound Info & Quick Select */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase rounded-md tracking-wider">Active Molecule</span>
                    <div className="flex gap-1">
                      {Array.from({length: 3}).map((_, i) => <div key={i} className="w-1 h-1 rounded-full bg-indigo-300" />)}
                    </div>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">{currentCompound.name}</h2>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {history.map(name => (
                    <button 
                      key={name}
                      onClick={() => handleSearch(name)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2",
                        currentCompound.name === name 
                          ? "bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20" 
                          : "bg-white text-slate-500 border-slate-100 hover:border-indigo-200"
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Projections Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <NewmanProjection compound={currentCompound} angle={angle} editingPos={editingPos} />
                <SawhorseProjection compound={currentCompound} angle={angle} editingPos={editingPos} />
              </div>

              {/* Energy Analysis Section */}
              <div className="glass-card rounded-[2.5rem] p-10">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-500">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg">Potential Energy Profile</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Torsional Strain Analysis</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 flex flex-col items-end">
                    <span className="text-3xl font-black text-indigo-600 leading-none">{currentEnergy.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">kJ / mol</span>
                  </div>
                </div>
                
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={energyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis 
                        dataKey="angle" 
                        stroke="#94A3B8" 
                        fontSize={11} 
                        fontWeight={700}
                        tickLine={false} 
                        axisLine={false}
                        ticks={[0, 60, 120, 180, 240, 300, 360]}
                        tickFormatter={(v) => `${v}°`}
                      />
                      <YAxis 
                        stroke="#94A3B8" 
                        fontSize={11} 
                        fontWeight={700}
                        tickLine={false} 
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1E293B', borderRadius: '16px', border: 'none', color: '#FFF', padding: '12px' }}
                        itemStyle={{ color: '#818CF8', fontWeight: 'bold' }}
                        cursor={{ stroke: '#6366F1', strokeWidth: 2 }}
                      />
                      <ReferenceLine x={angle} stroke="#6366F1" strokeWidth={3} strokeDasharray="6 6" />
                      <Area 
                        type="monotone" 
                        dataKey="energy" 
                        stroke="#6366F1" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#colorEnergy)" 
                        animationDuration={1000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right: Controls & Stats */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Control Panel */}
              <div className="glass-card rounded-[2.5rem] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <RotateCw className="text-indigo-500" size={20} />
                    <h3 className="font-black text-slate-900">Angle Control</h3>
                  </div>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                      isPlaying ? "bg-rose-500 text-white shadow-rose-200" : "bg-indigo-500 text-white shadow-indigo-200"
                    )}
                  >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                  </button>
                </div>
                
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <span className="text-6xl font-black text-slate-900 tracking-tighter">{angle}°</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 60, 120, 180].map(val => (
                        <button 
                          key={val}
                          onClick={() => { setAngle(val); setIsPlaying(false); }}
                          className="px-3 py-2 rounded-xl bg-slate-50 text-[10px] font-black text-slate-500 hover:bg-indigo-500 hover:text-white transition-all border border-slate-100"
                        >
                          {val}°
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="relative h-6 flex items-center">
                    <input 
                      type="range" 
                      min="0" 
                      max="360" 
                      value={angle} 
                      onChange={(e) => { setAngle(parseInt(e.target.value)); setIsPlaying(false); }}
                      className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conformer</span>
                      </div>
                      <span className="text-sm font-black text-slate-700">
                        {currentCompound.type === 'cyclohexane' 
                          ? (angle % 180 === 0 ? 'Chair' : angle % 90 === 0 ? 'Boat' : 'Twist-Boat')
                          : (angle % 60 === 0 ? (angle % 120 === 0 ? 'Eclipsed' : 'Staggered') : 'Skew')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stability</span>
                      </div>
                      <span className={cn(
                        "text-sm font-black",
                        currentEnergy < 6 ? "text-emerald-500" : currentEnergy < 18 ? "text-amber-500" : "text-rose-500"
                      )}>
                        {currentEnergy < 6 ? 'Optimal' : currentEnergy < 18 ? 'Intermediate' : 'Unstable'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Substituent Editor */}
              <div className="glass-card rounded-[2.5rem] p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black text-slate-900 flex items-center gap-2">
                    <Beaker size={18} className="text-indigo-500" />
                    Substituent Editor
                  </h3>
                  {editingPos && (
                    <button 
                      onClick={() => setEditingPos(null)}
                      className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 transition-colors"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Select Position</span>
                    <div className="flex flex-wrap gap-2">
                      {currentCompound.type === 'cyclohexane' ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="flex flex-col gap-1">
                            <span className="text-[8px] font-bold text-center text-slate-400">C{i+1}</span>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => setEditingPos({ carbon: i, index: 0, type: 'axial' })}
                                className={cn(
                                  "w-8 h-8 rounded-lg text-[8px] font-bold border-2 transition-all",
                                  editingPos?.carbon === i && editingPos?.type === 'axial' ? "bg-indigo-500 text-white border-indigo-500" : "bg-white text-slate-500 border-slate-100"
                                )}
                              >Ax</button>
                              <button 
                                onClick={() => setEditingPos({ carbon: i, index: 0, type: 'equatorial' })}
                                className={cn(
                                  "w-8 h-8 rounded-lg text-[8px] font-bold border-2 transition-all",
                                  editingPos?.carbon === i && editingPos?.type === 'equatorial' ? "bg-indigo-500 text-white border-indigo-500" : "bg-white text-slate-500 border-slate-100"
                                )}
                              >Eq</button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-bold text-center text-slate-400">Front C</span>
                            <div className="flex gap-1">
                              {[0, 1, 2].map(i => (
                                <button 
                                  key={i}
                                  onClick={() => setEditingPos({ carbon: 'front', index: i })}
                                  className={cn(
                                    "w-8 h-8 rounded-lg text-[10px] font-bold border-2 transition-all",
                                    editingPos?.carbon === 'front' && editingPos?.index === i ? "bg-indigo-500 text-white border-indigo-500" : "bg-white text-slate-500 border-slate-100"
                                  )}
                                >{i+1}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-bold text-center text-slate-400">Back C</span>
                            <div className="flex gap-1">
                              {[0, 1, 2].map(i => (
                                <button 
                                  key={i}
                                  onClick={() => setEditingPos({ carbon: 'back', index: i })}
                                  className={cn(
                                    "w-8 h-8 rounded-lg text-[10px] font-bold border-2 transition-all",
                                    editingPos?.carbon === 'back' && editingPos?.index === i ? "bg-indigo-500 text-white border-indigo-500" : "bg-white text-slate-500 border-slate-100"
                                  )}
                                >{i+1}</button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {editingPos && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-100"
                      >
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Choose Atom/Group</span>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.entries(ATOMS).map(([key, sub]) => (
                            <button 
                              key={key}
                              onClick={() => updateSubstituent(sub)}
                              className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-500 transition-all group"
                            >
                              <div className="w-6 h-6 rounded-md flex items-center justify-center text-[8px] font-black text-white" style={{ backgroundColor: sub.color }}>
                                {key}
                              </div>
                              <span className="text-[10px] font-bold text-slate-600 group-hover:text-indigo-600">{sub.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Substituent Legend */}
              <div className="glass-card rounded-[2.5rem] p-8">
                <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2">
                  <FlaskConical size={18} className="text-indigo-500" />
                  Substituent Legend
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(ATOMS).map(([key, sub]) => (
                    <div key={key} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg shadow-inner flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: sub.color }}>
                        {key}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-900 leading-none">{sub.name}</span>
                        <span className="text-[8px] text-slate-400 font-bold">Size: {sub.size}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Note */}
              <div className="p-8 rounded-[2.5rem] bg-indigo-600 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                  <Beaker size={120} />
                </div>
                <h4 className="font-black text-lg mb-2">Scientific Note</h4>
                <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                  Energy calculations are based on a torsional strain model (V/2 * (1 + cos(nφ))). Steric hindrance is weighted by substituent Van der Waals radii.
                </p>
                <div className="mt-6 pt-6 border-t border-indigo-500/50 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Lab Protocol 402</span>
                  <ChevronRight size={16} />
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
