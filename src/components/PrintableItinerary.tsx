import { Day, Location, Route, TRANSPORT_LABELS } from '../types';
import { CheckSquare } from 'lucide-react';

interface PrintableItineraryProps {
  days: Day[];
  locations: Location[];
  routes: Route[];
  startDate: string;
  endDate: string;
}

export function PrintableItinerary({ days, locations, routes, startDate, endDate }: PrintableItineraryProps) {
  const getDayLocations = (dayId: string) => {
    return locations
      .filter(l => l.startDayId === dayId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const getRouteTo = (toId: string) => {
    return routes.find(r => r.toLocationId === toId);
  };

  return (
    <div className="printable-itinerary d-none d-print-block">
      <div className="text-center mb-5 border-bottom pb-3">
        <h1 className="display-4 fw-bold mb-2">Travel Itinerary</h1>
        <p className="lead text-muted">{new Date(startDate).toLocaleDateString()} — {new Date(endDate).toLocaleDateString()}</p>
      </div>

      <div className="itinerary-content">
        {days.map((day, index) => {
          const dayLocs = getDayLocations(day.id);
          if (dayLocs.length === 0) return null;

          return (
            <div key={day.id} className="day-section mb-5 break-inside-avoid">
              <h3 className="border-bottom pb-2 mb-3 bg-light p-2 rounded">
                Day {index + 1}: {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              
              <div className="locations-list ps-3 border-start border-3 border-secondary">
                {dayLocs.map((loc, idx) => {
                  const route = getRouteTo(loc.id);
                  return (
                    <div key={loc.id} className="location-item mb-4 position-relative">
                      {/* Transport Connection */}
                      {route && (
                        <div className="transport-connection mb-2 ms-4 text-muted fst-italic small">
                          <span className="me-2">↓</span>
                          Travel via {TRANSPORT_LABELS[route.transportType]} 
                          {route.duration && ` (${route.duration})`}
                        </div>
                      )}

                      <div className="d-flex align-items-start">
                        <div className="marker-number fw-bold me-3 bg-dark text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px', fontSize: '12px' }}>
                          {idx + 1}
                        </div>
                        <div className="flex-grow-1">
                          <h4 className="h5 mb-1 d-flex align-items-center gap-2">
                            {loc.name}
                            {loc.category && <span className="badge bg-secondary fw-normal text-uppercase" style={{ fontSize: '0.6rem' }}>{loc.category}</span>}
                          </h4>
                          
                          {loc.notes && (
                            <p className="text-muted mb-2 text-pre-wrap">{loc.notes}</p>
                          )}

                          {loc.checklist && loc.checklist.length > 0 && (
                            <div className="checklist mt-2 row">
                              {loc.checklist.map(item => (
                                <div key={item.id} className="col-6 small d-flex align-items-center gap-2 mb-1">
                                  <CheckSquare size={14} className={item.completed ? "text-success" : "text-muted"} />
                                  <span className={item.completed ? "text-decoration-line-through text-muted" : ""}>{item.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="text-center mt-5 pt-3 border-top text-muted small">
        Generated with Itinerary Planner
      </div>
    </div>
  );
}
