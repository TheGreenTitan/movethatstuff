///var/www/movethatstuff/frontend/src/components/Layout.js//
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import IntakeForm from './IntakeForm'; // Adjust path if needed

function Layout({ children }) {
  const navigate = useNavigate();
  const [showIntakeModal, setShowIntakeModal] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const handleCloseModal = () => {
    setShowIntakeModal(false);
  };

  return (
    <div>
      {/* Header/Navbar */}
      <nav id="app-header" className="navbar navbar-expand-lg navbar-dark">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/dashboard">MoveThatStuff CRM</Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <button className="btn btn-link nav-link" onClick={() => setShowIntakeModal(true)}>Intake Form</button>
              </li>
              <li className="nav-item">
                <button className="btn btn-danger nav-link" onClick={handleLogout}>Logout</button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Sidebar and Main Content */}
      <div className="container-fluid">
        <div className="row">
          {/* Sidebar */}
          <nav id="app-sidebar" className="col-md-3 col-lg-2 d-md-block sidebar">
            <div className="position-sticky pt-3">
              <ul className="nav flex-column">
                <li className="nav-item">
                  <Link className="nav-link" to="/dashboard">Dashboard</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/customers">Customers</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/estimates">Estimates</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/settings">Settings</Link>
                </li>
                {/* Add more links later */}
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="col-md-9 ms-sm-auto col-lg-10 px-md-4">
            {children}
          </main>
        </div>
      </div>

      {/* Intake Form Modal */}
      {showIntakeModal && (
        <div className="modal show d-block" tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Intake Form</h5>
                <button type="button" className="btn-close" onClick={handleCloseModal} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <IntakeForm onSuccess={handleCloseModal} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;