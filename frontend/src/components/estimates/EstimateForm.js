///var/www/movethatstuff/frontend/src/components/estimates/EstimateForm.js//
import React from 'react';

function EstimateForm({ formData, handleInputChange, handleSubmit, customers, editingId, setShowForm }) {
  return (
    <div className="modal show d-block" tabIndex="-1">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{editingId ? 'Edit Estimate' : 'Create New Estimate'}</h5>
            <button type="button" className="btn-close" onClick={() => setShowForm(false)}></button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label htmlFor="customer_id" className="form-label">Customer</label>
                    <select
                      className="form-control"
                      id="customer_id"
                      name="customer_id"
                      value={formData.customer_id}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select Customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} ({customer.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="move_type" className="form-label">Move Type</label>
                    <select
                      className="form-control"
                      id="move_type"
                      name="move_type"
                      value={formData.move_type}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="house">House</option>
                      <option value="apartment">Apartment</option>
                      <option value="commercial">Commercial</option>
                      <option value="storage">Storage</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="move_service" className="form-label">Move Service</label>
                    <select
                      className="form-control"
                      id="move_service"
                      name="move_service"
                      value={formData.move_service}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="moving">Moving</option>
                      <option value="packing">Packing</option>
                      <option value="moving and packing">Moving and Packing</option>
                      <option value="junk removal">Junk Removal</option>
                      <option value="labor only">Labor Only</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="move_date" className="form-label">Move Date</label>
                    <input
                      type="date"
                      className="form-control"
                      id="move_date"
                      name="move_date"
                      value={formData.move_date}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="move_time" className="form-label">Move Time</label>
                    <input
                      type="time"
                      className="form-control"
                      id="move_time"
                      name="move_time"
                      value={formData.move_time}
                      onChange={handleInputChange}
                    />
                  </div>
                  <h6>Origin</h6>
                  <div className="mb-3">
                    <label htmlFor="origin_address" className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-control"
                      id="origin_address"
                      name="origin_address"
                      value={formData.origin_address}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="origin_city" className="form-label">City</label>
                    <input
                      type="text"
                      className="form-control"
                      id="origin_city"
                      name="origin_city"
                      value={formData.origin_city}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="origin_state" className="form-label">State</label>
                    <input
                      type="text"
                      className="form-control"
                      id="origin_state"
                      name="origin_state"
                      value={formData.origin_state}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="origin_zip" className="form-label">Zip</label>
                    <input
                      type="text"
                      className="form-control"
                      id="origin_zip"
                      name="origin_zip"
                      value={formData.origin_zip}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="origin_floor" className="form-label">Floor</label>
                    <input
                      type="text"
                      className="form-control"
                      id="origin_floor"
                      name="origin_floor"
                      value={formData.origin_floor}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-check mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="origin_elevator"
                      name="origin_elevator"
                      checked={formData.origin_elevator}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="origin_elevator" className="form-check-label">Elevator</label>
                  </div>
                  <div className="form-check mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="origin_stairs"
                      name="origin_stairs"
                      checked={formData.origin_stairs}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="origin_stairs" className="form-check-label">Stairs</label>
                  </div>
                  <div className="form-check mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="origin_long_walk"
                      name="origin_long_walk"
                      checked={formData.origin_long_walk}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="origin_long_walk" className="form-check-label">Long Walk</label>
                  </div>
                </div>
                <div className="col-md-6">
                  <h6>Destination</h6>
                  <div className="mb-3">
                    <label htmlFor="destination_address" className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-control"
                      id="destination_address"
                      name="destination_address"
                      value={formData.destination_address}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="destination_city" className="form-label">City</label>
                    <input
                      type="text"
                      className="form-control"
                      id="destination_city"
                      name="destination_city"
                      value={formData.destination_city}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="destination_state" className="form-label">State</label>
                    <input
                      type="text"
                      className="form-control"
                      id="destination_state"
                      name="destination_state"
                      value={formData.destination_state}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="destination_zip" className="form-label">Zip</label>
                    <input
                      type="text"
                      className="form-control"
                      id="destination_zip"
                      name="destination_zip"
                      value={formData.destination_zip}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="destination_floor" className="form-label">Floor</label>
                    <input
                      type="text"
                      className="form-control"
                      id="destination_floor"
                      name="destination_floor"
                      value={formData.destination_floor}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-check mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="destination_elevator"
                      name="destination_elevator"
                      checked={formData.destination_elevator}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="destination_elevator" className="form-check-label">Elevator</label>
                  </div>
                  <div className="form-check mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="destination_stairs"
                      name="destination_stairs"
                      checked={formData.destination_stairs}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="destination_stairs" className="form-check-label">Stairs</label>
                  </div>
                  <div className="form-check mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="destination_long_walk"
                      name="destination_long_walk"
                      checked={formData.destination_long_walk}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="destination_long_walk" className="form-check-label">Long Walk</label>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="notes" className="form-label">Notes</label>
                    <textarea
                      className="form-control"
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="status" className="form-label">Status</label>
                    <select
                      className="form-control"
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="new lead">New Lead</option>
                      <option value="estimate">Estimate</option>
                      <option value="booked">Booked</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                  <h6>Estimate Details</h6>
                  <div className="mb-3">
                    <label htmlFor="method" className="form-label">Method</label>
                    <select
                      className="form-control"
                      id="method"
                      name="method"
                      value={formData.method}
                      onChange={handleInputChange}
                    >
                      <option value="inventory">Inventory</option>
                      <option value="size">Size</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="total_weight" className="form-label">Total Weight</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="total_weight"
                      name="total_weight"
                      value={formData.total_weight}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="total_volume" className="form-label">Total Volume</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="total_volume"
                      name="total_volume"
                      value={formData.total_volume}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="estimated_hours" className="form-label">Estimated Hours</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="estimated_hours"
                      name="estimated_hours"
                      value={formData.estimated_hours}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="labor_cost" className="form-label">Labor Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="labor_cost"
                      name="labor_cost"
                      value={formData.labor_cost}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="truck_cost" className="form-label">Truck Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="truck_cost"
                      name="truck_cost"
                      value={formData.truck_cost}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="fuel_cost" className="form-label">Fuel Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="fuel_cost"
                      name="fuel_cost"
                      value={formData.fuel_cost}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="additional_services_cost" className="form-label">Additional Services Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="additional_services_cost"
                      name="additional_services_cost"
                      value={formData.additional_services_cost}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="total_cost" className="form-label">Total Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="total_cost"
                      name="total_cost"
                      value={formData.total_cost}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="number_of_movers" className="form-label">Number of Movers</label>
                    <input
                      type="number"
                      className="form-control"
                      id="number_of_movers"
                      name="number_of_movers"
                      value={formData.number_of_movers}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="number_of_trucks" className="form-label">Number of Trucks</label>
                    <input
                      type="number"
                      className="form-control"
                      id="number_of_trucks"
                      name="number_of_trucks"
                      value={formData.number_of_trucks}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="distance_miles" className="form-label">Distance Miles</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="distance_miles"
                      name="distance_miles"
                      value={formData.distance_miles}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="travel_time" className="form-label">Travel Time</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="travel_time"
                      name="travel_time"
                      value={formData.travel_time}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Save</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EstimateForm;
