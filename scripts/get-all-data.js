const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n==================================================');
  console.log('       HOTEL MONOLITH DATABASE DATA DUMP         ');
  console.log('==================================================\n');

  // Parse .env manually
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found!');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const config = {};
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIdx = trimmed.indexOf('=');
    if (separatorIdx === -1) return;
    const key = trimmed.substring(0, separatorIdx).trim();
    const val = trimmed.substring(separatorIdx + 1).trim();
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
    console.log(
      `Connected successfully to PostgreSQL database: [${config.DB_NAME}]`,
    );

    // 1. Fetch all schemas
    const schemasRes = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'hotel_%' OR schema_name = 'global';
    `);
    const schemas = schemasRes.rows.map((r) => r.schema_name);

    for (const schemaName of schemas) {
      console.log(`\n==================================================`);
      console.log(` SCHEMA: ${schemaName.toUpperCase()} `);
      console.log(`==================================================`);

      // Get all tables in this schema
      const tablesRes = await client.query(
        `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
        ORDER BY table_name;
      `,
        [schemaName],
      );

      const tables = tablesRes.rows.map((r) => r.table_name);

      if (tables.length === 0) {
        console.log(`No tables exist in schema "${schemaName}".`);
        continue;
      }

      for (const table of tables) {
        // Get rows count
        const countRes = await client.query(
          `SELECT COUNT(*) as count FROM "${schemaName}"."${table}";`,
        );
        const count = parseInt(countRes.rows[0].count);

        if (count === 0) {
          console.log(`🔹 Table [${table}]: 0 records`);
          continue;
        }

        console.log(
          `\n🟢 Table [${table}] (${count} records) - Showing up to 10:`,
        );

        // Fetch rows
        let selectColumns = '*';
        if (table === 'users') {
          selectColumns =
            'id, email, "firstName", "lastName", scope, "isActive"'; // Exclude passwords
        }

        const rowsRes = await client.query(`
          SELECT ${selectColumns} 
          FROM "${schemaName}"."${table}" 
          LIMIT 10;
        `);
        console.table(rowsRes.rows);
      }
    }
  } catch (err) {
    console.error('Database connection or query failed:', err.message);
  } finally {
    await client.end();
    console.log('\n==================================================');
    console.log('               DATA DUMP COMPLETE                 ');
    console.log('==================================================\n');
  }
}

main();
