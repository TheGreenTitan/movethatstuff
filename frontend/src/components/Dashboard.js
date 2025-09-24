///var/www/movethatstuff/frontend/src/components/Dashboard.js//
import React, { useState, useEffect } from 'react';
import api from '../utils/api';

function Dashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await api.get('/reports/estimates');
        setReports(response.data);
        setError('');
      } catch (err) {
        setError('Failed to load reports.');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  return (
    <div className="mt-5">
      <h2>Dashboard</h2>
      <p>Welcome to the MoveThatStuff CRM Dashboard!</p>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <p>Loading reports...</p>
      ) : (
        <div className="row">
          {reports.map((report, index) => (
            <div className="col-md-4 mb-3" key={index}>
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Month: {report.month}</h5>
                  <p className="card-text">Estimates: {report.estimate_count}</p>
                  <p className="card-text">Total Revenue: ${parseFloat(report.total_revenue || '0').toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;