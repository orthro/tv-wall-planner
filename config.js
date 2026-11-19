// Brand + option data — the only place to change names, contact email and choices.
window.BRAND = {
  name: 'Northline Interiors',          // placeholder brand — replace with your own
  tagline: 'Custom feature walls & built-ins',
  siteUrl: '#',
  email: ''                              // set to an address to enable the "Send" button (mailto)
};

// Helper: o('id', 'Label', '#hex') -> option object
function o(id, label, hex) { return hex ? { id: id, label: label, hex: hex } : { id: id, label: label }; }

window.OPTIONS = {
  wallColor: [o('white', 'Soft white', '#EEEAE3'), o('greige', 'Warm greige', '#CFC6B8'), o('sage', 'Sage', '#A9B3A0'), o('charcoal', 'Charcoal', '#4A4A48'), o('navy', 'Navy', '#2E3A4F')],
  floor: [o('lightOak', 'Light oak', '#C9A97C'), o('walnut', 'Walnut', '#6B4A32'), o('greyTile', 'Grey tile', '#9A9893'), o('carpet', 'Carpet', '#BDB5A8')],
  ceiling: [o('flat', 'Flat'), o('cove', 'Lit cove'), o('beam', 'Wood beam')],
  fireplace: [o('none', 'No fireplace'), o('linear60', 'Linear electric 60"'), o('linear72', 'Linear electric 72"')],
  fireplaceFrame: [o('flush', 'Flush, no frame'), o('stone', 'Stone surround'), o('metal', 'Black metal frame')],
  layout: [o('full', 'Full-width wall'), o('center', 'Centered feature panel'), o('niches', 'TV panel with side niches')],
  facing: [o('paint', 'Painted'), o('woodVeneer', 'Wood veneer'), o('stone', 'Stone-look porcelain'), o('microcement', 'Microcement')],
  panelColor: [o('white', 'Soft white', '#EEEAE3'), o('greige', 'Warm greige', '#CFC6B8'), o('charcoal', 'Charcoal', '#3F3F3D'), o('black', 'Matte black', '#1E1E1E'), o('oak', 'Oak', '#B88A5A'), o('walnut', 'Walnut', '#5E3F2B')],
  niches: [o('none', 'None'), o('side', 'Side niches'), o('shelves', 'Floating shelves'), o('both', 'Niches + shelves')],
  cabinetry: [o('none', 'None'), o('floating', 'Floating media console'), o('base', 'Full-width base cabinets')],
  cabinetFinish: [o('white', 'Matte white', '#EDEBE6'), o('black', 'Matte black', '#232323'), o('oak', 'Oak', '#B88A5A'), o('walnut', 'Walnut', '#5E3F2B')],
  nicheInterior: [o('match', 'Match the wall'), o('dark', 'Dark contrast', '#2B2A28'), o('wood', 'Wood', '#A8784C')],
  led: [o('off', 'Off'), o('warm', 'Warm white', '#FFC98A'), o('neutral', 'Neutral white', '#FFF1DC'), o('cool', 'Cool white', '#DDE9FF')],
  slats: [o('none', 'None'), o('sides', 'Slats on the sides'), o('behind', 'Slats behind the TV')],
  slatTone: [o('oak', 'Natural oak', '#B88A5A'), o('walnut', 'Walnut', '#5E3F2B'), o('black', 'Black', '#1E1E1E')],
  reveals: [o('none', 'None'), o('brass', 'Brushed brass', '#B08D57'), o('black', 'Black', '#151515')],
  budget: [o('na', 'Prefer not to say'), o('lt5', 'Under $5,000'), o('5to10', '$5,000–$10,000'), o('10to20', '$10,000–$20,000'), o('20to40', '$20,000–$40,000'), o('40p', '$40,000+'), o('unsure', 'Not sure yet')],
  timeline: [o('na', 'Prefer not to say'), o('asap', 'As soon as possible'), o('m1to2', 'Within 1–2 months'), o('m3to6', 'Within 3–6 months'), o('m6p', 'More than 6 months'), o('exploring', 'Just exploring')]
};

// Field labels shown above each option group
window.LABELS = {
  wallColor: 'Existing wall colour', floor: 'Existing floor', ceiling: 'Ceiling over the wall',
  fireplace: 'Fireplace', fireplaceFrame: 'Fireplace frame', layout: 'Wall layout',
  facing: 'Main wall facing', panelColor: 'Panel colour', niches: 'Niches or shelves',
  cabinetry: 'Cabinetry below', cabinetFinish: 'Cabinet and shelf finish',
  nicheInterior: 'Niche and recess interiors', led: 'LED accent (band above the TV)',
  slats: 'Slat panels', slatTone: 'Slat tone', reveals: 'Metal reveals',
  budget: 'Budget (optional)', timeline: 'Timeline (optional)'
};

window.STEPS = [
  { title: 'Room', keys: ['wallColor', 'floor', 'ceiling'] },
  { title: 'Fireplace', keys: ['fireplace', 'fireplaceFrame'] },
  { title: 'Wall design', keys: ['layout', 'facing', 'panelColor'] },
  { title: 'Storage', keys: ['niches', 'cabinetry', 'cabinetFinish', 'nicheInterior'] },
  { title: 'Details', keys: ['led', 'slats', 'slatTone', 'reveals'] },
  { title: 'Your project', keys: ['photos', 'budget', 'timeline', 'notes'] },
  { title: 'Contact', keys: ['contact'] }
];

// Ready-made starting points. Each sets every design key (ids must exist in OPTIONS above);
// budget, timeline, notes and contact details are never touched by a preset.
window.PRESETS = [
  { id: 'walnut', name: 'Warm walnut', blurb: 'Walnut veneer, linear fire, lit niches',
    values: { wallColor: 'greige', floor: 'lightOak', ceiling: 'cove', fireplace: 'linear72', fireplaceFrame: 'flush', layout: 'niches', facing: 'woodVeneer', panelColor: 'walnut', niches: 'both', cabinetry: 'floating', cabinetFinish: 'walnut', nicheInterior: 'dark', led: 'warm', slats: 'none', slatTone: 'walnut', reveals: 'brass' } },
  { id: 'minimal', name: 'Modern minimal', blurb: 'Soft white panel, floating console',
    values: { wallColor: 'white', floor: 'lightOak', ceiling: 'flat', fireplace: 'none', fireplaceFrame: 'flush', layout: 'center', facing: 'paint', panelColor: 'white', niches: 'none', cabinetry: 'floating', cabinetFinish: 'white', nicheInterior: 'match', led: 'neutral', slats: 'none', slatTone: 'oak', reveals: 'none' } },
  { id: 'luxe', name: 'Dark luxe', blurb: 'Black stone, walnut slats, metal fire',
    values: { wallColor: 'charcoal', floor: 'walnut', ceiling: 'beam', fireplace: 'linear60', fireplaceFrame: 'metal', layout: 'full', facing: 'stone', panelColor: 'black', niches: 'none', cabinetry: 'base', cabinetFinish: 'black', nicheInterior: 'dark', led: 'warm', slats: 'behind', slatTone: 'walnut', reveals: 'black' } },
  { id: 'scandi', name: 'Scandi oak', blurb: 'Microcement, oak slats and shelves',
    values: { wallColor: 'white', floor: 'lightOak', ceiling: 'flat', fireplace: 'none', fireplaceFrame: 'flush', layout: 'full', facing: 'microcement', panelColor: 'greige', niches: 'shelves', cabinetry: 'floating', cabinetFinish: 'oak', nicheInterior: 'wood', led: 'warm', slats: 'sides', slatTone: 'oak', reveals: 'none' } }
];
