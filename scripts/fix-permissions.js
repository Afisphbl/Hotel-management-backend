const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

(async () => {
  await client.connect();
  console.log('Connected to DB');
  const res = await client.query('UPDATE "global".permissions SET slug = id::text WHERE slug IS NULL');
  console.log('Rows updated:', res.rowCount);
  await client.end();
})();
