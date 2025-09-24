///var/www/movethatstuff/frontend/src/components/estimates/EstimateList.js//
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import EstimateForm from './EstimateForm';

function EstimateList() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    move_type: 'house',
    move_service: 'moving',
    move_date: '',
    move_time: '',
    origin_address: '',
    origin_city: '',
    origin_state: '',
    origin_zip: '',
    origin_floor: '',
    origin_elevator: false,
    origin_stairs: false,
    origin_long_walk: false,
    destination_address: '',
    destination_city: '',
    destination_state: '',
    destination_zip: '',
    destination_floor: '',
    destination_elevator: false,
    destination_stairs: false,
    destination_long_walk: false,
    notes: '',
    status: 'new lead',
    method: 'inventory',
    total_weight: '',
    total_volume: '',
    estimated_hours: '',
    labor_cost: '',
    truck_cost: '',
    fuel_cost: '',
    additional_services_cost: '',
    total_cost: '',
    number_of_movers: '',
    number_of_trucks: '',
    distance_miles: '',
    travel_time: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetchEstimates();
    fetchCustomers();
  }, []);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const response = await api.get('/estimates');
      setEstimates(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load estimates.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers');
      setCustomers(response.data);
    } catch (err) {
      setError('Failed to load customers for dropdown.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/estimates/${editingId}`, formData);
      } else {
        await api.post('/estimates', formData);
      }
      setShowForm(false);
      setFormData({
        customer_id: '',
        move_type: 'house',
        move_service: 'moving',
        move_date: '',
        move_time: '',
        origin_address: '',
        origin_city: '',
        origin_state: '',
        origin_zip: '',
        origin_floor: '',
        origin_elevator: false,
        origin_stairs: false,
        origin_long_walk: false,
        destination_address: '',
        destination_city: '',
        destination_state: '',
        destination_zip: '',
        destination_floor: '',
        destination_elevator: false,
        destination_stairs: false,
        destination_long_walk: false,
        notes: '',
        status: 'new lead',
        method: 'inventory',
        total_weight: '',
        total_volume: '',
        estimated_hours: '',
        labor_cost: '',
        truck_cost: '',
        fuel_cost: '',
        additional_services_cost: '',
        total_cost: '',
        number_of_movers: '',
        number_of_trucks: '',
        distance_miles: '',
        travel_time: '',
      });
      setEditingId(null);
      fetchEstimates(); // Refresh list
    } catch (err) {
      setError(`Failed to ${editingId ? 'update' : 'create'} estimate.`);
    }
  };

  const handleEdit = (estimate) => {
    setFormData({
      customer_id: estimate.customer_id || '',
      move_type: estimate.move_type || 'house',
      move_service: estimate.move_service || 'moving',
      move_date: estimate.move_date || '',
      move_time: estimate.move_time || '',
      origin_address: estimate.origin_address || '',
      origin_city: estimate.origin_city || '',
      origin_state: estimate.origin_state || '',
      origin_zip: estimate.origin_zip || '',
      origin_floor: estimate.origin_floor || '',
      origin_elevator: estimate.origin_elevator || false,
      origin_stairs: estimate.origin_stairs || false,
      origin_long_walk: estimate.origin_long_walk || false,
      destination_address: estimate.destination_address || '',
      destination_city: estimate.destination_city || '',
      destination_state: estimate.destination_state || '',
      destination_zip: estimate.destination_zip || '',
      destination_floor: estimate.destination_floor || '',
      destination_elevator: estimate.destination_elevator || false,
      destination_stairs: estimate.destination_stairs || false,
      destination_long_walk: estimate.destination_long_walk || false,
      notes: estimate.notes || '',
      status: estimate.status || 'new lead',
      method: estimate.method || 'inventory',
      total_weight: estimate.total_weight || '',
      total_volume: estimate.total_volume || '',
      estimated_hours: estimate.estimated_hours || '',
      labor_cost: estimate.labor_cost || '',
      truck_cost: estimate.truck_cost || '',
      fuel_cost: estimate.fuel_cost || '',
      additional_services_cost: estimate.additional_services_cost || '',
      total_cost: estimate.total_cost || '',
      number_of_movers: estimate.number_of_movers || '',
      number_of_trucks: estimate.number_of_trucks || '',
      distance_miles: estimate.distance_miles || '',
      travel_time: estimate.travel_time || '',
    });
    setEditingId(estimate.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this estimate?')) {
      try {
        await api.delete(`/estimates/${id}`);
        fetchEstimates(); // Refresh list
      } catch (err) {
        setError('Failed to delete estimate.');
      }
    }
  };

  return (
    <div className="mt-5">
      <h2>Estimates/Leads</h2>
      <button className="btn btn-success mb-3" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ customer_id: '', move_type: 'house', move_service: 'moving', move_date: '', move_time: '', origin_address: '', origin_city: '', origin_state: '', origin_zip: '', origin_floor: '', origin_elevator: false, origin_stairs: false, origin_long_walk: false, destination_address: '', destination_city: '', destination_state: '', destination_zip: '', destination_floor: '', destination_elevator: false, destination_stairs: false, destination_long_walk: false, notes: '', status: 'new lead', method: 'inventory', total_weight: '', total_volume: '', estimated_hours: '', labor_cost: '', truck_cost: '', fuel_cost: '', additional_services_cost: '', total_cost: '', number_of_movers: '', number_of_trucks: '', distance_miles: '', travel_time: '' }); }}>New Estimate</button>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Move Type</th>
              <th>Move Service</th>
              <th>Move Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((estimate) => (
              <tr key={estimate.id}>
                <td><Link to={`/estimates/${estimate.id}`}>{estimate.id}</Link></td>
                <td>{estimate.customer_name}</td>
                <td>{estimate.move_type}</td>
                <td>{estimate.move_service}</td>
                <td>{estimate.move_date}</td>
                <td>{estimate.status}</td>
                <td>
                  <button className="btn btn-sm btn-dark me-2" onClick={() => handleEdit(estimate)}>Edit</button>
                  <button className="btn btn-sm btn-dark" onClick={() => handleDelete(estimate.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showForm && (
        <EstimateForm
          formData={formData}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          customers={customers}
          editingId={editingId}
          setShowForm={setShowForm}
        />
      )}
    </div>
  );
}

export default EstimateList;