const express = require('express');
const router = express.Router();
const pool = require('../db');

// Delay helper for deadlock retry backoff
const delay = (ms) => new Promise(res => setTimeout(res, ms));

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    const [items] = await pool.query(
      'SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?', 
      [req.params.id]
    );
    
    res.json({ ...orders[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid order items' });
  }

  // Enforce Consistent Lock Ordering (sort by product_id ASC)
  const sortedItems = [...items].sort((a, b) => a.product_id - b.product_id);

  let attempts = 0;
  while (attempts < 3) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let totalPrice = 0;
      const orderItemsToInsert = [];

      // Validate products, check stock, and apply atomic decrement
      for (const item of sortedItems) {
        const [products] = await conn.query('SELECT price FROM products WHERE id = ?', [item.product_id]);
        if (products.length === 0) {
          throw { status: 404, message: `Product ${item.product_id} not found` };
        }
        
        const priceAtTime = products[0].price;

        // Atomic stock update avoiding oversell
        const [updateRes] = await conn.query(
          'UPDATE products SET quantity = quantity - ?, version = version + 1 WHERE id = ? AND quantity >= ?',
          [item.quantity, item.product_id, item.quantity]
        );

        if (updateRes.affectedRows === 0) {
          throw { status: 409, message: `OUT_OF_STOCK for product ${item.product_id}` };
        }

        totalPrice += priceAtTime * item.quantity;
        orderItemsToInsert.push([item.product_id, item.quantity, priceAtTime]);
      }

      // Create Order
      const [orderRes] = await conn.query('INSERT INTO orders (total_price) VALUES (?)', [totalPrice]);
      const orderId = orderRes.insertId;

      // Create Order Items
      for (const oi of orderItemsToInsert) {
        await conn.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)',
          [orderId, oi[0], oi[1], oi[2]]
        );
      }

      await conn.commit();
      conn.release();
      return res.status(201).json({ message: 'Order created successfully', orderId });

    } catch (err) {
      await conn.rollback();
      conn.release();
      
      // Handle Deadlock (1213) or Lock Wait Timeout (1205)
      if (err.errno === 1213 || err.errno === 1205) {
        attempts++;
        if (attempts >= 3) {
          return res.status(503).json({ error: 'Too much contention, failed after 3 retries' });
        }
        await delay(50 * Math.random());
        continue;
      }

      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
