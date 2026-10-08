const request = require('supertest');
const app = require('../backend/src/app');
const pool = require('../backend/src/db');

beforeAll(async () => {
  await pool.query('DELETE FROM order_items');
  await pool.query('DELETE FROM orders');
  await pool.query('DELETE FROM products');
  
  await pool.query("INSERT INTO products (id, name, quantity, price) VALUES (1, 'Test Product', 10, 100.00)");
});

afterAll(async () => {
  await pool.end();
});

describe('Cloudstock Backend API', () => {

  it('GET /health returns healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('CRUD Products', async () => {
    const createRes = await request(app).post('/api/products').send({
      name: 'New Item',
      description: 'Desc',
      quantity: 5,
      price: 25.5
    });
    expect(createRes.status).toBe(201);
    const newId = createRes.body.id;

    const getRes = await request(app).get(`/api/products/${newId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('New Item');

    const updateRes = await request(app).put(`/api/products/${newId}`).send({
      name: 'Updated Item',
      description: 'Desc',
      quantity: 10,
      price: 30.0
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.quantity).toBe(10);
    expect(updateRes.body.version).toBe(1);

    const delRes = await request(app).delete(`/api/products/${newId}`);
    expect(delRes.status).toBe(204);
  });

  it('Order Creation & Stock Decrease', async () => {
    const orderRes = await request(app).post('/api/orders').send({
      items: [{ product_id: 1, quantity: 2 }]
    });
    expect(orderRes.status).toBe(201);
    
    const [rows] = await pool.query('SELECT quantity FROM products WHERE id = 1');
    expect(rows[0].quantity).toBe(8);
  });

  it('Order Creation - Insufficient Stock (Returns 409 OUT_OF_STOCK)', async () => {
    const orderRes = await request(app).post('/api/orders').send({
      items: [{ product_id: 1, quantity: 20 }]
    });
    expect(orderRes.status).toBe(409);
    expect(orderRes.body.error).toContain('OUT_OF_STOCK');
    
    const [rows] = await pool.query('SELECT quantity FROM products WHERE id = 1');
    expect(rows[0].quantity).toBe(8); // Ensure it wasn't modified
  });

});
