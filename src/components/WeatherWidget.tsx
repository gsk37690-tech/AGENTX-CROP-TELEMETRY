import React, { useEffect, useState } from 'react';
import { WeatherForecastResult } from '../types';
import { CropTools } from '../lib/cropTools';
import { CloudRain, AlertTriangle, RefreshCw, MapPin, CheckCircle2 } from 'lucide-react';

interface WeatherWidgetProps {
  cropTools: CropTools;
  lat?: number;
  lon?: number;
  locationName?: string;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  cropTools,
  lat = 10.79,
  lon = 78.70,
  locationName = 'Tiruchirappalli (10.79° N, 78.70° E)'
}) => {
  const [forecast, setForecast] = useState<WeatherForecastResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWeather = async () => {
    setLoading(true);
    try {
      const raw = await cropTools.getWeatherForecast(lat, lon);
      const parsed = JSON.parse(raw);
      setForecast(parsed);
    } catch {
      setForecast(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [lat, lon]);

  const max48hProb = forecast?.rain_probability_pct
    ? Math.max(forecast.rain_probability_pct[0] || 0, forecast.rain_probability_pct[1] || 0)
    : 0;

  const isRainImminent = max48hProb >= 60;

  return (
    <div className="bg-white rounded-2xl border border-[#E8E2D9] p-6 sm:p-7 shadow-xs space-y-5 transition-all">
      <div className="flex items-center justify-between pb-4 border-b border-[#F0ECE4]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#2D6A4F]">
            <CloudRain className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1A2421]">
              Open-Meteo Weather Radar
            </h3>
            <p className="text-xs text-[#6D4C41] flex items-center gap-1 font-medium truncate max-w-[210px]" title={locationName}>
              <MapPin className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
              <span>{locationName}</span>
            </p>
          </div>
        </div>

        <button
          onClick={fetchWeather}
          disabled={loading}
          className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F5EBE6] text-[#6D4C41] border border-[#E8E2D9] transition cursor-pointer"
          title="Refresh live weather forecast"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 48-Hour Rain Risk Alert Banner */}
      <div
        className={`p-4 rounded-xl border flex items-start gap-3 ${
          isRainImminent
            ? 'bg-[#FFF3E0] border-[#FFE0B2] text-[#BF360C]'
            : 'bg-[#E8F5E9] border-[#C8E6C9] text-[#1B5E20]'
        }`}
      >
        {isRainImminent ? (
          <AlertTriangle className="w-5 h-5 text-[#E65100] shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] shrink-0 mt-0.5" />
        )}
        <div className="text-xs space-y-1">
          <div className="font-bold">
            {isRainImminent
              ? `High Rain Risk: ${max48hProb}% in next 48h`
              : `Low Rain Risk: ${max48hProb}% in next 48h`}
          </div>
          <p className="opacity-90 leading-relaxed">
            {isRainImminent
              ? 'Postpone fertilizer application and withhold surface irrigation to prevent nutrient leaching.'
              : 'Safe for scheduled irrigation and routine fertigation according to soil moisture needs.'}
          </p>
        </div>
      </div>

      {/* 3-Day Forecast Grid */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold tracking-wider text-[#6D4C41] uppercase">
          3-Day Precipitation Outlook
        </span>
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((idx) => {
            const prob = forecast?.rain_probability_pct?.[idx] ?? 0;
            const mm = forecast?.rain_mm?.[idx] ?? 0;
            const days = ['Today', 'Tomorrow', 'Day +2'];

            return (
              <div
                key={idx}
                className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl p-3 text-center space-y-1"
              >
                <div className="text-[11px] font-medium text-[#60584F]">
                  {days[idx]}
                </div>
                <div className="text-base font-extrabold text-[#1A2421]">
                  {mm.toFixed(1)} <span className="text-[11px] font-normal text-[#60584F]">mm</span>
                </div>
                <div
                  className={`text-[11px] font-bold ${
                    prob >= 60 ? 'text-[#BF360C]' : 'text-[#2D6A4F]'
                  }`}
                >
                  {prob}% rain
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
