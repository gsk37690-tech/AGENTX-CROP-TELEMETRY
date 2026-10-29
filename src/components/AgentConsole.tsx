import React, { useState, useEffect, useRef } from 'react';
import { AgentJudgesResponse, ParsedAdvice, TraceStep, UrgencyLevel } from '../types';
import { parseAdvice } from '../lib/agentEngine';
import {
  Send,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Languages,
  ShieldCheck,
  Clock,
  Trash2,
  Sprout
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  response?: AgentJudgesResponse;
  parsedAdvice?: ParsedAdvice;
  isError?: boolean;
}

interface AgentConsoleProps {
  onRunQuery: (query: string, dryRun: boolean) => Promise<AgentJudgesResponse>;
  isLoading: boolean;
  lastResponse: AgentJudgesResponse | null;
  scenarioName: string;
}

const FARMER_QUICK_ACTIONS = [
  { label: '💧 Water Advice (பாசனம்)', query: 'Should I irrigate my 1 acre tomato field today?' },
  { label: '🌾 Fertilizer Dose (உரம்)', query: 'What fertilizer does my tomato need at flowering stage (1 acre)?' },
  { label: '🌦️ Rain Forecast (வானிலை)', query: 'Analyze 48h rain risk and moisture trend for Trichy' },
  { label: '🧪 Soil Health (மண் தரம்)', query: 'What is the current soil pH and health for tomato?' }
];

export const AgentConsole: React.FC<AgentConsoleProps> = ({
  onRunQuery,
  isLoading,
  lastResponse,
  scenarioName
}) => {
  const [query, setQuery] = useState('');
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Maintain conversational chat history with a fresh welcome greeting
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const welcomeAnswer = `URGENCY: GREEN
ADVICE: Vanakkam! I am Uzhavan AgriAgent, your autonomous crop telemetry and weather advisor for Tamil Nadu. Ask me any question about your soil moisture, irrigation timing, fertilizer dosage, or 48-hour rain risk.
ஆலோசனை: வணக்கம்! நான் உங்கள் உழவன் பயிர் ஆலோசகர். மண் ஈரப்பதம், பாசனத் தேவை, உர அளவு அல்லது மழை வாய்ப்பு குறித்த கேள்விகளை என்னிடம் கேட்கலாம்.
Estimate only. Confirm with a local agriculture officer.`;

    const welcomeParsed = parseAdvice(welcomeAnswer);
    return [
      {
        id: 'msg-welcome',
        sender: 'agent',
        text: welcomeAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        parsedAdvice: welcomeParsed
      }
    ];
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleExecute = async (targetQuery: string) => {
    if (!targetQuery.trim() || isLoading) return;

    const userMsgId = `usr-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: targetQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery('');

    try {
      const response = await onRunQuery(targetQuery, false);
      const parsed = parseAdvice(response.answer);

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        response,
        parsedAdvice: parsed
      };

      setMessages(prev => [...prev, agentMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `agent-err-${Date.now()}`,
        sender: 'agent',
        text: 'Error evaluating query. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    handleExecute(query || 'Should I irrigate my 1 acre tomato field today?');
  };

  const toggleTrace = (id: string) => {
    setExpandedTraces(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const renderUrgencyBadge = (urgency?: UrgencyLevel) => {
    switch (urgency) {
      case 'RED':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFEBEE] border border-[#FFCDD2] text-[#B71C1C] font-bold text-xs tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#C62828] animate-ping"></span>
            URGENCY: RED — Act Today
          </div>
        );
      case 'YELLOW':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF3E0] border border-[#FFE0B2] text-[#BF360C] font-bold text-xs tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#E65100]"></span>
            URGENCY: YELLOW — Act within 2-3 Days
          </div>
        );
      default:
        // Do not display urgency badge for general messages, greetings, or optimal/GREEN status
        return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-xs flex flex-col h-[760px] overflow-hidden">
      {/* Console Header */}
      <div className="p-5 sm:p-6 border-b border-[#F0ECE4] bg-white flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-[#1A2421] tracking-tight">
              Farm Advisory Console
            </h2>
            <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-[#E8F5E9] text-[#2D6A4F] border border-[#C8E6C9] rounded-full">
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-[#60584F] mt-0.5">
            Grounded soil & crop stress advisory for <span className="text-[#2D6A4F] font-semibold">{scenarioName}</span>
          </p>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="p-2 rounded-xl text-[#8D6E63] hover:text-[#B71C1C] hover:bg-[#FFEBEE] transition cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Conversation Thread */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 bg-[#FAF8F5]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#60584F] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#2D6A4F]">
              <Sprout className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-sm font-bold text-[#1A2421]">
                No questions asked yet
              </h3>
              <p className="text-xs text-[#60584F]">
                Click one of the quick questions below or type your farm inquiry to receive precision advice in English and Tamil.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.sender === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-xl bg-[#F5EBE6] border border-[#E6D7C3] text-[#4E342E] rounded-2xl px-5 py-3.5 shadow-xs">
                    <p className="text-sm font-semibold">{msg.text}</p>
                    <span className="text-[10px] text-[#8D6E63] block text-right mt-1">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            }

            // Agent Advisory Bubble
            const advice = msg.parsedAdvice;
            const trace = msg.response?.trace || [];
            const isTraceExpanded = expandedTraces[msg.id];

            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-2xl w-full bg-white border border-[#E8E2D9] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                  {/* Card Header & Urgency Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F0ECE4]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#E8F5E9] text-[#2D6A4F] flex items-center justify-center">
                        <Sprout className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <span className="text-xs font-bold text-[#1A2421]">
                        Uzhavan Advisory
                      </span>
                    </div>
                    {renderUrgencyBadge(advice?.urgency)}
                  </div>

                  {/* Bilingual Advice Section */}
                  <div className="space-y-3.5">
                    {/* English Advice */}
                    <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E8E2D9] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#6D4C41] uppercase tracking-wider">
                        <Languages className="w-3.5 h-3.5 text-[#2D6A4F]" />
                        English Recommendation
                      </div>
                      <p className="text-sm text-[#1A2421] font-medium leading-relaxed">
                        {advice?.englishAdvice || msg.text}
                      </p>
                    </div>

                    {/* Tamil Advice */}
                    {advice?.tamilAdvice && (
                      <div className="bg-[#E8F5E9] rounded-xl p-4 border border-[#C8E6C9] space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1B5E20] uppercase tracking-wider">
                          <Languages className="w-3.5 h-3.5 text-[#2D6A4F]" />
                          தமிழ் ஆலோசனை (Tamil Advisory)
                        </div>
                        <p className="text-sm text-[#1B5E20] font-medium leading-relaxed">
                          {advice.tamilAdvice}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Agronomic Disclaimer */}
                  <div className="flex items-center gap-1.5 text-[11px] text-[#60584F] pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                    <span>{advice?.disclaimer || 'Estimate only. Confirm with a local agriculture officer.'}</span>
                  </div>

                  {/* Calculation Details Footer */}
                  {trace.length > 0 && (
                    <div className="pt-3 border-t border-[#F0ECE4] flex items-center justify-between">
                      <button
                        onClick={() => toggleTrace(msg.id)}
                        className="flex items-center gap-1.5 text-xs text-[#2D6A4F] hover:text-[#1B4332] font-semibold transition cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#2D6A4F]" />
                        <span>View Calculation Details (கணக்கீட்டு விவரங்கள்)</span>
                        {isTraceExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  {/* Collapsible Reasoning & Tool Execution Trace */}
                  {isTraceExpanded && trace.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#F0ECE4] space-y-2.5 text-xs">
                      {trace.map((step, idx) => (
                        <div key={idx} className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E8E2D9] space-y-1.5">
                          <div className="flex items-center gap-2 text-[#2D6A4F] font-bold font-mono">
                            <span className="w-4 h-4 rounded bg-[#E8F5E9] text-[#1E5128] text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span>{step.tool}</span>
                            <span className="text-[10px] text-[#8D6E63] font-normal truncate max-w-xs">
                              {JSON.stringify(step.args)}
                            </span>
                          </div>
                          <div className="text-[#60584F] text-[11px]">
                            <strong className="text-[#6D4C41]">Reasoning:</strong> {step.thought}
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-[#E8E2D9] text-[#1A2421] text-[11px] font-mono overflow-x-auto">
                            {step.observation}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#E8E2D9] rounded-2xl p-4 shadow-xs flex items-center gap-3">
              <RotateCcw className="w-4 h-4 text-[#2D6A4F] animate-spin" />
              <span className="text-xs font-semibold text-[#1A2421]">
                Analyzing soil telemetry & Open-Meteo weather radar...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Chips */}
      <div className="px-5 py-3 bg-[#FAF8F5] border-t border-[#E8E2D9] flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <span className="text-[11px] text-[#6D4C41] font-bold flex items-center gap-1 shrink-0 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-[#D97706]" /> Quick Questions:
        </span>
        {FARMER_QUICK_ACTIONS.map((action, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleExecute(action.query)}
            disabled={isLoading}
            className="text-xs font-medium bg-white hover:bg-[#F5EBE6] text-[#262E2B] hover:text-[#5D4037] px-3.5 py-1.5 rounded-xl border border-[#D7CCC8] transition shrink-0 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 bg-white border-t border-[#E8E2D9] flex items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask in English or தமிழ் (e.g. Should I irrigate my 1 acre tomato field today?)..."
          disabled={isLoading}
          className="flex-1 bg-[#FAF8F5] border border-[#D7CCC8] rounded-xl px-4 py-3 text-sm text-[#1A2421] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 shrink-0 transition cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Evaluating...</span>
            </>
          ) : (
            <>
              <span>Ask Advisory</span>
              <Send className="w-4 h-4 fill-white" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
