export const ALLERGENS = [
  { code: 'peanuts', label: 'Peanuts' },
  { code: 'tree_nuts', label: 'Tree Nuts (almond / cashew / walnut)' },
  { code: 'sesame', label: 'Sesame Seeds' },
  { code: 'milk', label: 'Milk & Derivatives' },
  { code: 'eggs', label: 'Egg & Derivatives' },
  { code: 'seafood', label: 'Seafood (fish / crustaceans / shellfish)' },
  { code: 'soy', label: 'Soy & Soybean' },
  { code: 'wheat', label: 'Wheat & Triticale' },
  { code: 'gluten', label: 'Gluten Sources (barley / oats / rye)' },
  { code: 'mustard', label: 'Mustard' },
  { code: 'sulphites', label: 'Sulphites (>10ppm)' },
  { code: 'msg', label: 'Monosodium Glutamate (MSG)' },
  { code: 'art_colours', label: 'Artificial Colours & Flavours' },
  { code: 'hpp', label: 'Hydrolyzed Plant Protein (HPP)' },
];

export const ROHS_SUBSTANCES = [
  { name: 'Cadmium (Cd)', limit: 100 },
  { name: 'Lead (Pb)', limit: 1000 },
  { name: 'Mercury (Hg)', limit: 1000 },
  { name: 'Hexavalent chromium (Cr6+)', limit: 1000 },
  { name: 'Polybrominated biphenyls (PBB)', limit: 1000 },
  { name: 'Polybrominated diphenyl ethers (PBDE)', limit: 1000 },
  { name: 'Bis(2-ethylhexyl) phthalate (DEHP)', limit: 1000 },
  { name: 'Butyl benzyl phthalate (BBP)', limit: 1000 },
  { name: 'Dibutyl phthalate (DBP)', limit: 1000 },
  { name: 'Diisobutyl phthalate (DIBP)', limit: 1000 },
];

export const ROHS_OPTIONS = ['Compliant', 'Compliant with Exemption', 'Not Compliant', 'RoHS-not-concerned'];
export const SVHC_OPTIONS = ['Do Not Contain', 'Contain SVHCs of no more than 1000ppm', 'Contain SVHCs of more than 1000ppm'];

export const REACH_REFERENCES = [
  { label: 'Regulation (EC) No 1907/2006 (REACH) — EUR-Lex', url: 'https://eur-lex.europa.eu/eli/reg/2006/1907/oj' },
  { label: 'ECHA Candidate List of Substances of Very High Concern', url: 'https://echa.europa.eu/candidate-list-table' },
];

export const ROHS_REFERENCES = [
  { label: 'Directive 2011/65/EU (RoHS) — EUR-Lex', url: 'https://eur-lex.europa.eu/eli/dir/2011/65/oj' },
  { label: 'Commission Delegated Directive (EU) 2015/863 — EUR-Lex', url: 'https://eur-lex.europa.eu/eli/dir_del/2015/863/oj' },
];

export const DECLARATIONS = [
  {
    key: 'conflict_minerals',
    title: 'Conflict Minerals',
    statement:
      'The products supplied do not contain tin, tantalum, tungsten or gold (3TG) sourced from conflict-affected or high-risk areas, or any 3TG present is sourced responsibly in line with Regulation (EU) 2017/821.',
    references: [
      { label: 'Regulation (EU) 2017/821 (Conflict Minerals) — EUR-Lex', url: 'https://eur-lex.europa.eu/eli/reg/2017/821/oj' },
    ],
  },
  {
    key: 'melamine_cyanuric_acid',
    title: 'Melamine & Cyanuric Acid',
    statement:
      'The products supplied do not contain intentionally added melamine or cyanuric acid, and any trace levels are below the maximum levels set by Regulation (EU) 2023/915.',
    references: [
      { label: 'Regulation (EU) 2023/915 (maximum levels for contaminants in food) — EUR-Lex', url: 'https://eur-lex.europa.eu/eli/reg/2023/915/oj' },
    ],
  },
  {
    key: 'pbt',
    title: 'PBT (Persistent, Bioaccumulative and Toxic substances)',
    statement:
      'The products supplied do not contain substances meeting the PBT or vPvB criteria of REACH Annex XIII at a concentration of 0.1% (w/w) or more.',
    references: [
      { label: 'Regulation (EC) No 1907/2006 (REACH), Annex XIII — EUR-Lex', url: 'https://eur-lex.europa.eu/eli/reg/2006/1907/oj' },
    ],
  },
  {
    key: 'pops',
    title: 'POPs (Persistent Organic Pollutants)',
    statement:
      'The products supplied do not contain persistent organic pollutants listed in Annex I of Regulation (EU) 2019/1021, above the limits set in that Regulation.',
    references: [
      { label: 'Regulation (EU) 2019/1021 (POPs) — EUR-Lex', url: 'https://eur-lex.europa.eu/eli/reg/2019/1021/oj' },
      { label: 'Stockholm Convention on Persistent Organic Pollutants', url: 'https://www.pops.int' },
    ],
  },
  {
    key: 'ppwr',
    title: 'Packaging — PPWR (EU) 2025/40, Article 5',
    statement:
      'The packaging supplied complies with Article 5 (requirements for substances in packaging) of the Packaging and Packaging Waste Regulation (EU) 2025/40.',
    references: [
      { label: 'Regulation (EU) 2025/40 (PPWR) — EUR-Lex', url: 'https://eur-lex.europa.eu/eli/reg/2025/40/oj' },
    ],
  },
];

export const DECLARATION_OPTIONS = ['Yes', 'No', 'N/A'];
