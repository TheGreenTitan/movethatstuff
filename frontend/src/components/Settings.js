///var/www/movethatstuff/frontend/src/components/Settings.js//
import React, { useState, useEffect } from 'react';
import api from '../utils/api';

function Settings() {
  const [tenant, setTenant] = useState({
    name: '',
    phone_number: '',
    email: '',
    address: '',
    primary_color: '#ff4f00',
    secondary_color: '#232323',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenant();
  }, []);

  const fetchTenant = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tenants/my'); // Assume backend endpoint for current tenant
      setTenant(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTenant({ ...tenant, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put('/tenants/my', tenant);
      setSuccess('Settings updated successfully.');
      setError('');
      // Update global CSS variables
      document.documentElement.style.setProperty('--primary-color', tenant.primary_color);
      document.documentElement.style.setProperty('--secondary-color', tenant.secondary_color);
    } catch (err) {
      setError('Failed to update settings.');
      setSuccess('');
    }
  };

  return (
    <div className="mt-5">
      <h2>Company Settings</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="name" className="form-label">Company Name</label>
            <input
              type="text"
              className="form-control"
              id="name"
              name="name"
              value={tenant.name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="phone_number" className="form-label">Phone Number</label>
            <input
              type="tel"
              className="form-control"
              id="phone_number"
              name="phone_number"
              value={tenant.phone_number}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              id="email"
              name="email"
              value={tenant.email}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="address" className="form-label">Depot Address</label>
            <input
              type="text"
              className="form-control"
              id="address"
              name="address"
              value={tenant.address}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="primary_color" className="form-label">Primary Color</label>
            <input
              type="color"
              className="form-control form-control-color"
              id="primary_color"
              name="primary_color"
              value={tenant.primary_color}
              onChange={handleInputChange}
            />
          </div>
          <div className="mb-3">
            <label htmlFor="secondary_color" className="form-label">Secondary Color</label>
            <input
              type="color"
              className="form-control form-control-color"
              id="secondary_color"
              name="secondary_color"
              value={tenant.secondary_color}
              onChange={handleInputChange}
            />
          </div>
          <button type="submit" className="btn btn-primary">Save Settings</button>
        </form>
      )}
    </div>
  );
}

export default Settings;
