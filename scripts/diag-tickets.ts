import { Client } from 'pg';

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'As$030895',
  database: 'multi_tenant_hotel_management_system_db',
});

async function main() {
  await client.connect();
  try {
    // 1. Get search path
    const searchPath = await client.query('SHOW search_path');
    console.log('Default search path:', searchPath.rows[0]);

    // 2. Get list of all schemas
    const schemas = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'");
    console.log('Schemas:', schemas.rows.map(r => r.schema_name));

    // 3. Find where "maintenance_tickets" exists
    const tables = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'maintenance_tickets'
    `);
    console.log('Where maintenance_tickets table exists:', tables.rows);

    for (const tbl of tables.rows) {
      console.log(`\n--- Columns of "${tbl.table_schema}"."${tbl.table_name}" ---`);
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
      `, [tbl.table_schema, tbl.table_name]);
      console.table(cols.rows);
    }

    // 4. Find where "rooms" and "users" tables exist
    const roomsTables = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'rooms' OR table_name = 'users'
    `);
    console.log('\nWhere rooms/users exist:', roomsTables.rows);

    // 5. Let's see some ticket records if any exist
    for (const tbl of tables.rows) {
      console.log(`\nFetching 5 tickets from ${tbl.table_schema}.maintenance_tickets...`);
      try {
        const tickets = await client.query(`SELECT * FROM "${tbl.table_schema}".maintenance_tickets LIMIT 5`);
        console.log(`Tickets count in ${tbl.table_schema}:`, tickets.rows.length);
        console.log(tickets.rows);
      } catch (e: any) {
        console.error(`Failed to fetch tickets from ${tbl.table_schema}:`, e.message);
      }
    }

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
