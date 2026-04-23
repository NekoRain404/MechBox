INSERT OR IGNORE INTO standard_system (system_code, system_name, issuer_name) VALUES
  ('GB', '国家标准', '国家标准化管理委员会'),
  ('GB/T', '推荐性国家标准', '国家标准化管理委员会'),
  ('ISO', 'International Standard', 'ISO'),
  ('ASME', 'ASME Standard', 'ASME'),
  ('SAE', 'SAE Standard', 'SAE International'),
  ('DIN', 'DIN Standard', 'DIN'),
  ('JIS', 'Japanese Industrial Standard', 'JISC'),
  ('AGMA', 'AGMA Standard', 'AGMA'),
  ('ABMA', 'ABMA Standard', 'ABMA');

INSERT OR IGNORE INTO source_provider (
  source_id, source_name, source_type, homepage_url, trust_level, license_note
) VALUES
  ('samr_openstd', '国家标准全文公开系统', 'public_open', 'https://openstd.samr.gov.cn/bzgk/std/index', 5, '公开可获取 GB/GB/T 数据'),
  ('sae_mobilus', 'SAE Mobilus', 'purchased_standard', 'https://saemobilus.sae.org/', 5, '适合 AS568F 等正式标准'),
  ('iso', 'ISO Standards', 'purchased_standard', 'https://www.iso.org/', 5, '正式标准'),
  ('asme', 'ASME Standards', 'purchased_standard', 'https://www.asme.org/', 5, 'B18 系列标准'),
  ('agma', 'AGMA Standards', 'purchased_standard', 'https://www.agma.org/standards-technology/', 5, '齿轮标准'),
  ('abma', 'ABMA Standards', 'purchased_standard', 'https://americanbearings.org/industry-standards/', 5, '轴承标准'),
  ('apple_rubber', 'Apple Rubber', 'vendor_catalog', 'https://www.applerubber.com/', 4, '公开 O-Ring 材料资料'),
  ('gmors_catalog', 'GMORS Catalog', 'vendor_catalog', 'https://www.gmors.com/', 4, '公开 O-Ring 标准尺寸 PDF'),
  ('khk_gear_world', 'KHK Gear World', 'vendor_catalog', 'https://www.khkgears.us/', 4, '齿轮商品目录'),
  ('marco_sealing', 'Marco Sealing Solutions', 'vendor_catalog', 'https://www.marcorubber.com/', 4, '公开 O-Ring 设计规则资料'),
  ('nsk_catalog', 'NSK Catalogs and CAD', 'vendor_catalog', 'https://www.nsk.com/catalogs-and-cad/', 4, '轴承商品目录'),
  ('boltport', 'Boltport Fasteners', 'reference_db', 'https://boltport.com/standards/', 3, '公开紧固件尺寸参考页'),
  ('ferrobend_iso', 'FERROBEND ISO Fasteners', 'reference_db', 'https://iso-fasteners.com/', 3, '公开标准尺寸参考页'),
  ('parker_oring', 'Parker O-Ring Handbook', 'vendor_catalog', 'https://discover.parker.com/Parker-ORing-Handbook-ORD-5700', 4, '密封规则与经验参数'),
  ('bossard_resources', 'Bossard Technical Resources', 'vendor_catalog', 'https://www.bossard.com/us-en/assembly-technology-expert/technical-information-and-tools/technical-resources/', 4, '紧固件工程参考'),
  ('misumi_tech', 'MISUMI Technical Information', 'vendor_catalog', 'https://uk.misumi-ec.com/en/techblog/general-info/screws-overview-standard/', 3, '标准件系列参考'),
  ('matweb', 'MatWeb', 'reference_db', 'https://www.matweb.com/', 3, '材料性能参考'),
  ('total_materia', 'Total Materia', 'reference_db', 'https://docs.totalmateria.com/', 4, '材料代换与映射');

INSERT OR IGNORE INTO standard_document (
  standard_id, system_code, standard_number, title, domain_code, status, notes
) VALUES
  ('std_as568', 'SAE', 'AS568', 'Aerospace Size Standard for O-Rings', 'seal', 'active', 'O 型圈尺寸标准'),
  ('std_jis_b_2401', 'JIS', 'B 2401', 'O-Ring Standard Size', 'seal', 'active', 'JIS O 型圈尺寸标准'),
  ('std_iso_261', 'ISO', '261', 'ISO general purpose metric screw threads', 'thread', 'active', '公制螺纹'),
  ('std_iso_4032', 'ISO', '4032', 'Hexagon regular nuts', 'fastener', 'active', '六角螺母'),
  ('std_iso_4034', 'ISO', '4034', 'Hexagon nuts, product grade C', 'fastener', 'active', '六角螺母 C级'),
  ('std_iso_4035', 'ISO', '4035', 'Hexagon thin nuts chamfered', 'fastener', 'active', '六角薄螺母'),
  ('std_iso_7089', 'ISO', '7089', 'Plain washers', 'fastener', 'active', '平垫圈'),
  ('std_iso_7092', 'ISO', '7092', 'Plain washers, small series', 'fastener', 'active', '小系列平垫圈'),
  ('std_iso_7090', 'ISO', '7090', 'Plain washers Form B', 'fastener', 'active', '平垫圈 B型'),
  ('std_iso_7091', 'ISO', '7091', 'Plain washers', 'fastener', 'active', '平垫圈'),
  ('std_iso_7093', 'ISO', '7093', 'Plain washers, outer diameter about 3d', 'fastener', 'active', '大外径平垫圈'),
  ('std_iso_4014', 'ISO', '4014', 'Hexagon head bolts', 'fastener', 'active', '六角头螺栓'),
  ('std_gbt_5782', 'GB/T', '5782', '六角头螺栓', 'fastener', 'active', '国标六角头螺栓'),
  ('std_gbt_700', 'GB/T', '700', '碳素结构钢', 'material', 'active', '结构钢'),
  ('std_gbt_3077', 'GB/T', '3077', '合金结构钢', 'material', 'active', '合金结构钢'),
  ('std_iso_281', 'ISO', '281', 'Rolling bearings - Dynamic load ratings and rating life', 'bearing', 'active', '轴承寿命标准'),
  ('std_jis_b_1704', 'JIS', 'B 1704', 'Accuracy standards for gears', 'gear', 'active', '齿轮精度参考');

INSERT OR IGNORE INTO standard_revision (
  revision_id, standard_id, revision_code, version_label, publish_date, reaffirm_date,
  source_id, source_url, copyright_class, notes
) VALUES
  ('rev_as568f', 'std_as568', 'AS568F', 'AS568F', '2026-01-29', '2026-01-29', 'sae_mobilus', 'https://saemobilus.sae.org/standards/as568f-aerospace-size-standard-o-rings', 'licensed_internal', '官方页显示 2026-01-29 reaffirmed'),
  ('rev_jis_b_2401_gmors', 'std_jis_b_2401', 'gmors', 'gmors', NULL, NULL, 'gmors_catalog', 'https://www.gmors.com/files/CatalogDownload/file/Ya/gmors-o-ring-jisb-2401.pdf', 'vendor_reference', 'GMORS 公开 PDF 尺寸参考页'),
  ('rev_iso_261_default', 'std_iso_261', 'default', 'default', NULL, NULL, 'iso', 'https://www.iso.org/', 'restricted', '项目初始化占位版本'),
  ('rev_iso_4032_ferrobend', 'std_iso_4032', 'ferrobend', 'ferrobend', NULL, NULL, 'ferrobend_iso', 'https://iso-fasteners.com/iso-standard-nuts/iso-4032/', 'vendor_reference', '公开尺寸参考页'),
  ('rev_iso_4034_ferrobend', 'std_iso_4034', 'ferrobend', 'ferrobend', NULL, NULL, 'ferrobend_iso', 'https://iso-fasteners.com/iso-standard-nuts/iso-4034/', 'vendor_reference', '公开尺寸参考页'),
  ('rev_iso_4035_boltport', 'std_iso_4035', 'boltport', 'boltport', NULL, NULL, 'boltport', 'https://boltport.com/standards/iso-4035/', 'vendor_reference', '公开尺寸参考页'),
  ('rev_iso_7089_ferrobend', 'std_iso_7089', 'ferrobend', 'ferrobend', NULL, NULL, 'ferrobend_iso', 'https://iso-fasteners.com/iso-standard-washers/iso-7089/', 'vendor_reference', '公开尺寸参考页'),
  ('rev_iso_7092_boltport', 'std_iso_7092', 'boltport', 'boltport', NULL, NULL, 'boltport', 'https://boltport.com/standards/iso-7092/', 'vendor_reference', '公开尺寸参考页'),
  ('rev_iso_7090_ferrobend', 'std_iso_7090', 'ferrobend', 'ferrobend', NULL, NULL, 'ferrobend_iso', 'https://iso-fasteners.com/iso-standard-washers/iso-7090/', 'vendor_reference', '公开尺寸参考页'),
  ('rev_iso_7091_ferrobend', 'std_iso_7091', 'ferrobend', 'ferrobend', NULL, NULL, 'ferrobend_iso', 'https://iso-fasteners.com/iso-standard-washers/iso-7091/', 'vendor_reference', '公开尺寸参考页'),
  ('rev_iso_7093_ferrobend', 'std_iso_7093', 'ferrobend', 'ferrobend', NULL, NULL, 'ferrobend_iso', 'https://iso-fasteners.com/iso-standard-washers/iso-7093/', 'vendor_reference', '公开尺寸参考页'),
  ('rev_iso_4014_default', 'std_iso_4014', 'default', 'default', NULL, NULL, 'iso', 'https://www.iso.org/', 'restricted', '项目初始化占位版本'),
  ('rev_gbt_5782_default', 'std_gbt_5782', 'default', 'default', NULL, NULL, 'samr_openstd', 'https://openstd.samr.gov.cn/bzgk/std/index', 'public_open', '项目初始化占位版本'),
  ('rev_gbt_700_default', 'std_gbt_700', 'default', 'default', NULL, NULL, 'samr_openstd', 'https://openstd.samr.gov.cn/bzgk/std/index', 'public_open', '项目初始化占位版本'),
  ('rev_gbt_3077_default', 'std_gbt_3077', 'default', 'default', NULL, NULL, 'samr_openstd', 'https://openstd.samr.gov.cn/bzgk/std/index', 'public_open', '项目初始化占位版本'),
  ('rev_iso_281_default', 'std_iso_281', 'default', 'default', NULL, NULL, 'iso', 'https://www.iso.org/', 'restricted', '项目初始化占位版本'),
  ('rev_jis_b_1704_default', 'std_jis_b_1704', 'default', 'default', NULL, NULL, 'khk_gear_world', 'https://www.khkgears.us/', 'vendor_reference', 'KHK 页面常引用该精度等级');

INSERT OR IGNORE INTO dataset_release (
  dataset_id, dataset_name, dataset_version, source_id, revision_id, checksum, row_count, notes
) VALUES
  ('dataset_threads_iso_metric_json', 'ISO Metric Threads JSON', '1.0.0', 'iso', 'rev_iso_261_default', NULL, NULL, '仓库内置 JSON'),
  ('dataset_oring_material_apple', 'O-Ring Material Apple', '2026-04-12', 'apple_rubber', NULL, NULL, NULL, '公开网页整理'),
  ('dataset_oring_compat_apple', 'O-Ring Chemical Compatibility Apple', '2026-04-12', 'apple_rubber', NULL, NULL, NULL, '公开网页整理'),
  ('dataset_oring_rules_gmors', 'O-Ring Groove Rules GMORS', '2026-04-12', 'gmors_catalog', NULL, NULL, NULL, '公开 PDF 整理'),
  ('dataset_oring_rules_marco', 'O-Ring Design Rules Marco', '2026-04-12', 'marco_sealing', NULL, NULL, NULL, '公开网页整理'),
  ('dataset_jis_b2401_gmors_pdf', 'JIS B 2401 GMORS PDF', '2026-04-12', 'gmors_catalog', 'rev_jis_b_2401_gmors', NULL, NULL, '公开 PDF 抽取'),
  ('dataset_iso_4032_ferrobend', 'ISO 4032 FERROBEND', '2026-04-12', 'ferrobend_iso', 'rev_iso_4032_ferrobend', NULL, NULL, '公开网页抽取'),
  ('dataset_iso_4034_ferrobend', 'ISO 4034 FERROBEND', '2026-04-12', 'ferrobend_iso', 'rev_iso_4034_ferrobend', NULL, NULL, '公开网页抽取'),
  ('dataset_iso_4035_boltport', 'ISO 4035 BOLTPORT', '2026-04-12', 'boltport', 'rev_iso_4035_boltport', NULL, NULL, '公开网页抽取'),
  ('dataset_iso_7089_ferrobend', 'ISO 7089 FERROBEND', '2026-04-12', 'ferrobend_iso', 'rev_iso_7089_ferrobend', NULL, NULL, '公开网页抽取'),
  ('dataset_iso_7092_boltport', 'ISO 7092 BOLTPORT', '2026-04-12', 'boltport', 'rev_iso_7092_boltport', NULL, NULL, '公开网页抽取'),
  ('dataset_iso_7090_ferrobend', 'ISO 7090 FERROBEND', '2026-04-12', 'ferrobend_iso', 'rev_iso_7090_ferrobend', NULL, NULL, '公开网页抽取'),
  ('dataset_iso_7091_ferrobend', 'ISO 7091 FERROBEND', '2026-04-12', 'ferrobend_iso', 'rev_iso_7091_ferrobend', NULL, NULL, '公开网页抽取'),
  ('dataset_iso_7093_ferrobend', 'ISO 7093 FERROBEND', '2026-04-12', 'ferrobend_iso', 'rev_iso_7093_ferrobend', NULL, NULL, '公开网页抽取'),
  ('dataset_bolts_hex_json', 'Hex Bolts JSON', '1.0.0', 'iso', 'rev_iso_4014_default', NULL, NULL, '仓库内置 JSON'),
  ('dataset_bearings_deep_groove_json', 'Deep Groove Bearings JSON', '1.0.0', 'nsk_catalog', 'rev_iso_281_default', NULL, NULL, '仓库内置 JSON'),
  ('dataset_nsk_deep_groove_pdf', 'NSK Deep Groove Catalog PDF', '2026-04-12', 'nsk_catalog', 'rev_iso_281_default', NULL, NULL, 'NSK 公开 PDF 目录抽取'),
  ('dataset_oring_as568_json', 'AS568 O-Ring JSON', '1.0.0', 'sae_mobilus', 'rev_as568f', NULL, NULL, '仓库内置 JSON'),
  ('dataset_materials_extended_json', 'Materials Extended JSON', '1.0.0', 'samr_openstd', 'rev_gbt_700_default', NULL, NULL, '仓库内置 JSON'),
  ('dataset_khk_vendor_seed', 'KHK Vendor Catalog Seed', '2026-04-12', 'khk_gear_world', 'rev_jis_b_1704_default', NULL, NULL, '公开商品页面抓取');

INSERT OR IGNORE INTO manufacturer (
  manufacturer_id, manufacturer_name, country_code, homepage_url, notes
) VALUES
  ('mfr_khk', 'KHK Kohara Gear Industry', 'JP', 'https://www.khkgears.us/', '公开商品目录'),
  ('mfr_nsk', 'NSK', 'JP', 'https://www.nsk.com/', '公开商品目录');
