const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

client.connect().then(async () => {
  const hotels = await client.query('SELECT "schemaName" FROM global.hotels WHERE "deletedAt" IS NULL');
  for (const h of hotels.rows) {
    const s = h.schemaName;
    try {
      await client.query(`ALTER TABLE "${s}"."bookings" ADD COLUMN IF NOT EXISTS "numGuests" INT`);
      await client.query(`ALTER TABLE "${s}"."bookings" ADD COLUMN IF NOT EXISTS source VARCHAR(50)`);
      await client.query(`ALTER TABLE "${s}"."bookings" ADD COLUMN IF NOT EXISTS notes TEXT`);
      console.log('patched:', s);
    } catch (e) {
      console.error('error on', s, e.message);
    }
  }
  await client.end();
  console.log('done');
}).catch(e => { console.error(e); process.exit(1); });
