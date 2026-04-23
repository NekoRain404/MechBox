PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

BEGIN;

CREATE TABLE IF NOT EXISTS source_provider (
  source_id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('public_open', 'purchased_standard', 'vendor_catalog', 'reference_db', 'enterprise')
  ),
  homepage_url TEXT,
  license_note TEXT,
  trust_level INTEGER NOT NULL DEFAULT 3 CHECK (trust_level BETWEEN 1 AND 5),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS standard_system (
  system_code TEXT PRIMARY KEY,
  system_name TEXT NOT NULL,
  issuer_name TEXT
);

CREATE TABLE IF NOT EXISTS standard_document (
  standard_id TEXT PRIMARY KEY,
  system_code TEXT NOT NULL,
  standard_number TEXT NOT NULL,
  title TEXT NOT NULL,
  domain_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'superseded', 'withdrawn', 'draft')
  ),
  notes TEXT,
  FOREIGN KEY (system_code) REFERENCES standard_system(system_code),
  UNIQUE (system_code, standard_number)
);

CREATE INDEX IF NOT EXISTS idx_standard_document_domain
  ON standard_document(domain_code);

CREATE TABLE IF NOT EXISTS standard_revision (
  revision_id TEXT PRIMARY KEY,
  standard_id TEXT NOT NULL,
  revision_code TEXT NOT NULL,
  version_label TEXT,
  publish_date TEXT,
  reaffirm_date TEXT,
  source_id TEXT,
  source_url TEXT,
  copyright_class TEXT DEFAULT 'public_open' CHECK (
    copyright_class IN ('public_open', 'restricted', 'licensed_internal', 'vendor_reference')
  ),
  checksum TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (source_id) REFERENCES source_provider(source_id),
  UNIQUE (standard_id, revision_code)
);

CREATE TABLE IF NOT EXISTS dataset_release (
  dataset_id TEXT PRIMARY KEY,
  dataset_name TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  source_id TEXT,
  revision_id TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT,
  row_count INTEGER,
  notes TEXT,
  FOREIGN KEY (source_id) REFERENCES source_provider(source_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id)
);

CREATE TABLE IF NOT EXISTS manufacturer (
  manufacturer_id TEXT PRIMARY KEY,
  manufacturer_name TEXT NOT NULL,
  country_code TEXT,
  homepage_url TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS material_grade (
  material_id TEXT PRIMARY KEY,
  standard_id TEXT,
  revision_id TEXT,
  grade_code TEXT NOT NULL,
  grade_name TEXT NOT NULL,
  material_family TEXT NOT NULL,
  product_form TEXT,
  heat_treatment_state TEXT,
  density REAL,
  elastic_modulus REAL,
  shear_modulus REAL,
  yield_strength REAL,
  tensile_strength REAL,
  elongation REAL,
  temp_min REAL,
  temp_max REAL,
  dataset_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'deprecated', 'draft')
  ),
  notes TEXT,
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_material_grade_code
  ON material_grade(grade_code);

CREATE INDEX IF NOT EXISTS idx_material_family
  ON material_grade(material_family);

CREATE TABLE IF NOT EXISTS material_alias (
  alias_id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id TEXT NOT NULL,
  alias_type TEXT NOT NULL CHECK (
    alias_type IN ('legacy_grade', 'commercial_name', 'search_keyword', 'equivalent_name')
  ),
  alias_value TEXT NOT NULL,
  FOREIGN KEY (material_id) REFERENCES material_grade(material_id) ON DELETE CASCADE,
  UNIQUE (material_id, alias_type, alias_value)
);

CREATE TABLE IF NOT EXISTS material_composition (
  material_id TEXT NOT NULL,
  element_symbol TEXT NOT NULL,
  min_percent REAL,
  max_percent REAL,
  target_percent REAL,
  FOREIGN KEY (material_id) REFERENCES material_grade(material_id) ON DELETE CASCADE,
  PRIMARY KEY (material_id, element_symbol)
);

CREATE INDEX IF NOT EXISTS idx_material_composition_element
  ON material_composition(element_symbol);

CREATE TABLE IF NOT EXISTS material_property_set (
  property_set_id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL,
  condition_label TEXT,
  test_temperature_c REAL DEFAULT 20,
  source_id TEXT,
  source_url TEXT,
  note TEXT,
  FOREIGN KEY (material_id) REFERENCES material_grade(material_id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES source_provider(source_id)
);

CREATE TABLE IF NOT EXISTS material_property (
  property_set_id TEXT NOT NULL,
  property_code TEXT NOT NULL,
  numeric_value REAL,
  text_value TEXT,
  unit_code TEXT,
  FOREIGN KEY (property_set_id) REFERENCES material_property_set(property_set_id) ON DELETE CASCADE,
  PRIMARY KEY (property_set_id, property_code)
);

CREATE INDEX IF NOT EXISTS idx_material_property_code
  ON material_property(property_code, numeric_value);

CREATE TABLE IF NOT EXISTS material_equivalent (
  relation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id TEXT NOT NULL,
  external_system_code TEXT,
  external_grade_code TEXT,
  equivalence_level TEXT NOT NULL CHECK (
    equivalence_level IN ('exact', 'near', 'reference')
  ),
  note TEXT,
  FOREIGN KEY (material_id) REFERENCES material_grade(material_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS thread_metric (
  thread_id TEXT PRIMARY KEY,
  standard_id TEXT,
  revision_id TEXT,
  designation TEXT NOT NULL,
  nominal_d REAL NOT NULL,
  pitch REAL NOT NULL,
  pitch_series TEXT,
  major_diameter REAL,
  pitch_diameter REAL,
  minor_diameter REAL,
  tap_drill REAL,
  stress_area REAL,
  dataset_id TEXT,
  notes TEXT,
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id),
  UNIQUE (designation, pitch)
);

CREATE INDEX IF NOT EXISTS idx_thread_metric_nominal
  ON thread_metric(nominal_d, pitch);

CREATE TABLE IF NOT EXISTS seal_oring_size (
  oring_id TEXT PRIMARY KEY,
  standard_id TEXT,
  revision_id TEXT,
  dash_code TEXT NOT NULL,
  inner_diameter REAL NOT NULL,
  cross_section REAL NOT NULL,
  tolerance_id_plus REAL,
  tolerance_id_minus REAL,
  tolerance_cs_plus REAL,
  tolerance_cs_minus REAL,
  series_code TEXT,
  dataset_id TEXT,
  notes TEXT,
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id),
  UNIQUE (revision_id, dash_code)
);

CREATE INDEX IF NOT EXISTS idx_seal_oring_size_dim
  ON seal_oring_size(inner_diameter, cross_section);

CREATE TABLE IF NOT EXISTS seal_oring_material (
  oring_material_id TEXT PRIMARY KEY,
  material_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  hardness_shore_a INTEGER,
  temperature_min_c REAL,
  temperature_max_c REAL,
  oil_resistance_rating TEXT,
  water_resistance_rating TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS fastener_hex_bolt (
  bolt_id TEXT PRIMARY KEY,
  standard_id TEXT,
  revision_id TEXT,
  designation TEXT NOT NULL,
  thread_id TEXT,
  nominal_d REAL NOT NULL,
  length_l REAL,
  pitch REAL,
  head_width_s REAL,
  head_height_k REAL,
  thread_length_b REAL,
  strength_class TEXT,
  material_code TEXT,
  finish_code TEXT,
  dataset_id TEXT,
  notes TEXT,
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id),
  FOREIGN KEY (thread_id) REFERENCES thread_metric(thread_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_fastener_hex_bolt_dim
  ON fastener_hex_bolt(nominal_d, length_l, strength_class);

CREATE TABLE IF NOT EXISTS fastener_hex_nut (
  nut_id TEXT PRIMARY KEY,
  standard_id TEXT,
  revision_id TEXT,
  designation TEXT NOT NULL,
  thread_id TEXT,
  nominal_d REAL NOT NULL,
  pitch REAL,
  width_s REAL NOT NULL,
  height_m REAL NOT NULL,
  strength_class TEXT,
  material_code TEXT,
  finish_code TEXT,
  dataset_id TEXT,
  notes TEXT,
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id),
  FOREIGN KEY (thread_id) REFERENCES thread_metric(thread_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_fastener_hex_nut_dim
  ON fastener_hex_nut(nominal_d, pitch, strength_class);

CREATE TABLE IF NOT EXISTS fastener_plain_washer (
  washer_id TEXT PRIMARY KEY,
  standard_id TEXT,
  revision_id TEXT,
  designation TEXT NOT NULL,
  nominal_d REAL NOT NULL,
  inner_diameter REAL NOT NULL,
  outer_diameter REAL NOT NULL,
  thickness REAL NOT NULL,
  material_code TEXT,
  finish_code TEXT,
  dataset_id TEXT,
  notes TEXT,
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_fastener_plain_washer_dim
  ON fastener_plain_washer(nominal_d, inner_diameter, outer_diameter);

CREATE TABLE IF NOT EXISTS bearing_basic (
  bearing_id TEXT PRIMARY KEY,
  standard_id TEXT,
  revision_id TEXT,
  designation TEXT NOT NULL,
  bearing_type TEXT NOT NULL,
  inner_diameter REAL NOT NULL,
  outer_diameter REAL NOT NULL,
  width REAL NOT NULL,
  dynamic_load_rating REAL,
  static_load_rating REAL,
  grease_speed_limit REAL,
  oil_speed_limit REAL,
  clearance_group TEXT,
  mass REAL,
  dataset_id TEXT,
  notes TEXT,
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id),
  UNIQUE (designation)
);

CREATE INDEX IF NOT EXISTS idx_bearing_basic_dim
  ON bearing_basic(inner_diameter, outer_diameter, width);

CREATE TABLE IF NOT EXISTS gear_module_standard (
  gear_module_id TEXT PRIMARY KEY,
  standard_id TEXT,
  revision_id TEXT,
  gear_type TEXT NOT NULL,
  pressure_angle_deg REAL NOT NULL DEFAULT 20,
  helix_angle_deg REAL NOT NULL DEFAULT 0,
  module_value REAL NOT NULL,
  module_system TEXT NOT NULL DEFAULT 'metric',
  note TEXT,
  dataset_id TEXT,
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id),
  UNIQUE (revision_id, gear_type, pressure_angle_deg, helix_angle_deg, module_value, module_system)
);

CREATE INDEX IF NOT EXISTS idx_gear_module_standard_value
  ON gear_module_standard(gear_type, module_value);

CREATE TABLE IF NOT EXISTS rule_table (
  rule_table_id TEXT PRIMARY KEY,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  domain_code TEXT NOT NULL,
  standard_id TEXT,
  revision_id TEXT,
  dataset_id TEXT,
  notes TEXT,
  FOREIGN KEY (standard_id) REFERENCES standard_document(standard_id),
  FOREIGN KEY (revision_id) REFERENCES standard_revision(revision_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id),
  UNIQUE (revision_id, rule_code)
);

CREATE TABLE IF NOT EXISTS rule_row (
  rule_row_id TEXT PRIMARY KEY,
  rule_table_id TEXT NOT NULL,
  row_key TEXT NOT NULL,
  row_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (rule_table_id) REFERENCES rule_table(rule_table_id) ON DELETE CASCADE,
  UNIQUE (rule_table_id, row_key)
);

CREATE TABLE IF NOT EXISTS rule_value_numeric (
  rule_row_id TEXT NOT NULL,
  column_code TEXT NOT NULL,
  numeric_value REAL NOT NULL,
  unit_code TEXT,
  FOREIGN KEY (rule_row_id) REFERENCES rule_row(rule_row_id) ON DELETE CASCADE,
  PRIMARY KEY (rule_row_id, column_code)
);

CREATE INDEX IF NOT EXISTS idx_rule_value_numeric_col
  ON rule_value_numeric(column_code, numeric_value);

CREATE TABLE IF NOT EXISTS rule_value_text (
  rule_row_id TEXT NOT NULL,
  column_code TEXT NOT NULL,
  text_value TEXT NOT NULL,
  FOREIGN KEY (rule_row_id) REFERENCES rule_row(rule_row_id) ON DELETE CASCADE,
  PRIMARY KEY (rule_row_id, column_code)
);

CREATE TABLE IF NOT EXISTS vendor_part (
  vendor_part_id TEXT PRIMARY KEY,
  manufacturer_id TEXT NOT NULL,
  domain_code TEXT NOT NULL,
  vendor_part_number TEXT NOT NULL,
  linked_entity_type TEXT,
  linked_entity_id TEXT,
  product_url TEXT,
  cad_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'obsolete', 'draft')
  ),
  description TEXT,
  dataset_id TEXT,
  FOREIGN KEY (manufacturer_id) REFERENCES manufacturer(manufacturer_id),
  FOREIGN KEY (dataset_id) REFERENCES dataset_release(dataset_id),
  UNIQUE (manufacturer_id, vendor_part_number)
);

CREATE INDEX IF NOT EXISTS idx_vendor_part_linked
  ON vendor_part(linked_entity_type, linked_entity_id);

CREATE TABLE IF NOT EXISTS vendor_part_ext_numeric (
  vendor_part_id TEXT NOT NULL,
  attr_code TEXT NOT NULL,
  numeric_value REAL NOT NULL,
  unit_code TEXT,
  FOREIGN KEY (vendor_part_id) REFERENCES vendor_part(vendor_part_id) ON DELETE CASCADE,
  PRIMARY KEY (vendor_part_id, attr_code)
);

CREATE TABLE IF NOT EXISTS vendor_part_ext_text (
  vendor_part_id TEXT NOT NULL,
  attr_code TEXT NOT NULL,
  text_value TEXT NOT NULL,
  FOREIGN KEY (vendor_part_id) REFERENCES vendor_part(vendor_part_id) ON DELETE CASCADE,
  PRIMARY KEY (vendor_part_id, attr_code)
);

CREATE TABLE IF NOT EXISTS search_document (
  doc_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
  doc_id UNINDEXED,
  title,
  body,
  tags,
  tokenize = 'unicode61'
);

CREATE TABLE IF NOT EXISTS user_standards (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS data_version (
  standard_code TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  source TEXT DEFAULT 'system',
  updated_at TEXT DEFAULT (datetime('now')),
  checksum TEXT
);

CREATE TABLE IF NOT EXISTS workflow_project (
  project_id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  module_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version_label TEXT NOT NULL DEFAULT '1.0.0',
  revision_code TEXT NOT NULL DEFAULT 'A',
  input_summary TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'archived')
  ),
  lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle_status IN ('draft', 'in-review', 'approved', 'released', 'archived')
  ),
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_project_updated
  ON workflow_project(updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_state (
  state_key TEXT PRIMARY KEY,
  state_value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_artifact (
  report_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  module_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (
    report_type IN ('pdf', 'csv', 'json')
  ),
  status TEXT NOT NULL CHECK (
    status IN ('generated', 'pending')
  ),
  project_number TEXT,
  project_id TEXT,
  project_name TEXT,
  standard_ref TEXT,
  author_name TEXT,
  summary TEXT,
  source_kind TEXT NOT NULL DEFAULT 'module-result' CHECK (
    source_kind IN ('module-result', 'analysis-export', 'archive-report', 'manual-report')
  ),
  linked_run_id TEXT,
  linked_result_id TEXT,
  workflow_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    workflow_status IN ('draft', 'in-review', 'approved', 'released', 'archived')
  ),
  content_json TEXT,
  revision_code TEXT NOT NULL DEFAULT 'A',
  FOREIGN KEY (project_id) REFERENCES workflow_project(project_id) ON DELETE SET NULL,
  FOREIGN KEY (linked_run_id) REFERENCES calculation_run(run_id) ON DELETE SET NULL,
  FOREIGN KEY (linked_result_id) REFERENCES calculation_result(result_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_report_artifact_created
  ON report_artifact(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_artifact_project
  ON report_artifact(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bom_header (
  bom_id TEXT PRIMARY KEY,
  project_id TEXT,
  project_number TEXT NOT NULL,
  project_name TEXT NOT NULL,
  author_name TEXT,
  revision_code TEXT NOT NULL DEFAULT 'A',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'in-review', 'approved', 'released', 'archived')
  ),
  source_kind TEXT NOT NULL DEFAULT 'manual' CHECK (
    source_kind IN ('manual', 'derived', 'imported')
  ),
  total_cost REAL NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  report_date TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT,
  FOREIGN KEY (project_id) REFERENCES workflow_project(project_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bom_header_project
  ON bom_header(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS bom_item (
  item_id TEXT PRIMARY KEY,
  bom_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  category_code TEXT NOT NULL,
  designation TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  standard_ref TEXT,
  material_code TEXT,
  supplier_name TEXT,
  supplier_part_no TEXT,
  unit_cost REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  payload_json TEXT,
  FOREIGN KEY (bom_id) REFERENCES bom_header(bom_id) ON DELETE CASCADE,
  UNIQUE (bom_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_bom_item_bom
  ON bom_item(bom_id, line_no);

CREATE TABLE IF NOT EXISTS calculation_run (
  run_id TEXT PRIMARY KEY,
  module_code TEXT NOT NULL,
  run_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  project_id TEXT,
  project_number TEXT,
  project_name TEXT,
  source_kind TEXT NOT NULL DEFAULT 'recent-calculation' CHECK (
    source_kind IN ('recent-calculation', 'pdf-export', 'analysis-export', 'archive-report', 'manual-report')
  ),
  summary TEXT,
  linked_report_id TEXT,
  input_json TEXT,
  output_json TEXT,
  metadata_json TEXT,
  FOREIGN KEY (project_id) REFERENCES workflow_project(project_id) ON DELETE SET NULL,
  FOREIGN KEY (linked_report_id) REFERENCES report_artifact(report_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_calculation_run_created
  ON calculation_run(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calculation_run_project
  ON calculation_run(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scenario_snapshot (
  snapshot_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  module_code TEXT NOT NULL,
  snapshot_kind TEXT NOT NULL CHECK (
    snapshot_kind IN ('input', 'context', 'decision')
  ),
  title TEXT,
  summary TEXT,
  input_json TEXT,
  context_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES calculation_run(run_id) ON DELETE CASCADE,
  UNIQUE (run_id, snapshot_kind)
);

CREATE INDEX IF NOT EXISTS idx_scenario_snapshot_run
  ON scenario_snapshot(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scenario_snapshot_module
  ON scenario_snapshot(module_code, created_at DESC);

CREATE TABLE IF NOT EXISTS calculation_result (
  result_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  module_code TEXT NOT NULL,
  result_kind TEXT NOT NULL CHECK (
    result_kind IN ('primary', 'summary', 'distribution', 'recommendation', 'comparison', 'analysis')
  ),
  status TEXT NOT NULL DEFAULT 'computed' CHECK (
    status IN ('computed', 'warning', 'error', 'archived')
  ),
  summary TEXT,
  output_json TEXT,
  derived_metrics_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES calculation_run(run_id) ON DELETE CASCADE,
  UNIQUE (run_id, result_kind)
);

CREATE INDEX IF NOT EXISTS idx_calculation_result_run
  ON calculation_result(run_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_calculation_result_module
  ON calculation_result(module_code, updated_at DESC);

CREATE TABLE IF NOT EXISTS change_case (
  change_id TEXT PRIMARY KEY,
  project_id TEXT,
  object_type TEXT NOT NULL CHECK (
    object_type IN ('project', 'report', 'bom', 'run', 'result', 'part', 'document')
  ),
  object_id TEXT NOT NULL,
  change_code TEXT,
  title TEXT NOT NULL,
  module_code TEXT,
  change_reason TEXT,
  impact_summary TEXT,
  requested_by TEXT,
  requested_at TEXT NOT NULL,
  effective_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'in-review', 'approved', 'released', 'rejected', 'archived')
  ),
  revision_code TEXT NOT NULL DEFAULT 'A',
  payload_json TEXT,
  FOREIGN KEY (project_id) REFERENCES workflow_project(project_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_change_case_project
  ON change_case(project_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_case_object
  ON change_case(object_type, object_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_case_status
  ON change_case(status, requested_at DESC);

CREATE TABLE IF NOT EXISTS approval_task (
  approval_id TEXT PRIMARY KEY,
  change_id TEXT,
  project_id TEXT,
  object_type TEXT NOT NULL CHECK (
    object_type IN ('project', 'report', 'bom', 'run', 'result', 'part', 'document')
  ),
  object_id TEXT NOT NULL,
  module_code TEXT,
  task_title TEXT NOT NULL,
  approval_role TEXT,
  assignee_name TEXT,
  decision_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    decision_status IN ('pending', 'approved', 'rejected', 'waived')
  ),
  due_at TEXT,
  decided_at TEXT,
  comment TEXT,
  seq_no INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT,
  FOREIGN KEY (change_id) REFERENCES change_case(change_id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES workflow_project(project_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_task_project
  ON approval_task(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_task_object
  ON approval_task(object_type, object_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_task_status
  ON approval_task(decision_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS object_event_log (
  event_id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL CHECK (
    object_type IN ('project', 'report', 'bom', 'run', 'result', 'part', 'document')
  ),
  object_id TEXT NOT NULL,
  project_id TEXT,
  module_code TEXT,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'created',
      'updated',
      'opened',
      'status-changed',
      'approval-requested',
      'approval-decided',
      'exported',
      'imported',
      'deleted',
      'archived',
      'restored',
      'calculated',
      'linked'
    )
  ),
  event_summary TEXT NOT NULL,
  actor_name TEXT,
  event_at TEXT NOT NULL,
  payload_json TEXT,
  FOREIGN KEY (project_id) REFERENCES workflow_project(project_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_object_event_log_object
  ON object_event_log(object_type, object_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_object_event_log_project
  ON object_event_log(project_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_object_event_log_type
  ON object_event_log(event_type, event_at DESC);

CREATE TABLE IF NOT EXISTS part_master (
  part_id TEXT PRIMARY KEY,
  project_id TEXT,
  part_number TEXT NOT NULL,
  part_name TEXT NOT NULL,
  category_code TEXT NOT NULL,
  standard_ref TEXT,
  material_code TEXT,
  preferred_supplier_name TEXT,
  latest_supplier_part_no TEXT,
  revision_code TEXT NOT NULL DEFAULT 'A',
  lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle_status IN ('draft', 'in-review', 'approved', 'released', 'archived')
  ),
  source_kind TEXT NOT NULL DEFAULT 'derived-bom' CHECK (
    source_kind IN ('derived-bom', 'manual', 'imported')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (project_id) REFERENCES workflow_project(project_id) ON DELETE SET NULL,
  UNIQUE (project_id, part_number, revision_code)
);

CREATE INDEX IF NOT EXISTS idx_part_master_project
  ON part_master(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_part_master_category
  ON part_master(category_code, updated_at DESC);

CREATE TABLE IF NOT EXISTS supplier_part (
  supplier_part_id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_part_no TEXT NOT NULL,
  manufacturer_name TEXT,
  unit_cost REAL,
  currency_code TEXT NOT NULL DEFAULT 'CNY',
  moq REAL,
  lead_time_days REAL,
  preferred_flag INTEGER NOT NULL DEFAULT 0 CHECK (preferred_flag IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (part_id) REFERENCES part_master(part_id) ON DELETE CASCADE,
  UNIQUE (part_id, supplier_name, supplier_part_no)
);

CREATE INDEX IF NOT EXISTS idx_supplier_part_part
  ON supplier_part(part_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_part_supplier
  ON supplier_part(supplier_name, updated_at DESC);

CREATE TABLE IF NOT EXISTS bom_revision_link (
  link_id TEXT PRIMARY KEY,
  bom_id TEXT NOT NULL,
  part_id TEXT NOT NULL,
  revision_code TEXT NOT NULL DEFAULT 'A',
  line_no INTEGER NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  source_item_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (bom_id) REFERENCES bom_header(bom_id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES part_master(part_id) ON DELETE CASCADE,
  UNIQUE (bom_id, line_no, revision_code)
);

CREATE INDEX IF NOT EXISTS idx_bom_revision_link_bom
  ON bom_revision_link(bom_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bom_revision_link_part
  ON bom_revision_link(part_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS document_attachment (
  document_id TEXT PRIMARY KEY,
  project_id TEXT,
  object_type TEXT NOT NULL CHECK (
    object_type IN ('project', 'report', 'bom', 'run', 'result', 'part', 'document')
  ),
  object_id TEXT NOT NULL,
  module_code TEXT,
  document_kind TEXT NOT NULL CHECK (
    document_kind IN ('pdf', 'csv', 'json', 'image', 'note', 'package', 'snapshot', 'spec')
  ),
  title TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  storage_type TEXT NOT NULL DEFAULT 'export-reference' CHECK (
    storage_type IN ('embedded', 'export-reference', 'local-path')
  ),
  revision_code TEXT NOT NULL DEFAULT 'A',
  created_at TEXT NOT NULL,
  created_by TEXT,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (
    status IN ('draft', 'generated', 'released', 'archived')
  ),
  checksum TEXT,
  payload_json TEXT,
  FOREIGN KEY (project_id) REFERENCES workflow_project(project_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_document_attachment_object
  ON document_attachment(object_type, object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_attachment_project
  ON document_attachment(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_attachment_kind
  ON document_attachment(document_kind, created_at DESC);

COMMIT;
