import Database from "better-sqlite3";
import { mkdirSync, existsSync, readFileSync, rmSync } from "fs";
import { dirname, join } from "path";

const repoRoot = process.cwd();
const dataDir = join(repoRoot, "data");
const dbPath = join(dataDir, "mechbox.db");
const schemaPath = join(repoRoot, "DOC", "schema_v3.sql");
const seedPath = join(repoRoot, "DOC", "seed_sources_v3.sql");

const khkUrls = [
  "https://www.khkgears.us/catalog/product/SSG1-20",
  "https://www.khkgears.us/catalog/product/SS2-30",
  "https://www.khkgears.us/catalog/product/SR1-500",
  "https://www.khkgears.us/catalog/product/KS2-30/",
  "https://www.khkgears.us/catalog/product/MM2-30",
  "https://www.khkgears.us/catalog/product/SMSG1-25R",
];

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&deg;/g, "°")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNumber(raw) {
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseKhkPage(html, url) {
  const titleMatch = html.match(/<h1>\s*([^<]+?)\s*<\/h1>/i);
  const skuMatch = html.match(/itemprop="sku">([^<]+)</i);
  const nameMatch = html.match(/itemprop="name">([^<]+)</i);

  const pairs = {};
  const rowRegex =
    /<tr[^>]*itemprop="additionalProperty"[\s\S]*?<td[^>]*itemprop="name"[^>]*>[\s\S]*?<strong>(.*?)<\/strong>[\s\S]*?<td class="plp-table-value">[\s\S]*?<span data-measure='general' itemprop="value" >([\s\S]*?)<\/span>/gi;

  for (const row of html.matchAll(rowRegex)) {
    const key = stripTags(row[1]);
    const value = stripTags(row[2]);
    if (key && value) {
      pairs[key] = value;
    }
  }

  const sku = stripTags(skuMatch?.[1] || "");
  const title = stripTags(titleMatch?.[1] || nameMatch?.[1] || sku);
  if (!sku || !title) {
    throw new Error(`Failed to parse KHK page: ${url}`);
  }

  return {
    sku,
    title,
    description: title,
    url,
    specs: pairs,
  };
}

async function fetchKhkProducts() {
  const products = [];
  for (const url of khkUrls) {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    const html = await response.text();
    products.push(parseKhkPage(html, url));
  }
  return products;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function applySchema(db) {
  db.exec(readFileSync(schemaPath, "utf-8"));
  db.exec(readFileSync(seedPath, "utf-8"));
}

function importThreads(db) {
  const data = loadJson(join(repoRoot, "data", "standards", "threads", "iso-metric.json"));
  const insert = db.prepare(`
    INSERT OR IGNORE INTO thread_metric
    (thread_id, standard_id, revision_id, designation, nominal_d, pitch, pitch_diameter, minor_diameter, stress_area, dataset_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const t of data.threads) {
      insert.run(
        `thread_${t.designation.replace(/[^a-zA-Z0-9]/g, "_")}`,
        "std_iso_261",
        "rev_iso_261_default",
        t.designation,
        t.d,
        t.pitch,
        t.d2 ?? null,
        t.d1 ?? null,
        t.stress_area ?? null,
        "dataset_threads_iso_metric_json",
      );
    }
  })();
}

function importBolts(db) {
  const data = loadJson(join(repoRoot, "data", "standards", "bolts", "hex-bolts.json"));
  const insert = db.prepare(`
    INSERT OR IGNORE INTO fastener_hex_bolt
    (bolt_id, standard_id, revision_id, designation, nominal_d, pitch, head_width_s, head_height_k, dataset_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const b of data.bolts) {
      insert.run(
        `bolt_${b.designation.replace(/[^a-zA-Z0-9]/g, "_")}`,
        b.standard?.includes("GB/T 5782") ? "std_gbt_5782" : "std_iso_4014",
        b.standard?.includes("GB/T 5782") ? "rev_gbt_5782_default" : "rev_iso_4014_default",
        b.designation,
        b.d,
        null,
        b.head_width_s,
        b.head_height_k,
        "dataset_bolts_hex_json",
      );
    }
  })();
}

function importBearings(db) {
  const data = loadJson(join(repoRoot, "data", "standards", "bearings", "deep-groove.json"));
  const insert = db.prepare(`
    INSERT OR IGNORE INTO bearing_basic
    (bearing_id, standard_id, revision_id, designation, bearing_type, inner_diameter, outer_diameter, width,
     dynamic_load_rating, static_load_rating, grease_speed_limit, oil_speed_limit, mass, dataset_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const b of data.bearings) {
      insert.run(
        `bearing_${b.designation}`,
        "std_iso_281",
        "rev_iso_281_default",
        b.designation,
        data.type || "deep_groove_ball",
        b.d,
        b.D,
        b.B,
        b.C_r ?? null,
        b.C_0r ?? null,
        b.speed_limit_grease ?? null,
        b.speed_limit_oil ?? null,
        b.mass ?? null,
        "dataset_bearings_deep_groove_json",
      );
    }
  })();
}

function importOrings(db) {
  const data = loadJson(join(repoRoot, "data", "standards", "o-ring", "as568.json"));
  const insert = db.prepare(`
    INSERT OR IGNORE INTO seal_oring_size
    (oring_id, standard_id, revision_id, dash_code, inner_diameter, cross_section, dataset_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const s of data.sizes) {
      insert.run(
        `oring_${data.standard}_${s.code}`,
        "std_as568",
        "rev_as568f",
        s.code,
        s.id,
        s.cs,
        "dataset_oring_as568_json",
      );
    }
  })();
}

function importMaterials(db) {
  const data = loadJson(join(repoRoot, "data", "materials-extended.json"));
  const insertGrade = db.prepare(`
    INSERT OR IGNORE INTO material_grade
    (material_id, standard_id, revision_id, grade_code, grade_name, material_family, heat_treatment_state,
     density, elastic_modulus, shear_modulus, yield_strength, tensile_strength, elongation,
     temp_min, temp_max, dataset_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPropertySet = db.prepare(`
    INSERT OR IGNORE INTO material_property_set
    (property_set_id, material_id, condition_label, test_temperature_c, source_id, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertProperty = db.prepare(`
    INSERT OR IGNORE INTO material_property
    (property_set_id, property_code, numeric_value, text_value, unit_code)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertEquivalent = db.prepare(`
    INSERT OR IGNORE INTO material_equivalent
    (material_id, external_system_code, external_grade_code, equivalence_level, note)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const [family, materials] of Object.entries(data)) {
      if (!Array.isArray(materials)) continue;
      for (const m of materials) {
        const materialId = `material_${m.designation.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const [standardId, revisionId] =
          Array.isArray(m.standards) && m.standards.includes("GB/T 3077")
            ? ["std_gbt_3077", "rev_gbt_3077_default"]
            : ["std_gbt_700", "rev_gbt_700_default"];

        insertGrade.run(
          materialId,
          standardId,
          revisionId,
          m.designation,
          m.name_zh,
          family,
          m.condition ?? null,
          m.density ?? null,
          m.E ?? null,
          m.G ?? null,
          m.yield_strength ?? null,
          m.tensile_strength ?? null,
          m.elongation ?? null,
          m.temp_min ?? null,
          m.temp_max ?? null,
          "dataset_materials_extended_json",
          m.notes ?? null,
        );

        const propertySetId = `${materialId}_default_props`;
        insertPropertySet.run(
          propertySetId,
          materialId,
          m.condition ?? "default",
          20,
          "samr_openstd",
          "Generated from materials-extended.json",
        );

        const numericProps = [
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

        for (const [code, value, unit] of numericProps) {
          if (value !== undefined && value !== null) {
            insertProperty.run(propertySetId, code, value, null, unit);
          }
        }

        for (const [system, grade] of Object.entries(m.equivalents || {})) {
          insertEquivalent.run(
            materialId,
            system,
            String(grade),
            "reference",
            "Imported from materials-extended.json",
          );
        }
      }
    }
  })();
}

function importSeedGearModules(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO gear_module_standard
    (gear_module_id, standard_id, revision_id, gear_type, pressure_angle_deg, helix_angle_deg, module_value, module_system, dataset_id, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const commonModules = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

  db.transaction(() => {
    for (const moduleValue of commonModules) {
      insert.run(
        `gear_module_spur_${String(moduleValue).replace(".", "_")}`,
        "std_jis_b_1704",
        "rev_jis_b_1704_default",
        "spur",
        20,
        0,
        moduleValue,
        "metric",
        "dataset_khk_vendor_seed",
        "Seeded common metric modules",
      );
    }
  })();
}

function importSearchDocuments(db) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO search_document (doc_id, entity_type, entity_id, title, body, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec("DELETE FROM search_fts");

  const rows = db.prepare(`
    SELECT 'thread_metric' AS entity_type, thread_id AS entity_id, designation AS title,
           printf('Thread %s nominal %.3f pitch %.3f', designation, nominal_d, pitch) AS body,
           'thread metric' AS tags
    FROM thread_metric
    UNION ALL
    SELECT 'seal_oring_size', oring_id, dash_code,
           printf('O-ring %s ID %.3f CS %.3f', dash_code, inner_diameter, cross_section),
           'oring seal'
    FROM seal_oring_size
    UNION ALL
    SELECT 'bearing_basic', bearing_id, designation,
           printf('Bearing %s %.3fx%.3fx%.3f', designation, inner_diameter, outer_diameter, width),
           'bearing'
    FROM bearing_basic
    UNION ALL
    SELECT 'material_grade', material_id, grade_code,
           printf('Material %s %s', grade_code, grade_name),
           material_family
    FROM material_grade
    UNION ALL
    SELECT 'vendor_part', vendor_part_id, vendor_part_number,
           COALESCE(description, vendor_part_number),
           domain_code
    FROM vendor_part
  `).all();

  const insertFts = db.prepare(`
    INSERT INTO search_fts (doc_id, title, body, tags)
    VALUES (?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const row of rows) {
      const docId = `${row.entity_type}:${row.entity_id}`;
      insert.run(docId, row.entity_type, row.entity_id, row.title, row.body, row.tags);
      insertFts.run(docId, row.title, row.body, row.tags);
    }
  })();
}

function importDataVersion(db) {
  const records = [
    ["V3_SCHEMA", "3.0.0", "system", "schema_v3"],
    ["KHK_VENDOR", "2026-04-12", "khk_gear_world", `urls:${khkUrls.length}`],
  ];
  const insert = db.prepare(`
    INSERT OR REPLACE INTO data_version (standard_code, version, source, checksum)
    VALUES (?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const row of records) {
      insert.run(...row);
    }
  })();
}

async function importKhkVendorParts(db) {
  const products = await fetchKhkProducts();
  const insertVendorPart = db.prepare(`
    INSERT OR REPLACE INTO vendor_part
    (vendor_part_id, manufacturer_id, domain_code, vendor_part_number, linked_entity_type, linked_entity_id,
     product_url, status, description, dataset_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertText = db.prepare(`
    INSERT OR REPLACE INTO vendor_part_ext_text
    (vendor_part_id, attr_code, text_value)
    VALUES (?, ?, ?)
  `);
  const insertNumeric = db.prepare(`
    INSERT OR REPLACE INTO vendor_part_ext_numeric
    (vendor_part_id, attr_code, numeric_value, unit_code)
    VALUES (?, ?, ?, ?)
  `);

  const unitHints = new Map([
    ["Module", "module"],
    ["No. of teeth", "count"],
    ["Pressure Angle", "deg"],
    ["Helix Angle", "deg"],
    ["Weight", "kg"],
    ["Bore (A)", "mm"],
    ["Pitch Diameter (C)", "mm"],
    ["Outer Diameter (D)", "mm"],
    ["Face Width (E)", "mm"],
    ["Face Width (J)", "mm"],
    ["Hub Diameter (B)", "mm"],
    ["Hub Width (F)", "mm"],
    ["Hub Width (H)", "mm"],
    ["Mounting Distance (E)", "mm"],
    ["Length Of Bore (I)", "mm"],
    ["Bending Strength (N-m)", "N·m"],
    ["Surface Durability (N-m)", "N·m"],
  ]);

  const slug = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  db.transaction(() => {
    for (const product of products) {
      const vendorPartId = `vendor_khk_${product.sku.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      const moduleValue = firstNumber(product.specs["Module"] || "");
      const linkedEntityId =
        moduleValue !== null
          ? `gear_module_spur_${String(moduleValue).replace(".", "_")}`
          : null;

      insertVendorPart.run(
        vendorPartId,
        "mfr_khk",
        "gear",
        product.sku,
        linkedEntityId ? "gear_module_standard" : null,
        linkedEntityId,
        product.url,
        "active",
        product.title,
        "dataset_khk_vendor_seed",
      );

      insertText.run(vendorPartId, "title", product.title);

      for (const [key, value] of Object.entries(product.specs)) {
        const attrCode = slug(key);
        insertText.run(vendorPartId, attrCode, value);
        const numericValue = firstNumber(value);
        if (numericValue !== null) {
          insertNumeric.run(vendorPartId, attrCode, numericValue, unitHints.get(key) ?? null);
        }
      }
    }
  })();

  db.prepare(`
    UPDATE dataset_release
    SET row_count = ?
    WHERE dataset_id = 'dataset_khk_vendor_seed'
  `).run(products.length);
}

async function main() {
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(dbPath)) {
    rmSync(dbPath);
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  applySchema(db);
  importThreads(db);
  importBolts(db);
  importBearings(db);
  importOrings(db);
  importMaterials(db);
  importSeedGearModules(db);
  await importKhkVendorParts(db);
  importSearchDocuments(db);
  importDataVersion(db);

  const counts = db
    .prepare(`
      SELECT 'thread_metric' AS table_name, COUNT(*) AS count FROM thread_metric
      UNION ALL SELECT 'fastener_hex_bolt', COUNT(*) FROM fastener_hex_bolt
      UNION ALL SELECT 'bearing_basic', COUNT(*) FROM bearing_basic
      UNION ALL SELECT 'seal_oring_size', COUNT(*) FROM seal_oring_size
      UNION ALL SELECT 'material_grade', COUNT(*) FROM material_grade
      UNION ALL SELECT 'gear_module_standard', COUNT(*) FROM gear_module_standard
      UNION ALL SELECT 'vendor_part', COUNT(*) FROM vendor_part
      UNION ALL SELECT 'search_document', COUNT(*) FROM search_document
    `)
    .all();

  console.log(`Initialized DB at ${dbPath}`);
  counts.forEach((row) => {
    console.log(`${row.table_name}: ${row.count}`);
  });
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
