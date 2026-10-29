import React from 'react';
import { Sprout, CloudRain } from 'lucide-react';
import { TELEMETRY_SCENARIOS } from '../lib/datasets';

interface HeaderProps {
  onOpenCalculator: () => void;
  activeScenarioKey: string;
  onSelectScenario: (key: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCalculator,
  activeScenarioKey,
  onSelectScenario
}) => {
  return (
    <header className="border-b border-[#E8E2D9] bg-white/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center shadow-xs">
            <Sprout className="w-6 h-6 text-[#1E5128] stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-[#1A2421]">
                Uzhavan <span className="text-[#2D6A4F] font-extrabold">AgriAgent</span>
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase bg-[#F5EBE6] text-[#6D4C41] border border-[#D7CCC8] rounded-full">
                Tamil Nadu
              </span>
            </div>
            <p className="text-xs text-[#60584F] font-medium">
              உழவன் பயிர் ஆலோசனை &bull; Precision Soil & Weather Advisory
            </p>
          </div>
        </div>

        {/* Minimal Controls: Plot Selector & Dosage Tool */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={activeScenarioKey}
              onChange={(e) => onSelectScenario(e.target.value)}
              className="appearance-none bg-[#FAF8F5] border border-[#D7CCC8] hover:border-[#8D6E63] text-[#262E2B] text-xs font-semibold rounded-xl pl-3 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition shadow-xs cursor-pointer"
            >
              {Object.entries(TELEMETRY_SCENARIOS).map(([key, s]) => (
                <option key={key} value={key}>
                  🌾 {s.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#6D4C41]">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>

          <button
            onClick={onOpenCalculator}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-semibold shadow-xs hover:shadow-sm transition cursor-pointer"
            title="Open Dosage Calculator for water and fertilizer"
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dosage Tool</span>
          </button>
        </div>
      </div>
    </header>
  );
};
