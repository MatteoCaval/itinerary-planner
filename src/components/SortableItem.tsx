import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Button, Form, Badge } from 'react-bootstrap';
import { Location } from '../types';

interface SortableItemProps {
  id: string;
  location: Location;
  index?: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Location>) => void;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  duration?: number;
  zoomLevel: number;
}

export function SortableItem({
  id,
  location,
  index,
  onRemove,
  onUpdate,
  onSelect,
  isSelected = false,
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
        className={`sortable-item h-100 ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect?.(id)}
      >
        <div className="d-flex flex-column h-100 w-100">
          <div className="d-flex align-items-center w-100 mb-1">
            <div 
              {...attributes} 
              {...listeners} 
              className="drag-handle"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={20} />
            </div>

            {index && (
              <div className="location-index me-2">
                <Badge bg="primary" pill className="small">{index}</Badge>
              </div>
            )}

            <div className="flex-grow-1 min-width-0 d-flex align-items-center gap-2">
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  title="Click to edit name"
                >
                  {location.name}
                </div>
              )}
              {duration > 1 && (
                <Badge bg="light" text="dark" className="border fw-normal" style={{ fontSize: '0.65rem' }}>
                  {(duration / 3).toFixed(1).replace('.0', '')}d
                </Badge>
              )}
            </div>

            <div className="d-flex align-items-center gap-1">
               <Button
                variant="link"
                className="text-danger btn-icon p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(id);
                }}
                title="Remove location"
              >
                <X size={18} />
              </Button>
            </div>
          </div>

          {location.notes && (
            <div 
              className="notes-preview text-muted small mt-1 mb-2 px-1"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: duration > 1 ? 4 : 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.2',
                maxHeight: duration > 1 ? '4.8em' : '1.2em'
              }}
            >
              {location.notes}
            </div>
          )}

          <div className="mt-auto pt-1">
              {/* Route info detached */}
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