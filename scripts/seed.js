/**
 * Seed script for Forklift Fleet Manager
 * Populates the database with sample data for testing
 *
 * Usage: npm run seed
 */

const db = require('../config/database');

console.log('Starting database seed...\n');

// Clear existing data
console.log('Clearing existing data...');
db._data.locations = [];
db._data.forklifts = [];
db._data.maintenance_records = [];
db._data.alerts = [];
db._data.hour_logs = [];
db._data._meta.sequences = {
  locations: 1,
  maintenance_records: 1,
  alerts: 1,
  hour_logs: 1
};
db._save();
console.log('Existing data cleared.\n');

// ===== Seed Locations =====
console.log('Creating locations...');
const locations = [
  { name: 'Warehouse A', address: '123 Industrial Blvd, Building A', type: 'warehouse', capacity: 40 },
  { name: 'Warehouse B', address: '456 Logistics Way, Building B', type: 'warehouse', capacity: 35 },
  { name: 'Distribution Center', address: '789 Commerce Dr', type: 'distribution', capacity: 50 }
];

const locationIds = {};
locations.forEach(loc => {
  const created = db.locations.create(loc);
  locationIds[loc.name] = created.id;
  console.log(`  Created location: ${loc.name} (ID: ${created.id})`);
});
console.log(`Created ${locations.length} locations.\n`);

// ===== Seed Forklifts =====
console.log('Creating forklifts...');

const manufacturers = ['Toyota', 'Hyster', 'Crown', 'Yale', 'Caterpillar', 'Komatsu'];
const models = {
  Toyota: ['8FGU25', '8FGU30', '7FDU35', '8FBE15'],
  Hyster: ['H50FT', 'H60FT', 'E50XN', 'S50FT'],
  Crown: ['FC5200', 'SC5200', 'RC5500', 'C-5'],
  Yale: ['GLP050', 'ERC050', 'GDP080', 'MPB045'],
  Caterpillar: ['DP25N', 'EC25K', 'GP25K', 'NPP20'],
  Komatsu: ['FG25T-16', 'FB15-12', 'BX50', 'FD35AT-16']
};
const fuelTypes = ['electric', 'propane', 'diesel'];
const statuses = ['active', 'active', 'active', 'active', 'maintenance', 'out_of_service'];

const forklifts = [];
for (let i = 1; i <= 25; i++) {
  const manufacturer = manufacturers[Math.floor(Math.random() * manufacturers.length)];
  const model = models[manufacturer][Math.floor(Math.random() * models[manufacturer].length)];
  const locationName = Object.keys(locationIds)[Math.floor(Math.random() * Object.keys(locationIds).length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const operatingHours = Math.floor(Math.random() * 6000);
  const year = 2015 + Math.floor(Math.random() * 10);

  // Calculate risk level
  let riskScore = 0;
  if (operatingHours > 5000) riskScore += 3;
  else if (operatingHours > 3000) riskScore += 2;
  else if (operatingHours > 1000) riskScore += 1;
  if (status === 'out_of_service') riskScore += 3;
  else if (status === 'maintenance') riskScore += 1;

  const riskLevel = riskScore >= 6 ? 'high' : riskScore >= 3 ? 'medium' : 'low';

  // Generate dates
  const purchaseDate = new Date(year, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
  const lastServiceDate = new Date();
  lastServiceDate.setMonth(lastServiceDate.getMonth() - Math.floor(Math.random() * 6));

  const nextServiceDate = new Date(lastServiceDate);
  nextServiceDate.setMonth(nextServiceDate.getMonth() + 3);

  const forklift = {
    id: `FK-${String(i).padStart(3, '0')}`,
    location_id: locationIds[locationName],
    model,
    manufacturer,
    serial_number: `SN${year}${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
    year,
    fuel_type: fuelTypes[Math.floor(Math.random() * fuelTypes.length)],
    capacity_lbs: [3000, 4000, 5000, 6000, 8000][Math.floor(Math.random() * 5)],
    status,
    operating_hours: operatingHours,
    last_service_date: lastServiceDate.toISOString().split('T')[0],
    next_service_date: nextServiceDate.toISOString().split('T')[0],
    purchase_date: purchaseDate.toISOString().split('T')[0],
    purchase_price: 15000 + Math.floor(Math.random() * 35000),
    risk_level: riskLevel
  };

  db.forklifts.create(forklift);
  forklifts.push(forklift);
  console.log(`  Created forklift: ${forklift.id} - ${manufacturer} ${model}`);
}
console.log(`Created ${forklifts.length} forklifts.\n`);

// ===== Seed Maintenance Records =====
console.log('Creating maintenance records...');

const maintenanceTypes = ['routine', 'repair', 'inspection', 'emergency'];
const maintenanceDescriptions = {
  routine: [
    'Regular scheduled maintenance',
    'Oil change and filter replacement',
    'Hydraulic fluid check and top-off',
    'Tire inspection and rotation',
    'Battery maintenance and charging system check'
  ],
  repair: [
    'Replaced hydraulic hose',
    'Fixed brake system issue',
    'Repaired steering mechanism',
    'Replaced worn forks',
    'Fixed electrical wiring issue'
  ],
  inspection: [
    'Annual safety inspection',
    'Pre-operation safety check',
    'OSHA compliance inspection',
    'Insurance inspection',
    'Quarterly performance review'
  ],
  emergency: [
    'Emergency brake repair',
    'Critical hydraulic leak fix',
    'Steering failure repair',
    'Battery replacement due to failure',
    'Emergency tire replacement'
  ]
};

const technicians = ['John Smith', 'Mike Johnson', 'Sarah Davis', 'Tom Wilson', 'Lisa Brown'];

let maintenanceCount = 0;
forklifts.forEach(forklift => {
  // Generate 1-4 maintenance records per forklift
  const recordCount = 1 + Math.floor(Math.random() * 4);

  for (let i = 0; i < recordCount; i++) {
    const type = maintenanceTypes[Math.floor(Math.random() * maintenanceTypes.length)];
    const descriptions = maintenanceDescriptions[type];

    const serviceDate = new Date();
    serviceDate.setMonth(serviceDate.getMonth() - Math.floor(Math.random() * 12));

    const record = {
      forklift_id: forklift.id,
      type,
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      cost: type === 'emergency' ? 500 + Math.floor(Math.random() * 2000) :
            type === 'repair' ? 200 + Math.floor(Math.random() * 800) :
            50 + Math.floor(Math.random() * 200),
      technician: technicians[Math.floor(Math.random() * technicians.length)],
      parts_replaced: Math.random() > 0.5 ? 'Various parts' : null,
      hours_at_service: forklift.operating_hours - Math.floor(Math.random() * 500),
      service_date: serviceDate.toISOString().split('T')[0],
      status: 'completed'
    };

    db.maintenance.create(record);
    maintenanceCount++;
  }
});
console.log(`Created ${maintenanceCount} maintenance records.\n`);

// ===== Seed Alerts =====
console.log('Creating alerts...');

const alertTypes = ['maintenance', 'safety', 'operational', 'inspection'];
const alertTitles = {
  maintenance: [
    'Scheduled maintenance due',
    'Oil change required',
    'Battery inspection needed',
    'Hydraulic system check required',
    'Tire replacement recommended'
  ],
  safety: [
    'Safety inspection overdue',
    'Warning light active',
    'Brake system alert',
    'Seatbelt sensor malfunction',
    'Horn not functioning'
  ],
  operational: [
    'High operating hours',
    'Performance degradation detected',
    'Unusual noise reported',
    'Fuel efficiency below normal',
    'Load capacity exceeded warning'
  ],
  inspection: [
    'Annual inspection due',
    'OSHA compliance check needed',
    'Pre-operation check failed',
    'Certification expiring soon',
    'Insurance inspection required'
  ]
};

const alertSeverities = ['low', 'medium', 'high', 'critical'];

let alertCount = 0;

// Create some alerts without forklift association
for (let i = 0; i < 3; i++) {
  const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
  db.alerts.create({
    forklift_id: null,
    type,
    severity: alertSeverities[Math.floor(Math.random() * alertSeverities.length)],
    title: 'General fleet alert: ' + alertTitles[type][Math.floor(Math.random() * alertTitles[type].length)],
    message: 'This is a general alert affecting multiple units.'
  });
  alertCount++;
}

// Create alerts for forklifts
forklifts.forEach(forklift => {
  // Create 0-3 alerts per forklift
  const alertNum = Math.floor(Math.random() * 4);

  for (let i = 0; i < alertNum; i++) {
    const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const titles = alertTitles[type];

    const alert = db.alerts.create({
      forklift_id: forklift.id,
      type,
      severity: alertSeverities[Math.floor(Math.random() * alertSeverities.length)],
      title: titles[Math.floor(Math.random() * titles.length)],
      message: `Alert for forklift ${forklift.id}.`
    });

    // Resolve some alerts
    if (Math.random() > 0.6) {
      db.alerts.resolve(alert.id, technicians[Math.floor(Math.random() * technicians.length)]);
    }

    alertCount++;
  }
});
console.log(`Created ${alertCount} alerts.\n`);

// ===== Seed Hour Logs =====
console.log('Creating hour logs...');

let hourLogCount = 0;
forklifts.forEach(forklift => {
  // Create 3-8 hour log entries per forklift
  const logCount = 3 + Math.floor(Math.random() * 6);
  let currentHours = forklift.operating_hours;

  for (let i = 0; i < logCount; i++) {
    const logDate = new Date();
    logDate.setDate(logDate.getDate() - (i * 7)); // Weekly logs

    const hoursAtTime = currentHours - (i * Math.floor(Math.random() * 50 + 10));

    db._data.hour_logs.push({
      id: db._nextId('hour_logs'),
      forklift_id: forklift.id,
      hours: Math.max(0, hoursAtTime),
      logged_by: technicians[Math.floor(Math.random() * technicians.length)],
      logged_at: logDate.toISOString()
    });
    hourLogCount++;
  }
});
db._save();
console.log(`Created ${hourLogCount} hour logs.\n`);

// ===== Summary =====
console.log('='.repeat(50));
console.log('Database seeding completed successfully!');
console.log('='.repeat(50));
console.log('\nSummary:');
console.log(`  - Locations: ${locations.length}`);
console.log(`  - Forklifts: ${forklifts.length}`);
console.log(`  - Maintenance Records: ${maintenanceCount}`);
console.log(`  - Alerts: ${alertCount}`);
console.log(`  - Hour Logs: ${hourLogCount}`);
console.log('\nYou can now start the server with: npm run dev');
