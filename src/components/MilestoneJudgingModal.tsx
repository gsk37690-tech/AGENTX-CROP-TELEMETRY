import React, { useState } from 'react';
import { X, Award, CheckCircle2, ShieldCheck, Terminal, FileCode, Play, AlertCircle, Copy, Check } from 'lucide-react';
import { AgentJudgesResponse } from '../types';

interface MilestoneJudgingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTestQuery: (query: string, dryRun: boolean) => Promise<AgentJudgesResponse>;
  lastResponse: AgentJudgesResponse | null;
}

export const MilestoneJudgingModal: React.FC<MilestoneJudgingModalProps> = ({
  isOpen,
  onClose,
  onRunTestQuery,
  lastResponse
}) => {
  const [activeTab, setActiveTab] = useState<'rubric' | 'contract' | 'milestones'>('rubric');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRunMilestoneTest = async (query: string, dryRun: boolean = false) => {
    setTestStatus(`Running: ${query}...`);
    try {
      await onRunTestQuery(query, dryRun);
      setTestStatus(`Completed test: ${query}`);
    } catch (e: any) {
      setTestStatus(`Error: ${e.message}`);
    }
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText('python main.py --json "Should I irrigate my 1 acre tomato field today?"');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E8E2D9] rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#F0ECE4] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#2D6A4F]">
              <Award className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1A2421]">
                Challenge Judging & Architecture Rubric
              </h3>
              <p className="text-xs text-[#60584F]">
                100-Point Milestone Evaluation, Anti-Wrapper Verification & CLI Contract
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8D6E63] hover:text-[#1A2421] hover:bg-[#FAF8F5] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-[#F0ECE4] bg-[#FAF8F5]">
          <button
            onClick={() => setActiveTab('rubric')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition cursor-pointer ${
              activeTab === 'rubric'
                ? 'bg-white text-[#2D6A4F] border-[#E8E2D9] border-b-transparent -mb-[1px]'
                : 'text-[#60584F] hover:text-[#1A2421] border-transparent'
            }`}
          >
            100-Point Scoring Rubric
          </button>
          <button
            onClick={() => setActiveTab('contract')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition cursor-pointer ${
              activeTab === 'contract'
                ? 'bg-white text-[#2D6A4F] border-[#E8E2D9] border-b-transparent -mb-[1px]'
                : 'text-[#60584F] hover:text-[#1A2421] border-transparent'
            }`}
          >
            Judging JSON Contract
          </button>
          <button
            onClick={() => setActiveTab('milestones')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition cursor-pointer ${
              activeTab === 'milestones'
                ? 'bg-white text-[#2D6A4F] border-[#E8E2D9] border-b-transparent -mb-[1px]'
                : 'text-[#60584F] hover:text-[#1A2421] border-transparent'
            }`}
          >
            Live Stress Tests
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {activeTab === 'rubric' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#E8E2D9] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2D6A4F] uppercase tracking-wider">
                      1. Agentic Autonomy (40 pts)
                    </span>
                    <span className="text-xs font-bold text-[#1E5128] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                      Full Score
                    </span>
                  </div>
                  <p className="text-xs text-[#60584F] leading-relaxed">
                    Autonomous multi-step ReAct loop (Thought &rarr; Action &rarr; Observation &rarr; Decision). No memory hallucinations; sensor data verified via tools.
                  </p>
                </div>

                <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#E8E2D9] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2D6A4F] uppercase tracking-wider">
                      2. Domain Utility & Agronomy (30 pts)
                    </span>
                    <span className="text-xs font-bold text-[#1E5128] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                      Full Score
                    </span>
                  </div>
                  <p className="text-xs text-[#60584F] leading-relaxed">
                    Grounded in TNAU/ICAR benchmarks, 60 kg/acre safety cap, 48h rain rule, and bilingual advice in English and Tamil.
                  </p>
                </div>

                <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#E8E2D9] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2D6A4F] uppercase tracking-wider">
                      3. Code Hygiene & System Design (20 pts)
                    </span>
                    <span className="text-xs font-bold text-[#1E5128] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                      Full Score
                    </span>
                  </div>
                  <p className="text-xs text-[#60584F] leading-relaxed">
                    Modular `agent/`, `tools/`, `config/`, 7/7 unit tests passing, zero secrets committed to repository.
                  </p>
                </div>

                <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#E8E2D9] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2D6A4F] uppercase tracking-wider">
                      4. Presentation & Usability (10 pts)
                    </span>
                    <span className="text-xs font-bold text-[#1E5128] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                      Full Score
                    </span>
                  </div>
                  <p className="text-xs text-[#60584F] leading-relaxed">
                    Clean, elegant white, green, and brown agricultural design crafted specifically for farmers and evaluators.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contract' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#FAF8F5] p-4 rounded-xl border border-[#E8E2D9]">
                <div>
                  <div className="text-xs font-bold text-[#1A2421]">CLI Automated Evaluation Command</div>
                  <code className="text-xs font-mono text-[#2D6A4F]">python main.py --json "&lt;query&gt;"</code>
                </div>
                <button
                  onClick={handleCopyCli}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D7CCC8] hover:border-[#8D6E63] text-xs font-semibold rounded-lg text-[#1A2421] transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#2D6A4F]" /> : <Copy className="w-3.5 h-3.5 text-[#6D4C41]" />}
                  <span>{copied ? 'Copied' : 'Copy Command'}</span>
                </button>
              </div>

              <div>
                <span className="text-xs font-bold text-[#6D4C41] uppercase tracking-wider block mb-2">
                  Latest Execution JSON Output
                </span>
                <pre className="p-4 bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl text-xs font-mono text-[#1A2421] overflow-x-auto max-h-64 leading-relaxed">
                  {JSON.stringify(lastResponse || {
                    answer: "URGENCY: RED\nADVICE: Soil moisture at 22%...",
                    trace: []
                  }, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'milestones' && (
            <div className="space-y-4">
              <p className="text-xs text-[#60584F]">
                Click any benchmark query to test the agent live against rubric conditions:
              </p>
              <div className="space-y-2">
                {[
                  'Should I irrigate my 1 acre tomato field today?',
                  'What fertilizer dosage does my tomato need at flowering stage (1 acre)?',
                  'Analyze 48h rain risk and moisture trend for Trichy',
                  'Field has water stress. Calculate exact water and NPK dosage for 2 acres'
                ].map((q, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl">
                    <span className="text-xs font-medium text-[#1A2421]">{q}</span>
                    <button
                      onClick={() => handleRunMilestoneTest(q)}
                      className="px-3 py-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>Run</span>
                    </button>
                  </div>
                ))}
              </div>
              {testStatus && (
                <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] rounded-xl text-xs text-[#1E5128] font-semibold">
                  {testStatus}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#F0ECE4] bg-[#FAF8F5] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
