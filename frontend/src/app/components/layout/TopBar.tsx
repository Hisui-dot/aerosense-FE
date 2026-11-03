import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

interface TopBarProps {
  title: string;
}

export const TopBar = ({ title }: TopBarProps) => {
  return (
    <div className="bg-[#0B1847] px-4 flex justify-between items-center sticky top-0 z-30 shadow-lg" style={{ height: '64px' }}>
      <div className="flex items-center justify-between w-full max-w-2xl mx-auto">
        <Link 
          to="/" 
          className="flex items-center gap-3 hover:opacity-80 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#2665D0] flex items-center justify-center shadow-sm">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div className="text-white font-bold tracking-tight text-lg">
            AERO<span className="bg-[linear-gradient(to_right,#00b6bd,#00acce,#03a3d9,#02a0e3,#018afd)] bg-clip-text text-transparent">SENSE</span>
          </div>
        </Link>
        <h1 className="text-xs font-bold text-blue-300 uppercase tracking-wider">{title}</h1>
      </div>
    </div>
  );
};