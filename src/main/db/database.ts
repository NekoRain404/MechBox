import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync } from "fs";

let db: Database.Database | null = null;

function requireDatabase(): Database.Database {
  if (!db) {
    throw new Error("Database has not been initialized");
  }
  return db;
}

export function initDatabase() {
  if (db) {
    return db;
  }

  const isDev = !app.isPackaged;
  const dbDir = isDev
    ? join(app.getAppPath(), "data")
    : app.getPath("userData");

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = join(dbDir, "mechbox.db");
  console.log("Attempting to open database at:", dbPath);

  const isFirstRun = !existsSync(dbPath);

  try {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Always create V3 schema (pure V3, no backward compatibility)
    createV3Schema();
    migrateWorkflowSchema();
    
    if (isFirstRun) {
      console.log("First run - seeding initial data...");
      seedInitialData();
    }

    console.log("Database initialization complete (V3 schema)");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }

  return db;
}

function createV3Schema() {
  const database = requireDatabase();
  const candidates = [
    join(app.getAppPath(), "DOC", "schema_v3.sql"),
    join(__dirname, "../../../DOC/schema_v3.sql"),
    join(process.cwd(), "DOC", "schema_v3.sql"),
  ];
  const schemaPath = candidates.find((candidate) => existsSync(candidate));
  if (!schemaPath) {
    console.warn("V3 schema file not found. Checked:", candidates);
    return;
  }

  const schemaSql = readFileSync(schemaPath, "utf-8");
  database.exec(schemaSql);
  console.log("V3 schema loaded successfully from:", schemaPath);
}

function hasColumn(tableName: string, columnName: string) {
  const database = requireDatabase();
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function migrateWorkflowSchema() {
  const database = requireDatabase();
  if (!hasColumn("workflow_project", "revision_code")) {
    database.exec("ALTER TABLE workflow_project ADD COLUMN revision_code TEXT NOT NULL DEFAULT 'A'");
  }
  if (!hasColumn("workflow_project", "lifecycle_status")) {
    database.exec("ALTER TABLE workflow_project ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'draft'");
    database.exec(`
      UPDATE workflow_project
      SET lifecycle_status = CASE
        WHEN status = 'archived' THEN 'archived'
        ELSE 'draft'
      END
      WHERE lifecycle_status IS NULL OR lifecycle_status = ''
    `);
  }
  if (!hasColumn("report_artifact", "revision_code")) {
    database.exec("ALTER TABLE report_artifact ADD COLUMN revision_code TEXT NOT NULL DEFAULT 'A'");
  }
  if (!hasColumn("report_artifact", "workflow_status")) {
    database.exec("ALTER TABLE report_artifact ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'draft'");
    database.exec(`
      UPDATE report_artifact
      SET workflow_status = CASE
        WHEN source_kind = 'archive-report' THEN 'approved'
        ELSE 'draft'
      END
      WHERE workflow_status IS NULL OR workflow_status = ''
    `);
  }
  if (!hasColumn("report_artifact", "linked_run_id")) {
    database.exec("ALTER TABLE report_artifact ADD COLUMN linked_run_id TEXT");
  }
  if (!hasColumn("report_artifact", "linked_result_id")) {
    database.exec("ALTER TABLE report_artifact ADD COLUMN linked_result_id TEXT");
  }
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_report_artifact_linked_run
      ON report_artifact(linked_run_id, created_at DESC);
  `);

  database.exec(`
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
  `);

  database.exec(`
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
  `);
}

function seedInitialData() {
  const database = requireDatabase();
  const candidates = [
    join(app.getAppPath(), "DOC", "seed_sources_v3.sql"),
    join(__dirname, "../../../DOC/seed_sources_v3.sql"),
    join(process.cwd(), "DOC", "seed_sources_v3.sql"),
  ];
  const seedPath = candidates.find((candidate) => existsSync(candidate));
  if (seedPath) {
    const seedSql = readFileSync(seedPath, "utf-8");
    database.exec(seedSql);
  }

  // Import JSON data into V3 tables
  importJsonToV3Tables();
  console.log("Initial data seeded successfully");
}

function importJsonToV3Tables() {
  const database = requireDatabase();
  // Import threads
  const threadsPath = join(__dirname, "../../../data/standards/threads/iso-metric.json");
  if (existsSync(threadsPath)) {
    const threadsData = require(threadsPath);
    const insertThread = database.prepare(
      `INSERT OR REPLACE INTO thread_metric
       (thread_id, standard_id, revision_id, designation, nominal_d, pitch, pitch_diameter, minor_diameter, stress_area, dataset_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    database.transaction((data: any) => {
      data.threads.forEach((t: any) => {
        insertThread.run(
          `thread_${t.designation.replace(/[^a-zA-Z0-9]/g, '_')}`,
          "std_iso_261",
          "rev_iso_261_default",
          t.designation,
          t.d,
          t.pitch,
          t.d2 || null,
          t.d1 || null,
          t.stress_area || null,
          "dataset_threads_iso_metric_json"
        );
      });
    })(threadsData);
  }

  // Import bolts
  const boltsPath = join(__dirname, "../../../data/standards/bolts/hex-bolts.json");
  if (existsSync(boltsPath)) {
    const boltsData = require(boltsPath);
    const insertBolt = database.prepare(
      `INSERT OR REPLACE INTO fastener_hex_bolt
       (bolt_id, standard_id, revision_id, designation, nominal_d, pitch, head_width_s, head_height_k, dataset_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    database.transaction((data: any) => {
      data.bolts.forEach((b: any) => {
        insertBolt.run(
          `bolt_${b.designation.replace(/[^a-zA-Z0-9]/g, '_')}`,
          b.standard?.includes("GB/T 5782") ? "std_gbt_5782" : "std_iso_4014",
          b.standard?.includes("GB/T 5782") ? "rev_gbt_5782_default" : "rev_iso_4014_default",
          b.designation,
          b.d,
          null,
          b.head_width_s,
          b.head_height_k,
          "dataset_bolts_hex_json"
        );
      });
    })(boltsData);
  }

  // Import bearings
  const bearingsPath = join(__dirname, "../../../data/standards/bearings/deep-groove.json");
  if (existsSync(bearingsPath)) {
    const bearingsData = require(bearingsPath);
    const insertBearing = database.prepare(
      `INSERT OR REPLACE INTO bearing_basic
       (bearing_id, standard_id, revision_id, designation, bearing_type, inner_diameter, outer_diameter, width,
        dynamic_load_rating, static_load_rating, grease_speed_limit, oil_speed_limit, mass, dataset_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    database.transaction((data: any) => {
      data.bearings.forEach((b: any) => {
        insertBearing.run(
          `bearing_${b.designation}`,
          "std_iso_281",
          "rev_iso_281_default",
          b.designation,
          data.type || 'deep_groove_ball',
          b.d,
          b.D,
          b.B,
          b.C_r,
          b.C_0r,
          b.speed_limit_grease,
          b.speed_limit_oil,
          b.mass,
          "dataset_bearings_deep_groove_json"
        );
      });
    })(bearingsData);
  }

  // Import O-rings
  const oringPath = join(__dirname, "../../../data/standards/o-ring/as568.json");
  if (existsSync(oringPath)) {
    const oringData = require(oringPath);
    const insertOring = database.prepare(
      `INSERT OR REPLACE INTO seal_oring_size
       (oring_id, standard_id, revision_id, dash_code, inner_diameter, cross_section, dataset_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    database.transaction((data: any) => {
      data.sizes.forEach((s: any) => {
        insertOring.run(
          `oring_${data.standard}_${s.code}`,
          "std_as568",
          "rev_as568f",
          s.code,
          s.id,
          s.cs,
          "dataset_oring_as568_json"
        );
      });
    })(oringData);
  }

  // Import materials
  const materialsPath = join(__dirname, "../../../data/materials-extended.json");
  if (existsSync(materialsPath)) {
    const materialsData = require(materialsPath);
    const insertMaterial = database.prepare(
      `INSERT OR REPLACE INTO material_grade
       (material_id, standard_id, revision_id, grade_code, grade_name, material_family, heat_treatment_state,
        density, elastic_modulus, shear_modulus, yield_strength, tensile_strength, elongation, temp_min, temp_max,
        dataset_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertPropertySet = database.prepare(
      `INSERT OR REPLACE INTO material_property_set
       (property_set_id, material_id, condition_label, test_temperature_c, source_id, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const insertProperty = database.prepare(
      `INSERT OR REPLACE INTO material_property
       (property_set_id, property_code, numeric_value, text_value, unit_code)
       VALUES (?, ?, ?, ?, ?)`
    );

    const insertEquivalent = database.prepare(
      `INSERT OR REPLACE INTO material_equivalent
       (material_id, external_system_code, external_grade_code, equivalence_level, note)
       VALUES (?, ?, ?, ?, ?)`
    );

    database.transaction((data: any) => {
      Object.entries(data).forEach(([category, materials]: [string, any]) => {
        if (Array.isArray(materials)) {
          materials.forEach((m: any) => {
            const materialId = `material_${m.designation.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const standardRef = Array.isArray(m.standards) && m.standards.includes("GB/T 3077")
              ? ["std_gbt_3077", "rev_gbt_3077_default"]
              : ["std_gbt_700", "rev_gbt_700_default"];

            insertMaterial.run(
              materialId,
              standardRef[0],
              standardRef[1],
              m.designation,
              m.name_zh,
              category,
              m.condition || null,
              m.density || null,
              m.E || null,
              m.G || null,
              m.yield_strength || null,
              m.tensile_strength || null,
              m.elongation || null,
              m.temp_min || null,
              m.temp_max || null,
              "dataset_materials_extended_json",
              m.notes || null
            );

            const propertySetId = `${materialId}_default_props`;
            insertPropertySet.run(
              propertySetId,
              materialId,
              m.condition || "default",
              20,
              "samr_openstd",
              "Generated from materials-extended.json"
            );

            const numericProperties: Array<[string, number | null | undefined, string | null]> = [
              ["density", m.density, "g/cm3"],
              ["elastic_modulus", m.E, "MPa"],
              ["shear_modulus", m.G, "MPa"],
              ["yield_strength", m.yield_strength, "MPa"],
              ["tensile_strength", m.tensile_strength, "MPa"],
              ["elongation", m.elongation, "pct"],
              ["temp_min", m.temp_min, "degC"],
              ["temp_max", m.temp_max, "degC"],
              ["hardness_brinell", m.hardness_brinell, "HB"],
            ];

            numericProperties.forEach(([code, value, unit]) => {
              if (value !== null && value !== undefined) {
                insertProperty.run(propertySetId, code, value, null, unit);
              }
            });

            Object.entries(m.equivalents || {}).forEach(([system, grade]) => {
              insertEquivalent.run(
                materialId,
                system,
                grade as string,
                "reference",
                "Imported from materials-extended.json"
              );
            });
          });
        }
      });
    })(materialsData);
  }

  // Seed common standard spur/helical modules used by catalog products
  const commonModules = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const insertGearModule = database.prepare(
    `INSERT OR REPLACE INTO gear_module_standard
     (gear_module_id, standard_id, revision_id, gear_type, pressure_angle_deg, helix_angle_deg, module_value, module_system, dataset_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  database.transaction(() => {
    commonModules.forEach((moduleValue) => {
      ["spur", "helical"].forEach((gearType) => {
        insertGearModule.run(
          `gear_module_${gearType}_${String(moduleValue).replace('.', '_')}`,
          "std_jis_b_1704",
          "rev_jis_b_1704_default",
          gearType,
          20,
          gearType === "helical" ? 15 : 0,
          moduleValue,
          "metric",
          "dataset_khk_vendor_seed",
          "Seeded common metric modules"
        );
      });
    });
  })();

  console.log("JSON data imported to V3 tables");
}

export function getDatabase() {
  return db ?? initDatabase();
}

export function closeDatabase() {
  if (!db) return;
  db.close();
  db = null;
}
