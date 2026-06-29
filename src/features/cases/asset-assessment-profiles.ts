export const SUPPORTED_ASSET_TYPES = [
  'vehicle', 'goods_in_transit', 'stock', 'building_materials', 'property',
  'machinery', 'electronics', 'appliance', 'furniture', 'scrap', 'agriculture',
  'medical_equipment', 'energy_equipment', 'aviation_equipment', 'jewelry', 'other',
] as const;

export type SupportedAssetType = typeof SUPPORTED_ASSET_TYPES[number];
export type AssessmentFamily =
  | 'vehicle'
  | 'unit_recovery'
  | 'building_sections'
  | 'repairable_equipment'
  | 'contents'
  | 'material_recovery'
  | 'specialist'
  | 'general';

export interface AssetAssessmentProfile {
  family: AssessmentFamily;
  identificationMakeLabel: string;
  identificationModelLabel: string;
  conditionLabel: string;
  evidenceTitle: string;
  summaryTitle: string;
  valueLabel: string;
  evidenceNoun: string;
  promptGuidance: string[];
  evidenceExamples: string[];
}

const equipmentGuidance = [
  'Identify manufacturer, exact equipment type, model/serial plate, capacity, and visible configuration.',
  'Separate casing, controls, electrical, mechanical, hydraulic, structural, and safety-system damage.',
  'Do not declare functional failure unless operation or decisive physical evidence supports it.',
];

export const ASSET_ASSESSMENT_PROFILES: Record<SupportedAssetType, AssetAssessmentProfile> = {
  vehicle: {
    family: 'vehicle', identificationMakeLabel: 'Make', identificationModelLabel: 'Model',
    conditionLabel: 'Overall Condition', evidenceTitle: 'Damage Evidence', summaryTitle: 'Damage Summary',
    valueLabel: 'Estimated Salvage Value', evidenceNoun: 'component',
    promptGuidance: ['Identify impact zones, structural intrusion, restraint deployment, glass, body, mechanical, electrical, wheel and suspension damage.', 'State side and position for every component where visible; do not infer hidden mechanical failure from exterior damage alone.'],
    evidenceExamples: ['shattered front windscreen', 'crushed left front door', 'deployed driver airbag'],
  },
  goods_in_transit: {
    family: 'unit_recovery', identificationMakeLabel: 'Brand / Consignment', identificationModelLabel: 'Goods / Packaging',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Affected Cargo / Loss Evidence', summaryTitle: 'Cargo Recovery Summary',
    valueLabel: 'Estimated Recovery Value', evidenceNoun: 'package or unit',
    promptGuidance: ['Identify consignment, packaging, visible count, seal integrity, missing/crushed/wet units, contamination and recoverable quantity.', 'Do not claim the full consignment count from partial photographs.'],
    evidenceExamples: ['water-soaked cartons', 'crushed pallet corner', 'missing sealed units'],
  },
  stock: {
    family: 'unit_recovery', identificationMakeLabel: 'Brand / Manufacturer', identificationModelLabel: 'Stock / Package',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Affected Stock / Loss Evidence', summaryTitle: 'Stock Recovery Summary',
    valueLabel: 'Estimated Recovery Value', evidenceNoun: 'stock unit or package',
    promptGuidance: ['Identify product, brand, pack size, visible quantity, packaging integrity, contamination, expiry/safety risk and recoverable units.', 'Distinguish clean saleable stock from damaged or quarantined stock.'],
    evidenceExamples: ['smoke-contaminated cartons', 'torn product sacks', 'water-damaged sealed stock'],
  },
  building_materials: {
    family: 'unit_recovery', identificationMakeLabel: 'Brand / Material', identificationModelLabel: 'Material / Unit Size',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Affected Materials / Loss Evidence', summaryTitle: 'Material Recovery Summary',
    valueLabel: 'Estimated Recovery Value', evidenceNoun: 'material unit',
    promptGuidance: ['Identify material, brand, size, visible count and water/fire/impact effects such as hardening, deformation, corrosion or broken packaging.', 'Treat pack weight separately from visible unit count.'],
    evidenceExamples: ['water-hardened cement bags', 'warped roofing sheets', 'cracked ceramic tiles'],
  },
  property: {
    family: 'building_sections', identificationMakeLabel: 'Building / Fixture Type', identificationModelLabel: 'Use / Affected Area',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Affected Sections / Fixtures', summaryTitle: 'Property Damage Summary',
    valueLabel: 'Estimated Recovery Value', evidenceNoun: 'section or fixture',
    promptGuidance: ['Identify building sections and fixtures, affected area, structural compromise, smoke/fire/water effects and electrical hazards.', 'Do not value land or unaffected building areas as damaged salvage.'],
    evidenceExamples: ['collapsed roof section', 'fire-damaged distribution board', 'water-swollen timber door'],
  },
  machinery: {
    family: 'repairable_equipment', identificationMakeLabel: 'Manufacturer', identificationModelLabel: 'Machine / Model',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Damaged Components', summaryTitle: 'Machinery Assessment Summary',
    valueLabel: 'Estimated Salvage Value', evidenceNoun: 'component', promptGuidance: equipmentGuidance,
    evidenceExamples: ['cracked control panel', 'bent hydraulic ram', 'fire-damaged engine wiring'],
  },
  electronics: {
    family: 'repairable_equipment', identificationMakeLabel: 'Brand', identificationModelLabel: 'Device / Model',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Damaged Components', summaryTitle: 'Device Assessment Summary',
    valueLabel: 'Estimated Salvage Value', evidenceNoun: 'component',
    promptGuidance: ['Identify exact device, model/storage/serial where visible, screen, casing, ports, cameras, battery and liquid/fire indicators.', 'Do not infer internal board or battery failure solely from exterior marks.'],
    evidenceExamples: ['shattered display glass', 'bent device chassis', 'corroded charging port'],
  },
  appliance: {
    family: 'repairable_equipment', identificationMakeLabel: 'Brand', identificationModelLabel: 'Appliance / Model',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Damaged Components', summaryTitle: 'Appliance Assessment Summary',
    valueLabel: 'Estimated Salvage Value', evidenceNoun: 'component',
    promptGuidance: ['Identify appliance type, model/capacity, housing, door, controls, motor/compressor, wiring and water/fire exposure.', 'Separate cosmetic casing damage from evidence of functional failure.'],
    evidenceExamples: ['dented refrigerator door', 'burnt compressor wiring', 'cracked control fascia'],
  },
  furniture: {
    family: 'contents', identificationMakeLabel: 'Brand / Maker', identificationModelLabel: 'Furniture Set / Item',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Affected Furniture / Damage Evidence', summaryTitle: 'Furniture Recovery Summary',
    valueLabel: 'Estimated Recovery Value', evidenceNoun: 'item or component',
    promptGuidance: ['Identify every visible furniture item in the lot and preserve set size, material, frame, upholstery, joints, surfaces, drawers and fittings.', 'State whether each item is cleanable, repairable, material-only recovery, or commercially unrecoverable.'],
    evidenceExamples: ['charred three-seater upholstery', 'water-swollen cabinet panels', 'split coffee-table top'],
  },
  scrap: {
    family: 'material_recovery', identificationMakeLabel: 'Material / Grade', identificationModelLabel: 'Scrap Lot',
    conditionLabel: 'Visible Grade', evidenceTitle: 'Material Condition / Recovery Evidence', summaryTitle: 'Scrap Recovery Summary',
    valueLabel: 'Estimated Recovery Value', evidenceNoun: 'material fraction',
    promptGuidance: ['Identify material class, grade, contamination, sorting state and approximate measurable quantity/weight.', 'Assess recoverable material grade, not repair cost or cosmetic condition.'],
    evidenceExamples: ['heat-warped steel sections', 'insulation-contaminated copper cable', 'ash-contaminated mixed ferrous scrap'],
  },
  agriculture: {
    family: 'unit_recovery', identificationMakeLabel: 'Commodity / Variety', identificationModelLabel: 'Produce / Stock Description',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Affected Agricultural Stock', summaryTitle: 'Agricultural Recovery Summary',
    valueLabel: 'Estimated Recovery Value', evidenceNoun: 'stock unit or lot',
    promptGuidance: ['Identify whether the subject is produce, seed, feed, or other livestock-related stock; assess quantity, moisture, mold, pests, spoilage and food/feed safety.', 'Farm machinery must be assessed as machinery, not as crop stock.'],
    evidenceExamples: ['mold-contaminated maize cobs', 'waterlogged feed bags', 'rotted harvested produce'],
  },
  medical_equipment: {
    family: 'repairable_equipment', identificationMakeLabel: 'Manufacturer', identificationModelLabel: 'Medical Device / Model',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Damaged Components / Safety Evidence', summaryTitle: 'Medical Equipment Summary',
    valueLabel: 'Estimated Salvage Value', evidenceNoun: 'component or sterile unit',
    promptGuidance: [...equipmentGuidance, 'Flag sterility breaches, contamination, calibration uncertainty and regulated resale restrictions without claiming clinical safety.'],
    evidenceExamples: ['cracked monitor display', 'fluid-contaminated sensor cable', 'broken sterile-package seal'],
  },
  energy_equipment: {
    family: 'repairable_equipment', identificationMakeLabel: 'Manufacturer', identificationModelLabel: 'Energy Equipment / Model',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Damaged Components / Hazard Evidence', summaryTitle: 'Energy Equipment Summary',
    valueLabel: 'Estimated Salvage Value', evidenceNoun: 'component',
    promptGuidance: [...equipmentGuidance, 'Assess pumps, valves, tanks, cables, panels, inverters, solar modules, corrosion, leakage and hazardous contamination.'],
    evidenceExamples: ['corroded pump housing', 'fire-damaged inverter board', 'oil-contaminated power cable'],
  },
  aviation_equipment: {
    family: 'repairable_equipment', identificationMakeLabel: 'Manufacturer', identificationModelLabel: 'Part / Ground Equipment',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Damaged Components / Airworthiness Evidence', summaryTitle: 'Aviation Equipment Summary',
    valueLabel: 'Estimated Salvage Value', evidenceNoun: 'component',
    promptGuidance: [...equipmentGuidance, 'Capture part/serial markings and impact, fire, water or missing-component evidence; never assert airworthiness from photographs.'],
    evidenceExamples: ['impact-damaged avionics casing', 'corroded connector pins', 'bent ground-support frame'],
  },
  jewelry: {
    family: 'specialist', identificationMakeLabel: 'Brand / Maker', identificationModelLabel: 'Item / Reference',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Condition / Authenticity Evidence', summaryTitle: 'Specialist Assessment Summary',
    valueLabel: 'Provisional Recovery Value', evidenceNoun: 'item or component',
    promptGuidance: ['Identify each distinct item, visible hallmark/reference/serial, material, stones, settings, case, movement and missing pieces.', 'Do not authenticate or assign precious-material purity from appearance alone; require specialist appraisal where material value dominates.'],
    evidenceExamples: ['cracked watch crystal', 'heat-discoloured gold bangle', 'missing stone from claw setting'],
  },
  other: {
    family: 'general', identificationMakeLabel: 'Brand / Category', identificationModelLabel: 'Asset Description',
    conditionLabel: 'Visible Condition', evidenceTitle: 'Observed Damage / Loss Evidence', summaryTitle: 'Recovery Assessment Summary',
    valueLabel: 'Estimated Recovery Value', evidenceNoun: 'item or affected area',
    promptGuidance: ['Identify the asset before assessing it, use domain-appropriate component/unit language, and distinguish repair, partial resale, material recovery and disposal.', 'Do not map unknown assets into vehicle or electronics categories.'],
    evidenceExamples: ['cracked outer housing', 'water-contaminated contents', 'missing detachable assembly'],
  },
};

export function getAssetAssessmentProfile(assetType?: string): AssetAssessmentProfile {
  return ASSET_ASSESSMENT_PROFILES[assetType as SupportedAssetType] || ASSET_ASSESSMENT_PROFILES.other;
}
