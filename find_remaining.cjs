const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost', port: 5432, user: 'postgres',
  password: 'As$030895',
  database: 'multi_tenant_hotel_management_system_db'
});
(async () => {
  const c = await pool.connect();
  try {
    // Find which booking has these room_nights
    const rn = await c.query(`
      SELECT rn.date, rn.status, rn."bookingId", b.status AS booking_status,
             b."checkIn", b."checkOut", b.source, b."createdAt"
      FROM hotel_4058b737_08a6_4275_90a2_802d65fe44cd.room_nights rn
      JOIN hotel_4058b737_08a6_4275_90a2_802d65fe44cd.bookings b ON b.id = rn."bookingId"
      WHERE rn."roomId" = 'cc5eb5fc-1878-4f3f-a85f-f8afcd0885d7'
      AND rn.date >= '2026-07-01' AND rn.date <= '2026-07-31'
      ORDER BY rn.date
    `);
    console.log('Room cc5eb5fc room_nights for July:');
    rn.rows.forEach(r => console.log(`  ${r.date} ${r.status} booking=${String(r.bookingId).substring(0,8)} bkg_status=${r.booking_status} source=${r.source} checkIn=${r.checkIn} checkOut=${r.checkOut} created=${r.createdAt}`));
  } finally { c.release(); await pool.end(); }
})().catch(e => { console.error(e); process.exit(1); });
