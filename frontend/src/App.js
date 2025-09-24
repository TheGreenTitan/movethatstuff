///var/www/movethatstuff/frontend/src/App.js//
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import CustomerDetail from './components/CustomerDetail';
import { EstimateList, EstimateDetail } from './components/estimates';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import IntakeForm from './components/IntakeForm';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/intake" element={<IntakeForm />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/:id" element={<CustomerDetail />} />
                  <Route path="/estimates" element={<EstimateList />} />
                  <Route path="/estimates/:id" element={<EstimateDetail />} />
                  <Route path="/" element={<Dashboard />} /> {/* Redirect root to dashboard */}
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
