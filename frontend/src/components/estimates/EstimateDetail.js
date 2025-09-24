///var/www/movethatstuff/frontend/src/components/estimates/EstimateDetail.js//
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import moment from 'moment-timezone';
import api from '../../utils/api';
import LocationsCard from './LocationsCard';
import MapCard from './MapCard';

function EstimateDetail() {
  const { id } = useParams();
  const [estimate, setEstimate] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [depotAddress, setDepotAddress] = useState('');
  const [depotPos, setDepotPos] = useState(null);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItem, setNewItem] = useState({ item_type: 'additional', description: '', quantity: 1, unit_price: 0, total_cost: 0 });
  const [editingLineId, setEditingLineId] = useState(null);

  const fetchEstimate = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/estimates/${id}`);
      const tenantRes = await api.get('/tenants/my');
      const tenant = tenantRes.data;
      const timezone = tenant.timezone || 'UTC';
      const formattedData = {
        ...response.data,
        move_date: response.data.move_date ? moment.utc(response.data.move_date).tz(timezone).format('YYYY-MM-DD') : 'N/A'
      };
      setEstimate(formattedData);
      setLineItems(response.data.line_items || []);
      setDepotAddress(tenant.address);
      setGoogleMapsApiKey(tenant.google_maps_api_key || 'AIzaSyCIEZbjaw7Dn6pfOG2UT3mBIwLuhzYJt8Y'); // Fallback to default if not set
      if (tenant.lat && tenant.lng && !isNaN(parseFloat(tenant.lat)) && !isNaN(parseFloat(tenant.lng))) {
        setDepotPos({ lat: parseFloat(tenant.lat), lng: parseFloat(tenant.lng) });
      } else {
        setDepotPos({ lat: 36.172, lng: -95.7918 }); // Fallback
      }
      setError('');
    } catch (err) {
      setError('Failed to load estimate details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  const startEdit = (field, value) => {
    setEditingField(field);
    setEditValue(value || '');
  };

  const saveEdit = async (field) => {
    if (!editValue || parseFloat(editValue) === estimate[field]) {
      setEditingField(null);
      return;
    }
    const originalValue = estimate[field];
    const newValue = parseFloat(editValue);
    setEstimate(prev => ({ ...prev, [field]: newValue })); // Optimistic update
    try {
      await api.put(`/estimates/${id}`, { [field]: newValue });
      // If field affects calculation, recalc (full=false for non-location)
      if (['total_weight', 'total_volume'].includes(field)) {
        await api.post(`/estimates/${id}/calculate?full=false`);
      }
      fetchEstimate(); // Sync
    } catch (err) {
      setEstimate(prev => ({ ...prev, [field]: originalValue })); // Revert
      setError('Failed to save edit.');
    }
    setEditingField(null);
  };

  const handleRecalc = async () => {
    try {
      await api.post(`/estimates/${id}/calculate?full=true`);
      fetchEstimate();
    } catch (err) {
      setError('Failed to recalculate.');
    }
  };

  const handleSendEmail = async () => {
    try {
      await api.post(`/estimates/${id}/send-email`);
      alert('Email sent!');
    } catch (err) {
      setError('Failed to send email.');
    }
  };

  const renderField = (label, field) => {
    const value = estimate[field];
    return (
      <div>
        <strong>{label}:</strong>{' '}
        {editingField === field ? (
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(field)}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit(field)}
            autoFocus
          />
        ) : (
          <span onClick={() => startEdit(field, value)} style={{ cursor: 'pointer' }}>
            {value ?? 'N/A'}
          </span>
        )}
      </div>
    );
  };

  const handleAddItemChange = (e) => {
    const { name, value } = e.target;
    const updatedItem = { ...newItem, [name]: parseFloat(value) || 0 };
    if (name === 'quantity' || name === 'unit_price') {
      updatedItem.total_cost = updatedItem.quantity * updatedItem.unit_price;
    }
    setNewItem(updatedItem);
  };

  const handleAddItemSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLineId) {
        await api.put(`/estimates/${id}/line-items/${editingLineId}`, newItem);
      } else {
        await api.post(`/estimates/${id}/line-items`, newItem);
      }
      setShowAddItemForm(false);
      setNewItem({ item_type: 'additional', description: '', quantity: 1, unit_price: 0, total_cost: 0 });
      setEditingLineId(null);
      fetchEstimate();
    } catch (err) {
      setError('Failed to add/update item.');
    }
  };

  const handleEditLineItem = (item) => {
    setNewItem({
      item_type: item.item_type,
      description: item.description,
      quantity: parseFloat(item.quantity) || 0,
      unit_price: parseFloat(item.unit_price) || 0,
      total_cost: parseFloat(item.total_cost) || 0
    });
    setEditingLineId(item.id);
    setShowAddItemForm(true);
  };

  const handleDeleteLineItem = async (lineId) => {
    if (window.confirm('Delete this item?')) {
      try {
        await api.delete(`/estimates/${id}/line-items/${lineId}`);
        fetchEstimate();
      } catch (err) {
        setError('Failed to delete item.');
      }
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!estimate) return <p>Estimate not found.</p>;

  return (
    <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={["places", "geometry"]}>
      <div className="row mt-5">
        {/* Left Column - 70% */}
        <div className="col-md-8">
          {/* Customer Info Card */}
          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">Customer Information</h5>
              <p><strong>Name:</strong> {estimate.customer_name}</p>
              <p><strong>Phone:</strong> {estimate.phone || 'N/A'}</p>
              <p><strong>Email:</strong> {estimate.email || 'N/A'}</p>
              <p><strong>Source:</strong> {estimate.source || 'N/A'}</p>
            </div>
          </div>

          {/* Three Cards Row */}
          <div className="row mb-3">
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Move Details</h5>
                  <p><strong>Service:</strong> {estimate.move_service}</p>
                  <p><strong>Type:</strong> {estimate.move_type}</p>
                  <p><strong>Size:</strong> {estimate.move_size_description || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Weight & Volume</h5>
                  {renderField('Weight', 'total_weight')}
                  {renderField('Volume', 'total_volume')}
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Status</h5>
                  <p><strong>Status:</strong> {estimate.status}</p>
                  <p><strong>Date:</strong> {estimate.move_date || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Locations Card (without map) */}
          <LocationsCard
            estimateId={id}
            stops={estimate.stops}
            depotAddress={depotAddress}
            depotPos={depotPos}
            distance_miles={estimate.distance_miles}
            depot_travel_time={estimate.depot_travel_time}
            move_travel_time={estimate.move_travel_time}
            fetchEstimate={fetchEstimate}
            showMap={false}
          />

          {/* Estimate Details Card */}
          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">Estimate Breakdown</h5>
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.item_type}</td>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>${Number(item.unit_price || 0).toFixed(2)}</td>
                      <td>${Number(item.total_cost || 0).toFixed(2)}</td>
                      <td>
                        <button className="btn btn-sm btn-primary me-1" onClick={() => handleEditLineItem(item)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteLineItem(item.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="4"><strong>Total Cost</strong></td>
                    <td>${Number(estimate.total_cost || 0).toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <button className="btn btn-secondary mt-2" onClick={() => { setShowAddItemForm(true); setEditingLineId(null); }}>Add Additional Items</button>
              <button className="btn btn-primary mt-2 ms-2" onClick={handleRecalc}>Recalculate</button>
              {showAddItemForm && (
                <form onSubmit={handleAddItemSubmit} className="mt-3">
                  <div className="mb-3">
                    <label htmlFor="item_type" className="form-label">Item Type</label>
                    <input type="text" className="form-control" id="item_type" name="item_type" value={newItem.item_type} onChange={handleAddItemChange} />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="description" className="form-label">Description</label>
                    <input type="text" className="form-control" id="description" name="description" value={newItem.description} onChange={handleAddItemChange} />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="quantity" className="form-label">Quantity</label>
                    <input type="number" step="0.01" className="form-control" id="quantity" name="quantity" value={newItem.quantity} onChange={handleAddItemChange} />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="unit_price" className="form-label">Unit Price</label>
                    <input type="number" step="0.01" className="form-control" id="unit_price" name="unit_price" value={newItem.unit_price} onChange={handleAddItemChange} />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="total_cost" className="form-label">Total Cost</label>
                    <input type="number" step="0.01" className="form-control" id="total_cost" name="total_cost" value={newItem.total_cost} readOnly />
                  </div>
                  <button type="submit" className="btn btn-success">{editingLineId ? 'Update' : 'Add'} Item</button>
                  <button type="button" className="btn btn-secondary ms-2" onClick={() => setShowAddItemForm(false)}>Cancel</button>
                </form>
              )}
            </div>
          </div>

          {/* Notes Card */}
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Notes</h5>
              <p>{estimate.notes || 'No notes'}</p>
            </div>
          </div>
        </div>

        {/* Right Column - 30% */}
        <div className="col-md-4">
          {/* Actions Card */}
          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">Actions</h5>
              <button className="btn btn-primary mb-2" onClick={handleSendEmail}>Send Estimate Email</button>
            </div>
          </div>

          {/* Map Card */}
          <MapCard stops={estimate.stops} depotPos={depotPos} />
        </div>
      </div>
    </LoadScript>
  );
}

export default EstimateDetail;