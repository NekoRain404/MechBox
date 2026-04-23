import bearingData from "../../../data/standards/bearings/deep-groove.json";
import boltData from "../../../data/standards/bolts/hex-bolts.json";
import oringData from "../../../data/standards/o-ring/as568.json";
import threadData from "../../../data/standards/threads/iso-metric.json";

const fallbackThreadRows = threadData.threads.map((item) => ({
  thread_id: `fallback_thread_${item.designation.replace(/[^a-zA-Z0-9]/g, "_")}`,
  standard_id: "std_iso_261",
  revision_id: "rev_iso_261_default",
  designation: item.designation,
  nominal_d: item.d,
  pitch: item.pitch,
  major_diameter: item.d,
  pitch_diameter: item.d2,
  minor_diameter: item.d1,
  tap_drill: null,
  stress_area: item.stress_area,
  dataset_id: "fallback_threads_iso_metric_json",
  data_origin: "json-fallback",
}));

const stressAreaByDesignation = new Map(
  fallbackThreadRows.map((item) => [item.designation, item.stress_area]),
);

export const fallbackThreads = fallbackThreadRows;

export const fallbackBolts = boltData.bolts.map((item) => ({
  bolt_id: `fallback_bolt_${item.designation.replace(/[^a-zA-Z0-9]/g, "_")}`,
  standard_id: "std_iso_4014",
  revision_id: "rev_iso_4014_default",
  designation: item.designation,
  nominal_d: item.d,
  pitch: fallbackThreadRows.find((thread) => thread.designation === item.designation)?.pitch ?? null,
  head_width_s: item.head_width_s,
  head_height_k: item.head_height_k,
  stress_area: stressAreaByDesignation.get(item.designation) ?? null,
  dataset_id: "fallback_bolts_hex_json",
  data_origin: "json-fallback",
}));

export const fallbackBearings = bearingData.bearings.map((item) => ({
  bearing_id: `fallback_bearing_${item.designation.replace(/[^a-zA-Z0-9]/g, "_")}`,
  standard_id: "std_iso_281",
  revision_id: "rev_iso_281_default",
  designation: item.designation,
  bearing_type: bearingData.type || "deep_groove_ball",
  inner_diameter: item.d,
  outer_diameter: item.D,
  width: item.B,
  dynamic_load_rating: item.C_r * 1000,
  static_load_rating: item.C_0r * 1000,
  grease_speed_limit: item.speed_limit_grease,
  oil_speed_limit: item.speed_limit_oil,
  mass: item.mass,
  dataset_id: "fallback_bearings_deep_groove_json",
  data_origin: "json-fallback",
}));

export function getFallbackOringList(standard?: string) {
  if (standard && standard !== "std_as568") {
    return [];
  }

  return oringData.sizes.map((item) => ({
    oring_id: `fallback_oring_${item.code}`,
    standard_id: "std_as568",
    revision_id: "rev_as568f",
    dash_code: item.code,
    code: item.code,
    inner_diameter: item.id,
    id: item.id,
    cross_section: item.cs,
    cs: item.cs,
    dataset_id: "fallback_oring_as568_json",
    data_origin: "json-fallback",
  }));
}
