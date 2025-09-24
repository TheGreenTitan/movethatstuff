///var/www/movethatstuff/frontend/src/components/estimates/MapCard.js//
import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';

function MapCard({ stops, depotPos }) {
  const [directions, setDirections] = useState(null);
  const [error, setError] = useState('');

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

  return (
    <div className="card">
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
    </div>
  );
}

export default MapCard;