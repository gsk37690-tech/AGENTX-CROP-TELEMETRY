import React from 'react';
import { SoilReading } from '../types';
import { Droplets, Activity, Gauge, Thermometer, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface TelemetryDashboardProps {
  telemetry: SoilReading[];
  crop: string;
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  telemetry,
  crop
}) => {
  const latest = telemetry[telemetry.length - 1] || { moisture: 0, N: 0, P: 0, K: 0, pH: 7 };

  // Calculate simple trend for moisture
  const moistureValues = telemetry.map(t => Number(t.moisture)).filter(v => !isNaN(v));
  let slope = 0;
  let trendStatus: 'falling' | 'rising' | 'stable' = 'stable';

  if (moistureValues.length >= 3) {
    const n = moistureValues.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += moistureValues[i];
      sumXY += i * moistureValues[i];
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    trendStatus = slope < -0.05 ? 'falling' : slope > 0.05 ? 'rising' : 'stable';
  }

  // Format data for chart
  const chartData = telemetry.map((r, i) => ({
    name: r.timestamp ? r.timestamp.split(' ')[0].slice(5) : `Day ${i + 1}`,
    moisture: Number(r.moisture) || 0,
    nitrogen: Number(r.N) || 0,
    idealMoisture: crop.toLowerCase() === 'rice' ? 80 : 65
  }));

  return (
    <div className="bg-white rounded-2xl border border-[#E8E2D9] p-6 sm:p-7 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F0ECE4]">
        <div>
          <h2 className="text-base font-bold text-[#1A2421] tracking-tight">
            Root-Zone Telemetry Trend (300mm Depth)
          </h2>
          <p className="text-xs text-[#60584F] mt-0.5">
            Sensor telemetry stream over {telemetry.length} readings for {crop}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#6D4C41]">
          {trendStatus === 'falling' ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEBEE] text-[#B71C1C]">
              <TrendingDown className="w-3.5 h-3.5" /> Moisture Falling
            </span>
          ) : trendStatus === 'rising' ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F5E9] text-[#1E5128]">
              <TrendingUp className="w-3.5 h-3.5" /> Moisture Rising
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5EBE6] text-[#6D4C41]">
              <Minus className="w-3.5 h-3.5" /> Moisture Stable
            </span>
          )}
        </div>
      </div>

      {/* Area Chart with White, Green and Earth Brown Palette */}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorNitrogen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8D6E63" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8D6E63" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE4" />
            <XAxis dataKey="name" stroke="#8D6E63" fontSize={11} tickLine={false} />
            <YAxis stroke="#8D6E63" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E8E2D9',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
              }}
              labelStyle={{ color: '#1A2421', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="moisture"
              name="Moisture %"
              stroke="#2D6A4F"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorMoisture)"
            />
            <Area
              type="monotone"
              dataKey="nitrogen"
              name="Nitrogen (N)"
              stroke="#8D6E63"
              strokeWidth={1.8}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#colorNitrogen)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#F0ECE4] text-xs text-[#60584F]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#2D6A4F]"></span>
            <span>Soil Moisture (%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#8D6E63]"></span>
            <span>Nitrogen Level (kg/ha)</span>
          </div>
        </div>
        <span>Target: 65% for Flowering Tomato (TNAU standard)</span>
      </div>
    </div>
  );
};
