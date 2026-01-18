import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Map as MapIcon, Search } from 'lucide-react';
import MapDisplay from './components/MapDisplay';
import { SortableItem } from './components/SortableItem';
import { Location } from './types';

// Nominatim OpenStreetMap Search Service
const searchPlace = async (query: string) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Search failed", error);
    return [];
  }
};

const reverseGeocode = async (lat: number, lng: number) => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        return data.display_name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
        return `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

function App() {
  const [locations, setLocations] = useState<Location[]>(() => {
    const saved = localStorage.getItem('itinerary-locations');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    localStorage.setItem('itinerary-locations', JSON.stringify(locations));
  }, [locations]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocations((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addLocation = async (lat: number, lng: number, name?: string) => {
    const resolvedName = name || await reverseGeocode(lat, lng);
    const newLocation: Location = {
      id: uuidv4(),
      name: resolvedName.split(',')[0], // Keep it short initially
      lat,
      lng,
      notes: ''
    };
    setLocations([...locations, newLocation]);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    const results = await searchPlace(searchQuery);
    setIsSearching(false);

    if (results && results.length > 0) {
      const first = results[0];
      await addLocation(parseFloat(first.lat), parseFloat(first.lon), first.display_name);
      setSearchQuery('');
    } else {
      alert('Place not found');
    }
  };

  const removeLocation = (id: string) => {
    setLocations(locations.filter(l => l.id !== id));
  };

  const updateLocation = (id: string, updates: Partial<Location>) => {
    setLocations(locations.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  return (
    <div className="container-fluid p-0">
      <Row className="g-0">
        {/* Sidebar */}
        <Col md={4} lg={3} className="sidebar d-flex flex-column">
          <div className="mb-4">
            <h3 className="d-flex align-items-center gap-2 mb-3">
              <MapIcon /> Itinerary
            </h3>
            
            <Form onSubmit={handleSearch} className="d-flex gap-2 mb-3">
              <Form.Control 
                type="text" 
                placeholder="Search place..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Button type="submit" variant="primary" disabled={isSearching}>
                {isSearching ? '...' : <Search size={18} />}
              </Button>
            </Form>
            
            <p className="text-muted small">
              Click map to add stops. Drag items to reorder.
            </p>
          </div>

          <div className="flex-grow-1 overflow-auto">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={locations.map(l => l.id)}
                strategy={verticalListSortingStrategy}
              >
                {locations.length === 0 ? (
                  <div className="text-center text-muted mt-5">
                    <p>No stops yet.</p>
                    <p>Search or click the map to start your journey!</p>
                  </div>
                ) : (
                  locations.map((location) => (
                    <SortableItem 
                      key={location.id} 
                      id={location.id} 
                      location={location} 
                      onRemove={removeLocation}
                      onUpdate={updateLocation}
                    />
                  ))
                )}
              </SortableContext>
            </DndContext>
          </div>

          <div className="mt-3 pt-3 border-top">
             <div className="d-flex justify-content-between align-items-center">
                <strong>Total Stops: {locations.length}</strong>
                {locations.length > 0 && (
                    <Button variant="outline-danger" size="sm" onClick={() => setLocations([])}>
                        <Trash2 size={16} className="me-1" /> Clear
                    </Button>
                )}
             </div>
          </div>
        </Col>

        {/* Map */}
        <Col md={8} lg={9}>
          <MapDisplay locations={locations} onAddLocation={addLocation} />
        </Col>
      </Row>
    </div>
  );
}

export default App;
