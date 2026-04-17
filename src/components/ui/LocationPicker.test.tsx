import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LocationPicker } from './LocationPicker';

// react-leaflet doesn't run in jsdom — mock the whole module
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({
    invalidateSize: vi.fn(),
    fitBounds: vi.fn(),
    setView: vi.fn(),
    panTo: vi.fn(),
    getZoom: vi.fn().mockReturnValue(10),
  }),
  useMapEvents: () => null,
}));

describe('LocationPicker', () => {
  it('renders a "Pick on map" button', () => {
    render(<LocationPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /pick on map/i })).toBeInTheDocument();
  });

  it('map is hidden initially', () => {
    render(<LocationPicker value={null} onChange={vi.fn()} />);
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
  });

  it('clicking button shows the map and coord inputs', () => {
    render(<LocationPicker value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Lat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Lng')).toBeInTheDocument();
  });

  it('clicking button again hides the map', () => {
    render(<LocationPicker value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    fireEvent.click(screen.getByRole('button', { name: /close map/i }));
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
  });

  it('shows current coords in inputs when value is provided', () => {
    render(<LocationPicker value={{ lat: 35.6762, lng: 139.6503 }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    expect((screen.getByPlaceholderText('Lat') as HTMLInputElement).value).toBe('35.67620');
    expect((screen.getByPlaceholderText('Lng') as HTMLInputElement).value).toBe('139.65030');
  });

  it('clear button calls onChange(null)', () => {
    const onChange = vi.fn();
    render(<LocationPicker value={{ lat: 35.6762, lng: 139.6503 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('valid lat + lng on blur calls onChange with parsed coords', () => {
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));

    const latInput = screen.getByPlaceholderText('Lat');
    const lngInput = screen.getByPlaceholderText('Lng');

    fireEvent.change(latInput, { target: { value: '48.8566' } });
    fireEvent.change(lngInput, { target: { value: '2.3522' } });
    fireEvent.blur(latInput);
    fireEvent.blur(lngInput);

    expect(onChange).toHaveBeenCalledWith({ lat: 48.8566, lng: 2.3522 });
  });

  it('out-of-range lat adds error styling on blur', () => {
    render(<LocationPicker value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    const latInput = screen.getByPlaceholderText('Lat');
    fireEvent.change(latInput, { target: { value: '999' } });
    fireEvent.blur(latInput);
    expect(latInput).toHaveClass('border-destructive');
  });

  it('out-of-range lng adds error styling on blur', () => {
    render(<LocationPicker value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    const lngInput = screen.getByPlaceholderText('Lng');
    fireEvent.change(lngInput, { target: { value: '-999' } });
    fireEvent.blur(lngInput);
    expect(lngInput).toHaveClass('border-destructive');
  });
});
