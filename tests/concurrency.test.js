const request = require('supertest');
const app = require('../backend/src/app');
const pool = require('../backend/src/db');

beforeAll(async () => {
  await pool.query('DELETE FROM order_items');
  await pool.query('DELETE FROM orders');
  await pool.query('DELETE FROM products');
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 2: Concurrency & Database Validation', () => {

  it('1. Concurrent Purchase Test (Oversell Prevention)', async () => {
    // Initial stock = 1
    const [insert] = await pool.query("INSERT INTO products (name, quantity, price) VALUES ('Race Item', 1, 100.00)");
    const prodId = insert.insertId;

    // Send 10 purchase requests simultaneously
    const requests = Array(10).fill(null).map(() => 
      request(app).post('/api/orders').send({
        items: [{ product_id: prodId, quantity: 1 }]
      })
    );

    const responses = await Promise.all(requests);
    
    const successes = responses.filter(r => r.status === 201).length;
    const failures = responses.filter(r => r.status === 409).length;

    // Exactly 1 request succeeds. Exactly 9 requests fail.
    expect(successes).toBe(1);
    expect(failures).toBe(9);

    // Final stock must equal 0 (no negative stock)
    const [rows] = await pool.query('SELECT quantity FROM products WHERE id = ?', [prodId]);
    expect(rows[0].quantity).toBe(0);
  });

  it('2. Multi-Product Transaction (Atomic Rollback)', async () => {
    const [pA] = await pool.query("INSERT INTO products (name, quantity, price) VALUES ('Prod A', 10, 10)");
    const [pB] = await pool.query("INSERT INTO products (name, quantity, price) VALUES ('Prod B', 10, 10)");
    const [pC] = await pool.query("INSERT INTO products (name, quantity, price) VALUES ('Prod C', 0, 10)"); // Out of stock

    const orderRes = await request(app).post('/api/orders').send({
      items: [
        { product_id: pA.insertId, quantity: 1 },
        { product_id: pB.insertId, quantity: 1 },
        { product_id: pC.insertId, quantity: 1 } // Will fail
      ]
    });

    expect(orderRes.status).toBe(409);

    const [rowsA] = await pool.query('SELECT quantity FROM products WHERE id = ?', [pA.insertId]);
    const [rowsB] = await pool.query('SELECT quantity FROM products WHERE id = ?', [pB.insertId]);
    
    // Ensure all operations occur inside one transaction: ROLLBACK entire order
    expect(rowsA[0].quantity).toBe(10);
    expect(rowsB[0].quantity).toBe(10);
  });

  it('3. Deadlock & Lock Ordering Verification', async () => {
    // We send concurrent overlapping orders.
    // Order A: requires Product 1, 2
    // Order B: requires Product 2, 1
    // Because the backend explicitly sorts items before locking: 
    // const sortedItems = [...items].sort((a, b) => a.product_id - b.product_id);
    // They will both lock 1, then 2, preventing a cyclic deadlock.
    
    const [p1] = await pool.query("INSERT INTO products (name, quantity, price) VALUES ('P1', 50, 10)");
    const [p2] = await pool.query("INSERT INTO products (name, quantity, price) VALUES ('P2', 50, 10)");

    const reqA = request(app).post('/api/orders').send({
      items: [
        { product_id: p1.insertId, quantity: 5 },
        { product_id: p2.insertId, quantity: 5 }
      ]
    });

    const reqB = request(app).post('/api/orders').send({
      items: [
        { product_id: p2.insertId, quantity: 5 },
        { product_id: p1.insertId, quantity: 5 }
      ]
    });

    const [resA, resB] = await Promise.all([reqA, reqB]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);

    const [rows1] = await pool.query('SELECT quantity FROM products WHERE id = ?', [p1.insertId]);
    const [rows2] = await pool.query('SELECT quantity FROM products WHERE id = ?', [p2.insertId]);
    
    expect(rows1[0].quantity).toBe(40);
    expect(rows2[0].quantity).toBe(40);
  });

  it('4. Optimistic Locking Test (Version Check)', async () => {
    const [p] = await pool.query("INSERT INTO products (name, quantity, price, version) VALUES ('Version Item', 10, 10, 5)");
    const pId = p.insertId;

    // Simulate Tx A succeeds with expectedVersion = 5
    const resA = await request(app).put(`/api/products/${pId}`).send({
      name: 'Version Item', description: 'Updated', quantity: 15, price: 10, expectedVersion: 5
    });
    
    expect(resA.status).toBe(200);
    expect(resA.body.version).toBe(6);

    // Simulate Tx B fails using old version = 5
    const resB = await request(app).put(`/api/products/${pId}`).send({
      name: 'Version Item', description: 'Stale Update', quantity: 20, price: 10, expectedVersion: 5
    });
    
    expect(resB.status).toBe(409);
    expect(resB.body.error).toContain('Conflict');
  });
});
