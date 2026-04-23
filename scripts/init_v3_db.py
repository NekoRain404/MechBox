import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
DB_PATH = DATA_DIR / "mechbox.db"
SCHEMA_PATH = REPO_ROOT / "DOC" / "schema_v3.sql"
SEED_PATH = REPO_ROOT / "DOC" / "seed_sources_v3.sql"
GMORS_JIS_B2401_PDF_URL = "https://www.gmors.com/files/CatalogDownload/file/Ya/gmors-o-ring-jisb-2401.pdf"
APPLE_CHEMICAL_GUIDE_URL = "https://www.applerubber.com/chemical-compatibility-guide/"

KHK_URLS = [
    "https://www.khkgears.us/catalog/product/SSG1-20",
    "https://www.khkgears.us/catalog/product/SS2-30",
    "https://www.khkgears.us/catalog/product/SR1-500",
    "https://www.khkgears.us/catalog/product/MM2-30",
    "https://www.khkgears.us/catalog/product/SMSG1-25R",
    "https://www.khkgears.us/catalog/product/SS1-120H",
    "https://www.khkgears.us/catalog/product/SM1-25",
    "https://www.khkgears.us/catalog/product/KHG2-22RJ19",
    "https://www.khkgears.us/catalog/product/PR1.5-1000",
    "https://www.khkgears.us/catalog/product/SHE5-24L/",
    "https://www.khkgears.us/catalog/product/SM6-25",
    "https://www.khkgears.us/catalog/product/SMA1-25",
    "https://www.khkgears.us/catalog/product/SRF6-1000H/",
    "https://www.khkgears.us/catalog/product/SSG3-24",
    "https://www.khkgears.us/catalog/product/SS6-18",
    "https://www.khkgears.us/catalog/product/KRF3-1000H/",
    "https://www.khkgears.us/catalog/product/SMS6-25R",
]

FERROBEND_ISO_4032_URL = "https://iso-fasteners.com/iso-standard-nuts/iso-4032/"
FERROBEND_ISO_7089_URL = "https://iso-fasteners.com/iso-standard-washers/iso-7089/"
FERROBEND_NUT_SOURCES = [
    ("https://iso-fasteners.com/iso-standard-nuts/iso-4032/", "std_iso_4032", "rev_iso_4032_ferrobend", "dataset_iso_4032_ferrobend", "ISO 4032"),
    ("https://iso-fasteners.com/iso-standard-nuts/iso-4034/", "std_iso_4034", "rev_iso_4034_ferrobend", "dataset_iso_4034_ferrobend", "ISO 4034"),
    ("https://boltport.com/standards/iso-4035/", "std_iso_4035", "rev_iso_4035_boltport", "dataset_iso_4035_boltport", "ISO 4035"),
]
FERROBEND_WASHER_SOURCES = [
    ("https://iso-fasteners.com/iso-standard-washers/iso-7089/", "std_iso_7089", "rev_iso_7089_ferrobend", "dataset_iso_7089_ferrobend", "ISO 7089"),
    ("https://boltport.com/standards/iso-7092/", "std_iso_7092", "rev_iso_7092_boltport", "dataset_iso_7092_boltport", "ISO 7092"),
    ("https://iso-fasteners.com/iso-standard-washers/iso-7090/", "std_iso_7090", "rev_iso_7090_ferrobend", "dataset_iso_7090_ferrobend", "ISO 7090"),
    ("https://iso-fasteners.com/iso-standard-washers/iso-7091/", "std_iso_7091", "rev_iso_7091_ferrobend", "dataset_iso_7091_ferrobend", "ISO 7091"),
    ("https://iso-fasteners.com/iso-standard-washers/iso-7093/", "std_iso_7093", "rev_iso_7093_ferrobend", "dataset_iso_7093_ferrobend", "ISO 7093"),
]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_json(path: Path):
    return json.loads(read_text(path))


def strip_tags(value: str) -> str:
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = value.replace("&nbsp;", " ").replace("&amp;", "&").replace("&deg;", "°")
    return re.sub(r"\s+", " ", value).strip()


def first_number(raw: str):
    match = re.search(r"-?\d+(?:\.\d+)?", raw)
    return float(match.group(0)) if match else None


def slugify(value: str) -> str:
    return re.sub(r"(^_+|_+$)", "", re.sub(r"[^a-z0-9]+", "_", value.lower()))


def fetch_text(url: str) -> str:
    result = subprocess.run(
        [
            "curl",
            "-L",
            "--silent",
            "--show-error",
            "--retry",
            "3",
            "--retry-all-errors",
            "--retry-delay",
            "2",
            "--max-time",
            "30",
            url,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def fetch_pdf_text(url: str) -> str:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        subprocess.run(
            [
                "curl",
                "-L",
                "--silent",
                "--show-error",
                "--retry",
                "3",
                "--retry-all-errors",
                "--retry-delay",
                "2",
                "--max-time",
                "60",
                "-o",
                str(tmp_path),
                url,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        result = subprocess.run(
            ["pdftotext", str(tmp_path), "-"],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout
    finally:
        tmp_path.unlink(missing_ok=True)


def parse_apple_compatibility_page(html: str):
    match = re.search(r"<ul><li class=\"compat-[\s\S]*?</ul>", html, re.I)
    if not match:
        return {}
    rows = re.findall(r'class="compat-(\d+)".*?<span>(.*?)</span>', match.group(0), re.I | re.S)
    result = {}
    for rating_code, label in rows:
        result[strip_tags(label)] = int(rating_code)
    return result


def parse_khk_page(html: str, url: str):
    title_match = re.search(r"<h1>\s*([^<]+?)\s*</h1>", html, re.I)
    sku_match = re.search(r'itemprop="sku">([^<]+)<', html, re.I)
    name_match = re.search(r'itemprop="name">([^<]+)<', html, re.I)

    row_regex = re.compile(
        r'<tr[^>]*itemprop="additionalProperty"[\s\S]*?'
        r'<td[^>]*itemprop="name"[^>]*>[\s\S]*?<strong>(.*?)</strong>[\s\S]*?'
        r'<td class="plp-table-value">[\s\S]*?'
        r"<span data-measure='general' itemprop=\"value\" >([\s\S]*?)</span>",
        re.I,
    )

    specs = {}
    for key, value in row_regex.findall(html):
        clean_key = strip_tags(key)
        clean_value = strip_tags(value)
        if clean_key and clean_value:
            specs[clean_key] = clean_value

    sku = strip_tags(sku_match.group(1) if sku_match else "")
    title = strip_tags((title_match or name_match).group(1) if (title_match or name_match) else sku)
    if not sku or not title:
        raise RuntimeError(f"failed to parse KHK page: {url}")

    return {
        "sku": sku,
        "title": title,
        "url": url,
        "specs": specs,
    }


def parse_ferrobend_rows(html: str):
    row_regex = re.compile(r"<tr>\s*(.*?)\s*</tr>", re.I | re.S)
    cell_regex = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.I | re.S)
    rows = []
    for row_html in row_regex.findall(html):
        cells = [strip_tags(cell) for cell in cell_regex.findall(row_html)]
        cells = [cell for cell in cells if cell]
        if cells:
            rows.append(cells)
    return rows


def parse_boltport_iso4035_rows(html: str):
    table_match = re.search(
        r'<table class="common-table-tophead">[\s\S]*?<th rowspan="2">Thread <br />D</th>[\s\S]*?</table>',
        html,
        re.I,
    )
    if not table_match:
        return []

    row_regex = re.compile(r"<tr>\s*(.*?)\s*</tr>", re.I | re.S)
    cell_regex = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.I | re.S)
    rows = []
    for row_html in row_regex.findall(table_match.group(0)):
        cells = [strip_tags(cell) for cell in cell_regex.findall(row_html)]
        if len(cells) != 11:
            continue
        if not cells[0].startswith("M"):
            continue
        rows.append(cells)
    return rows


def apply_schema(conn: sqlite3.Connection):
    conn.executescript(read_text(SCHEMA_PATH))
    conn.executescript(read_text(SEED_PATH))


def import_threads(conn: sqlite3.Connection):
    data = load_json(REPO_ROOT / "data" / "standards" / "threads" / "iso-metric.json")
    rows = []
    for t in data["threads"]:
        rows.append(
            (
                f"thread_{re.sub(r'[^a-zA-Z0-9]', '_', t['designation'])}",
                "std_iso_261",
                "rev_iso_261_default",
                t["designation"],
                t["d"],
                t["pitch"],
                t.get("d2"),
                t.get("d1"),
                t.get("stress_area"),
                "dataset_threads_iso_metric_json",
            )
        )
    conn.executemany(
        """
        INSERT OR IGNORE INTO thread_metric
        (thread_id, standard_id, revision_id, designation, nominal_d, pitch, pitch_diameter, minor_diameter, stress_area, dataset_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )


def import_bolts(conn: sqlite3.Connection):
    data = load_json(REPO_ROOT / "data" / "standards" / "bolts" / "hex-bolts.json")
    rows = []
    for b in data["bolts"]:
        is_gb = "GB/T 5782" in (b.get("standard") or "")
        rows.append(
            (
                f"bolt_{re.sub(r'[^a-zA-Z0-9]', '_', b['designation'])}",
                "std_gbt_5782" if is_gb else "std_iso_4014",
                "rev_gbt_5782_default" if is_gb else "rev_iso_4014_default",
                b["designation"],
                b["d"],
                None,
                b["head_width_s"],
                b["head_height_k"],
                "dataset_bolts_hex_json",
            )
        )
    conn.executemany(
        """
        INSERT OR IGNORE INTO fastener_hex_bolt
        (bolt_id, standard_id, revision_id, designation, nominal_d, pitch, head_width_s, head_height_k, dataset_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )


def import_ferrobend_nuts(conn: sqlite3.Connection):
    for url, standard_id, revision_id, dataset_id, standard_label in FERROBEND_NUT_SOURCES:
        html = fetch_text(url)
        rows = parse_boltport_iso4035_rows(html) if standard_id == "std_iso_4035" else parse_ferrobend_rows(html)
        insert_rows = []
        count = 0
        for cells in rows:
            if standard_id == "std_iso_4035":
                designation = cells[0].replace(" ", "")
                nominal_d = first_number(designation)
                pitch = first_number(cells[1])
                height_m = first_number(cells[6])
                width_s = first_number(cells[9])
            else:
                if len(cells) != 3:
                    continue
                if cells[0] == "Dimensions":
                    continue
                designation = cells[0].replace(" ", "")
                nominal_d = first_number(designation)
                pitch = None
                height_m = first_number(cells[1])
                width_s = first_number(cells[2])
            if nominal_d is None or height_m is None or width_s is None:
                continue
            nut_id = f"nut_{slugify(standard_id)}_{slugify(designation)}"
            insert_rows.append(
                (
                    nut_id,
                    standard_id,
                    revision_id,
                    designation,
                    None,
                    nominal_d,
                    pitch,
                    width_s,
                    height_m,
                    None,
                    None,
                    None,
                    dataset_id,
                    f"Imported from {standard_label} reference page",
                )
            )
            count += 1

        conn.executemany(
            """
            INSERT OR IGNORE INTO fastener_hex_nut
            (nut_id, standard_id, revision_id, designation, thread_id, nominal_d, pitch, width_s, height_m,
             strength_class, material_code, finish_code, dataset_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            insert_rows,
        )
        conn.execute(
            """
            UPDATE dataset_release
            SET row_count = ?
            WHERE dataset_id = ?
            """,
            (count, dataset_id),
        )


def import_ferrobend_washers(conn: sqlite3.Connection):
    for url, standard_id, revision_id, dataset_id, standard_label in FERROBEND_WASHER_SOURCES:
        html = fetch_text(url)
        rows = parse_ferrobend_rows(html)
        insert_rows = []
        count = 0
        for cells in rows:
            if len(cells) != 4:
                continue
            if cells[0] == "Nominal Size":
                continue
            designation = cells[0].replace(" ", "")
            nominal_d = first_number(designation)
            inner_diameter = first_number(cells[1])
            outer_diameter = first_number(cells[2])
            thickness = first_number(cells[3])
            if None in (nominal_d, inner_diameter, outer_diameter, thickness):
                continue
            washer_id = f"washer_{slugify(standard_id)}_{slugify(designation)}"
            insert_rows.append(
                (
                    washer_id,
                    standard_id,
                    revision_id,
                    designation,
                    nominal_d,
                    inner_diameter,
                    outer_diameter,
                    thickness,
                    None,
                    None,
                    dataset_id,
                    f"Imported from FERROBEND {standard_label} reference page",
                )
            )
            count += 1

        conn.executemany(
            """
            INSERT OR IGNORE INTO fastener_plain_washer
            (washer_id, standard_id, revision_id, designation, nominal_d, inner_diameter, outer_diameter, thickness,
             material_code, finish_code, dataset_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            insert_rows,
        )
        conn.execute(
            """
            UPDATE dataset_release
            SET row_count = ?
            WHERE dataset_id = ?
            """,
            (count, dataset_id),
        )


def import_bearings(conn: sqlite3.Connection):
    data = load_json(REPO_ROOT / "data" / "standards" / "bearings" / "deep-groove.json")
    rows = []
    for b in data["bearings"]:
        dynamic_load = b.get("C_r")
        static_load = b.get("C_0r")
        if dynamic_load is not None and dynamic_load < 1000:
            dynamic_load = dynamic_load * 1000
        if static_load is not None and static_load < 1000:
            static_load = static_load * 1000
        rows.append(
            (
                f"bearing_{b['designation']}",
                "std_iso_281",
                "rev_iso_281_default",
                b["designation"],
                data.get("type", "deep_groove_ball"),
                b["d"],
                b["D"],
                b["B"],
                dynamic_load,
                static_load,
                b.get("speed_limit_grease"),
                b.get("speed_limit_oil"),
                b.get("mass"),
                "dataset_bearings_deep_groove_json",
            )
        )
    conn.executemany(
        """
        INSERT OR IGNORE INTO bearing_basic
        (bearing_id, standard_id, revision_id, designation, bearing_type, inner_diameter, outer_diameter, width,
         dynamic_load_rating, static_load_rating, grease_speed_limit, oil_speed_limit, mass, dataset_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )


def import_nsk_catalog_bearings(conn: sqlite3.Connection):
    rows = [
        ("6000", 10, 26, 8, 5100, 2360),
        ("6200", 10, 30, 9, 5100, 2390),
        ("6300", 10, 35, 11, 8900, 3450),
        ("6001", 12, 28, 8, 5600, 2370),
        ("6201", 12, 32, 10, 7500, 3050),
        ("6301", 12, 37, 12, 10700, 4200),
        ("6002", 15, 32, 9, 6150, 2830),
        ("6202", 15, 35, 11, 8400, 3750),
        ("6302", 15, 42, 13, 12600, 5450),
        ("6003", 17, 35, 10, 6600, 3250),
        ("6203", 17, 40, 12, 10500, 4800),
        ("6303", 17, 47, 14, 15000, 6650),
        ("6004", 20, 42, 12, 10300, 5000),
        ("6204", 20, 47, 14, 14100, 6600),
        ("6304", 20, 52, 15, 17500, 7900),
        ("6005", 25, 47, 12, 11100, 5850),
        ("6205", 25, 52, 15, 15400, 7850),
        ("6305", 25, 62, 17, 22600, 11200),
        ("6006", 30, 55, 13, 14600, 8300),
        ("6206", 30, 62, 16, 21400, 11300),
        ("6306", 30, 72, 19, 29300, 15000),
        ("6007", 35, 62, 14, 17600, 10300),
        ("6207", 35, 72, 17, 28200, 15300),
        ("6307", 35, 80, 21, 36500, 19200),
        ("6008", 40, 68, 15, 18400, 11500),
        ("6208", 40, 80, 18, 32000, 17900),
        ("6308", 40, 90, 23, 45000, 24000),
        ("6009", 45, 75, 16, 23000, 15200),
        ("6209", 45, 85, 19, 34500, 20400),
        ("6309", 45, 100, 25, 58500, 32000),
        ("6010", 50, 80, 16, 24000, 16600),
        ("6210", 50, 90, 20, 38500, 23200),
        ("6310", 50, 110, 27, 68000, 38500),
        ("6011", 55, 90, 18, 31000, 21200),
        ("6211", 55, 100, 21, 47500, 29300),
        ("6311", 55, 120, 29, 78500, 44500),
        ("6012", 60, 95, 18, 32500, 23200),
        ("6212", 60, 110, 22, 57500, 36000),
        ("6312", 60, 130, 31, 90000, 52000),
        ("6013", 65, 100, 18, 33500, 25200),
        ("6213", 65, 120, 23, 63000, 40000),
        ("6313", 65, 140, 33, 102000, 60000),
        ("6014", 70, 110, 20, 42000, 31000),
        ("6214", 70, 125, 24, 68500, 44000),
        ("6314", 70, 150, 35, 115000, 68000),
        ("6015", 75, 115, 20, 43500, 33500),
        ("6215", 75, 130, 25, 73000, 49500),
        ("6016", 80, 125, 22, 52500, 40000),
        ("6216", 80, 140, 26, 80000, 53000),
        ("6017", 85, 130, 22, 54500, 43000),
        ("6217", 85, 150, 28, 92500, 62000),
        ("6018", 90, 140, 24, 64000, 50000),
        ("6019", 95, 145, 24, 66500, 54000),
        ("6020", 100, 150, 24, 66000, 54000),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO bearing_basic
        (bearing_id, standard_id, revision_id, designation, bearing_type, inner_diameter, outer_diameter, width,
         dynamic_load_rating, static_load_rating, dataset_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                f"bearing_{designation}",
                "std_iso_281",
                "rev_iso_281_default",
                designation,
                "deep_groove_ball",
                inner_diameter,
                outer_diameter,
                width,
                dynamic_load,
                static_load,
                "dataset_nsk_deep_groove_pdf",
                "Imported from NSK public deep groove bearing PDF catalog",
            )
            for designation, inner_diameter, outer_diameter, width, dynamic_load, static_load in rows
        ],
    )

    variant_rows = []
    for designation, _, _, _, _, _ in rows:
        for suffix in ["ZZ", "DDU", "VV"]:
            variant_rows.append(
                (
                    f"vendor_nsk_{slugify(f'{designation} {suffix}')}",
                    "mfr_nsk",
                    "bearing",
                    f"{designation} {suffix}",
                    "bearing_basic",
                    f"bearing_{designation}",
                    None,
                    "active",
                    f"NSK {designation} {suffix} deep groove ball bearing",
                    "dataset_nsk_deep_groove_pdf",
                )
            )

    conn.executemany(
        """
        INSERT OR IGNORE INTO vendor_part
        (vendor_part_id, manufacturer_id, domain_code, vendor_part_number, linked_entity_type, linked_entity_id,
         product_url, status, description, dataset_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        variant_rows,
    )
    conn.execute(
        """
        UPDATE dataset_release
        SET row_count = ?
        WHERE dataset_id = 'dataset_nsk_deep_groove_pdf'
        """,
        (len(rows),),
    )


def import_orings(conn: sqlite3.Connection):
    data = load_json(REPO_ROOT / "data" / "standards" / "o-ring" / "as568.json")
    rows = []
    for s in data["sizes"]:
        rows.append(
            (
                f"oring_{data['standard']}_{s['code']}",
                "std_as568",
                "rev_as568f",
                s["code"],
                s["id"],
                s["cs"],
                "dataset_oring_as568_json",
            )
        )
    conn.executemany(
        """
        INSERT OR IGNORE INTO seal_oring_size
        (oring_id, standard_id, revision_id, dash_code, inner_diameter, cross_section, dataset_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )


def import_jis_b2401_orings(conn: sqlite3.Connection):
    text = fetch_pdf_text(GMORS_JIS_B2401_PDF_URL)
    lines = [line.strip() for line in text.splitlines()]
    size_pattern = re.compile(r"^[PGSV]\d+(?:\.\d+)?[A-Z]?$")
    number_pattern = re.compile(r"^\d+(?:\.\d+)?$")

    rows = []
    for index, line in enumerate(lines):
        if not size_pattern.match(line):
            continue
        values = []
        cursor = index + 1
        while cursor < len(lines) and len(values) < 4:
            candidate = lines[cursor]
            if number_pattern.fullmatch(candidate):
                values.append(float(candidate))
            elif size_pattern.match(candidate):
                break
            cursor += 1
        if len(values) != 4:
            continue

        dash_code, inner_diameter, tol_id, cross_section, tol_cs = line, values[0], values[1], values[2], values[3]
        rows.append(
            (
                f"oring_jis_b2401_{slugify(dash_code)}",
                "std_jis_b_2401",
                "rev_jis_b_2401_gmors",
                dash_code,
                inner_diameter,
                cross_section,
                tol_id,
                tol_id,
                tol_cs,
                tol_cs,
                dash_code[0],
                "dataset_jis_b2401_gmors_pdf",
                "Imported from GMORS JIS B 2401 public PDF",
            )
        )

    if not rows:
        raise RuntimeError("no JIS B 2401 O-ring rows imported")

    conn.executemany(
        """
        INSERT OR IGNORE INTO seal_oring_size
        (oring_id, standard_id, revision_id, dash_code, inner_diameter, cross_section,
         tolerance_id_plus, tolerance_id_minus, tolerance_cs_plus, tolerance_cs_minus,
         series_code, dataset_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    conn.execute(
        """
        UPDATE dataset_release
        SET row_count = ?
        WHERE dataset_id = 'dataset_jis_b2401_gmors_pdf'
        """,
        (len(rows),),
    )


def import_oring_materials(conn: sqlite3.Connection):
    materials = [
        (
            "oring_mat_nbr_70",
            "NBR",
            "Nitrile (Buna-N)",
            70,
            -40,
            125,
            "excellent",
            None,
            "Apple Rubber public guide: general-purpose oil resistant elastomer.",
        ),
        (
            "oring_mat_fkm_75",
            "FKM",
            "Fluorocarbon (Viton)",
            75,
            -25,
            230,
            "excellent",
            None,
            "Apple Rubber public guide: high temperature and petroleum fluid resistance.",
        ),
        (
            "oring_mat_epdm_70",
            "EPDM",
            "Ethylene-Propylene",
            70,
            -40,
            135,
            "poor",
            "excellent",
            "Apple Rubber public guide: preferred for hot water, steam, weather and ozone exposure.",
        ),
        (
            "oring_mat_vmq_70",
            "VMQ",
            "Silicone",
            70,
            -55,
            200,
            "fair",
            None,
            "Apple Rubber public guide: broad low/high temperature range and good dry heat resistance.",
        ),
        (
            "oring_mat_fvmq_70",
            "FVMQ",
            "Fluorosilicone",
            70,
            -65,
            177,
            "good",
            None,
            "Apple Rubber public guide: improved fuel and petroleum fluid resistance versus silicone.",
        ),
        (
            "oring_mat_cr_70",
            "CR",
            "Chloroprene (Neoprene)",
            70,
            -40,
            100,
            "fair",
            None,
            "Apple Rubber public guide: moderate petroleum resistance and good ozone/weather resistance.",
        ),
        (
            "oring_mat_hnbr_70",
            "HNBR",
            "Hydrogenated Nitrile",
            70,
            -34,
            149,
            "excellent",
            None,
            "Apple Rubber HNBR guide: improved heat, oil and ozone resistance compared with NBR.",
        ),
        (
            "oring_mat_ffkm_75",
            "FFKM",
            "Perfluoroelastomer",
            75,
            -25,
            316,
            "excellent",
            None,
            "Apple Rubber FFKM guide: exceptional chemical resistance and very high temperature capability.",
        ),
    ]

    conn.executemany(
        """
        INSERT OR IGNORE INTO seal_oring_material
        (oring_material_id, material_code, material_name, hardness_shore_a, temperature_min_c, temperature_max_c,
         oil_resistance_rating, water_resistance_rating, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        materials,
    )
    conn.execute(
        """
        UPDATE dataset_release
        SET row_count = ?
        WHERE dataset_id = 'dataset_oring_material_apple'
        """,
        (len(materials),),
    )


def import_oring_design_rules(conn: sqlite3.Connection):
    tables = [
        (
            "rule_oring_squeeze_pct",
            "oring_squeeze_pct",
            "O-Ring Recommended Squeeze",
            "Squeeze percentage recommendations summarized from Marco public design guide.",
        ),
        (
            "rule_oring_stretch_pct",
            "oring_stretch_pct",
            "O-Ring Installed Stretch",
            "Installed stretch recommendations summarized from Marco public design guide.",
        ),
        (
            "rule_oring_gland_fill_pct",
            "oring_gland_fill_pct",
            "O-Ring Gland Fill",
            "Nominal gland fill and void-space guidance summarized from Marco public design guide.",
        ),
        (
            "rule_oring_surface_finish",
            "oring_surface_finish_ra",
            "O-Ring Surface Finish",
            "Surface finish guidance summarized from Marco public design guide.",
        ),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_table
        (rule_table_id, rule_code, rule_name, domain_code, dataset_id, notes)
        VALUES (?, ?, ?, 'seal', 'dataset_oring_rules_marco', ?)
        """,
        tables,
    )

    rows = [
        ("rule_oring_squeeze_pct_face", "rule_oring_squeeze_pct", "face", "Face Seal", 1),
        ("rule_oring_squeeze_pct_static", "rule_oring_squeeze_pct", "static_male_female", "Static Male/Female", 2),
        ("rule_oring_squeeze_pct_recip", "rule_oring_squeeze_pct", "reciprocating", "Reciprocating", 3),
        ("rule_oring_squeeze_pct_rotary", "rule_oring_squeeze_pct", "rotary", "Rotary", 4),
        ("rule_oring_stretch_pct_general", "rule_oring_stretch_pct", "general", "General Stretch", 1),
        ("rule_oring_gland_fill_pct_standard", "rule_oring_gland_fill_pct", "standard", "Standard Application", 1),
        ("rule_oring_surface_finish_static_gas", "rule_oring_surface_finish", "static_gas", "Static Gas", 1),
        ("rule_oring_surface_finish_static_liquid", "rule_oring_surface_finish", "static_liquid", "Static Liquid", 2),
        ("rule_oring_surface_finish_dynamic", "rule_oring_surface_finish", "dynamic", "Dynamic", 3),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_row
        (rule_row_id, rule_table_id, row_key, row_label, sort_order)
        VALUES (?, ?, ?, ?, ?)
        """,
        rows,
    )

    numeric_values = [
        ("rule_oring_squeeze_pct_face", "min_pct", 20, "pct"),
        ("rule_oring_squeeze_pct_face", "max_pct", 30, "pct"),
        ("rule_oring_squeeze_pct_static", "min_pct", 18, "pct"),
        ("rule_oring_squeeze_pct_static", "max_pct", 25, "pct"),
        ("rule_oring_squeeze_pct_recip", "min_pct", 10, "pct"),
        ("rule_oring_squeeze_pct_recip", "max_pct", 20, "pct"),
        ("rule_oring_squeeze_pct_rotary", "min_pct", 0, "pct"),
        ("rule_oring_squeeze_pct_rotary", "max_pct", 10, "pct"),
        ("rule_oring_stretch_pct_general", "min_pct", 0, "pct"),
        ("rule_oring_stretch_pct_general", "max_pct", 5, "pct"),
        ("rule_oring_gland_fill_pct_standard", "nominal_fill_pct", 75, "pct"),
        ("rule_oring_gland_fill_pct_standard", "nominal_void_pct", 25, "pct"),
        ("rule_oring_surface_finish_static_gas", "min_ra_uin", 16, "uin"),
        ("rule_oring_surface_finish_static_gas", "max_ra_uin", 16, "uin"),
        ("rule_oring_surface_finish_static_liquid", "min_ra_uin", 32, "uin"),
        ("rule_oring_surface_finish_static_liquid", "max_ra_uin", 32, "uin"),
        ("rule_oring_surface_finish_dynamic", "min_ra_uin", 8, "uin"),
        ("rule_oring_surface_finish_dynamic", "max_ra_uin", 16, "uin"),
        ("rule_oring_surface_finish_dynamic", "max_pressure_without_backup_psi", 1500, "psi"),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_value_numeric
        (rule_row_id, column_code, numeric_value, unit_code)
        VALUES (?, ?, ?, ?)
        """,
        numeric_values,
    )

    text_values = [
        (
            "rule_oring_stretch_pct_general",
            "note",
            "General rule 0-5%; cross section reduction due to stretch is about half of ID stretch.",
        ),
        (
            "rule_oring_gland_fill_pct_standard",
            "note",
            "Leave void space for swell, thermal expansion and width growth due to squeeze.",
        ),
        (
            "rule_oring_surface_finish_static_gas",
            "note",
            "Marco recommends finer finish for gas sealing.",
        ),
        (
            "rule_oring_surface_finish_static_liquid",
            "note",
            "Marco allows rougher finish for liquid static sealing.",
        ),
        (
            "rule_oring_surface_finish_dynamic",
            "note",
            "Dynamic surfaces should stay smoother; use backup rings or harder materials at higher pressure.",
        ),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_value_text
        (rule_row_id, column_code, text_value)
        VALUES (?, ?, ?)
        """,
        text_values,
    )
    conn.execute(
        """
        UPDATE dataset_release
        SET row_count = ?
        WHERE dataset_id = 'dataset_oring_rules_marco'
        """,
        (len(rows),),
    )


def import_oring_gland_rules(conn: sqlite3.Connection):
    tables = [
        (
            "rule_oring_gland_static_radial_as568",
            "oring_gland_static_radial_as568",
            "AS568 Static Radial Gland",
            "GMORS O-Ring Master static industrial seal gland dimensions by AS568 cross-section group.",
        ),
        (
            "rule_oring_gland_face_as568",
            "oring_gland_face_as568",
            "AS568 Static Face Gland",
            "GMORS O-Ring Master static face seal gland dimensions by AS568 cross-section group.",
        ),
        (
            "rule_oring_extrusion_limit",
            "oring_extrusion_limit",
            "O-Ring Extrusion Limit",
            "GMORS diametral clearance limits against fluid pressure and hardness without back-up rings.",
        ),
        (
            "rule_oring_backup_ring_general",
            "oring_backup_ring_general",
            "O-Ring Back-Up Ring Notes",
            "GMORS general back-up ring recommendations and derating notes.",
        ),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_table
        (rule_table_id, rule_code, rule_name, domain_code, dataset_id, notes)
        VALUES (?, ?, ?, 'seal', 'dataset_oring_rules_gmors', ?)
        """,
        tables,
    )

    radial_rows = [
        ("004_050", "004 through 050", 1, 0.070, 0.050, 0.052, 22, 32, 0.002, 0.005, 0.093, 0.098, 0.138, 0.143, 0.205, 0.210, 0.005, 0.015, 0.002),
        ("102_178", "102 through 178", 2, 0.103, 0.081, 0.083, 17, 24, 0.002, 0.005, 0.140, 0.145, 0.171, 0.176, 0.238, 0.243, 0.005, 0.015, 0.002),
        ("201_284", "201 through 284", 3, 0.139, 0.111, 0.113, 16, 23, 0.003, 0.006, 0.187, 0.192, 0.208, 0.213, 0.275, 0.280, 0.010, 0.025, 0.003),
        ("309_395", "309 through 395", 4, 0.210, 0.170, 0.173, 15, 21, 0.003, 0.006, 0.281, 0.286, 0.311, 0.316, 0.410, 0.415, 0.020, 0.035, 0.004),
        ("425_475", "425 through 475", 5, 0.275, 0.226, 0.229, 15, 20, 0.004, 0.007, 0.375, 0.380, 0.408, 0.413, 0.538, 0.543, 0.020, 0.035, 0.005),
    ]
    face_rows = [
        ("004_050", "004 through 050", 1, 0.070, 0.050, 0.054, 19, 32, 0.101, 0.107, 0.084, 0.089, 0.005, 0.015),
        ("102_178", "102 through 178", 2, 0.103, 0.074, 0.080, 20, 30, 0.136, 0.142, 0.120, 0.125, 0.005, 0.015),
        ("201_284", "201 through 284", 3, 0.139, 0.101, 0.107, 20, 30, 0.177, 0.187, 0.158, 0.164, 0.010, 0.025),
        ("309_395", "309 through 395", 4, 0.210, 0.152, 0.162, 21, 30, 0.270, 0.290, 0.239, 0.244, 0.020, 0.035),
        ("425_475", "425 through 475", 5, 0.275, 0.201, 0.211, 21, 29, 0.342, 0.362, 0.309, 0.314, 0.020, 0.035),
    ]

    rule_rows = []
    numeric_values = []

    for key, label, sort_order, nominal_cs, depth_min, depth_max, squeeze_min, squeeze_max, clearance_min, clearance_max, width_min, width_max, width1_min, width1_max, width2_min, width2_max, radius_min, radius_max, max_ecc in radial_rows:
        row_id = f"rule_oring_gland_static_radial_as568_{key}"
        rule_rows.append((row_id, "rule_oring_gland_static_radial_as568", key, label, sort_order))
        numeric_values.extend(
            [
                (row_id, "nominal_cs_in", nominal_cs, "in"),
                (row_id, "gland_depth_min_in", depth_min, "in"),
                (row_id, "gland_depth_max_in", depth_max, "in"),
                (row_id, "squeeze_min_pct", squeeze_min, "pct"),
                (row_id, "squeeze_max_pct", squeeze_max, "pct"),
                (row_id, "diametral_clearance_min_in", clearance_min, "in"),
                (row_id, "diametral_clearance_max_in", clearance_max, "in"),
                (row_id, "groove_width_no_backup_min_in", width_min, "in"),
                (row_id, "groove_width_no_backup_max_in", width_max, "in"),
                (row_id, "groove_width_one_backup_min_in", width1_min, "in"),
                (row_id, "groove_width_one_backup_max_in", width1_max, "in"),
                (row_id, "groove_width_two_backup_min_in", width2_min, "in"),
                (row_id, "groove_width_two_backup_max_in", width2_max, "in"),
                (row_id, "groove_radius_min_in", radius_min, "in"),
                (row_id, "groove_radius_max_in", radius_max, "in"),
                (row_id, "max_eccentricity_in", max_ecc, "in"),
            ]
        )

    for key, label, sort_order, nominal_cs, depth_min, depth_max, squeeze_min, squeeze_max, width_liq_min, width_liq_max, width_vac_min, width_vac_max, radius_min, radius_max in face_rows:
        row_id = f"rule_oring_gland_face_as568_{key}"
        rule_rows.append((row_id, "rule_oring_gland_face_as568", key, label, sort_order))
        numeric_values.extend(
            [
                (row_id, "nominal_cs_in", nominal_cs, "in"),
                (row_id, "gland_depth_min_in", depth_min, "in"),
                (row_id, "gland_depth_max_in", depth_max, "in"),
                (row_id, "squeeze_min_pct", squeeze_min, "pct"),
                (row_id, "squeeze_max_pct", squeeze_max, "pct"),
                (row_id, "groove_width_liquid_min_in", width_liq_min, "in"),
                (row_id, "groove_width_liquid_max_in", width_liq_max, "in"),
                (row_id, "groove_width_vacuum_min_in", width_vac_min, "in"),
                (row_id, "groove_width_vacuum_max_in", width_vac_max, "in"),
                (row_id, "groove_radius_min_in", radius_min, "in"),
                (row_id, "groove_radius_max_in", radius_max, "in"),
            ]
        )

    extrusion_rows = [
        ("up_to_500_70", "Up to 500 psi / 70A", 1, 70, 0, 500, 0.016),
        ("up_to_500_90", "Up to 500 psi / 90A", 2, 90, 0, 500, 0.028),
        ("500_1000_70", "500-1000 psi / 70A", 3, 70, 500, 1000, 0.010),
        ("500_1000_90", "500-1000 psi / 90A", 4, 90, 500, 1000, 0.024),
        ("1000_1500_70", "1000-1500 psi / 70A", 5, 70, 1000, 1500, 0.006),
        ("1000_1500_90", "1000-1500 psi / 90A", 6, 90, 1000, 1500, 0.020),
        ("1500_2000_70", "1500-2000 psi / 70A", 7, 70, 1500, 2000, 0.004),
        ("1500_2000_90", "1500-2000 psi / 90A", 8, 90, 1500, 2000, 0.016),
        ("2000_3000_70", "2000-3000 psi / 70A", 9, 70, 2000, 3000, 0.002),
        ("2000_3000_90", "2000-3000 psi / 90A", 10, 90, 2000, 3000, 0.010),
    ]
    for key, label, sort_order, hardness, pressure_min, pressure_max, max_clearance in extrusion_rows:
        row_id = f"rule_oring_extrusion_limit_{key}"
        rule_rows.append((row_id, "rule_oring_extrusion_limit", key, label, sort_order))
        numeric_values.extend(
            [
                (row_id, "hardness_shore_a", hardness, "shore_a"),
                (row_id, "pressure_min_psi", pressure_min, "psi"),
                (row_id, "pressure_max_psi", pressure_max, "psi"),
                (row_id, "max_diametral_clearance_in", max_clearance, "in"),
            ]
        )

    backup_rows = [
        ("clearance_derate_silicone", "Silicone / Fluorosilicone Derating", 1),
        ("gland_depth_increase_with_backup", "Gland Depth Increase With Back-Up Ring", 2),
    ]
    for key, label, sort_order in backup_rows:
        row_id = f"rule_oring_backup_ring_general_{key}"
        rule_rows.append((row_id, "rule_oring_backup_ring_general", key, label, sort_order))

    numeric_values.extend(
        [
            ("rule_oring_backup_ring_general_clearance_derate_silicone", "clearance_multiplier", 0.5, "ratio"),
            ("rule_oring_backup_ring_general_gland_depth_increase_with_backup", "max_depth_increase_pct", 5, "pct"),
        ]
    )

    text_values = [
        (
            "rule_oring_backup_ring_general_clearance_derate_silicone",
            "note",
            "Reduce maximum diametral clearance 50% when using silicone or fluorosilicone O-rings.",
        ),
        (
            "rule_oring_backup_ring_general_gland_depth_increase_with_backup",
            "note",
            "For ease of assembly, gland depth may be increased up to 5% when back-up rings are used.",
        ),
    ]

    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_row
        (rule_row_id, rule_table_id, row_key, row_label, sort_order)
        VALUES (?, ?, ?, ?, ?)
        """,
        rule_rows,
    )
    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_value_numeric
        (rule_row_id, column_code, numeric_value, unit_code)
        VALUES (?, ?, ?, ?)
        """,
        numeric_values,
    )
    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_value_text
        (rule_row_id, column_code, text_value)
        VALUES (?, ?, ?)
        """,
        text_values,
    )
    conn.execute(
        """
        UPDATE dataset_release
        SET row_count = ?
        WHERE dataset_id = 'dataset_oring_rules_gmors'
        """,
        (len(rule_rows),),
    )


def import_oring_chemical_compatibility(conn: sqlite3.Connection):
    conn.execute(
        """
        INSERT OR IGNORE INTO rule_table
        (rule_table_id, rule_code, rule_name, domain_code, dataset_id, notes)
        VALUES (?, ?, ?, 'seal', 'dataset_oring_compat_apple', ?)
        """,
        (
            "rule_oring_chemical_compatibility_basic",
            "oring_chemical_compatibility_basic",
            "O-Ring Chemical Compatibility Basic",
            "Apple Rubber public compatibility guide curated for common sealing media at 70°F.",
        ),
    )

    chemicals = [
        ("acetone", "Acetone", 6),
        ("ammonia_anhydrous", "Ammonia Anhydrous", 20),
        ("denatured_alcohol", "Denatured Alcohol", 153),
        ("diesel_oil", "Diesel Oil", 168),
        ("ethylene_glycol", "Ethylene Glycol", 216),
        ("red_oil_mil_h_5606", "Red Oil (MIL-H-5606)", 440),
        ("salt_water", "Salt Water", 445),
        ("skydrol_500", "Skydrol 500", 451),
        ("skydrol_7000", "Skydrol 7000", 452),
        ("steam_under_300f", "Steam Under 300 F", 474),
        ("steam_over_300f", "Steam Over 300 F", 475),
        ("stoddard_solvent", "Stoddard Solvent", 477),
        ("brake_fluid_wagner_21b", "Wagner 21B Brake Fluid", 535),
        ("water", "Water", 536),
        ("white_oil", "White Oil", 539),
    ]
    material_map = {
        "Chloroprene": "CR",
        "Ethylene-Propylene": "EPDM",
        "Fluorocarbon": "FKM",
        "Fluorosilicone": "FVMQ",
        "Hydrogenated Nitrile": "HNBR",
        "Nitrile (Buna-N)": "NBR",
        "Silicone": "VMQ",
    }
    rating_map = {
        1: "good",
        2: "fair",
        3: "questionable",
        4: "poor",
        0: "insufficient_data",
        5: "insufficient_data",
    }

    row_inserts = []
    text_inserts = []
    for sort_order, (row_key, row_label, chemical_id) in enumerate(chemicals, start=1):
        row_id = f"rule_oring_chemical_compatibility_basic_{row_key}"
        row_inserts.append((row_id, "rule_oring_chemical_compatibility_basic", row_key, row_label, sort_order))
        html = fetch_text(f"{APPLE_CHEMICAL_GUIDE_URL}?chemical_alpha=&chemical_filter=%2A&chemical_id={chemical_id}")
        compatibility = parse_apple_compatibility_page(html)
        text_inserts.append((row_id, "source_chemical_id", str(chemical_id)))
        text_inserts.append((row_id, "temperature_basis", "70F"))
        text_inserts.append((row_id, "FFKM", "not_listed"))
        for source_label, material_code in material_map.items():
            if source_label in compatibility:
                text_inserts.append((row_id, material_code, rating_map.get(compatibility[source_label], "insufficient_data")))

    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_row
        (rule_row_id, rule_table_id, row_key, row_label, sort_order)
        VALUES (?, ?, ?, ?, ?)
        """,
        row_inserts,
    )
    conn.executemany(
        """
        INSERT OR IGNORE INTO rule_value_text
        (rule_row_id, column_code, text_value)
        VALUES (?, ?, ?)
        """,
        text_inserts,
    )
    conn.execute(
        """
        UPDATE dataset_release
        SET row_count = ?
        WHERE dataset_id = 'dataset_oring_compat_apple'
        """,
        (len(row_inserts),),
    )


def import_materials(conn: sqlite3.Connection):
    data = load_json(REPO_ROOT / "data" / "materials-extended.json")
    for family, materials in data.items():
        if not isinstance(materials, list):
            continue
        for m in materials:
            material_id = f"material_{re.sub(r'[^a-zA-Z0-9]', '_', m['designation'])}"
            if "GB/T 3077" in (m.get("standards") or []):
                standard_id, revision_id = "std_gbt_3077", "rev_gbt_3077_default"
            else:
                standard_id, revision_id = "std_gbt_700", "rev_gbt_700_default"

            conn.execute(
                """
                INSERT OR IGNORE INTO material_grade
                (material_id, standard_id, revision_id, grade_code, grade_name, material_family, heat_treatment_state,
                 density, elastic_modulus, shear_modulus, yield_strength, tensile_strength, elongation,
                 temp_min, temp_max, dataset_id, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    material_id,
                    standard_id,
                    revision_id,
                    m["designation"],
                    m["name_zh"],
                    family,
                    m.get("condition"),
                    m.get("density"),
                    m.get("E"),
                    m.get("G"),
                    m.get("yield_strength"),
                    m.get("tensile_strength"),
                    m.get("elongation"),
                    m.get("temp_min"),
                    m.get("temp_max"),
                    "dataset_materials_extended_json",
                    m.get("notes"),
                ),
            )

            property_set_id = f"{material_id}_default_props"
            conn.execute(
                """
                INSERT OR IGNORE INTO material_property_set
                (property_set_id, material_id, condition_label, test_temperature_c, source_id, note)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    property_set_id,
                    material_id,
                    m.get("condition", "default"),
                    20,
                    "samr_openstd",
                    "Generated from materials-extended.json",
                ),
            )

            numeric_props = [
                ("density", m.get("density"), "g/cm3"),
                ("elastic_modulus", m.get("E"), "MPa"),
                ("shear_modulus", m.get("G"), "MPa"),
                ("yield_strength", m.get("yield_strength"), "MPa"),
                ("tensile_strength", m.get("tensile_strength"), "MPa"),
                ("elongation", m.get("elongation"), "pct"),
                ("temp_min", m.get("temp_min"), "degC"),
                ("temp_max", m.get("temp_max"), "degC"),
                ("hardness_brinell", m.get("hardness_brinell"), "HB"),
            ]
            for code, value, unit in numeric_props:
                if value is not None:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO material_property
                        (property_set_id, property_code, numeric_value, text_value, unit_code)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (property_set_id, code, value, None, unit),
                    )

            for system, grade in (m.get("equivalents") or {}).items():
                conn.execute(
                    """
                    INSERT OR IGNORE INTO material_equivalent
                    (material_id, external_system_code, external_grade_code, equivalence_level, note)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        material_id,
                        system,
                        str(grade),
                        "reference",
                        "Imported from materials-extended.json",
                    ),
                )


def import_seed_gear_modules(conn: sqlite3.Connection):
    for module_value in [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]:
        conn.execute(
            """
            INSERT OR IGNORE INTO gear_module_standard
            (gear_module_id, standard_id, revision_id, gear_type, pressure_angle_deg, helix_angle_deg,
             module_value, module_system, dataset_id, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"gear_module_spur_{str(module_value).replace('.', '_')}",
                "std_jis_b_1704",
                "rev_jis_b_1704_default",
                "spur",
                20,
                0,
                module_value,
                "metric",
                "dataset_khk_vendor_seed",
                "Seeded common metric modules",
            ),
        )


def import_khk_vendor_parts(conn: sqlite3.Connection):
    unit_hints = {
        "Module": "module",
        "No. of teeth": "count",
        "Pressure Angle": "deg",
        "Helix Angle": "deg",
        "Weight": "kg",
        "Bore (A)": "mm",
        "Pitch Diameter (C)": "mm",
        "Outer Diameter (D)": "mm",
        "Face Width (E)": "mm",
        "Face Width (J)": "mm",
        "Hub Diameter (B)": "mm",
        "Hub Width (F)": "mm",
        "Hub Width (H)": "mm",
        "Mounting Distance (E)": "mm",
        "Length Of Bore (I)": "mm",
        "Bending Strength (N-m)": "N·m",
        "Surface Durability (N-m)": "N·m",
    }

    count = 0
    for url in KHK_URLS:
        try:
            html = fetch_text(url)
            product = parse_khk_page(html, url)
        except Exception as exc:
            print(f"skip KHK url {url}: {exc}", file=sys.stderr)
            continue
        vendor_part_id = f"vendor_khk_{slugify(product['sku'])}"
        module_value = first_number(product["specs"].get("Module", ""))
        linked_entity_id = (
            f"gear_module_spur_{str(module_value).replace('.', '_')}" if module_value is not None else None
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO vendor_part
            (vendor_part_id, manufacturer_id, domain_code, vendor_part_number, linked_entity_type, linked_entity_id,
             product_url, status, description, dataset_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                vendor_part_id,
                "mfr_khk",
                "gear",
                product["sku"],
                "gear_module_standard" if linked_entity_id else None,
                linked_entity_id,
                product["url"],
                "active",
                product["title"],
                "dataset_khk_vendor_seed",
            ),
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO vendor_part_ext_text
            (vendor_part_id, attr_code, text_value)
            VALUES (?, ?, ?)
            """,
            (vendor_part_id, "title", product["title"]),
        )
        for key, value in product["specs"].items():
            attr_code = slugify(key)
            conn.execute(
                """
                INSERT OR REPLACE INTO vendor_part_ext_text
                (vendor_part_id, attr_code, text_value)
                VALUES (?, ?, ?)
                """,
                (vendor_part_id, attr_code, value),
            )
            numeric_value = first_number(value)
            if numeric_value is not None:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO vendor_part_ext_numeric
                    (vendor_part_id, attr_code, numeric_value, unit_code)
                    VALUES (?, ?, ?, ?)
                    """,
                    (vendor_part_id, attr_code, numeric_value, unit_hints.get(key)),
                )
        count += 1

    if count == 0:
        raise RuntimeError("no KHK vendor parts imported")

    conn.execute(
        """
        UPDATE dataset_release
        SET row_count = ?
        WHERE dataset_id = 'dataset_khk_vendor_seed'
        """,
        (count,),
    )


def rebuild_search(conn: sqlite3.Connection):
    conn.execute("DELETE FROM search_document")
    conn.execute("DELETE FROM search_fts")

    rows = conn.execute(
        """
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
        SELECT 'seal_oring_material', oring_material_id, material_code,
               printf('O-ring material %s %s ShoreA %d temp %.0f to %.0f C',
                      material_code, material_name, COALESCE(hardness_shore_a, 0),
                      COALESCE(temperature_min_c, 0), COALESCE(temperature_max_c, 0)),
               'oring material seal'
        FROM seal_oring_material
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
        SELECT 'fastener_hex_nut', nut_id, designation,
               printf('Hex nut %s s=%.3f m=%.3f', designation, width_s, height_m),
               'nut fastener'
        FROM fastener_hex_nut
        UNION ALL
        SELECT 'fastener_plain_washer', washer_id, designation,
               printf('Plain washer %s %.3fx%.3fx%.3f', designation, nominal_d, inner_diameter, outer_diameter),
               'washer fastener'
        FROM fastener_plain_washer
        UNION ALL
        SELECT 'rule_table', rule_table_id, rule_name,
               COALESCE(notes, rule_code),
               domain_code || ' rule'
        FROM rule_table
        UNION ALL
        SELECT 'vendor_part', vendor_part_id, vendor_part_number,
               COALESCE(description, vendor_part_number),
               domain_code
        FROM vendor_part
        """
    ).fetchall()

    for entity_type, entity_id, title, body, tags in rows:
        doc_id = f"{entity_type}:{entity_id}"
        conn.execute(
            """
            INSERT INTO search_document (doc_id, entity_type, entity_id, title, body, tags)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (doc_id, entity_type, entity_id, title, body, tags),
        )
        conn.execute(
            """
            INSERT INTO search_fts (doc_id, title, body, tags)
            VALUES (?, ?, ?, ?)
            """,
            (doc_id, title, body, tags),
        )


def seed_data_version(conn: sqlite3.Connection):
    rows = [
        ("V3_SCHEMA", "3.0.0", "system", "schema_v3"),
        ("ORING_COMPAT_APPLE", "2026-04-12", "apple_rubber", "rows:15"),
        ("JIS_B2401_GMORS", "2026-04-12", "gmors_catalog", "rows:419"),
        ("ORING_GLAND_GMORS", "2026-04-12", "gmors_catalog", "rows:22"),
        ("ORING_MATERIAL_APPLE", "2026-04-12", "apple_rubber", "rows:8"),
        ("ORING_RULES_MARCO", "2026-04-12", "marco_sealing", "rows:9"),
        ("KHK_VENDOR", "2026-04-12", "khk_gear_world", f"urls:{len(KHK_URLS)}"),
        ("NSK_PUBLIC_PDF", "2026-04-12", "nsk_catalog", "rows:54"),
        ("FERROBEND_FASTENER", "2026-04-12", "ferrobend_iso", "iso4032+4034+7089+7090+7091+7093+boltport4035+boltport7092"),
    ]
    conn.executemany(
        """
        INSERT OR REPLACE INTO data_version (standard_code, version, source, checksum)
        VALUES (?, ?, ?, ?)
        """,
        rows,
    )


def print_counts(conn: sqlite3.Connection):
    rows = conn.execute(
        """
        SELECT 'thread_metric' AS table_name, COUNT(*) AS count FROM thread_metric
        UNION ALL SELECT 'fastener_hex_bolt', COUNT(*) FROM fastener_hex_bolt
        UNION ALL SELECT 'bearing_basic', COUNT(*) FROM bearing_basic
        UNION ALL SELECT 'seal_oring_size', COUNT(*) FROM seal_oring_size
        UNION ALL SELECT 'material_grade', COUNT(*) FROM material_grade
        UNION ALL SELECT 'gear_module_standard', COUNT(*) FROM gear_module_standard
        UNION ALL SELECT 'vendor_part', COUNT(*) FROM vendor_part
        UNION ALL SELECT 'search_document', COUNT(*) FROM search_document
        """
    ).fetchall()
    for table_name, count in rows:
        print(f"{table_name}: {count}")


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")

    apply_schema(conn)
    import_threads(conn)
    import_ferrobend_nuts(conn)
    import_ferrobend_washers(conn)
    import_bolts(conn)
    import_bearings(conn)
    import_nsk_catalog_bearings(conn)
    import_orings(conn)
    import_jis_b2401_orings(conn)
    import_oring_materials(conn)
    import_oring_design_rules(conn)
    import_oring_gland_rules(conn)
    import_oring_chemical_compatibility(conn)
    import_materials(conn)
    import_seed_gear_modules(conn)
    import_khk_vendor_parts(conn)
    rebuild_search(conn)
    seed_data_version(conn)
    conn.commit()

    print(f"Initialized DB at {DB_PATH}")
    print_counts(conn)
    conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
