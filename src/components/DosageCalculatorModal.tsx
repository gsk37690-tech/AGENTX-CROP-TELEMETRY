import React, { useState } from 'react';
import { CropTools, MAX_NUTRIENT_KG_PER_ACRE, MAX_WATER_MM, ROOT_ZONE_MM } from '../lib/cropTools';
import { DosageResult } from '../types';
import { X, Calculator, ShieldAlert, CheckCircle2, Droplets, Scale, Info } from 'lucide-react';

interface DosageCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  cropTools: CropTools;
}

export const DosageCalculatorModal: React.FC<DosageCalculatorModalProps> = ({
  isOpen,
  onClose,
  cropTools
}) => {
  const [crop, setCrop] = useState('tomato');
  const [stage, setStage] = useState('flowering');
  const [acres, setAcres] = useState(1.0);

  if (!isOpen) return null;

  const dosageRaw = cropTools.calculateDosage(crop, acres, stage);
  const dosageData: DosageResult = JSON.parse(dosageRaw);

  const stagesByCrop: Record<string, string[]> = {
    tomato: ['seedling', 'vegetative', 'flowering', 'fruiting'],
    rice: ['seedling', 'tillering', 'flowering', 'ripening'],
    maize: ['seedling', 'vegetative', 'tasseling', 'grain_filling'],
    cotton: ['seedling', 'vegetative', 'flowering', 'boll_development'],
    banana: ['vegetative', 'shooting', 'bunch_development'],
    groundnut: ['vegetative', 'flowering', 'peg_formation', 'pod_filling']
  };

  const availableStages = stagesByCrop[crop] || ['seedling', 'vegetative', 'flowering', 'fruiting'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E8E2D9] rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#F0ECE4] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#2D6A4F]">
              <Calculator className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1A2421]">
                Agronomic Dosage & Irrigation Calculator
              </h3>
              <p className="text-xs text-[#60584F]">
                Formula: Deficit / 2.471 * Acres with TNAU/ICAR safety guardrails
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

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Input Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#FAF8F5] p-5 rounded-2xl border border-[#E8E2D9]">
            <div>
              <label htmlFor="modal-crop-select" className="block text-xs font-bold text-[#6D4C41] uppercase tracking-wider mb-1.5">
                Target Crop
              </label>
              <select
                id="modal-crop-select"
                value={crop}
                onChange={(e) => {
                  setCrop(e.target.value);
                  setStage(stagesByCrop[e.target.value]?.[0] || 'flowering');
                }}
                className="w-full bg-white border border-[#D7CCC8] text-[#1A2421] text-sm font-medium rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] cursor-pointer"
              >
                <option value="tomato">Tomato (Solanum lycopersicum)</option>
                <option value="rice">Rice / Paddy (Oryza sativa)</option>
                <option value="maize">Maize / Corn (Zea mays)</option>
                <option value="cotton">Cotton (Gossypium)</option>
                <option value="banana">Banana (Musa)</option>
                <option value="groundnut">Groundnut (Arachis hypogaea)</option>
              </select>
            </div>

            <div>
              <label htmlFor="modal-stage-select" className="block text-xs font-bold text-[#6D4C41] uppercase tracking-wider mb-1.5">
                Growth Stage
              </label>
              <select
                id="modal-stage-select"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full bg-white border border-[#D7CCC8] text-[#1A2421] text-sm font-medium rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] cursor-pointer capitalize"
              >
                {availableStages.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="modal-acres-input" className="block text-xs font-bold text-[#6D4C41] uppercase tracking-wider mb-1.5">
                Field Area (Acres): <span className="text-[#2D6A4F] font-bold">{acres}</span>
              </label>
              <input
                id="modal-acres-input"
                type="number"
                min="0.1"
                max="50"
                step="0.5"
                value={acres}
                onChange={(e) => setAcres(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className="w-full bg-white border border-[#D7CCC8] text-[#1A2421] text-sm font-medium rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F]"
              />
            </div>
          </div>

          {/* Results Display */}
          {dosageData.error ? (
            <div className="bg-[#FFEBEE] border border-[#FFCDD2] rounded-2xl p-4 flex items-center gap-3 text-[#B71C1C] text-sm">
              <ShieldAlert className="w-5 h-5 text-[#C62828] shrink-0" />
              <span>{dosageData.error}</span>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Nutrients Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6D4C41] mb-2.5 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-[#2D6A4F]" />
                  Fertilizer Nutrient Deficit & Capped Dose
                </h4>
                <div className="overflow-x-auto rounded-xl border border-[#E8E2D9]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF8F5] text-[#6D4C41] font-semibold border-b border-[#E8E2D9]">
                      <tr>
                        <th className="p-3.5">Nutrient</th>
                        <th className="p-3.5">Current Soil Level</th>
                        <th className="p-3.5">Ideal Level</th>
                        <th className="p-3.5">Deficit (kg/ha)</th>
                        <th className="p-3.5">Calculated Dose ({acres} acre)</th>
                        <th className="p-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0ECE4] text-[#262E2B]">
                      {['N', 'P', 'K'].map((nut) => {
                        const item = (dosageData.dosage as any)?.[nut];
                        if (!item) return null;
                        const isCapped = item.dose_kg === MAX_NUTRIENT_KG_PER_ACRE * acres;
                        return (
                          <tr key={nut} className="hover:bg-[#FAF8F5]">
                            <td className="p-3.5 font-bold text-[#1A2421] flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#2D6A4F]"></span>
                              {nut === 'N' ? 'Nitrogen (N)' : nut === 'P' ? 'Phosphorus (P)' : 'Potassium (K)'}
                            </td>
                            <td className="p-3.5 font-mono">{item.current} kg/ha</td>
                            <td className="p-3.5 font-mono text-[#2D6A4F]">{item.ideal} kg/ha</td>
                            <td className="p-3.5 font-mono text-[#D97706]">
                              {item.deficit > 0 ? `+${item.deficit}` : '0 (Met)'}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-[#2D6A4F] text-sm">
                              {item.dose_kg} kg
                            </td>
                            <td className="p-3.5">
                              {isCapped ? (
                                <span className="text-[11px] bg-[#FFF3E0] text-[#BF360C] px-2 py-0.5 rounded-full font-semibold">
                                  Safety Capped
                                </span>
                              ) : (
                                <span className="text-[11px] bg-[#E8F5E9] text-[#1B5E20] px-2 py-0.5 rounded-full font-semibold">
                                  Within Limits
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Water Requirement Box */}
              {dosageData.dosage?.water && (
                <div className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] text-[#2D6A4F] flex items-center justify-center">
                      <Droplets className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1A2421]">
                        Hydrological Irrigation Need
                      </div>
                      <div className="text-xs text-[#60584F]">
                        Root depth: {ROOT_ZONE_MM} mm | Capped at {MAX_WATER_MM} mm per single cycle
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-[#2D6A4F]">
                      {dosageData.dosage.water.irrigation_mm} mm
                    </div>
                    <div className="text-xs font-semibold text-[#6D4C41]">
                      {dosageData.dosage.water.litres?.toLocaleString()} Litres ({acres} acre)
                    </div>
                  </div>
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
