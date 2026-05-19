const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function testConnection() {
  console.log('=== Raw PostgreSQL Data Verification ===\n');

  // Parse .env manually
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const config = {};
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0];
    const val = parts.slice(1).join('=');
    config[key] = val;
  });

  const client = new Client({
    host: config.DB_HOST,
    port: parseInt(config.DB_PORT || '5432'),
    user: config.DB_USERNAME,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
  });

  try {
    await client.connect();
    console.log('Successfully connected to DB:', config.DB_NAME);

    // 1. Schemas check
    const schemasRes = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'hotel_%' OR schema_name = 'global';
    `);
    const schemas = schemasRes.rows.map((r) => r.schema_name);
    console.log('\n1. Schemas in database:', schemas);

    // 2. Hotels check
    console.log('\n2. Entries in global.hotels:');
    const hotelsRes = await client.query(
      'SELECT id, name, "schemaName", status FROM global.hotels;',
    );
    console.table(hotelsRes.rows);

    // 3. Users check
    console.log('\n3. Entries in global.users (passwords omitted):');
    const usersRes = await client.query(
      'SELECT id, email, "firstName", "lastName", scope, "isActive" FROM global.users;',
    );
    console.table(usersRes.rows);

    // 4. Hotel User Access matches
    console.log('\n4. Access Mapping (global.hotel_user_access):');
    const accessRes = await client.query(
      'SELECT * FROM global.hotel_user_access;',
    );
    console.table(accessRes.rows);

    // 5. Tenant table check
    for (const schema of schemas) {
      if (schema === 'global') continue;
      console.log(`\n--- Tenant: "${schema}" ---`);
      try {
        const roomsRes = await client.query(
          `SELECT COUNT(*) as count FROM "${schema}".rooms;`,
        );
        console.log(`  Rooms count in tenant schema:`, roomsRes.rows[0].count);

        const roomTypesRes = await client.query(
          `SELECT COUNT(*) as count FROM "${schema}"."room-types";`,
        );
        console.log(
          `  Room Types count in tenant schema:`,
          roomTypesRes.rows[0].count,
        );
      } catch (e) {
        // Table names might be singular or plural, let's list available tables
        const tablesRes = await client.query(
          `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = $1;
        `,
          [schema],
        );
        console.log(
          `  Tables inside "${schema}":`,
          tablesRes.rows.map((r) => r.table_name),
        );

        for (const table of tablesRes.rows.map((r) => r.table_name)) {
          const rowCountRes = await client.query(
            `SELECT COUNT(*) as count FROM "${schema}"."${table}";`,
          );
          console.log(
            `    - Table "${table}" has ${rowCountRes.rows[0].count} records`,
          );
        }
      }
    }
  } catch (err) {
    console.error('Error querying DB:', err.message);
  } finally {
    await client.end();
  }
}

testConnection();
