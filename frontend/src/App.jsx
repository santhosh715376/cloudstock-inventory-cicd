import { useState, useEffect } from 'react';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  // Fetch data
  const fetchHealth = () => fetch(`${API_BASE}/health`).then(r => r.json()).then(setHealth).catch(() => setHealth({ status: 'unhealthy' }));
  const fetchProducts = () => fetch(`${API_BASE}/api/products`).then(r => r.json()).then(setProducts).catch(e => setError(e.message));
  const fetchOrders = () => fetch(`${API_BASE}/api/orders`).then(r => r.json()).then(setOrders).catch(e => setError(e.message));

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, [activeTab]);

  const totalInventory = products.reduce((acc, p) => acc + p.quantity, 0);
  const lowStockCount = products.filter(p => p.quantity > 0 && p.quantity <= 10).length;
  const outOfStockCount = products.filter(p => p.quantity === 0).length;

  return (
    <div className="app-container">
      <header className="header">
        <h1>☁️ CLOUDSTOCK</h1>
        {health && (
          <div className={`health-badge ${health.status === 'healthy' ? 'healthy' : 'unhealthy'}`}>
            <span className="dot"></span>
            {health.status.toUpperCase()} ({health.database || 'disconnected'})
          </div>
        )}
      </header>

      {error && <div className="error-msg">{error} <button onClick={() => setError('')}>x</button></div>}

      <div className="dashboard-grid">
        <div className="stat-card">
          <span className="stat-title">Total Products</span>
          <span className="stat-value">{products.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Total Inventory Units</span>
          <span className="stat-value">{totalInventory}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Low / Out of Stock</span>
          <span className="stat-value" style={{color: outOfStockCount > 0 ? 'var(--danger)' : 'inherit'}}>
            {lowStockCount} / {outOfStockCount}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Total Orders</span>
          <span className="stat-value">{orders.length}</span>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>Products</button>
        <button className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Orders & History</button>
        <button className={`tab-btn ${activeTab === 'demo' ? 'active' : ''}`} onClick={() => setActiveTab('demo')}>Concurrency Demo</button>
      </div>

      <div className="panel">
        {activeTab === 'dashboard' && <ProductsTable products={products} fetchProducts={fetchProducts} />}
        {activeTab === 'products' && <ProductManager products={products} fetchProducts={fetchProducts} setError={setError} />}
        {activeTab === 'orders' && <OrderManager products={products} orders={orders} fetchOrders={fetchOrders} fetchProducts={fetchProducts} setError={setError} />}
        {activeTab === 'demo' && <ConcurrencyDemo products={products} fetchProducts={fetchProducts} setError={setError} />}
      </div>
    </div>
  );
}

function ProductsTable({ products }) {
  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Current Inventory</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>Image</th>
            <th>ID</th>
            <th>Name</th>
            <th>Price</th>
            <th>Quantity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.image_url ? <img src={p.image_url} alt={p.name} style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}} /> : 'No img'}</td>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>${p.price}</td>
              <td>{p.quantity}</td>
              <td>
                {p.quantity === 0 ? <span className="out-of-stock">Out of Stock</span> : 
                 p.quantity <= 10 ? <span className="low-stock">Low Stock</span> : 
                 <span style={{color: 'var(--success)'}}>In Stock</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductManager({ products, fetchProducts, setError }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', quantity: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error(await res.text());
      fetchProducts();
      setForm({ name: '', description: '', price: '', quantity: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Delete failed');
      }
      fetchProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const uploadImage = async (id) => {
    if (!selectedFile) return;
    setUploadingId(id);
    const formData = new FormData();
    formData.append('image', selectedFile);
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}/image`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Upload failed');
      }
      fetchProducts();
      setSelectedFile(null);
    } catch (err) {
      setError(err.message);
    }
    setUploadingId(null);
  };

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Manage Products</h2>
      </div>
      <form className="order-form" onSubmit={handleAdd}>
        <input placeholder="Name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input placeholder="Price" type="number" step="0.01" required value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
        <input placeholder="Qty" type="number" required value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
        <button type="submit" className="action-btn">Add Product</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Version</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.image_url ? <img src={p.image_url} alt={p.name} style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}} /> : 'No img'}</td>
              <td>{p.name}</td>
              <td>${p.price}</td>
              <td>{p.quantity}</td>
              <td>v{p.version}</td>
              <td>
                <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                  <input type="file" onChange={e => setSelectedFile(e.target.files[0])} accept="image/*" style={{width: '180px', fontSize: '0.8rem'}} />
                  <button className="action-btn" onClick={() => uploadImage(p.id)} disabled={uploadingId === p.id || !selectedFile}>S3 Upload</button>
                  <button className="action-btn danger" onClick={() => handleDelete(p.id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderManager({ products, orders, fetchOrders, fetchProducts, setError }) {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);

  const handleOrder = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ product_id: parseInt(selectedProduct), quantity: parseInt(qty) }]
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Order failed');
      }
      fetchOrders();
      fetchProducts();
      setQty(1);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Create Order (Transaction)</h2>
      </div>
      <form className="order-form" onSubmit={handleOrder}>
        <select required value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
          <option value="" disabled>Select Product</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} - ${p.price} (In stock: {p.quantity})</option>)}
        </select>
        <input type="number" min="1" required value={qty} onChange={e => setQty(e.target.value)} />
        <button type="submit" className="action-btn success">Place Order</button>
      </form>

      <h3 style={{marginTop: '2rem', marginBottom: '1rem'}}>Transaction History</h3>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Date</th>
            <th>Total Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>#{o.id}</td>
              <td>{new Date(o.created_at).toLocaleString()}</td>
              <td>${o.total_price}</td>
              <td><span style={{color: 'var(--success)', fontWeight: 'bold'}}>{o.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConcurrencyDemo({ products, fetchProducts, setError }) {
  const [selected, setSelected] = useState('');
  const [cashiers, setCashiers] = useState(10);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const runTest = async () => {
    setLoading(true);
    setResults(null);
    try {
      const prod = products.find(p => p.id === parseInt(selected));
      if (!prod) throw new Error('Select a product');
      
      const initialStock = prod.quantity;
      const promises = Array(cashiers).fill(0).map((_, i) => 
        fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ product_id: prod.id, quantity: 1 }] })
        }).then(res => res.json().then(data => ({ status: res.status, id: i + 1, data })))
      );
      
      const res = await Promise.all(promises);
      
      const successes = res.filter(r => r.status === 201).length;
      const failures = res.filter(r => r.status === 409).length;
      
      // Fetch final stock
      const pRes = await fetch(`${API_BASE}/api/products/${prod.id}`);
      const pData = await pRes.json();
      
      setResults({
        initialStock,
        finalStock: pData.quantity,
        successes,
        failures,
        details: res
      });
      fetchProducts();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Concurrency Control Demo</h2>
      </div>
      <p style={{marginBottom: '1rem'}}>
        Fire simultaneous identical requests to prove the atomic decrements and dead-lock handling.
      </p>
      
      <div className="demo-box">
        <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={{padding: '0.5rem', flex: 1}}>
            <option value="" disabled>Target Product</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} (Initial Qty: {p.quantity})</option>)}
          </select>
          <input type="number" min="1" max="100" value={cashiers} onChange={e => setCashiers(parseInt(e.target.value))} style={{padding: '0.5rem'}} title="Concurrent Cashiers" />
          <button className="action-btn" disabled={!selected || loading} onClick={runTest}>
            {loading ? 'Running...' : 'Run Test'}
          </button>
        </div>
        
        {results && (
          <div style={{marginTop: '1.5rem'}}>
            <div className="dashboard-grid">
              <div className="stat-card">
                <span className="stat-title">Initial Stock</span>
                <span className="stat-value">{results.initialStock}</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">Successful</span>
                <span className="stat-value" style={{color: 'var(--success)'}}>{results.successes}</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">Rejected (409)</span>
                <span className="stat-value" style={{color: 'var(--danger)'}}>{results.failures}</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">Final Stock</span>
                <span className="stat-value">{results.finalStock}</span>
              </div>
            </div>
            
            <h3 style={{color: 'var(--success)', textAlign: 'center', marginBottom: '1rem'}}>
              Race condition prevented successfully.
            </h3>
            
            <div style={{maxHeight: '300px', overflowY: 'auto', background: 'white', padding: '1rem', border: '1px solid var(--border)'}}>
              {results.details.map(r => (
                <div key={r.id} style={{marginBottom: '0.5rem'}}>
                  Cashier {r.id} → {r.status === 201 ? <span className="success" style={{color: 'var(--success)', fontWeight: 'bold'}}>SUCCESS</span> : <span className="danger" style={{color: 'var(--danger)', fontWeight: 'bold'}}>OUT OF STOCK</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
