/**
 * Enterprise Seed Script
 * Populates database with realistic fleet data
 */

const bcrypt = require('bcryptjs');
const db = require('../config/sqlite-database');

// Configuration
const NUM_LOCATIONS = 5;
const NUM_FORKLIFTS = 150;
const MAINTENANCE_RECORDS_PER_UNIT = 8;
const DAYS_OF_HISTORY = 365;

// Manufacturers and models
const MANUFACTURERS = [
    { name: 'Toyota', models: ['8FGU25', '8FGCU25', '7FBCU25', '8FBE18U'] },
    { name: 'Crown', models: ['FC5200', 'RC5500', 'PE4500', 'SC5300'] },
    { name: 'Hyster', models: ['H50FT', 'H60FT', 'E50XN', 'J40XNT'] },
    { name: 'Yale', models: ['GLP050VX', 'ERP040VT', 'MPB045VG', 'OS030BF'] },
    { name: 'Raymond', models: ['4150', '4250', '8210', '8610'] }
];

const FUEL_TYPES = ['electric', 'propane', 'diesel'];
const LOCATIONS = [
    { name: 'Atlanta Distribution Center', city: 'Atlanta', state: 'GA', type: 'distribution_center',
      service_center_phone: '(404) 555-0101', service_center_email: 'service.atlanta@forkliftpro.com', service_center_contact: 'Mike Johnson' },
    { name: 'Dallas Warehouse', city: 'Dallas', state: 'TX', type: 'warehouse',
      service_center_phone: '(214) 555-0202', service_center_email: 'service.dallas@forkliftpro.com', service_center_contact: 'Sarah Williams' },
    { name: 'Chicago Manufacturing', city: 'Chicago', state: 'IL', type: 'manufacturing',
      service_center_phone: '(312) 555-0303', service_center_email: 'service.chicago@forkliftpro.com', service_center_contact: 'David Chen' },
    { name: 'Phoenix Fulfillment', city: 'Phoenix', state: 'AZ', type: 'distribution_center',
      service_center_phone: '(602) 555-0404', service_center_email: 'service.phoenix@forkliftpro.com', service_center_contact: 'Maria Garcia' },
    { name: 'Seattle Logistics Hub', city: 'Seattle', state: 'WA', type: 'warehouse',
      service_center_phone: '(206) 555-0505', service_center_email: 'service.seattle@forkliftpro.com', service_center_contact: 'Robert Thompson' }
];

const MAINTENANCE_TYPES = ['preventive', 'repair', 'emergency', 'inspection'];
const MAINTENANCE_CATEGORIES = ['engine', 'transmission', 'hydraulic', 'electrical', 'tires', 'brakes', 'mast', 'battery', 'fuel_system', 'safety', 'general'];
const ROOT_CAUSES = ['mechanical_failure', 'electrical_failure', 'operator_error', 'parts_delay', 'maintenance', 'other'];
const RENTAL_COMPANIES = ['United Rentals', 'Sunbelt Rentals', 'Herc Rentals', 'NEFF Rental'];

// Expected repair times (industry standard labor hours for common repairs)
const EXPECTED_REPAIR_TIMES = [
    { code: 'TIRE-LOAD', name: 'Load Wheel Replacement', category: 'tires', expected_hours: 2.0, min_hours: 1.5, max_hours: 2.5 },
    { code: 'TIRE-DRIVE', name: 'Drive Wheel Replacement', category: 'tires', expected_hours: 3.0, min_hours: 2.5, max_hours: 4.0 },
    { code: 'TIRE-STEER', name: 'Steer Wheel Replacement', category: 'tires', expected_hours: 2.5, min_hours: 2.0, max_hours: 3.0 },
    { code: 'BRAKE-PAD', name: 'Brake Pad Replacement', category: 'brakes', expected_hours: 2.0, min_hours: 1.5, max_hours: 2.5 },
    { code: 'BRAKE-DRUM', name: 'Brake Drum Service', category: 'brakes', expected_hours: 4.0, min_hours: 3.0, max_hours: 5.0 },
    { code: 'HYD-HOSE', name: 'Hydraulic Hose Replacement', category: 'hydraulic', expected_hours: 1.5, min_hours: 1.0, max_hours: 2.0 },
    { code: 'HYD-PUMP', name: 'Hydraulic Pump Replacement', category: 'hydraulic', expected_hours: 6.0, min_hours: 5.0, max_hours: 8.0 },
    { code: 'HYD-CYL', name: 'Hydraulic Cylinder Repair', category: 'hydraulic', expected_hours: 4.0, min_hours: 3.0, max_hours: 5.0 },
    { code: 'HYD-SEAL', name: 'Hydraulic Seal Kit Installation', category: 'hydraulic', expected_hours: 3.0, min_hours: 2.0, max_hours: 4.0 },
    { code: 'MAST-CHAIN', name: 'Mast Chain Replacement', category: 'mast', expected_hours: 3.0, min_hours: 2.5, max_hours: 4.0 },
    { code: 'MAST-ROLLER', name: 'Mast Roller Replacement', category: 'mast', expected_hours: 2.5, min_hours: 2.0, max_hours: 3.5 },
    { code: 'MAST-FORK', name: 'Fork Replacement', category: 'mast', expected_hours: 1.5, min_hours: 1.0, max_hours: 2.0 },
    { code: 'ELEC-MOTOR', name: 'Electric Motor Replacement', category: 'electrical', expected_hours: 5.0, min_hours: 4.0, max_hours: 6.0 },
    { code: 'ELEC-CONTACTOR', name: 'Contactor Replacement', category: 'electrical', expected_hours: 2.0, min_hours: 1.5, max_hours: 3.0 },
    { code: 'ELEC-WIRING', name: 'Wiring Harness Repair', category: 'electrical', expected_hours: 3.0, min_hours: 2.0, max_hours: 4.0 },
    { code: 'BATT-REPLACE', name: 'Battery Replacement', category: 'battery', expected_hours: 1.5, min_hours: 1.0, max_hours: 2.0 },
    { code: 'BATT-CABLE', name: 'Battery Cable Replacement', category: 'battery', expected_hours: 1.0, min_hours: 0.5, max_hours: 1.5 },
    { code: 'BATT-CHARGER', name: 'Charger Repair/Replacement', category: 'battery', expected_hours: 2.0, min_hours: 1.5, max_hours: 3.0 },
    { code: 'ENG-TUNE', name: 'Engine Tune-Up', category: 'engine', expected_hours: 3.0, min_hours: 2.0, max_hours: 4.0 },
    { code: 'ENG-STARTER', name: 'Starter Motor Replacement', category: 'engine', expected_hours: 2.5, min_hours: 2.0, max_hours: 3.5 },
    { code: 'ENG-ALT', name: 'Alternator Replacement', category: 'engine', expected_hours: 2.0, min_hours: 1.5, max_hours: 2.5 },
    { code: 'ENG-OVERHAUL', name: 'Engine Overhaul', category: 'engine', expected_hours: 16.0, min_hours: 12.0, max_hours: 24.0 },
    { code: 'TRANS-FLUID', name: 'Transmission Fluid Change', category: 'transmission', expected_hours: 1.5, min_hours: 1.0, max_hours: 2.0 },
    { code: 'TRANS-OVERHAUL', name: 'Transmission Overhaul', category: 'transmission', expected_hours: 12.0, min_hours: 10.0, max_hours: 16.0 },
    { code: 'FUEL-FILTER', name: 'Fuel Filter Replacement', category: 'fuel_system', expected_hours: 0.5, min_hours: 0.25, max_hours: 1.0 },
    { code: 'FUEL-PUMP', name: 'Fuel Pump Replacement', category: 'fuel_system', expected_hours: 2.5, min_hours: 2.0, max_hours: 3.5 },
    { code: 'FUEL-INJ', name: 'Fuel Injector Service', category: 'fuel_system', expected_hours: 3.0, min_hours: 2.0, max_hours: 4.0 },
    { code: 'SAFE-BELT', name: 'Seat Belt Replacement', category: 'safety', expected_hours: 0.5, min_hours: 0.25, max_hours: 1.0 },
    { code: 'SAFE-HORN', name: 'Horn/Alarm Replacement', category: 'safety', expected_hours: 0.5, min_hours: 0.25, max_hours: 1.0 },
    { code: 'SAFE-LIGHT', name: 'Safety Light Replacement', category: 'safety', expected_hours: 0.5, min_hours: 0.25, max_hours: 0.75 },
    { code: 'PM-250', name: '250-Hour PM Service', category: 'general', expected_hours: 2.0, min_hours: 1.5, max_hours: 2.5 },
    { code: 'PM-500', name: '500-Hour PM Service', category: 'general', expected_hours: 3.0, min_hours: 2.5, max_hours: 4.0 },
    { code: 'PM-1000', name: '1000-Hour PM Service', category: 'general', expected_hours: 4.0, min_hours: 3.5, max_hours: 5.0 },
    { code: 'PM-2000', name: '2000-Hour Major PM', category: 'general', expected_hours: 6.0, min_hours: 5.0, max_hours: 8.0 }
];

// Helper functions
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const randomDate = (daysBack) => {
    const date = new Date();
    date.setDate(date.getDate() - randomInt(0, daysBack));
    return date.toISOString().split('T')[0];
};
const generateForkliftId = (index) => {
    const prefix = ['FL', 'FT', 'FK', 'FE'][Math.floor(index / 100) % 4];
    return `${prefix}-${String(index + 1).padStart(4, '0')}`;
};

async function seed() {
    console.log('🚀 Starting Enterprise Seed...\n');

    // Create users
    console.log('Creating users...');
    const users = [
        { email: 'admin@fleetmanager.com', first_name: 'Admin', last_name: 'User', role: 'admin', password: 'admin123' },
        { email: 'manager@fleetmanager.com', first_name: 'Fleet', last_name: 'Manager', role: 'fleet_manager', password: 'manager123' },
        { email: 'tech@fleetmanager.com', first_name: 'Service', last_name: 'Technician', role: 'technician', password: 'tech123' },
        { email: 'viewer@fleetmanager.com', first_name: 'Report', last_name: 'Viewer', role: 'viewer', password: 'viewer123' }
    ];

    const createdUsers = [];
    for (const userData of users) {
        const existing = db.users.findByEmail(userData.email);
        if (!existing) {
            const password_hash = await bcrypt.hash(userData.password, 10);
            const user = db.users.create({ ...userData, password_hash });
            createdUsers.push(user);
            console.log(`  ✓ Created user: ${userData.email}`);
        } else {
            createdUsers.push(existing);
            console.log(`  - User exists: ${userData.email}`);
        }
    }

    // Create locations
    console.log('\nCreating locations...');
    const createdLocations = [];
    for (const locData of LOCATIONS) {
        const existing = db.locations.findByName(locData.name);
        if (!existing) {
            const location = db.locations.create({
                ...locData,
                address: `${randomInt(100, 9999)} Industrial Pkwy`,
                zip_code: String(randomInt(10000, 99999)),
                capacity: randomInt(30, 80),
                manager_id: createdUsers[1].id,
                service_center_phone: locData.service_center_phone,
                service_center_email: locData.service_center_email,
                service_center_contact: locData.service_center_contact
            });
            createdLocations.push(location);
            console.log(`  ✓ Created location: ${locData.name}`);
        } else {
            // Update existing location with service center info
            db.locations.update(existing.id, {
                service_center_phone: locData.service_center_phone,
                service_center_email: locData.service_center_email,
                service_center_contact: locData.service_center_contact
            });
            createdLocations.push(db.locations.findById(existing.id));
            console.log(`  ✓ Updated location: ${locData.name} (added service center info)`);
        }
    }

    // Create expected repair times reference data
    console.log('\nCreating expected repair times...');
    for (const repair of EXPECTED_REPAIR_TIMES) {
        try {
            db.raw.prepare(`
                INSERT OR IGNORE INTO expected_repair_times
                (repair_code, repair_name, category, expected_hours, min_hours, max_hours, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                repair.code,
                repair.name,
                repair.category,
                repair.expected_hours,
                repair.min_hours,
                repair.max_hours,
                repair.name
            );
        } catch (e) {
            // Ignore if already exists
        }
    }
    console.log(`  ✓ Created ${EXPECTED_REPAIR_TIMES.length} expected repair times`);

    // Create forklifts
    console.log('\nCreating forklifts...');
    const createdForklifts = [];

    for (let i = 0; i < NUM_FORKLIFTS; i++) {
        const forkliftId = generateForkliftId(i);
        const existing = db.forklifts.findById(forkliftId);

        if (!existing) {
            const manufacturer = randomItem(MANUFACTURERS);
            const model = randomItem(manufacturer.models);
            const yearAge = randomInt(1, 12);
            const year = new Date().getFullYear() - yearAge;
            const hours = randomInt(500, 20000);
            const purchasePrice = randomInt(20000, 45000);

            // Assign to a location (distribute evenly with some variation)
            const locationIndex = Math.floor(i / (NUM_FORKLIFTS / createdLocations.length)) % createdLocations.length;
            const location = createdLocations[locationIndex];

            // Calculate risk score based on age and hours
            let riskScore = 1;
            if (yearAge > 8) riskScore += 3;
            else if (yearAge > 5) riskScore += 2;
            else if (yearAge > 3) riskScore += 1;

            if (hours > 15000) riskScore += 3;
            else if (hours > 10000) riskScore += 2;
            else if (hours > 5000) riskScore += 1;

            riskScore = Math.min(10, riskScore + randomInt(0, 2));

            const riskLevel = riskScore >= 9 ? 'critical' :
                              riskScore >= 7 ? 'high' :
                              riskScore >= 4 ? 'medium' : 'low';

            // Determine status based on risk
            let status = 'active';
            if (riskScore >= 9 && Math.random() < 0.3) status = 'out_of_service';
            else if (Math.random() < 0.1) status = 'maintenance';

            // Calculate next service
            const lastServiceDate = randomDate(randomInt(30, 180));
            const nextServiceDate = new Date(lastServiceDate);
            nextServiceDate.setDate(nextServiceDate.getDate() + 90);
            const nextServiceHours = hours + 250;

            const forklift = db.forklifts.create({
                id: forkliftId,
                location_id: location.id,
                model,
                manufacturer: manufacturer.name,
                serial_number: `${manufacturer.name.substring(0, 2).toUpperCase()}${randomInt(100000, 999999)}`,
                year,
                fuel_type: randomItem(FUEL_TYPES),
                capacity_lbs: randomItem([3000, 4000, 5000, 6000, 8000]),
                status,
                current_hours: hours,
                last_hour_reading: hours,
                last_service_date: lastServiceDate,
                next_service_date: nextServiceDate.toISOString().split('T')[0],
                next_service_hours: nextServiceHours,
                purchase_date: `${year}-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`,
                purchase_price: purchasePrice,
                current_value: Math.round(purchasePrice * Math.pow(0.85, yearAge)),
                risk_score: riskScore,
                risk_level: riskLevel,
                service_interval_hours: 250,
                service_interval_days: 90
            });

            createdForklifts.push(forklift);

            if ((i + 1) % 25 === 0) {
                console.log(`  ✓ Created ${i + 1}/${NUM_FORKLIFTS} forklifts...`);
            }
        } else {
            createdForklifts.push(existing);
        }
    }
    console.log(`  ✓ Total forklifts: ${createdForklifts.length}`);

    // Create maintenance records
    console.log('\nCreating maintenance records...');
    let maintenanceCount = 0;

    // Get repairs by category for matching
    const repairsByCategory = {};
    for (const repair of EXPECTED_REPAIR_TIMES) {
        if (!repairsByCategory[repair.category]) {
            repairsByCategory[repair.category] = [];
        }
        repairsByCategory[repair.category].push(repair);
    }

    for (const forklift of createdForklifts) {
        const numRecords = randomInt(3, MAINTENANCE_RECORDS_PER_UNIT);

        for (let i = 0; i < numRecords; i++) {
            const type = randomItem(MAINTENANCE_TYPES);
            const category = randomItem(MAINTENANCE_CATEGORIES);
            const isCompleted = Math.random() < 0.9;
            const serviceDate = randomDate(DAYS_OF_HISTORY);

            // Get a matching repair type for this category if available
            const categoryRepairs = repairsByCategory[category] || repairsByCategory['general'];
            const matchedRepair = categoryRepairs ? randomItem(categoryRepairs) : null;

            // Expected labor hours based on matched repair or type defaults
            let expectedLaborHours = matchedRepair ? matchedRepair.expected_hours :
                                    (type === 'preventive' ? 2.0 :
                                     type === 'repair' ? 3.0 :
                                     type === 'emergency' ? 4.0 : 1.5);

            // Actual labor hours - most within range, some overruns
            let laborHours;
            if (Math.random() < 0.85) {
                // Normal - within expected range (+/- 25%)
                laborHours = expectedLaborHours * randomFloat(0.75, 1.25);
            } else if (Math.random() < 0.7) {
                // Minor overrun - 1.5x to 2x expected
                laborHours = expectedLaborHours * randomFloat(1.5, 2.0);
            } else {
                // Major overrun - 2x to 4x expected (like load wheel taking 6 hrs instead of 2)
                laborHours = expectedLaborHours * randomFloat(2.0, 4.0);
            }
            laborHours = Math.round(laborHours * 10) / 10; // Round to 1 decimal

            const laborCost = Math.round(laborHours * randomInt(75, 125)); // $75-125/hour rate
            const partsCost = type === 'preventive' ? randomInt(50, 200) :
                             type === 'repair' ? randomInt(100, 600) :
                             type === 'emergency' ? randomInt(200, 1000) : 0;

            // Generate invoice number for completed work
            const invoiceNumber = isCompleted ? `INV-${new Date(serviceDate).getFullYear()}-${String(maintenanceCount + 1).padStart(5, '0')}` : null;
            const workOrderNumber = `WO-${String(randomInt(10000, 99999))}`;

            // Description based on matched repair
            const description = matchedRepair ?
                `${matchedRepair.name} - ${forklift.id}` :
                `${type.charAt(0).toUpperCase() + type.slice(1)} maintenance - ${category}`;

            const workPerformed = matchedRepair ?
                `${matchedRepair.name}: Performed ${type} service. Standard time: ${expectedLaborHours}h, Actual time: ${laborHours}h` :
                `Performed ${type} service on ${category} system`;

            db.maintenance.create({
                forklift_id: forklift.id,
                type,
                category,
                description,
                work_performed: workPerformed,
                service_date: serviceDate,
                completion_date: isCompleted ? serviceDate : null,
                status: isCompleted ? 'completed' : 'scheduled',
                priority: type === 'emergency' ? 'critical' : type === 'repair' ? 'high' : 'medium',
                hours_at_service: forklift.current_hours - randomInt(0, 500),
                labor_hours: laborHours,
                expected_labor_hours: expectedLaborHours,
                labor_cost: laborCost,
                parts_cost: partsCost,
                technician_name: `Tech ${randomInt(1, 10)}`,
                service_provider: Math.random() < 0.3 ? 'External Vendor' : 'In-House',
                work_order_number: workOrderNumber,
                invoice_number: invoiceNumber,
                created_by: createdUsers[2].id
            });

            maintenanceCount++;
        }
    }
    console.log(`  ✓ Created ${maintenanceCount} maintenance records`);

    // Create hour meter readings
    console.log('\nCreating hour meter history...');
    let readingsCount = 0;

    for (const forklift of createdForklifts) {
        // Create 10-20 historical readings
        const numReadings = randomInt(10, 20);
        let currentReading = forklift.current_hours - (numReadings * randomInt(30, 80));
        currentReading = Math.max(0, currentReading);

        for (let i = 0; i < numReadings; i++) {
            const increment = randomInt(20, 80);
            currentReading += increment;

            // Occasionally create anomalies
            let flagged = false;
            let flagReason = null;

            if (Math.random() < 0.02) { // 2% chance of anomaly
                flagged = true;
                flagReason = Math.random() < 0.5 ? 'Unusually large jump' : 'Suspicious pattern detected';
            }

            const readingDate = new Date();
            readingDate.setDate(readingDate.getDate() - (numReadings - i) * randomInt(5, 15));

            db.raw.prepare(`
                INSERT INTO hour_meter_readings (
                    forklift_id, reading, previous_reading, reading_delta,
                    source, recorded_by, recorded_at, is_flagged, flag_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                forklift.id,
                currentReading,
                currentReading - increment,
                increment,
                Math.random() < 0.8 ? 'manual' : 'api',
                createdUsers[randomInt(0, 2)].id,
                readingDate.toISOString(),
                flagged ? 1 : 0,
                flagReason
            );

            readingsCount++;
        }
    }
    console.log(`  ✓ Created ${readingsCount} hour meter readings`);

    // Create downtime events
    console.log('\nCreating downtime events...');
    let downtimeCount = 0;

    for (const forklift of createdForklifts) {
        if (Math.random() < 0.4) { // 40% of forklifts have downtime history
            const numEvents = randomInt(1, 4);

            for (let i = 0; i < numEvents; i++) {
                const startTime = new Date();
                startTime.setDate(startTime.getDate() - randomInt(10, DAYS_OF_HISTORY));

                const duration = randomFloat(2, 72);
                const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
                const isResolved = endTime < new Date();

                db.downtime.create({
                    forklift_id: forklift.id,
                    start_time: startTime.toISOString(),
                    end_time: isResolved ? endTime.toISOString() : null,
                    duration_hours: isResolved ? duration : null,
                    type: randomItem(['unplanned', 'planned', 'emergency']),
                    root_cause: randomItem(ROOT_CAUSES),
                    root_cause_detail: 'Equipment malfunction requiring service',
                    impact_level: randomItem(['low', 'medium', 'high']),
                    cost_per_hour_down: randomInt(100, 250),
                    status: isResolved ? 'resolved' : 'active',
                    reported_by: createdUsers[randomInt(1, 3)].id
                });

                downtimeCount++;
            }
        }
    }
    console.log(`  ✓ Created ${downtimeCount} downtime events`);

    // Create rental records
    console.log('\nCreating rental records...');
    let rentalCount = 0;

    for (const forklift of createdForklifts) {
        if (Math.random() < 0.15) { // 15% have rental history
            const numRentals = randomInt(1, 2);

            for (let i = 0; i < numRentals; i++) {
                const startDate = randomDate(DAYS_OF_HISTORY);
                const days = randomInt(3, 21);
                const dailyRate = randomInt(75, 200);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + days);
                const isReturned = endDate < new Date();

                db.rentals.create({
                    forklift_id: forklift.id,
                    rental_company: randomItem(RENTAL_COMPANIES),
                    rental_equipment_type: 'Forklift',
                    start_date: startDate,
                    end_date: isReturned ? endDate.toISOString().split('T')[0] : null,
                    daily_rate: dailyRate,
                    delivery_fee: randomInt(50, 200),
                    pickup_fee: randomInt(50, 150),
                    reason: 'Equipment down for repair',
                    status: isReturned ? 'returned' : 'active',
                    created_by: createdUsers[1].id
                });

                // Close returned rentals
                if (isReturned) {
                    const rental = db.raw.prepare('SELECT id FROM rental_records ORDER BY id DESC LIMIT 1').get();
                    const totalCost = (dailyRate * days) + randomInt(100, 350);
                    db.raw.prepare(`
                        UPDATE rental_records
                        SET actual_return_date = ?, total_cost = ?, status = 'returned'
                        WHERE id = ?
                    `).run(endDate.toISOString().split('T')[0], totalCost, rental.id);
                }

                rentalCount++;
            }
        }
    }
    console.log(`  ✓ Created ${rentalCount} rental records`);

    // Create alerts
    console.log('\nCreating alerts...');
    let alertCount = 0;

    for (const forklift of createdForklifts) {
        // High risk alerts
        if (forklift.risk_score >= 7) {
            db.alerts.create({
                forklift_id: forklift.id,
                type: 'high_risk',
                severity: forklift.risk_score >= 9 ? 'critical' : 'high',
                title: `High Risk Unit: ${forklift.id}`,
                message: `Risk score ${forklift.risk_score}/10. Consider replacement planning.`,
                context_data: { risk_score: forklift.risk_score }
            });
            alertCount++;
        }

        // Maintenance due alerts
        if (forklift.next_service_date && new Date(forklift.next_service_date) < new Date()) {
            db.alerts.create({
                forklift_id: forklift.id,
                type: 'maintenance_overdue',
                severity: 'high',
                title: `Maintenance Overdue: ${forklift.id}`,
                message: `Scheduled maintenance was due on ${forklift.next_service_date}`
            });
            alertCount++;
        } else if (forklift.next_service_date) {
            const daysUntil = Math.floor((new Date(forklift.next_service_date) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 7 && daysUntil >= 0) {
                db.alerts.create({
                    forklift_id: forklift.id,
                    type: 'maintenance_due',
                    severity: 'medium',
                    title: `Maintenance Due Soon: ${forklift.id}`,
                    message: `Scheduled maintenance due in ${daysUntil} days`
                });
                alertCount++;
            }
        }
    }

    // Create hour meter anomaly alerts (backward readings)
    console.log('  Creating hour meter anomaly alerts...');
    const anomalyForklifts = createdForklifts.slice(0, 8); // Pick 8 forklifts for anomalies
    for (let i = 0; i < anomalyForklifts.length; i++) {
        const forklift = anomalyForklifts[i];
        const previousReading = forklift.current_hours;
        const anomalyReading = previousReading - randomInt(15, 150); // Backward reading

        // Create the flagged hour meter reading
        const readingDate = new Date();
        readingDate.setDate(readingDate.getDate() - randomInt(1, 14));

        db.raw.prepare(`
            INSERT INTO hour_meter_readings (
                forklift_id, reading, previous_reading, reading_delta,
                source, recorded_by, recorded_at, is_flagged, flag_reason, flag_severity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            forklift.id,
            anomalyReading,
            previousReading,
            anomalyReading - previousReading,
            'manual',
            createdUsers[randomInt(1, 3)].id,
            readingDate.toISOString(),
            1,
            `Hour meter went backward by ${Math.abs(anomalyReading - previousReading).toFixed(1)} hours. Possible incorrect entry or meter reset.`,
            'error'
        );

        // Create corresponding alert
        db.alerts.create({
            forklift_id: forklift.id,
            type: 'hour_anomaly',
            severity: 'high',
            title: `Hour Meter Anomaly: ${forklift.id}`,
            message: `Hour meter reading went backward from ${previousReading.toLocaleString()} to ${anomalyReading.toLocaleString()} hours. This may indicate an incorrect entry or meter reset. Please verify and correct.`,
            context_data: {
                previous_reading: previousReading,
                recorded_reading: anomalyReading,
                difference: anomalyReading - previousReading,
                recorded_date: readingDate.toISOString()
            }
        });
        alertCount++;
    }
    console.log(`    ✓ Created ${anomalyForklifts.length} hour meter anomaly alerts`);

    // Create billing discrepancy alerts
    console.log('  Creating billing discrepancy alerts...');
    const maintenanceRecords = db.maintenance.findAll({ status: 'completed', limit: 100 });
    const discrepancyRecords = maintenanceRecords.filter(() => Math.random() < 0.05).slice(0, 6); // ~5% have discrepancies, max 6

    for (const record of discrepancyRecords) {
        const discrepancyAmount = randomInt(50, 500);
        const discrepancyType = randomItem(['overcharge', 'duplicate_charge', 'unauthorized_work', 'incorrect_parts']);
        const descriptions = {
            overcharge: `Labor charges exceed quoted amount by $${discrepancyAmount}`,
            duplicate_charge: `Duplicate charge detected for diagnostic fee ($${discrepancyAmount})`,
            unauthorized_work: `Unauthorized additional work performed ($${discrepancyAmount})`,
            incorrect_parts: `Parts charged do not match work order ($${discrepancyAmount} difference)`
        };

        db.alerts.create({
            forklift_id: record.forklift_id,
            type: 'billing_discrepancy',
            severity: discrepancyAmount > 300 ? 'high' : 'medium',
            title: `Billing Discrepancy: ${record.invoice_number || 'No Invoice'}`,
            message: descriptions[discrepancyType],
            context_data: {
                maintenance_id: record.id,
                invoice_number: record.invoice_number,
                work_order: record.work_order_number,
                original_cost: record.total_cost,
                discrepancy_amount: discrepancyAmount,
                discrepancy_type: discrepancyType,
                service_provider: record.service_provider
            }
        });
        alertCount++;
    }
    console.log(`    ✓ Created ${discrepancyRecords.length} billing discrepancy alerts`);

    // Create repair time overrun alerts
    console.log('  Creating repair time overrun alerts...');
    const allMaintenanceRecords = db.maintenance.findAll({ status: 'completed', limit: 500 });

    // Find records where actual labor hours significantly exceeded expected (1.75x or more)
    const overrunRecords = allMaintenanceRecords.filter(record => {
        if (!record.labor_hours || !record.expected_labor_hours) return false;
        const ratio = record.labor_hours / record.expected_labor_hours;
        return ratio >= 1.75; // At least 75% over expected time
    }).slice(0, 10); // Cap at 10 alerts

    for (const record of overrunRecords) {
        const overrunHours = record.labor_hours - record.expected_labor_hours;
        const overrunPercent = Math.round((record.labor_hours / record.expected_labor_hours - 1) * 100);
        const severity = overrunPercent >= 150 ? 'high' : 'medium'; // 2.5x+ is high severity

        db.alerts.create({
            forklift_id: record.forklift_id,
            type: 'repair_time_overrun',
            severity,
            title: `Repair Time Overrun: ${record.invoice_number || record.work_order_number}`,
            message: `${record.description || 'Repair'} took ${record.labor_hours}h instead of expected ${record.expected_labor_hours}h (+${overrunHours.toFixed(1)}h / +${overrunPercent}% over standard time). Review invoice for billing accuracy.`,
            threshold_value: record.expected_labor_hours,
            actual_value: record.labor_hours,
            context_data: {
                maintenance_id: record.id,
                invoice_number: record.invoice_number,
                work_order: record.work_order_number,
                forklift_id: record.forklift_id,
                description: record.description,
                expected_hours: record.expected_labor_hours,
                actual_hours: record.labor_hours,
                overrun_hours: overrunHours,
                overrun_percent: overrunPercent,
                labor_cost: record.labor_cost,
                service_provider: record.service_provider,
                technician: record.technician_name,
                service_date: record.service_date
            }
        });
        alertCount++;
    }
    console.log(`    ✓ Created ${overrunRecords.length} repair time overrun alerts`);

    // Create some resolved alerts
    const alerts = db.alerts.findAll({ limit: Math.floor(alertCount * 0.3) });
    for (const alert of alerts.slice(0, Math.floor(alerts.length * 0.5))) {
        db.alerts.resolve(alert.id, createdUsers[1].id, 'Issue addressed');
    }

    console.log(`  ✓ Created ${alertCount} total alerts`);

    // Create risk assessments for high-risk units
    console.log('\nCreating risk assessments...');
    const riskAssessmentService = require('../services/riskAssessmentService');
    let assessmentCount = 0;

    for (const forklift of createdForklifts.filter(f => f.risk_score >= 5)) {
        try {
            await riskAssessmentService.assessForklift(forklift.id);
            assessmentCount++;
        } catch (e) {
            // Skip if assessment fails
        }
    }
    console.log(`  ✓ Created ${assessmentCount} risk assessments`);

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Seed Complete!');
    console.log('='.repeat(50));
    console.log(`Users:              ${createdUsers.length}`);
    console.log(`Locations:          ${createdLocations.length}`);
    console.log(`Forklifts:          ${createdForklifts.length}`);
    console.log(`Maintenance:        ${maintenanceCount}`);
    console.log(`Hour Readings:      ${readingsCount}`);
    console.log(`Downtime Events:    ${downtimeCount}`);
    console.log(`Rentals:            ${rentalCount}`);
    console.log(`Alerts:             ${alertCount}`);
    console.log(`Risk Assessments:   ${assessmentCount}`);
    console.log('='.repeat(50));
    console.log('\nTest Credentials:');
    console.log('  Admin:      admin@fleetmanager.com / admin123');
    console.log('  Manager:    manager@fleetmanager.com / manager123');
    console.log('  Technician: tech@fleetmanager.com / tech123');
    console.log('  Viewer:     viewer@fleetmanager.com / viewer123');
    console.log('='.repeat(50));
}

// Run seed
seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
