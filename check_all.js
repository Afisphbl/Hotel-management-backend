const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'As$030895',
    database: 'multi_tenant_hotel_management_system_db',
  });
  await client.connect();
  try {
    const hotelId = '4193f8a1-f829-444a-84bf-1afa104398c3'; // New AbduRes
    const roomsCount = await client.query(
      'SELECT COUNT(*) FROM global.rooms WHERE "hotelId" = $1',
      [hotelId],
    );
    console.log(
      `Actual room rows for new AbduRes (4193f8a1): ${roomsCount.rows[0].count}`,
    );

    // Show all hotels and their actual vs stored rooms
    const hotels = await client.query(
      'SELECT id, name, rooms FROM global.hotels ORDER BY "createdAt" DESC',
    );
    console.log('\n--- All hotels: stored rooms vs actual rows ---');
    for (const hotel of hotels.rows) {
      const actual = await client.query(
        'SELECT COUNT(*) FROM global.rooms WHERE "hotelId" = $1',
        [hotel.id],
      );
      const mismatch =
        hotel.rooms != actual.rows[0].count ? ' ⚠️  MISMATCH' : '';
      console.log(
        `${hotel.name}: stored=${hotel.rooms}, actual rows=${actual.rows[0].count}${mismatch}`,
      );
    }

    // Check tenant schema existence for new hotel
    const schemaRes = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'hotel_4193f8a1_f829_444a_84bf_1afa104398c3'`,
    );
    console.log(
      '\nTenant schema exists for new AbduRes:',
      schemaRes.rows.length > 0,
    );
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
