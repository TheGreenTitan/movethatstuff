///var/www/movethatstuff/frontend/src/components/IntakeForm.js//
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadScript, Autocomplete } from '@react-google-maps/api';
import api from '../utils/api';

const libraries = ['places'];

function IntakeForm({ onSuccess }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    source: '',
    origin_address: '',
    origin_city: '',
    origin_state: '',
    origin_zip: '',
    destination_address: '',
    destination_city: '',
    destination_state: '',
    destination_zip: '',
    move_date: '',
    move_type: '',
    move_service: '',
    notes: '',
    move_size: '',
  });
  const [sources, setSources] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [originAutocomplete, setOriginAutocomplete] = useState(null);
  const [destinationAutocomplete, setDestinationAutocomplete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await api.get('/intake/sources');
        setSources(response.data);
      } catch (err) {
        setError('Failed to load sources.');
        console.error('Fetch sources error:', err);
      }
    };
    fetchSources();
  }, []);

  const fetchSizes = async (type) => {
    setSizes([]);
    if (!type) return;
    try {
      const response = await api.get(`/intake/residence-sizes?move_type=${type}`);
      setSizes(response.data);
    } catch (err) {
      setError('Failed to load sizes.');
      console.error('Fetch sizes error:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'move_type') {
        fetchSizes(value);
        newData.move_size = '';
      }
      return newData;
    });
  };

  const onOriginLoad = (autocomplete) => {
    setOriginAutocomplete(autocomplete);
  };

  const onDestinationLoad = (autocomplete) => {
    setDestinationAutocomplete(autocomplete);
  };

  const onOriginPlaceChanged = () => {
    if (originAutocomplete) {
      const place = originAutocomplete.getPlace();
      if (place && place.formatted_address) {
        setFormData(prev => ({
          ...prev,
          origin_address: place.formatted_address,
          origin_city: getComponent(place, 'locality'),
          origin_state: getComponent(place, 'administrative_area_level_1'),
          origin_zip: getComponent(place, 'postal_code'),
        }));
      }
    }
  };

  const onDestinationPlaceChanged = () => {
    if (destinationAutocomplete) {
      const place = destinationAutocomplete.getPlace();
      if (place && place.formatted_address) {
        setFormData(prev => ({
          ...prev,
          destination_address: place.formatted_address,
          destination_city: getComponent(place, 'locality'),
          destination_state: getComponent(place, 'administrative_area_level_1'),
          destination_zip: getComponent(place, 'postal_code'),
        }));
      }
    }
  };

  const getComponent = (place, type) => {
    const component = place.address_components.find(c => c.types.includes(type));
    return component ? component.long_name : '';
  };

  const nextStep = () => {
    setStep(step + 1);
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    console.log('Form data being submitted:', formData);
    try {
      const response = await api.post('/intake', formData);
      setSuccess(response.data.message);
      setStep(1);
      navigate(`/estimates/${response.data.estimate_id}`);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError('Failed to submit lead. Please try again.');
      console.error('Submission error:', JSON.stringify(err.response?.data || err.message));
    }
  };

  return (
    <LoadScript googleMapsApiKey="AIzaSyCIEZbjaw7Dn6pfOG2UT3mBIwLuhzYJt8Y" libraries={libraries}>
      <div className="container mt-5">
        <h2>MoveThatStuff Intake Form - Step {step}/3</h2>
        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit} noValidate>
          {step === 1 && (
            <>
              <div className="mb-3">
                <input type="text" className="form-control" id="name" name="name" placeholder="Name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div className="mb-3">
                <input type="tel" className="form-control" id="phone" name="phone" placeholder="Phone" value={formData.phone} onChange={handleInputChange} />
              </div>
              <div className="mb-3">
                <input type="email" className="form-control" id="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
              </div>
              <div className="mb-3">
                <select className="form-control" id="source" name="source" value={formData.source} onChange={handleInputChange} required>
                  <option value="">How did you hear about us?</option>
                  {sources.map((src, index) => (
                    <option key={index} value={src}>{src}</option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={nextStep}>Next</button>
            </>
          )}
          {step === 2 && (
            <>
              <h6>Origin</h6>
              <div className="mb-3">
                <Autocomplete onLoad={onOriginLoad} onPlaceChanged={onOriginPlaceChanged}>
                  <input type="text" className="form-control" id="origin_address" name="origin_address" placeholder="Origin Address (start typing for suggestions)" value={formData.origin_address} onChange={handleInputChange} required />
                </Autocomplete>
              </div>
              <h6>Destination</h6>
              <div className="mb-3">
                <Autocomplete onLoad={onDestinationLoad} onPlaceChanged={onDestinationPlaceChanged}>
                  <input type="text" className="form-control" id="destination_address" name="destination_address" placeholder="Destination Address (start typing for suggestions)" value={formData.destination_address} onChange={handleInputChange} required />
                </Autocomplete>
              </div>
              <button type="button" className="btn btn-secondary me-2" onClick={prevStep}>Previous</button>
              <button type="button" className="btn btn-primary" onClick={nextStep}>Next</button>
            </>
          )}
          {step === 3 && (
            <>
              <div className="mb-3">
                <input type="date" className="form-control" id="move_date" name="move_date" placeholder="Move Date" value={formData.move_date} onChange={handleInputChange} />
              </div>
              <div className="mb-3">
                <select className="form-control" id="move_service" name="move_service" value={formData.move_service} onChange={handleInputChange} required>
                  <option value="">Select Move Service</option>
                  <option value="moving">Moving</option>
                  <option value="packing">Packing</option>
                  <option value="moving and packing">Moving and Packing</option>
                  <option value="junk removal">Junk Removal</option>
                  <option value="labor only">Labor Only</option>
                </select>
              </div>
              <div className="mb-3">
                <select className="form-control" id="move_type" name="move_type" value={formData.move_type} onChange={handleInputChange} required>
                  <option value="">Select Move Type</option>
                  <option value="house">House</option>
                  <option value="apartment">Apartment</option>
                  <option value="commercial">Commercial</option>
                  <option value="storage">Storage</option>
                </select>
              </div>
              <div className="mb-3">
                <select className="form-control" id="move_size" name="move_size" value={formData.move_size} onChange={handleInputChange} required={formData.move_type !== 'commercial'}>
                  <option value="">Select Move Size</option>
                  {sizes.map((size, index) => (
                    <option key={index} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <textarea className="form-control" id="notes" name="notes" placeholder="Notes" value={formData.notes} onChange={handleInputChange} />
              </div>
              <button type="button" className="btn btn-secondary me-2" onClick={prevStep}>Previous</button>
              <button type="submit" className="btn btn-primary">Submit Lead</button>
            </>
          )}
        </form>
      </div>
    </LoadScript>
  );
}

export default IntakeForm;