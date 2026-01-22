import { Day, Location, LocationCategory, DaySection } from '../types';

interface CalendarViewProps {
  days: Day[];
  locations: Location[];
  onSelectLocation: (id: string) => void;
}

const CATEGORY_COLORS: Record<LocationCategory, string> = {
  sightseeing: '#0d6efd',
  dining: '#fd7e14',
  hotel: '#6f42c1',
  transit: '#20c997',
  other: '#6c757d'
};

const SECTION_ORDER: DaySection[] = ['morning', 'afternoon', 'evening'];
const getSectionIndex = (section?: DaySection) => {
    if (!section) return 0;
    return SECTION_ORDER.indexOf(section);
};

export function CalendarView({ days, locations, onSelectLocation }: CalendarViewProps) {
  if (days.length === 0) return <div className="p-4 text-center text-muted">No dates selected</div>;

  const months: { [key: string]: Day[] } = {};
  days.forEach(day => {
    const d = new Date(day.date);
    const key = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!months[key]) months[key] = [];
    months[key].push(day);
  });

  // Map day ID to index for quick lookups
  const dayIndexMap = new Map<string, number>();
  days.forEach((d, i) => dayIndexMap.set(d.id, i));

  const getLocationsForDay = (dayId: string) => {
    const currentDayIndex = dayIndexMap.get(dayId);
    if (currentDayIndex === undefined) return [];

    return locations.filter(loc => {
      if (!loc.startDayId) return false;
      const startDayIndex = dayIndexMap.get(loc.startDayId);
      if (startDayIndex === undefined) return false;

      // Calculate span in days
      // 3 slots per day.
      // Total slots from start of trip = startDayIndex * 3 + startSlotIndex
      // End slot = Start total + duration - 1
      // Current day covers slots: currentDayIndex * 3 to currentDayIndex * 3 + 2
      
      const startSlotIndex = getSectionIndex(loc.startSlot);
      const absStartSlot = startDayIndex * 3 + startSlotIndex;
      const absEndSlot = absStartSlot + (loc.duration || 1) - 1;

      const dayStartSlot = currentDayIndex * 3;
      const dayEndSlot = dayStartSlot + 2;

      // Check intersection
      return Math.max(absStartSlot, dayStartSlot) <= Math.min(absEndSlot, dayEndSlot);
    });
  };

  return (
    <div className="calendar-view p-3 h-100 overflow-auto">
      {Object.entries(months).map(([monthName, monthDays]) => (
        <div key={monthName} className="mb-4">
          <h5 className="mb-3 text-secondary sticky-top bg-light py-2">{monthName}</h5>
          <div className="calendar-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '8px' 
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center small text-muted fw-bold pb-2 border-bottom">{d}</div>
            ))}
            
            {Array.from({ length: new Date(monthDays[0].date).getDay() }).map((_, i) => (
              <div key={`pad-${i}`} className="calendar-cell empty bg-light opacity-25 rounded"></div>
            ))}

            {monthDays.map(day => {
              const dayLocs = getLocationsForDay(day.id);
              
              return (
                <div key={day.id} className="calendar-cell border rounded p-1 bg-white" style={{ minHeight: '80px' }}>
                  <div className="text-end small text-muted mb-1" style={{ fontSize: '0.75rem' }}>
                    {new Date(day.date).getDate()}
                  </div>
                  <div className="d-flex flex-column gap-1">
                    {dayLocs.map(loc => (
                      <div 
                        key={loc.id} 
                        className="calendar-event rounded px-1 text-truncate"
                        style={{ 
                          fontSize: '0.65rem', 
                          backgroundColor: `${CATEGORY_COLORS[loc.category || 'sightseeing']}20`,
                          color: CATEGORY_COLORS[loc.category || 'sightseeing'],
                          cursor: 'pointer',
                          border: '1px solid transparent'
                        }}
                        onClick={() => onSelectLocation(loc.id)}
                        title={loc.name}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = CATEGORY_COLORS[loc.category || 'sightseeing']}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                      >
                        {loc.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}