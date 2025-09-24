///var/www/movethatstuff/frontend/src/components/CustomerDetail.js//
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';

function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCustomer = useCallback(async () => {
    try {
      const response = await api.get(`/customers/${id}`);
      setCustomer(response.data);
    } catch (err) {
      setError('Failed to load customer details.');
    }
  }, [id]);

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/estimates');
      const customerEstimates = response.data.filter(est => est.opportunity.customer_id === parseInt(id));
      setEstimates(customerEstimates);
      setError('');
    } catch (err) {
      setError('Failed to load estimates.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomer();
    fetchEstimates();
  }, [fetchCustomer, fetchEstimates]);

  const groupedEstimates = estimates.reduce((acc, est) => {
    const status = est.status || 'unknown';
    if (!acc[status]) acc[status] = [];
    acc[status].push(est);
    return acc;
  }, {});

  return (
    <div className="mt-5">
      <h2>Customer Details</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {customer ? (
        <div>
          <p><strong>Name:</strong> {customer.name}</p>
          <p><strong>Email:</strong> {customer.email}</p>
          <p><strong>Phone:</strong> {customer.phone}</p>
          <p><strong>Company Name:</strong> {customer.company_name}</p>
          <p><strong>Source:</strong> {customer.source}</p>
        </div>
      ) : (
        <p>Loading customer...</p>
      )}
      <h3>Estimates</h3>
      {loading ? (
        <p>Loading estimates...</p>
      ) : (
        Object.keys(groupedEstimates).map(status => (
          <div key={status}>
            <h4>{status.charAt(0).toUpperCase() + status.slice(1)}</h4>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Method</th>
                  <th>Total Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groupedEstimates[status].map(est => (
                  <tr key={est.id}>
                    <td>{est.id}</td>
                    <td>{est.method}</td>
                    <td>${est.total_cost.toFixed(2)}</td>
                    <td>{est.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

export default CustomerDetail;