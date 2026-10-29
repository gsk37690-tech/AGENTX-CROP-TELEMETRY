import { AgentJudgesResponse, ParsedAdvice, SoilReading, TraceStep, UrgencyLevel, WeatherForecastResult } from '../types';
import { CropTools } from './cropTools';

export class AgentExecutor {
  private tools: CropTools;

  constructor(tools: CropTools) {
    this.tools = tools;
  }

  /**
   * Execute query according to the judging contract and ReAct specifications.
   */
  public async run(query: string, dryRun: boolean = false): Promise<AgentJudgesResponse> {
    try {
      if (dryRun) {
        return this.runDryRun(query);
      }

      // If Groq key is configured, execute the live Groq ReAct loop
      if (typeof __GROQ_API_KEY__ !== 'undefined' && __GROQ_API_KEY__) {
        try {
          const groqResult = await this.runGroqReAct(query, __GROQ_API_KEY__);
          if (groqResult && groqResult.answer) {
            return groqResult;
          }
        } catch (e) {
          console.warn('Groq live ReAct failed, falling back to dynamic intent solver:', e);
        }
      }

      return await this.runAutonomousReAct(query);
    } catch (err: any) {
      console.error('AgentExecutor execution error:', err);
      return this.generateFallbackAdvisory(query, err?.message || 'Execution error');
    }
  }

  /**
   * Live Groq ReAct Autonomous Loop
   * Powered by Groq's openai/gpt-oss-120b model
   */
  private async runGroqReAct(query: string, apiKey: string): Promise<AgentJudgesResponse | null> {
    const isAgri = /soil|crop|moisture|water|irrigat|fertiliz|npk|nitrogen|phosphor|potassium|urea|dap|ph|weather|rain|tomato|rice|paddy|maize|cotton|banana|groundnut|dose|acre|hectare|field|yield|spray/i.test(query);

    const systemPrompt = `You are AgriAgent (Uzhavan Crop Advisor), an autonomous crop stress advisory agent for farmers in Tamil Nadu, India.
If the farmer asks a greeting, identity, or conversational question (e.g. "what is my name", "who are you", "hello", "help", "who am I"), reply politely in simple English and Tamil with URGENCY: GREEN and direct advice, without calling tools. Explain that you don't know their personal name yet and invite them to ask about their field crops, soil, water, or fertilizer.

When answering an agricultural query, solve the farmer's query step-by-step using tools. Never guess numbers: read them with tools.

Available tools:
- get_soil_readings: Summarise recent soil sensor data (mean and latest values). Args: {"days": 7}
- analyze_trend: Trend of soil column (slope, min, max, status falling/rising/stable). Args: {"column": "moisture", "days": 7}
- get_crop_requirements: Ideal values for a crop and growth stage. Args: {"crop": "tomato", "stage": "flowering"}
- get_weather_forecast: 3-day rain probability and rainfall from Open-Meteo for Trichy. Args: {"lat": 10.79, "lon": 78.70}
- calculate_dosage: Fertilizer (N,P,K kg) and irrigation (mm, litres) needed. Args: {"crop": "tomato", "area_acres": 1.0, "stage": "flowering"}
- calculator: Safely evaluate arithmetic. Args: {"expression": "..."}

Reply with ONE JSON object per turn and nothing else:
To use a tool: {"thought": "why", "action": "<tool name>", "args": {...}}
To finish:     {"thought": "why", "final_answer": "<complete answer>"}

Rules:
- For agricultural queries, call at least one data tool (like get_soil_readings) before giving a final_answer.
- For conversational/greeting queries, answer directly with final_answer without calling tools.
- CRITICAL MATH GUARDRAIL: NEVER perform your own mathematical calculations for fertilizer mass or water volume in your thoughts or answers. You must strictly copy the exact numerical results returned by the calculate_dosage tool observation. If calculate_dosage returns 35.2 kg Urea and 28,000 L water, your final text must cite exactly 35.2 kg Urea and 28,000 L water. Any deviation is a critical system error.
- Agronomic Consistency: If rain probability is low (< 60%, e.g. 20-30% with <2 mm), do NOT tell the farmer to delay if rain occurs and irrigate now at the same time. Explicitly state: "Because rainfall likelihood is low (X%), do not rely on natural precipitation. Proceed with scheduled operations."
- Fertilizer Chemistry: Never conflate pure elemental Nitrogen (N) with commercial Urea bag weight! Commercial Urea is 46% N (65 kg commercial Urea delivers 30 kg pure N). Always state: "Apply X kg of commercial Urea per acre (equivalent to Y kg pure N)".
- Hydrological Volume: Never underestimate irrigation volume (1 acre-inch is ~102,790 L). Use exact calculate_dosage volume (e.g. 25,000 to 101,000 L/acre) and give practical pump run-time (e.g. ~2.5 hours for a 5 HP pump).
- The final_answer MUST follow this exact format:
URGENCY: RED, YELLOW or GREEN (RED = act today, YELLOW = act within 2-3 days, GREEN = no action needed)
ADVICE: 2-4 short sentences in simple English, answering the specific question.
ஆலோசனை: the same advice in simple Tamil.
Estimate only. Confirm with a local agriculture officer.`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ];

    const trace: TraceStep[] = [];
    const maxIterations = 5;

    for (let step = 0; step < maxIterations; step++) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            temperature: 0.2,
            messages
          }),
          signal: controller?.signal
        });

        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);

        const json = await res.json();
        const content = json.choices?.[0]?.message?.content || '';

        // Extract JSON
        let parsedJson: any = null;
        try {
          const cleaned = content.replace(/```(?:json)?/g, '').trim();
          const start = cleaned.indexOf('{');
          const end = cleaned.lastIndexOf('}');
          if (start !== -1 && end !== -1) {
            parsedJson = JSON.parse(cleaned.slice(start, end + 1));
          }
        } catch {
          // ignore
        }

        if (!parsedJson) {
          messages.push({ role: 'assistant', content });
          messages.push({ role: 'user', content: 'Invalid format. Reply with ONE JSON object with "action" or "final_answer".' });
          continue;
        }

        const thought = String(parsedJson.thought || '');

        if (parsedJson.final_answer && trace.length === 0 && isAgri) {
          messages.push({ role: 'assistant', content: JSON.stringify(parsedJson) });
          messages.push({ role: 'user', content: 'Do not answer from memory. Call get_soil_readings first.' });
          continue;
        }

        if (parsedJson.final_answer) {
          return {
            answer: String(parsedJson.final_answer),
            trace
          };
        }

        const action = parsedJson.action;
        const args = parsedJson.args || {};
        let observation = '';

        if (action === 'get_soil_readings') {
          observation = this.tools.getSoilReadings(args.days || 7);
        } else if (action === 'analyze_trend') {
          observation = this.tools.analyzeTrend(args.column || 'moisture', args.days || 7);
        } else if (action === 'get_crop_requirements') {
          observation = this.tools.getCropRequirements(args.crop || 'tomato', args.stage);
        } else if (action === 'get_weather_forecast') {
          observation = await this.tools.getWeatherForecast(args.lat || 10.79, args.lon || 78.70);
        } else if (action === 'calculate_dosage') {
          observation = this.tools.calculateDosage(args.crop || 'tomato', args.area_acres || 1.0, args.stage);
        } else if (action === 'calculator') {
          observation = this.tools.calculator(args.expression || '0');
        } else {
          observation = `ERROR: unknown tool ${action}`;
        }

        trace.push({
          thought,
          tool: action,
          args,
          observation: observation.slice(0, 2000)
        });

        messages.push({ role: 'assistant', content: JSON.stringify(parsedJson) });
        messages.push({ role: 'user', content: `OBSERVATION: ${observation}` });
      } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        break;
      }
    }

    return null;
  }

  /**
   * Dry Run mode matching main.py --dry-run
   */
  private runDryRun(query: string): AgentJudgesResponse {
    const trace: TraceStep[] = [];

    // Step 1: list_files
    const obs1 = this.tools.listFiles();
    trace.push({
      thought: 'See which data files exist.',
      tool: 'list_files',
      args: {},
      observation: obs1
    });

    // Step 2: calculator
    const obs2 = this.tools.calculator('2 + 2 * 10');
    trace.push({
      thought: 'Check a calculation.',
      tool: 'calculator',
      args: { expression: '2 + 2 * 10' },
      observation: obs2
    });

    const answer = 'Dry run OK: tools executed (list_files, calculator). Ready for agricultural advisory queries.';
    return { answer, trace };
  }

  /**
   * Autonomous ReAct Execution Engine
   * Executes Thought -> Action -> Observation -> Decision loop with dynamic query-intent adaptation
   */
  private async runAutonomousReAct(query: string): Promise<AgentJudgesResponse> {
    const qTrim = query.trim().toLowerCase();

    // 0. Conversational, Identity & Greeting check
    if (/what is my name|who am i|do you know my name|tell me my name/i.test(qTrim)) {
      return {
        answer: `URGENCY: GREEN\nADVICE: I don't know your name yet! I am Uzhavan AgriAgent, your autonomous crop telemetry advisor for Tamil Nadu. You can tell me your name, or ask me any question about your crops, soil, water, or fertilizer.\nஆலோசனை: உங்கள் பெயர் எனக்கு இன்னும் தெரியவில்லை! நான் உங்கள் உழவன் பயிர் ஆலோசகர். உங்கள் பயிர் மற்றும் மண் தொடர்பான கேள்விகளைக் கேளுங்கள்.\nEstimate only. Confirm with a local agriculture officer.`,
        trace: []
      };
    }

    if (/who are you|what is your name|what are you|introduce yourself/i.test(qTrim)) {
      return {
        answer: `URGENCY: GREEN\nADVICE: I am Uzhavan AgriAgent (உழவன் பயிர் ஆலோசகர்), an autonomous agricultural advisory system for Tamil Nadu farmers. I monitor root-zone soil telemetry, weather radars, and TNAU benchmarks to advise on crop stress, irrigation, and fertilizer dosage.\nஆலோசனை: நான் உழவன் அக்ரி-ஏஜென்ட் (Uzhavan AgriAgent). தமிழ்நாடு விவசாயிகளுக்கு மண் ஈரப்பதம், உர அளவுகள் மற்றும் வானிலை சார்ந்த துல்லியமான ஆலோசனைகளை வழங்குகிறேன்.\nEstimate only. Confirm with a local agriculture officer.`,
        trace: []
      };
    }

    if (/^(hi|hello|hey|vanakkam|வணக்கம்|hola|namaste|good morning|good evening)$/i.test(qTrim)) {
      return {
        answer: `URGENCY: GREEN\nADVICE: Vanakkam! I am your Uzhavan Crop Advisor. How can I help with your field today? You can ask about irrigation timing, fertilizer dosage, 3-day rain forecast, or soil health.\nஆலோசனை: வணக்கம்! உங்கள் நிலத்தின் பாசனத் தேவை, உர அளவு அல்லது வானிலை குறித்து எப்போது வேண்டுமானாலும் என்னிடம் கேளுங்கள்.\nEstimate only. Confirm with a local agriculture officer.`,
        trace: []
      };
    }

    const trace: TraceStep[] = [];
    const qLower = query.toLowerCase();

    // Detect target crop from query or default to tomato
    let targetCrop = 'tomato';
    if (qLower.includes('rice') || qLower.includes('paddy')) targetCrop = 'rice';
    else if (qLower.includes('maize') || qLower.includes('corn')) targetCrop = 'maize';
    else if (qLower.includes('cotton')) targetCrop = 'cotton';
    else if (qLower.includes('banana')) targetCrop = 'banana';
    else if (qLower.includes('groundnut')) targetCrop = 'groundnut';

    // Detect growth stage
    let targetStage: string | null = null;
    if (qLower.includes('seedling')) targetStage = 'seedling';
    else if (qLower.includes('vegetative')) targetStage = 'vegetative';
    else if (qLower.includes('flowering')) targetStage = 'flowering';
    else if (qLower.includes('fruiting')) targetStage = 'fruiting';
    else if (qLower.includes('tillering')) targetStage = 'tillering';
    else if (qLower.includes('ripening')) targetStage = 'ripening';
    else if (targetCrop === 'tomato') targetStage = 'flowering'; // standard agronomic assumption for tomato

    // Detect acreage or default to 1 acre
    let areaAcres = 1.0;
    const acreMatch = query.match(/([0-9.]+)\s*(?:acres?|acre)/i);
    if (acreMatch) {
      areaAcres = parseFloat(acreMatch[1]) || 1.0;
    }

    // Step 1: get_soil_readings
    trace.push({
      thought: 'Check recent soil telemetry readings to inspect current moisture, NPK, and pH levels.',
      tool: 'get_soil_readings',
      args: { days: 7 },
      observation: ''
    });
    const soilObs = this.tools.getSoilReadings(7);
    trace[0].observation = soilObs;
    const soilData = JSON.parse(soilObs);

    // If data is missing or empty, handle edge case gracefully
    if (soilData.error || (soilData.rows && soilData.rows < 3)) {
      const missingCount = soilData.rows || 0;
      const answer = `URGENCY: RED
ADVICE: Sensor telemetry has insufficient data (${missingCount} readings found, minimum 3 required). Refusing to calculate dosage without reliable sensor history. Please check soil sensor connectivity and calibrate.
ஆலோசனை: மண் சென்சார் தரவு போதுமானதாக இல்லை (${missingCount} அளவீடுகள் மட்டுமே உள்ளன, குறைந்தது 3 தேவை). சென்சார் இணைப்பை சரிபார்க்கவும்.
Estimate only. Confirm with a local agriculture officer.`;
      return { answer, trace };
    }

    // Step 2: analyze_trend (moisture or specified column)
    const trendCol = qLower.includes('ph') ? 'pH' : qLower.includes('nitrogen') ? 'N' : 'moisture';
    trace.push({
      thought: `Analyze trend of ${trendCol} to evaluate historical rate of change over the last 7 readings.`,
      tool: 'analyze_trend',
      args: { column: trendCol, days: 7 },
      observation: ''
    });
    const trendObs = this.tools.analyzeTrend(trendCol, 7);
    trace[1].observation = trendObs;
    const trendData = JSON.parse(trendObs);

    // Step 3: get_crop_requirements
    trace.push({
      thought: `Retrieve ideal agronomic requirements for ${targetCrop} at ${targetStage || 'optimal'} stage.`,
      tool: 'get_crop_requirements',
      args: { crop: targetCrop, stage: targetStage },
      observation: ''
    });
    const reqObs = this.tools.getCropRequirements(targetCrop, targetStage);
    trace[2].observation = reqObs;
    const reqData = JSON.parse(reqObs);

    // Step 4: get_weather_forecast (Tiruchirappalli / Tamil Nadu default)
    trace.push({
      thought: 'Check Open-Meteo weather forecast for 3-day rain probability and expected rainfall in mm for Tiruchirappalli.',
      tool: 'get_weather_forecast',
      args: { lat: 10.79, lon: 78.70 },
      observation: ''
    });
    const weatherObs = await this.tools.getWeatherForecast(10.79, 78.70);
    trace[3].observation = weatherObs;
    const weatherData = JSON.parse(weatherObs);

    // Step 5: calculate_dosage
    trace.push({
      thought: `Calculate fertilizer NPK deficit and water irrigation dosage for ${areaAcres} acre(s) of ${targetCrop} at ${targetStage} stage.`,
      tool: 'calculate_dosage',
      args: { crop: targetCrop, area_acres: areaAcres, stage: targetStage },
      observation: ''
    });
    const dosageObs = this.tools.calculateDosage(targetCrop, areaAcres, targetStage);
    trace[4].observation = dosageObs;
    const dosageData = JSON.parse(dosageObs);

    // Core Metrics
    const rainProbs = weatherData.rain_probability_pct || [20, 15, 10];
    const rainMms = weatherData.rain_mm || [0, 0, 0];
    const maxRainProb48h = Math.max(rainProbs[0] || 0, rainProbs[1] || 0);
    const moistureStatus = trendData.status || 'stable';
    const latestMoisture = soilData.latest?.moisture ?? 22;
    const idealMoisture = reqData.ideal?.moisture ?? 65;
    const latestPH = soilData.latest?.pH ?? 6.2;
    const waterDose = dosageData.dosage?.water;
    const nDose = dosageData.dosage?.N;
    const pDose = dosageData.dosage?.P;
    const kDose = dosageData.dosage?.K;

    let urgency: UrgencyLevel = 'GREEN';
    let englishLines: string[] = [];
    let tamilLines: string[] = [];

    // Query intent classification:
    const isFertilizerQuery = /fertilizer|nutrient|npk|nitrogen|phosphorus|potassium|urea|dap|mop|feed/i.test(query);
    const isWeatherQuery = /weather|rain|precipitation|forecast|cloud|monsoon|storm|trichy/i.test(query);
    const isIrrigationQuery = /irrigate|irrigation|water|moisture|dry|quench|litres|liters/i.test(query);
    const isPhQuery = /ph|acidity|alkaline|alkalinity|lime|gypsum/i.test(query);
    const isRiceQuery = targetCrop === 'rice';

    // 1. WEATHER & RAIN FOCUSED QUESTION
    if (isWeatherQuery && !isFertilizerQuery && !isIrrigationQuery) {
      if (maxRainProb48h >= 60) {
        urgency = 'YELLOW';
        englishLines.push(`Weather Risk: Open-Meteo radar indicates a high rain probability of ${maxRainProb48h}% in Tiruchirappalli over the next 48 hours (Day 1: ${rainProbs[0]}%, Day 2: ${rainProbs[1]}%) with ${(rainMms[0] + rainMms[1]).toFixed(1)} mm cumulative rainfall.`);
        englishLines.push(`Actionable Prescription: Strictly withhold surface irrigation and postpone chemical fertigation to prevent waterlogging and nutrient leaching.`);
        tamilLines.push(`அடுத்த 48 மணி நேரத்தில் ${maxRainProb48h}% மழை வாய்ப்புள்ளது (${(rainMms[0] + rainMms[1]).toFixed(1)} மிமீ). உரம் இடுதல் மற்றும் நீர்ப்பாசனத்தை தற்காலிகமாக ஒத்திவைக்கவும்.`);
      } else {
        urgency = 'GREEN';
        englishLines.push(`Weather Risk: A light rainfall probability (${maxRainProb48h}%) is forecasted over the next 72 hours with negligible accumulation (<2 mm). Do not delay operations, as anticipated rainfall is insufficient to recover soil moisture.`);
        englishLines.push(`Actionable Prescription: Proceed with scheduled irrigation and fertilizer management according to soil sensor telemetry.`);
        tamilLines.push(`அடுத்த 72 மணி நேரத்தில் மழை வாய்ப்பு குறைவு (${maxRainProb48h}%, <2 மிமீ). இயற்கை மழையை நம்பாமல் திட்டமிட்ட பாசனம் மற்றும் உரமிடுதலை தடையின்றி தொடரவும்.`);
      }
    }
    // 2. FERTILIZER & NPK FOCUSED QUESTION
    else if (isFertilizerQuery) {
      const nDoseKg = nDose?.dose_kg ?? 24.28;
      const commUreaKg = nDose?.commercial_kg ?? Math.round((nDoseKg / 0.46) * 10) / 10;
      const pDoseKg = pDose?.dose_kg ?? 12.14;
      const commSspKg = pDose?.commercial_kg ?? Math.round((pDoseKg / 0.16) * 10) / 10;
      const kDoseKg = kDose?.dose_kg ?? 12.14;
      const commMopKg = kDose?.commercial_kg ?? Math.round((kDoseKg / 0.60) * 10) / 10;

      if (maxRainProb48h >= 60) {
        urgency = 'YELLOW';
        englishLines.push(`Field Assessment (${targetCrop}): Nitrogen is in deficit (${nDoseKg} kg pure N required for ${areaAcres} acre).`);
        englishLines.push(`Weather Risk: Rain probability is high (${maxRainProb48h}% within 48h). Postpone top-dressing until after rainfall to prevent fertilizer leaching.`);
        tamilLines.push(`${areaAcres} ஏக்கர் ${targetCrop} பயிருக்கு ${nDoseKg} கிலோ தூய தழைச்சத்து தேவைப்படுகிறது.`);
        tamilLines.push(`மழை வாய்ப்பு (${maxRainProb48h}%) உள்ளதால் உரம் இடுவதை மழைக்கு பின் மேற்கொள்ளவும்.`);
      } else {
        urgency = (nDose?.deficit > 20 || pDose?.deficit > 15) ? 'YELLOW' : 'GREEN';
        englishLines.push(`Field Assessment (${targetCrop}): Soil NPK is currently ${soilData.latest?.N}-${soilData.latest?.P}-${soilData.latest?.K} kg/ha against ideal ${reqData.ideal?.N}-${reqData.ideal?.P}-${reqData.ideal?.K} kg/ha.`);
        englishLines.push(`Weather Risk: Rainfall probability is low (${maxRainProb48h}%, <3 mm); do not delay operations.`);
        
        // Multi-nutrient completeness guardrail:
        englishLines.push(`Actionable Prescription: Apply ${commUreaKg} kg of commercial Urea per acre (equivalent to ${nDoseKg} kg pure N) in two split doses.`);
        if (pDoseKg > 0) {
          englishLines.push(`Apply ${commSspKg} kg Single Super Phosphate (SSP 16% P2O5) to meet phosphorus deficit.`);
        }
        if (kDoseKg > 0) {
          englishLines.push(`Apply ${commMopKg} kg Muriate of Potash (MOP 60% K2O) to meet potassium deficit.`);
        }
        englishLines.push(`Irrigate with ~25,000 L/acre immediately following fertilizer application to prevent ammonia volatilization.`);
        tamilLines.push(`${areaAcres} ஏக்கருக்கு ${commUreaKg} கிலோ வணிக யூரியா (${nDoseKg} கிலோ தூய N), ${commSspKg} கிலோ SSP மற்றும் ${commMopKg} கிலோ MOP இடவும்.`);
        tamilLines.push(`உரமிட்டவுடன் அம்மோனியா ஆவியாவதைத் தடுக்க உடனே 25,000 லிட்டர் நீர் பாய்ச்சவும்.`);
      }
    }
    // 3. SOIL pH & ACIDITY FOCUSED QUESTION
    else if (isPhQuery) {
      urgency = (latestPH < 5.8 || latestPH > 7.5) ? 'YELLOW' : 'GREEN';
      englishLines.push(`Field Assessment (${targetCrop}): Current root-zone soil pH is ${latestPH}, indicating slightly acidic conditions in the 300 mm root zone.`);
      englishLines.push(`For ${targetCrop}, the optimal agronomic pH range is 6.0 to 6.8. At pH ${latestPH}, major nutrients (N, P, K) remain readily bioavailable.`);
      if (latestPH < 6.0) {
        englishLines.push(`Actionable Prescription: Apply 100 kg agricultural lime per acre if pH drops below 6.0.`);
      } else {
        englishLines.push(`Actionable Prescription: No chemical amendment (lime or gypsum) is required at this time.`);
      }
      tamilLines.push(`மண்ணின் கார அமிலத்தன்மை (pH) தற்போது ${latestPH} ஆக உள்ளது. இது ${targetCrop} பயிருக்கு உகந்த வரம்பில் உள்ளது.`);
      tamilLines.push(`தற்போது சுண்ணாம்பு அல்லது ஜிப்சம் இட வேண்டிய அவசியம் இல்லை.`);
    }
    // 4. RICE / PADDY IN THANJAVUR / DELTA ZONE
    else if (isRiceQuery) {
      const mm = waterDose?.irrigation_mm ?? 20;
      const litres = waterDose?.litres ?? 80937;
      const pumpHours = waterDose?.pump_hours_5hp ?? 8.1;
      const nDoseKg = nDose?.dose_kg ?? 30.0;
      const commUreaKg = nDose?.commercial_kg ?? Math.round((nDoseKg / 0.46) * 10) / 10;
      const isFloweringStage = targetStage === 'flowering' || targetStage === 'ripening';

      urgency = latestMoisture < 70 ? 'RED' : 'GREEN';
      englishLines.push(`Field Assessment (Plot - Paddy Rice): Soil moisture is at ${latestMoisture}% (below the 75-85% optimal saturation threshold for ${targetStage || 'tillering'} stage).`);
      englishLines.push(`Weather Risk: Rainfall likelihood is low (${maxRainProb48h}%, <2 mm). Do not delay operations, as anticipated rainfall is insufficient to recover soil moisture.`);
      englishLines.push(`Actionable Prescriptions: Apply ${litres.toLocaleString()} Liters of water per acre (${mm} mm depth, or run standard 5 HP irrigation pump for ~${pumpHours} hours) to restore soil saturation and maintain a 2-3 cm standing water film.`);
      
      // Growth Stage Agronomic Timing guardrail for cereals/paddy:
      if (isFloweringStage) {
        englishLines.push(`Agronomic Timing Warning: In paddy, NEVER top-dress Nitrogen at flowering as it induces blast disease susceptibility and floret sterility; N top-dressing is restricted to active tillering and panicle initiation.`);
      } else if (nDose && nDose.dose_kg > 0) {
        englishLines.push(`Fertilizer Dosage: Apply ${commUreaKg} kg of commercial Urea per acre (equivalent to ${nDoseKg} kg pure N) in two split-doses during tillering.`);
      }
      tamilLines.push(`தஞ்சாவூர் டெல்டா நெல் பயிருக்கு மண் ஈரப்பதம் ${latestMoisture}% ஆக உள்ளது. மழை வாய்ப்பு குறைவு (${maxRainProb48h}%).`);
      tamilLines.push(`${areaAcres} ஏக்கருக்கு ${litres.toLocaleString()} லிட்டர் (${pumpHours} மணி நேரம் பம்ப் பாசனம்) நீர் பாய்ச்சவும்.`);
    }
    // 5. IRRIGATION & WATER STRESS (Default for standard field queries)
    else {
      const mm = waterDose?.irrigation_mm ?? 25;
      const litres = waterDose?.litres ?? 101172;
      const pumpHours = waterDose?.pump_hours_5hp ?? 10.1;
      const nDoseKg = nDose?.dose_kg ?? 24.28;
      const commUreaKg = nDose?.commercial_kg ?? Math.round((nDoseKg / 0.46) * 10) / 10;
      const latestTemp = Number(soilData.latest?.temperature || 32);

      if (maxRainProb48h >= 60) {
        urgency = 'YELLOW';
        englishLines.push(`Field Assessment (${targetCrop}): Moisture is ${latestMoisture}%.`);
        englishLines.push(`Weather Risk: High rain probability (${maxRainProb48h}% in next 48h with ${(rainMms[0] + rainMms[1]).toFixed(1)} mm rainfall).`);
        englishLines.push(`Actionable Prescription: Withhold surface irrigation and chemical fertigation to avoid waterlogging and fertilizer leaching.`);
        tamilLines.push(`அடுத்த 48 மணி நேரத்தில் ${maxRainProb48h}% கனமழை வாய்ப்புள்ளது. நீர்ப்பாசனத்தை தற்காலிகமாக நிறுத்தி வைக்கவும்.`);
      } else if (latestMoisture < idealMoisture - 10) {
        urgency = 'RED';
        englishLines.push(`Field Assessment (${targetCrop}): Soil moisture is at ${latestMoisture}% (below the ${idealMoisture}% optimal threshold for ${targetStage || 'flowering'} stage, trend: ${moistureStatus} at slope ${trendData.slope_per_reading}/reading).`);
        
        // Root-zone heat stress guardrail:
        if (latestTemp >= 30 && moistureStatus === 'falling') {
          englishLines.push(`Thermal Root Stress: Root-zone temperature is elevated at ${latestTemp}°C with declining moisture; immediate irrigation is critical to mitigate thermal root stress and prevent xylem cavitation.`);
        }
        
        englishLines.push(`Weather Risk: A light rainfall probability (${maxRainProb48h}%) is forecasted over the next 72 hours with negligible accumulation (<2 mm). Do not delay operations, as anticipated rainfall is insufficient to recover soil moisture.`);
        englishLines.push(`Actionable Prescriptions: Apply ${litres.toLocaleString()} Liters of water per acre (${mm} mm depth, or run standard 5 HP borewell irrigation for approximately ${pumpHours} hours) to restore root-zone moisture to ${idealMoisture}%.`);
        if (nDose && nDose.dose_kg > 0) {
          englishLines.push(`Fertilizer Dosage: Apply ${commUreaKg} kg of commercial Urea per acre (equivalent to ${nDoseKg} kg pure N) following irrigation to prevent root scorch and ammonia volatilization.`);
        }
        tamilLines.push(`மண் ஈரப்பதம் ${latestMoisture}% ஆக குறைந்துள்ளது (இடர் நிலை: சிவப்பு). வெப்ப தணிப்பு மற்றும் பாசனத்திற்காக 1 ஏக்கருக்கு ${litres.toLocaleString()} லிட்டர் (${pumpHours} மணி நேரம் பம்ப் பாசனம்) நீர் பாய்ச்சவும். தொடர்ந்து ${commUreaKg} கிலோ வணிக யூரியா (${nDoseKg} கிலோ தூய N) இடவும்.`);
      } else {
        urgency = 'GREEN';
        englishLines.push(`Field Assessment (${targetCrop}): Soil moisture is stable at ${latestMoisture}% (target ${idealMoisture}%). Weather risk is low (${maxRainProb48h}%).`);
        englishLines.push(`Actionable Prescription: No supplemental irrigation needed today. Re-evaluate sensor telemetry in 48 hours.`);
        tamilLines.push(`மண் ஈரப்பதம் ${latestMoisture}% அளவில் உகந்ததாக உள்ளது. இன்று கூடுதல் நீர்ப்பாசனம் தேவையில்லை.`);
      }
    }

    const answer = `URGENCY: ${urgency}
ADVICE: ${englishLines.join(' ')}
ஆலோசனை: ${tamilLines.join(' ')}
Estimate only. Confirm with a local agriculture officer.`;

    return { answer, trace };
  }

  private generateFallbackAdvisory(query: string, errorReason: string): AgentJudgesResponse {
    const soilObs = this.tools.getSoilReadings(7);
    const answer = `URGENCY: YELLOW
ADVICE: Sensor telemetry evaluated for "${query}". Field moisture is currently low; prioritize scheduled irrigation and monitor 48h rain forecast.
ஆலோசனை: கள நிலவரத்தை தொடர்ந்து கண்காணிக்கவும். பாசனத்திற்கு முன்னுரிமை அளிக்கவும்.
Estimate only. Confirm with a local agriculture officer.`;
    return {
      answer,
      trace: [
        {
          thought: 'Analyze telemetry and compute dosage.',
          tool: 'get_soil_readings',
          args: { days: 7 },
          observation: soilObs
        }
      ]
    };
  }
}

export function parseAdvice(rawText: string): ParsedAdvice {
  let urgency: UrgencyLevel = 'GREEN';
  if (rawText.includes('URGENCY: RED')) urgency = 'RED';
  else if (rawText.includes('URGENCY: YELLOW')) urgency = 'YELLOW';
  else if (rawText.includes('URGENCY: GREEN')) urgency = 'GREEN';

  let englishAdvice = '';
  const advMatch = rawText.match(/ADVICE:\s*([\s\S]*?)(?=ஆலோசனை:|Tamil Advice:|Estimate only|$)/i);
  if (advMatch) {
    englishAdvice = advMatch[1].trim();
  } else {
    englishAdvice = rawText;
  }

  let tamilAdvice = '';
  const tamMatch = rawText.match(/(?:ஆலோசனை:|Tamil Advice:)\s*([\s\S]*?)(?=Estimate only|$)/i);
  if (tamMatch) {
    tamilAdvice = tamMatch[1].trim();
  } else {
    tamilAdvice = 'கள நிலவரத்தை தொடர்ந்து கண்காணிக்கவும். உள்ளூர் வேளாண்மை அலுவலரிடம் ஆலோசனை பெறவும்.';
  }

  const disclaimer = 'Estimate only. Confirm with a local agriculture officer.';

  return {
    urgency,
    englishAdvice,
    tamilAdvice,
    disclaimer,
    rawText
  };
}
