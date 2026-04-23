/**
 * Strict type definitions for all standard parts
 * Section 11.1: Eliminate `any` types - contract-based programming
 */

export interface BearingSpec {
  designation: string
  inner_diameter: number
  outer_diameter: number
  width: number
  C_r: number
  C_0r: number
  speed_limit_grease: number
  speed_limit_oil: number
  mass: number
}

export interface BoltSpec {
  designation: string
  d: number
  head_width_s: number
  head_height_k: number
  standard: string
  stress_area?: number
}

export interface ThreadSpec {
  designation: string
  d: number
  pitch: number
  d2: number
  d1: number
  stress_area: number
}

export interface ORingSpec {
  standard: string
  code: string
  id: number
  cs: number
}

export interface ITGradeEntry {
  grade: string
  size_index: number
  value: number
}

export interface FundamentalDeviationEntry {
  type: 'holes' | 'shafts'
  position: string
  size_index: number
  value: number
}

export interface MaterialSpec {
  designation: string
  name_zh: string
  density: number
  E: number
  yield_strength: number
  tensile_strength: number
  elongation: number
  temp_min?: number
  temp_max?: number
  applications: string[]
  notes?: string
  hardness_brinell?: number
  /** Heat treatment condition (Section 11.4) */
  condition?: 'annealed' | 'normalized' | 'quenched_tempered' | 'as_rolled'
  /** Standard reference (Section 11.4) */
  standard_ref?: string
}
