"""Crop advisory tools for the AgentX starter. Every tool returns a JSON string and never raises."""
import csv
import json
import os
import re
import time
import urllib.request
import urllib.error

from tools import Tool

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _knowledge_path():
    p1 = os.path.join(REPO_ROOT, "knowledge", "crop_requirements.json")
    if os.path.exists(p1):
        return p1
    p2 = os.path.join(_data_dir(), "crop_requirements.json")
    if os.path.exists(p2):
        return p2
    return os.path.join(REPO_ROOT, "data", "crop_requirements.json")


def _data_dir():
    """Read AGENTX_DATA_DIR at call time so tests and the judges' harness can change it."""
    return os.environ.get("AGENTX_DATA_DIR") or os.path.join(REPO_ROOT, "data")


# Assumptions used by calculate_dosage. Reported in every result.
ROOT_ZONE_MM = 300            # assumed root-zone depth for the water calculation
ACRES_PER_HECTARE = 2.471
MAX_NUTRIENT_KG_PER_ACRE = 60  # guardrail cap per nutrient
MAX_WATER_MM = 25              # guardrail cap per irrigation
LITRES_PER_MM_PER_ACRE = 4046.86

ALIASES = {
    "moisture": ["moisture", "soil_moisture", "soilmoisture"],
    "N": ["n", "nitrogen"],
    "P": ["p", "phosphorus", "phosphorous"],
    "K": ["k", "potassium"],
    "pH": ["ph"],
    "temperature": ["temperature", "temp"],
    "rainfall": ["rainfall", "rain"],
    "humidity": ["humidity"],
    "crop": ["crop", "label"],
    "time": ["timestamp", "time", "date", "datetime"]
}
NUTRIENTS = ["N", "P", "K"]


def _out(d):
    return json.dumps(d, default=str)


def _load_rows():
    """Load soil_telemetry.csv using stdlib csv with alias mapping."""
    filepath = os.path.join(_data_dir(), "soil_telemetry.csv")
    if not os.path.exists(filepath):
        raise ValueError("soil_telemetry.csv not found")
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        reader = list(csv.reader(f))
    if len(reader) < 2:
        raise ValueError("soil_telemetry.csv is empty")

    raw_header = [h.strip() for h in reader[0]]
    col_map = {}
    for std, names in ALIASES.items():
        for i, h in enumerate(raw_header):
            hl = h.lower()
            if hl in names:
                col_map[std] = i
                break

    rows = []
    for r in reader[1:]:
        if not any(r):
            continue
        entry = {}
        for std, idx in col_map.items():
            if idx < len(r):
                entry[std] = r[idx].strip()
        rows.append(entry)
    if not rows:
        raise ValueError("soil_telemetry.csv is empty")
    return rows, list(col_map.keys())


def _int(v, default):
    try:
        return int(float(v))
    except Exception:
        return default


def _num(v, default):
    try:
        return float(v)
    except Exception:
        return default


class GetSoilReadings(Tool):
    name = "get_soil_readings"
    description = "Summarise recent soil sensor data (mean and latest value per column) from soil_telemetry.csv."
    args_doc = '{"days": 7}'

    def execute(self, days=7, **kw):
        try:
            rows, cols = _load_rows()
            w = rows[-_int(days, 7):] if len(rows) > _int(days, 7) else rows
            num_cols = ["moisture", "N", "P", "K", "pH", "temperature", "humidity", "rainfall"]
            found_num = [c for c in num_cols if any(c in r for r in w)]
            if not found_num:
                return _out({"error": "no numeric columns in soil data"})

            mean, latest = {}, {}
            for c in found_num:
                vals = []
                for r in w:
                    try:
                        vals.append(float(r[c]))
                    except (KeyError, ValueError):
                        pass
                if vals:
                    mean[c] = round(sum(vals) / len(vals), 2)
                    latest[c] = round(vals[-1], 2)

            res = {
                "rows": len(w),
                "has_time_column": any("time" in r for r in w),
                "columns": found_num,
                "mean": mean,
                "latest": latest
            }
            crops = list(set(r["crop"] for r in w if "crop" in r and r["crop"]))
            if crops:
                res["crops_in_data"] = crops[:10]
            return _out(res)
        except Exception as e:
            return _out({"error": f"could not read soil data: {e}"})


class AnalyzeTrend(Tool):
    name = "analyze_trend"
    description = ("Trend of one soil column over the data (slope, min, max, status falling/rising/stable). "
                   "Columns: moisture, N, P, K, pH, temperature, rainfall.")
    args_doc = '{"column": "moisture", "days": 7}'

    def execute(self, column="moisture", days=7, **kw):
        try:
            rows, cols = _load_rows()
            w = rows[-_int(days, 7):] if len(rows) > _int(days, 7) else rows
            vals = []
            for r in w:
                if column in r:
                    try:
                        vals.append(float(r[column]))
                    except ValueError:
                        pass
            if not vals:
                return _out({"error": f"column '{column}' not found. Available: {cols}"})
            if len(vals) < 3:
                return _out({"error": f"only {len(vals)} readings. Need at least 3 to judge a trend."})

            # Linear regression: slope = (n*sum(xy) - sum(x)*sum(y)) / (n*sum(x^2) - sum(x)^2)
            n = len(vals)
            x = list(range(n))
            sum_x = sum(x)
            sum_y = sum(vals)
            sum_xy = sum(i * v for i, v in zip(x, vals))
            sum_xx = sum(i * i for i in x)
            denom = n * sum_xx - sum_x * sum_x
            slope = (n * sum_xy - sum_x * sum_y) / denom if denom != 0 else 0.0

            status = "falling" if slope < -0.05 else "rising" if slope > 0.05 else "stable"
            return _out({
                "column": column,
                "readings": n,
                "slope_per_reading": round(slope, 3),
                "min": float(min(vals)),
                "max": float(max(vals)),
                "latest": float(vals[-1]),
                "status": status
            })
        except Exception as e:
            return _out({"error": f"trend failed: {e}"})


class WeatherForecast(Tool):
    name = "get_weather_forecast"
    description = "3-day rain probability (%) and rainfall (mm) from Open-Meteo. Defaults to Tiruchirappalli."
    args_doc = '{"lat": 10.79, "lon": 78.70}'

    def execute(self, lat=10.79, lon=78.70, **kw):
        url = ("https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s"
               "&daily=precipitation_sum,precipitation_probability_max&forecast_days=3"
               % (_num(lat, 10.79), _num(lon, 78.70)))
        for _ in range(2):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "AgentX/1.0"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode())
                d = data.get("daily", {})
                if "precipitation_probability_max" in d:
                    return _out({
                        "rain_probability_pct": d["precipitation_probability_max"],
                        "rain_mm": d["precipitation_sum"],
                        "days_ahead": [1, 2, 3]
                    })
            except Exception:
                time.sleep(1)
        return _out({"error": "weather forecast unavailable after retry. Advise conservatively and say so."})


def _requirements(crop, stage=None):
    kpath = _knowledge_path()
    if not os.path.exists(kpath):
        return None, []
    with open(kpath, "r", encoding="utf-8") as f:
        table = json.load(f)
    key = {k.lower(): k for k in table}.get(str(crop).lower().strip())
    if key is None:
        return None, sorted(table)
    entry = table[key]
    vals = dict(entry.get("ideal", {}))
    used_stage = None
    if stage and stage in entry.get("stages", {}):
        vals.update(entry["stages"][stage])
        used_stage = stage
    return {"crop": key, "stage": used_stage, "ideal": vals, "source": entry.get("source", "unknown")}, sorted(table)


class CropRequirements(Tool):
    name = "get_crop_requirements"
    description = "Ideal soil values (N, P, K, pH, moisture, rainfall where known) for a crop, optionally by growth stage."
    args_doc = '{"crop": "tomato", "stage": "flowering"}'

    def execute(self, crop="tomato", stage=None, **kw):
        try:
            res, known = _requirements(crop, stage)
            if res is None:
                return _out({"error": f"no requirements for '{crop}'", "known_crops": known})
            return _out(res)
        except Exception as e:
            return _out({"error": f"could not read crop requirements: {e}"})


class CalculateDosage(Tool):
    name = "calculate_dosage"
    description = ("Fertilizer (N, P, K kg) and irrigation (mm, litres) needed to close the gap between the latest soil "
                   "readings and the crop's ideal values, for a given area. Capped for safety.")
    args_doc = '{"crop": "tomato", "area_acres": 1.0, "stage": "flowering"}'

    def execute(self, crop="tomato", area_acres=1.0, stage=None, **kw):
        try:
            area = _num(area_acres, 1.0)
            if area <= 0:
                return _out({"error": "area_acres must be positive"})
            req, known = _requirements(crop, stage)
            if req is None:
                return _out({"error": f"no requirements for '{crop}'", "known_crops": known})
            rows, cols = _load_rows()
            if len(rows) < 3:
                return _out({"error": f"only {len(rows)} readings. Refusing to calculate a dosage."})
            latest = rows[-1]
            ideal, out, notes = req["ideal"], {}, []

            for n in NUTRIENTS:
                if n in ideal and n in latest:
                    try:
                        latest_n = float(latest[n])
                        ideal_n = float(ideal[n])
                        deficit = max(ideal_n - latest_n, 0.0)
                        kg = deficit / ACRES_PER_HECTARE * area
                        capped = min(kg, MAX_NUTRIENT_KG_PER_ACRE * area)
                        
                        comm_fert = "Direct Nutrient Source"
                        comm_kg = round(capped, 2)
                        if n == "N":
                            comm_fert = "Commercial Urea (46% N)"
                            comm_kg = round(capped / 0.46, 1)
                        elif n == "P":
                            comm_fert = "Single Super Phosphate (16% P2O5)"
                            comm_kg = round(capped / 0.16, 1)
                        elif n == "K":
                            comm_fert = "Muriate of Potash (60% K2O)"
                            comm_kg = round(capped / 0.60, 1)

                        out[n] = {
                            "current": round(latest_n, 2),
                            "ideal": ideal_n,
                            "deficit": round(deficit, 2),
                            "dose_kg": round(capped, 2),
                            "commercial_fertilizer": comm_fert,
                            "commercial_kg": comm_kg
                        }
                        if capped < kg:
                            notes.append(f"{n} dose capped at {MAX_NUTRIENT_KG_PER_ACRE} kg/acre")
                    except (ValueError, TypeError):
                        pass

            if "moisture" in ideal and "moisture" in latest:
                try:
                    latest_m = float(latest["moisture"])
                    ideal_m = float(ideal["moisture"])
                    deficit = max(ideal_m - latest_m, 0.0)
                    mm = min(deficit / 100.0 * ROOT_ZONE_MM, MAX_WATER_MM)
                    litres = round(mm * LITRES_PER_MM_PER_ACRE * area)
                    pump_hours = round(litres / 10000.0, 1)
                    out["water"] = {
                        "current_pct": round(latest_m, 2),
                        "ideal_pct": ideal_m,
                        "irrigation_mm": round(mm, 1),
                        "litres": litres,
                        "pump_hours_5hp": pump_hours
                    }
                except (ValueError, TypeError):
                    pass

            if not out:
                return _out({"error": "no overlapping columns between soil data and crop requirements",
                             "soil_columns": list(latest.keys()), "ideal_keys": list(ideal.keys())})

            return _out({
                "crop": req["crop"],
                "stage": req["stage"],
                "area_acres": area,
                "dosage": out,
                "notes": notes,
                "assumptions": (f"N/P/K read as kg/ha-equivalent, root zone {ROOT_ZONE_MM} mm. "
                                "Estimate only. Confirm with a local agriculture officer."),
                "requirements_source": req["source"]
            })
        except Exception as e:
            return _out({"error": f"dosage failed: {e}"})


CROP_TOOLS = [GetSoilReadings, AnalyzeTrend, WeatherForecast, CropRequirements, CalculateDosage]
