import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Map as SightseeingIcon, Utensils, Bed, Train, Globe } from 'lucide-react';
import { Button, Form, Badge } from 'react-bootstrap';
import { Location, LocationCategory } from '../types';

const CATEGORY_ICONS: Record<LocationCategory, React.ReactNode> = {
  sightseeing: <SightseeingIcon size={14} />,
  dining: <Utensils size={14} />,
  hotel: <Bed size={14} />,
  transit: <Train size={14} />,
  other: <Globe size={14} />
};

interface SortableItemProps {
  id: string;
  location: Location;
  index?: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Location>) => void;
  duration?: number;
  zoomLevel: number;
}

export function SortableItem({
  id,
  location,
  index,
  onRemove,
  onUpdate,
  duration = 1,
  zoomLevel
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: '100%', 
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const toggleCategory = (e: React.MouseEvent) => {
    e.stopPropagation();
    const categories: LocationCategory[] = ['sightseeing', 'dining', 'hotel', 'transit', 'other'];
    const currentIndex = categories.indexOf(location.category || 'sightseeing');
    const nextIndex = (currentIndex + 1) % categories.length;
    onUpdate(id, { category: categories[nextIndex] });
  };

  // Resize logic
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startDuration = duration;
    const rowHeight = 80 * zoomLevel;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const rowDelta = Math.round(deltaY / rowHeight);
      const newDuration = Math.max(1, startDuration + rowDelta);
      
      if (newDuration !== duration) {
        onUpdate(id, { duration: newDuration });
      }
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="sortable-item-wrapper h-100 position-relative">
      <div
        ref={setNodeRef}
        style={style}
        className={`sortable-item h-100 ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
      >
        <div className="d-flex flex-column h-100 w-100">
          <div className="d-flex align-items-center w-100 mb-1">
            <div {...attributes} {...listeners} className="drag-handle">
              <GripVertical size={20} />
            </div>

            {index && (
              <div className="location-index me-2">
                <Badge bg="primary" pill className="small">{index}</Badge>
              </div>
            )}

            <div 
              className="category-icon-wrapper me-2 text-muted" 
              onClick={toggleCategory}
              title="Click to change category"
              style={{ cursor: 'pointer' }}
            >
              {CATEGORY_ICONS[location.category || 'sightseeing']}
            </div>

            <div className="flex-grow-1 min-width-0">
              {isEditing ? (
                <Form.Control
                  autoFocus
                  size="sm"
                  type="text"
                  value={location.name}
                  onChange={(e) => onUpdate(id, { name: e.target.value })}
                  onBlur={() => setIsEditing(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsEditing(false);
                  }}
                />
              ) : (
                <div
                  className="fw-bold text-truncate"
                  style={{ cursor: 'text' }}
                  onClick={() => setIsEditing(true)}
                  title="Click to edit name"
                >
                  {location.name}
                </div>
              )}
            </div>

            <div className="d-flex align-items-center gap-1">
               <Button
                variant="link"
                className="text-danger btn-icon p-1"
                onClick={() => onRemove(id)}
                title="Remove location"
              >
                <X size={18} />
              </Button>
            </div>
          </div>

          <div className="mt-auto pt-1">
              {/* Route info removed, will be rendered between items */}
          </div>
        </div>
      </div>
      
      {!isDragging && (
        <div 
          className="resize-handle"
          onPointerDown={handleResizeStart}
          title="Drag to change duration"
        >
          <div className="resize-handle-bar" />
        </div>
      )}
    </div>
  );
}