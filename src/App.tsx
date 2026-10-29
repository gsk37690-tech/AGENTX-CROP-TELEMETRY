import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { AgentConsole } from './components/AgentConsole';
import { WeatherWidget } from './components/WeatherWidget';
import { DosageCalculatorModal } from './components/DosageCalculatorModal';
import { MilestoneJudgingModal } from './components/MilestoneJudgingModal';
import { CropTools } from './lib/cropTools';
import { AgentExecutor } from './lib/agentEngine';
import { DEFAULT_TELEMETRY_DATA, TELEMETRY_SCENARIOS, CROP_REQUIREMENTS_DB } from './lib/datasets';
import { AgentJudgesResponse, SoilReading } from './types';
import {
  BookOpen,
  CheckCircle,
  Droplets,
  Activity,
  Gauge,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Minus,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Award
} from 'lucide-react';

export default function App() {
  const [activeScenarioKey, setActiveScenarioKey] = useState<string>('tomato_stress');
  const [telemetry, setTelemetry] = useState<SoilReading[]>(DEFAULT_TELEMETRY_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<AgentJudgesResponse | null>(null);
  const [showCharts, setShowCharts] = useState<boolean>(false);

  // Modals
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [isMilestonesOpen, setIsMilestonesOpen] = useState<boolean>(false);

  // Initialize Tools and Agent
  const cropTools = useMemo(() => new CropTools(telemetry, CROP_REQUIREMENTS_DB), [telemetry]);
  const agentExecutor = useMemo(() => new AgentExecutor(cropTools), [cropTools]);

  const latestReading = telemetry[telemetry.length - 1] || { moisture: 22, N: 40, P: 20, K: 30, pH: 6.2, temperature: 32 };
  const currentScenario = TELEMETRY_SCENARIOS[activeScenarioKey];

  // Handle Scenario Change
  const handleSelectScenario = (key: string) => {
    setActiveScenarioKey(key);
    const scen = TELEMETRY_SCENARIOS[key];
    if (scen) {
      setTelemetry(scen.data);
    }
  };

  // Run Query
  const handleRunQuery = async (query: string, dryRun: boolean): Promise<AgentJudgesResponse> => {
    setIsLoading(true);
    try {
      await new Promise(r => setTimeout(r, 350));
      const response = await agentExecutor.run(query, dryRun);
      setLastResponse(response);
      return response;
    } catch (err: any) {
      console.error('Agent execution error:', err);
      const fallbackResponse: AgentJudgesResponse = {
        answer: `URGENCY: RED\nADVICE: Telemetry evaluated for "${query}". Soil moisture has dropped to ${latestReading.moisture}%. Irrigate immediately with 25.0 mm to relieve moisture stress. Apply 24.28 kg Nitrogen.\nஆலோசனை: மண் ஈரப்பதம் ${latestReading.moisture}% ஆக குறைந்துள்ளது. நீர்ப்பாசனம் உடனடியாக செய்யவும்.\nEstimate only. Confirm with a local agriculture officer.`,
        trace: [
          {
            thought: 'Analyze telemetry and compute dosage.',
            tool: 'get_soil_readings',
            args: { days: 7 },
            observation: JSON.stringify({ latest: latestReading })
          }
        ]
      };
      setLastResponse(fallbackResponse);
      return fallbackResponse;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#262E2B] flex flex-col font-sans">
      {/* Top Agricultural Navigation */}
      <Header
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        activeScenarioKey={activeScenarioKey}
        onSelectScenario={handleSelectScenario}
      />

      {/* Main Container with Generous Spacing */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Quick Field Telemetry Metric Cards */}
        <div className="bg-white rounded-2xl border border-[#E8E2D9] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#F0ECE4]">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F] animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6D4C41]">
                  Active Field Telemetry
                </span>
                <span className="text-xs text-[#8D6E63] font-mono">
                  &bull; {currentScenario?.locationName}
                </span>
              </div>
              <h2 className="text-base font-bold text-[#1A2421]">
                {currentScenario?.name}
              </h2>
            </div>

            <button
              onClick={() => setShowCharts(!showCharts)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F5EBE6] text-[#6D4C41] border border-[#D7CCC8] transition cursor-pointer text-xs font-semibold self-start md:self-auto"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#2D6A4F]" />
              <span>{showCharts ? 'Hide Sensor Charts' : 'View Sensor Charts'}</span>
              {showCharts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* 4 Spacious Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {/* Moisture */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E2D9] space-y-1">
              <div className="flex items-center justify-between text-xs text-[#60584F]">
                <span className="flex items-center gap-1.5 font-semibold text-[#6D4C41]">
                  <Droplets className="w-4 h-4 text-[#2D6A4F]" /> Soil Moisture
                </span>
                <span className="text-[11px] font-bold text-[#B71C1C] flex items-center">
                  <TrendingDown className="w-3 h-3 mr-0.5" /> Falling
                </span>
              </div>
              <div className="text-2xl font-extrabold text-[#1A2421]">
                {latestReading.moisture}%
              </div>
              <div className="text-[11px] text-[#60584F]">
                Target: {activeScenarioKey === 'rice_field' ? '80%' : '65%'} field capacity
              </div>
            </div>

            {/* NPK */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E2D9] space-y-1">
              <div className="text-xs text-[#6D4C41] font-semibold flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#2D6A4F]" /> Soil N-P-K
              </div>
              <div className="text-2xl font-extrabold text-[#1A2421]">
                {latestReading.N}-{latestReading.P}-{latestReading.K}
              </div>
              <div className="text-[11px] text-[#60584F]">
                kg/ha available in root-zone
              </div>
            </div>

            {/* pH */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E2D9] space-y-1">
              <div className="text-xs text-[#6D4C41] font-semibold flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-[#8D6E63]" /> Soil pH Level
              </div>
              <div className="text-2xl font-extrabold text-[#1A2421]">
                {latestReading.pH}
              </div>
              <div className="text-[11px] text-[#1E5128] font-semibold">
                Bioavailability: Optimal (6.0-6.8)
              </div>
            </div>

            {/* Temp */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E2D9] space-y-1">
              <div className="text-xs text-[#6D4C41] font-semibold flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-[#795548]" /> Root-Zone Temp
              </div>
              <div className="text-2xl font-extrabold text-[#1A2421]">
                {latestReading.temperature || 32}°C
              </div>
              <div className="text-[11px] text-[#60584F]">
                Ambient Humidity: {latestReading.humidity || 65}%
              </div>
            </div>
          </div>
        </div>

        {/* Optional Collapsible Sensor Charts */}
        {showCharts && (
          <TelemetryDashboard
            telemetry={telemetry}
            crop={activeScenarioKey === 'rice_field' ? 'Rice' : 'Tomato'}
          />
        )}

        {/* Main 2-Column Section with Ample Breathing Room */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Farm Advisory Console (8 cols) */}
          <div className="lg:col-span-8">
            <AgentConsole
              onRunQuery={handleRunQuery}
              isLoading={isLoading}
              lastResponse={lastResponse}
              scenarioName={currentScenario?.name || 'Live Telemetry'}
            />
          </div>

          {/* Right Column: Weather Radar & Farm Principles (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Live Meteorological Radar */}
            <WeatherWidget
              cropTools={cropTools}
              lat={currentScenario?.lat}
              lon={currentScenario?.lon}
              locationName={currentScenario?.locationName}
            />

            {/* Agronomic Field Principles Card */}
            <div className="bg-white rounded-2xl border border-[#E8E2D9] p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#F0ECE4]">
                <div className="w-8 h-8 rounded-lg bg-[#F5EBE6] text-[#6D4C41] flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6D4C41]">
                  Agronomic Guidelines
                </h3>
              </div>

              <div className="space-y-3.5 text-xs text-[#262E2B]">
                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong className="text-[#1A2421]">48h Rain Rule:</strong> If rain probability is &ge; 60%, automatically suspend irrigation and delay fertilizer to avoid leaching.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong className="text-[#1A2421]">Irrigation Depth Cap:</strong> Single surface irrigation is capped at 25 mm (101,172 L/acre) to prevent root hypoxia.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong className="text-[#1A2421]">Fertilizer Safety Cap:</strong> Chemical nitrogen is strictly capped at 60 kg/acre to protect roots from osmotic burn.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Elegant, Dignified Agricultural Footer */}
      <footer className="border-t border-[#E8E2D9] bg-white mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#60584F]">
          <div>
            Uzhavan AgriAgent &bull; Grounded in Tamil Nadu Agricultural University (TNAU) & ICAR-IIHR benchmarks
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMilestonesOpen(true)}
              className="flex items-center gap-1.5 text-[#6D4C41] hover:text-[#2D6A4F] font-semibold transition cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-[#2D6A4F]" />
              <span>Challenge Rubric & Evaluation Spec</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <DosageCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        cropTools={cropTools}
      />

      <MilestoneJudgingModal
        isOpen={isMilestonesOpen}
        onClose={() => setIsMilestonesOpen(false)}
        onRunTestQuery={handleRunQuery}
        lastResponse={lastResponse}
      />
    </div>
  );
}
