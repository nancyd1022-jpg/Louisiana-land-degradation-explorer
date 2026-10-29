// Louisiana Land Degradation Explorer — Google Earth Engine Code Editor
// Annual MODIS NDVI/EVI comparison with a fixed 2001–2005 reference.
// Interpretation: potential vegetation degradation signals, NOT confirmed land degradation.
// Data: MODIS/061/MOD13Q1 (250 m); TIGER/2018/Counties.

var START_YEAR = 2001;
var END_YEAR = 2025; // Complete calendar years; extend after confirming dataset availability.
var BASE_START = 2001;
var BASE_END = 2005;
var SCALE = 250;
var MODERATE_NDVI = 0.08;
var MODERATE_EVI = 0.05;
var SEVERE_NDVI = 0.16;
var SEVERE_EVI = 0.10;

var parishes = ee.FeatureCollection('TIGER/2018/Counties')
  .filter(ee.Filter.eq('STATEFP', '22'));
var laBounds = parishes.geometry();
var modis = ee.ImageCollection('MODIS/061/MOD13Q1');

function prepareVI(img) {
  // MODLAND QA bits 0–1: accept only quality=0 (good VI data).
  var good = img.select('DetailedQA').bitwiseAnd(3).eq(0);
  return img.select(['NDVI', 'EVI'])
    .multiply(0.0001)
    .updateMask(good)
    .copyProperties(img, ['system:time_start']);
}

var vi = modis.map(prepareVI);

function annualVI(year) {
  year = ee.Number(year);
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = start.advance(1, 'year');
  // Yearly median reduces effects of individual 16-day composite anomalies.
  return vi.filterDate(start, end).median().rename(['NDVI', 'EVI']);
}

// Median of five annual composites, reducing uneven seasonal weighting.
var reference = ee.ImageCollection.fromImages(
  ee.List.sequence(BASE_START, BASE_END).map(function(y) {
    return annualVI(y);
  })
).median().rename(['NDVI', 'EVI']);

function makeResult(year, geom) {
  var current = annualVI(year).clip(geom);
  var baseline = reference.clip(geom);
  var loss = baseline.subtract(current);
  var valid = baseline.select('NDVI').gte(0.25)
    .and(baseline.select('EVI').gte(0.15))
    .and(current.select('NDVI').mask())
    .and(current.select('EVI').mask());
  var moderate = loss.select('NDVI').gte(MODERATE_NDVI)
    .and(loss.select('EVI').gte(MODERATE_EVI));
  var severe = loss.select('NDVI').gte(SEVERE_NDVI)
    .and(loss.select('EVI').gte(SEVERE_EVI));
  // 0: no detected decline; 1: moderate; 2: severe.
  var classes = ee.Image(0).where(moderate, 1).where(severe, 2)
    .rename('Degradation_Class').toByte().updateMask(valid).clip(geom);
  return {
    classes: classes,
    current: current,
    baseline: baseline,
    ndviLoss: loss.select('NDVI').rename('NDVI_Loss'),
    valid: valid.clip(geom)
  };
}

var map = ui.Map();
map.setOptions('HYBRID');
map.centerObject(parishes, 7);

var panel = ui.Panel({style: {width: '365px', padding: '14px'}});
panel.add(ui.Label('LOUISIANA LAND DEGRADATION', {
  fontSize: '19px', fontWeight: 'bold', color: '#173b32'
}));
panel.add(ui.Label('Interactive parish-level vegetation decline explorer', {
  fontSize: '12px', color: '#555555'
}));
panel.add(ui.Label('Select parish', {fontWeight: 'bold', margin: '16px 0 4px 0'}));

var parishSelect = ui.Select({items: ['Loading parishes...'],
  value: 'Loading parishes...', style: {stretch: 'horizontal'}});
panel.add(parishSelect);
panel.add(ui.Label('Select analysis year', {fontWeight: 'bold', margin: '12px 0 4px 0'}));
var years = [];
for (var y = START_YEAR; y <= END_YEAR; y++) years.push(String(y));
var yearSelect = ui.Select({items: years, value: '2024',
  style: {stretch: 'horizontal'}});
panel.add(yearSelect);

var runButton = ui.Button({label: 'RUN DEGRADATION ANALYSIS',
  style: {stretch: 'horizontal', backgroundColor: '#24745c', color: 'white'}});
runButton.setDisabled(true);
panel.add(runButton);
var status = ui.Label('Loading parish boundaries...', {color: '#555555'});
panel.add(status);
var statsPanel = ui.Panel();
panel.add(statsPanel);

panel.add(ui.Label('MAP LEGEND', {
  fontWeight: 'bold', margin: '16px 0 8px 0'
}));
function addLegendItem(hex, title) {
  panel.add(ui.Panel({widgets: [
    ui.Label('', {backgroundColor: hex, padding: '9px', margin: '2px 10px 2px 0'}),
    ui.Label(title, {margin: '3px 0 0 0'})
  ], layout: ui.Panel.Layout.flow('horizontal')}));
}
addLegendItem('#38a169', 'No detected decline');
addLegendItem('#f6ad42', 'Moderate decline');
addLegendItem('#cc3030', 'Severe decline');
panel.add(ui.Label('Uncolored areas: not evaluated or insufficient valid observations.',
  {fontSize: '11px', color: '#777777', margin: '8px 0 0 0'}));
panel.add(ui.Label('Method: NDVI & EVI annual medians compared with 2001–2005 reference. '+
  'Classification indicates potential vegetation decline, not verified land degradation. '+
  'Reference-period years (2001–2005) are compared partly with themselves.',
  {fontSize: '11px', color: '#555555', margin: '12px 0 0 0'}));

var exportButton = ui.Button({label: 'EXPORT CLASSIFICATION TO GOOGLE DRIVE',
  style: {stretch: 'horizontal', margin: '15px 0 0 0'}});
exportButton.setDisabled(true);
panel.add(exportButton);

ui.root.widgets().reset([panel, map]);
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));

var selectedExport = null;

function runAnalysis() {
  var name = parishSelect.getValue();
  var year = parseInt(yearSelect.getValue(), 10);
  if (!name || name === 'Loading parishes...') return;
  runButton.setDisabled(true);
  exportButton.setDisabled(true);
  status.setValue('Processing ' + name + ' Parish, ' + year + '...');
  statsPanel.clear();
  var parish = parishes.filter(ee.Filter.eq('NAME', name));
  var geom = parish.geometry();
  var result = makeResult(year, geom);

  map.layers().reset([]);
  map.addLayer(result.current.select('NDVI'),
    {min: 0, max: 0.85, palette: ['#8b4513', '#eddc79', '#75b85b', '#12643d']},
    'Annual NDVI ' + year, false);
  map.addLayer(result.ndviLoss,
    {min: -0.2, max: 0.25, palette: ['#2060a0', '#ffffff', '#e48340', '#a21616']},
    'NDVI change (baseline minus selected year)', false);
  map.addLayer(result.classes, {min: 0, max: 2,
    palette: ['#38a169', '#f6ad42', '#cc3030'], opacity: 0.80},
    'Potential degradation ' + year, true);
  map.addLayer(parish.style({color: '#ffffff', fillColor: '00000000', width: 2}),
    {}, name + ' Parish boundary', true);
  map.centerObject(parish, 10);

  // Count mutually exclusive area classes, in square kilometers.
  var area = ee.Image.pixelArea().divide(1e6);
  var areas = ee.Image.cat([
    area.updateMask(result.classes.eq(0)).rename('No_decline_km2'),
    area.updateMask(result.classes.eq(1)).rename('Moderate_km2'),
    area.updateMask(result.classes.eq(2)).rename('Severe_km2')
  ]).reduceRegion({reducer: ee.Reducer.sum(), geometry: geom,
    scale: SCALE, maxPixels: 1e10, tileScale: 4});

  areas.evaluate(function(values, error) {
    runButton.setDisabled(false);
    if (error || !values) {
      status.setValue('Statistics failed: ' + (error || 'No data'));
      return;
    }
    var clean = function(x) { return (typeof x === 'number') ? x : 0; };
    var no = clean(values.No_decline_km2);
    var moderate = clean(values.Moderate_km2);
    var severe = clean(values.Severe_km2);
    var assessed = no + moderate + severe;
    var degraded = moderate + severe;
    var percent = assessed > 0 ? (degraded / assessed * 100) : 0;
    var fmt = function(n) { return n.toFixed(2); };
    status.setValue('Map ready: ' + name + ' Parish (' + year + ')');
    statsPanel.clear();
    statsPanel.add(ui.Label('PARISH SUMMARY', {
      fontWeight: 'bold', fontSize: '15px', margin: '12px 0 6px 0'
    }));
    statsPanel.add(ui.Label('Assessed vegetated area: ' + fmt(assessed) + ' km²'));
    statsPanel.add(ui.Label('No detected decline: ' + fmt(no) + ' km²'));
    statsPanel.add(ui.Label('Moderate decline: ' + fmt(moderate) + ' km²'));
    statsPanel.add(ui.Label('Severe decline: ' + fmt(severe) + ' km²'));
    statsPanel.add(ui.Label('Potentially degraded: ' + fmt(degraded) + ' km²',
      {fontWeight: 'bold', color: '#aa2727'}));
    statsPanel.add(ui.Label('Share of assessed vegetation: ' + fmt(percent) + '%',
      {fontWeight: 'bold'}));
  });

  selectedExport = {
    image: result.classes.unmask(255).toByte().clip(geom),
    geom: geom, year: year, name: name
  };
  exportButton.setDisabled(false);
}

runButton.onClick(runAnalysis);
exportButton.onClick(function() {
  if (!selectedExport) return;
  Export.image.toDrive({
    image: selectedExport.image,
    description: 'LA_Degradation_' + selectedExport.name.replace(/\s+/g, '_') + '_' + selectedExport.year,
    folder: 'GEE_Louisiana_Degradation',
    fileNamePrefix: 'LA_Degradation_' + selectedExport.name.replace(/\s+/g, '_') + '_' + selectedExport.year,
    region: selectedExport.geom,
    scale: SCALE,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF'
  });
  status.setValue('Export task created. Open the GEE Tasks tab and click RUN.');
});

parishes.aggregate_array('NAME').distinct().sort().evaluate(function(names, error) {
  if (error || !names || !names.length) {
    status.setValue('Failed to load parishes: ' + (error || 'No records'));
    return;
  }
  parishSelect.items().reset(names);
  parishSelect.setValue(names.indexOf('East Baton Rouge') >= 0
    ? 'East Baton Rouge' : names[0]);
  status.setValue('Choose a parish and a year, then click RUN.');
  runButton.setDisabled(false);
});
