///var/www/movethatstuff/frontend/src/components/estimates/LocationsCard.js//
import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { GoogleMap, Marker, DirectionsRenderer, StandaloneSearchBox } from '@react-google-maps/api';
import api from '../../utils/api';
import io from 'socket.io-client';

function LocationsCard({ estimateId, stops, depotAddress, depotPos, distance_miles, depot_travel_time, move_travel_time, fetchEstimate, showMap = true }) {
  const [error, setError] = useState('');
  const [directions, setDirections] = useState(null);
  const [showAddStopForm, setShowAddStopForm] = useState(false);
  const [newStopAddress, setNewStopAddress] = useState('');
  const [newStop, setNewStop] = useState({ address: '', city: '', state: '', zip: '' });
  const searchBoxRef = useRef(null);
  const socket = useRef(null);

  useEffect(() => {
    socket.current = io();
    socket.current.on('connect', () => {
      socket.current.emit('joinEstimate', estimateId);
    });

    socket.current.on('update', () => {
      fetchEstimate();
    });

    return () => {
      socket.current.disconnect();
    };
  }, [estimateId, fetchEstimate]);

  useEffect(() => {
    if (stops && depotPos && window.google && window.google.maps) {
      if (stops.length < 2) {
        setError('Insufficient locations for map route.');
        return;
      }

      const originStop = stops.find(s => s.type === 'origin');
      const destinationStop = stops.find(s => s.type === 'destination');

      if (!originStop || !destinationStop || !originStop.lat || !originStop.lng || !destinationStop.lat || !destinationStop.lng || isNaN(parseFloat(originStop.lat)) || isNaN(parseFloat(originStop.lng)) || isNaN(parseFloat(destinationStop.lat)) || isNaN(parseFloat(destinationStop.lng))) {
        setError('Invalid origin or destination coordinates. Cannot load map route.');
        return;
      }

      const originPos = { lat: parseFloat(originStop.lat), lng: parseFloat(originStop.lng) };
      const destPos = { lat: parseFloat(destinationStop.lat), lng: parseFloat(destinationStop.lng) };

      const waypoints = stops.filter(s => s.type === 'stop' && s.lat && s.lng && !isNaN(parseFloat(s.lat)) && !isNaN(parseFloat(s.lng))).map(stop => ({
        location: { lat: parseFloat(stop.lat), lng: parseFloat(stop.lng) },
        stopover: true
      }));

      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin: depotPos,
          destination: depotPos,
          waypoints: [
            { location: originPos, stopover: true },
            ...waypoints,
            { location: destPos, stopover: true }
          ],
          travelMode: 'DRIVING',
          optimizeWaypoints: false
        },
        (result, status) => {
          if (status === 'OK') {
            setDirections(result);
          } else {
            console.error(`Directions request failed: ${status}`);
            setError(`Failed to load driving route: ${status}`);
          }
        }
      );
    }
  }, [stops, depotPos]);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(stops);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update types based on new order
    items[0].type = 'origin';
    items[items.length - 1].type = 'destination';
    for (let i = 1; i < items.length - 1; i++) {
      items[i].type = 'stop';
    }

    try {
      await api.post(`/estimates/${estimateId}/reorder-stops`, { order: items.map(item => item.id) });
      await api.post(`/estimates/${estimateId}/calculate`);
      fetchEstimate(); // Fallback refresh
    } catch (err) {
      setError('Failed to reorder stops: ' + err.response?.data || err.message);
    }
  };

  const handleDeleteStop = async (stopId, type) => {
    const confirmMsg = type === 'origin' || type === 'destination' ? `Are you sure you want to delete the ${type}? The new ${type === 'origin' ? 'first' : 'last'} location will be reassigned as ${type}.` : 'Are you sure you want to delete this stop?';
    if (window.confirm(confirmMsg)) {
      try {
        await api.delete(`/estimates/${estimateId}/stops/${stopId}`);
        await api.post(`/estimates/${estimateId}/calculate`);
        fetchEstimate(); // Fallback refresh
      } catch (err) {
        setError('Failed to delete stop: ' + err.response?.data || err.message);
      }
    }
  };

  const onLoad = (ref) => {
    searchBoxRef.current = ref;
  };

  const onPlacesChanged = () => {
    const places = searchBoxRef.current.getPlaces();
    if (places.length > 0) {
      const place = places[0];
      const addressComponents = place.address_components.reduce((acc, component) => {
        const type = component.types[0];
        if (type === 'street_number' || type === 'route') {
          acc.address = (acc.address || '') + ' ' + component.long_name;
        } else if (type === 'locality') {
          acc.city = component.long_name;
        } else if (type === 'administrative_area_level_1') {
          acc.state = component.short_name;
        } else if (type === 'postal_code') {
          acc.zip = component.long_name;
        }
        return acc;
      }, { address: '', city: '', state: '', zip: '' });

      if (!addressComponents.zip) {
        setError('Zip code is required. Please select a complete address.');
        return;
      }

      setNewStop({
        address: addressComponents.address.trim() || place.formatted_address,
        city: addressComponents.city || '',
        state: addressComponents.state || '',
        zip: addressComponents.zip || ''
      });
      setNewStopAddress(place.formatted_address);
    }
  };

  const handleAddStopSubmit = async (e) => {
    e.preventDefault();
    if (!newStop.zip) return setError('Zip code is required.');
    try {
      await api.post(`/estimates/${estimateId}/stops`, newStop);
      await api.post(`/estimates/${estimateId}/calculate`);
      setShowAddStopForm(false);
      setNewStop({ address: '', city: '', state: '', zip: '' });
      setNewStopAddress('');
      fetchEstimate(); // Fallback refresh
      setError('');
    } catch (err) {
      setError('Failed to add stop or recalculate: ' + err.response?.data || err.message);
    }
  };

  return (
    <div className="card mb-3">
      <div className="card-body">
        <h5 className="card-title">Move Locations</h5>
        <p><strong>Depot:</strong> {depotAddress || 'N/A'}</p>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="locations">
            {(provided) => (
              <ul className="list-group" {...provided.droppableProps} ref={provided.innerRef}>
                {stops && stops.map((stop, index) => (
                  <Draggable key={stop.id} draggableId={stop.id.toString()} index={index}>
                    {(provided) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <span>
                          <strong>{stop.type.charAt(0).toUpperCase() + stop.type.slice(1)} (Sequence {stop.sequence}):</strong> {stop.address || 'N/A'}, {stop.city || 'N/A'}, {stop.state || 'N/A'} {stop.zip}
                        </span>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStop(stop.id, stop.type)}>Delete</button>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
        <p><strong>Depot:</strong> {depotAddress || 'N/A'}</p>
        <hr />
        <div style={{ fontSize: '0.9em' }}>
          <span>📏 {distance_miles || 0} mi</span> &nbsp;
          <span>⏱️ Depot: {depot_travel_time || 0} h</span> &nbsp;
          <span>⏱️ Move: {move_travel_time || 0} h</span>
        </div>
        <button className="btn btn-primary mt-2" onClick={() => setShowAddStopForm(!showAddStopForm)}>
          {showAddStopForm ? 'Cancel' : 'Add Stop'}
        </button>
        {error && (
          <div className="alert alert-danger mt-2" role="alert">
            {error}
          </div>
        )}
        {showAddStopForm && (
          <form onSubmit={handleAddStopSubmit} className="mt-3">
            <StandaloneSearchBox onLoad={onLoad} onPlacesChanged={onPlacesChanged}>
              <input
                type="text"
                className="form-control mb-3"
                placeholder="Enter address for autocomplete"
                value={newStopAddress}
                onChange={(e) => setNewStopAddress(e.target.value)}
              />
            </StandaloneSearchBox>
            <button type="submit" className="btn btn-success">Save Stop</button>
          </form>
        )}
      </div>
      {showMap && (
    <div className="card-body">
      <h5 className="card-title">Route Map</h5>
      {error && <div className="alert alert-danger">{error}</div>}
      <GoogleMap
        mapContainerStyle={{ height: '400px', width: '100%' }}
        center={depotPos || { lat: 36.15, lng: -95.99 }} // Tulsa approx
        zoom={10}
      >
        {depotPos && <Marker position={depotPos} label="Depot" />}
        {stops && stops.map((stop, index) => (
          stop.lat && stop.lng && !isNaN(parseFloat(stop.lat)) && !isNaN(parseFloat(stop.lng)) && <Marker key={index} position={{ lat: parseFloat(stop.lat), lng: parseFloat(stop.lng) }} label={stop.type.charAt(0).toUpperCase() + stop.type.slice(1)} />
        ))}
        {directions && <DirectionsRenderer directions={directions} />}
      </GoogleMap>
    </div>
      )}
      </div>
  );
}

export default LocationsCard;