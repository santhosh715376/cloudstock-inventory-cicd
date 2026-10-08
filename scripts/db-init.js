const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function initDB() {
  console.log(`Connecting to ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}...`);
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    multipleStatements: true
  });

  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    const seedSql = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8');

    console.log('Executing schema.sql...');
    await conn.query(schemaSql);
    
    console.log('Executing seed.sql...');
    await conn.query(seedSql);

    console.log('Database Initialization Complete.');
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
  } finally {
    await conn.end();
  }
}

initDB();
