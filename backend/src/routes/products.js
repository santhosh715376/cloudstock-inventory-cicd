const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const { s3Client, PutObjectCommand } = require('../s3');
const upload = multer({ storage: multer.memoryStorage() });

// GET all products
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new product
router.post('/', async (req, res) => {
  const { name, description, quantity, price } = req.body;
  if (quantity < 0) return res.status(400).json({ error: 'Quantity cannot be negative' });
  try {
    const [result] = await pool.query(
      'INSERT INTO products (name, description, quantity, price) VALUES (?, ?, ?, ?)',
      [name, description, quantity, price]
    );
    const [newProduct] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(newProduct[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST product image to S3
router.post('/:id/image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  const bucketName = process.env.S3_BUCKET_NAME || 'cloudstock-artifacts-bucket-123456';

  const key = `products/${req.params.id}-${Date.now()}-${req.file.originalname}`;
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });
    
    await s3Client.send(command);
    
    const imageUrl = `https://${bucketName}.s3.amazonaws.com/${key}`;
    
    const [result] = await pool.query(
      'UPDATE products SET image_url = ?, version = version + 1 WHERE id = ?', 
      [imageUrl, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    
    const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  const { name, description, quantity, price, expectedVersion } = req.body;
  if (quantity < 0) return res.status(400).json({ error: 'Quantity cannot be negative' });
  try {
    let query = 'UPDATE products SET name = ?, description = ?, quantity = ?, price = ?, version = version + 1 WHERE id = ?';
    let params = [name, description, quantity, price, req.params.id];

    if (expectedVersion !== undefined) {
      query += ' AND version = ?';
      params.push(expectedVersion);
    }

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      const [check] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
      if (check.length === 0) return res.status(404).json({ error: 'Product not found' });
      return res.status(409).json({ error: 'Conflict: The product was updated by another transaction.' });
    }
    const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Cannot delete product as it is referenced in an order.' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
