import { useState, type FormEvent } from 'react';
import { useApp } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Button, Modal, SelectField, TextAreaField, TextField, useFeedback } from '@/components/ui';
import { errorMessage, hasErrors, nonNegative, positive, required } from '@/lib/validation';
import { roomService } from '@/services';
import type { Room, RoomCategory, RoomStatus } from '@/types/domain';

/* ---------- Room board ---------- */

export function RoomBoard({ rooms, categories, onSelect }: { rooms: Room[]; categories: RoomCategory[]; onSelect: (room: Room) => void }) {
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  const code = new Map(categories.map((c) => [c.id, c.code]));
  const stateLabel: Record<RoomStatus, string> = { occupied: 'occupied', vacant: 'vacant', maintenance: 'out of service' };
  return (
    <div>
      {floors.map((floor) => (
        <div key={floor} className="board-floor">
          <div className="board-floor-label">Floor {floor}</div>
          <div className="board-rooms">
            {rooms.filter((r) => r.floor === floor).map((room) => (
              <button
                key={room.id}
                type="button"
                className={`room-tile ${room.status}`}
                aria-label={`Room ${room.number}, ${stateLabel[room.status]}${room.cleaning !== 'clean' ? ', needs cleaning' : ''}`}
                onClick={() => onSelect(room)}
              >
                <b>{room.number}</b>
                <small>{code.get(room.categoryId)}</small>
                {room.cleaning !== 'clean' && room.status !== 'maintenance' && <i className="flag" />}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="legend" style={{ marginTop: 12 }}>
        <span><i className="chart-swatch" style={{ background: 'var(--tile-occupied)' }} />Occupied</span>
        <span><i className="chart-swatch" style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }} />Vacant</span>
        <span><i className="chart-swatch" style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)' }} />Out of service</span>
        <span><i className="chart-swatch" style={{ background: 'var(--brass)', borderRadius: '50%' }} />Needs cleaning</span>
      </div>
    </div>
  );
}

/* ---------- Room form ---------- */

export function RoomFormModal({ room, categories, onClose }: { room?: Room; categories: RoomCategory[]; onClose: () => void }) {
  const { hotel } = useApp();
  const { toast } = useFeedback();
  const [form, setForm] = useState({
    number: room?.number ?? '',
    floor: room?.floor ?? 1,
    categoryId: room?.categoryId ?? categories[0]?.id ?? '',
    priceOverride: room?.priceOverride ?? '',
    notes: room?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const category = categories.find((c) => c.id === form.categoryId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      number: required(form.number, 'Room number'),
      floor: Number(form.floor) < 0 ? 'Enter a valid floor' : '',
      categoryId: required(form.categoryId, 'Category'),
      priceOverride: form.priceOverride === '' ? '' : nonNegative(Number(form.priceOverride), 'Price'),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      await roomService.saveRoom({
        id: room?.id,
        number: form.number.trim(),
        floor: Number(form.floor),
        categoryId: form.categoryId,
        priceOverride: form.priceOverride === '' ? null : Number(form.priceOverride),
        notes: form.notes,
        status: room?.status ?? 'vacant',
        cleaning: room?.cleaning ?? 'clean',
      });
      toast(room ? `Room ${form.number} updated` : `Room ${form.number} added`);
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title={room ? `Edit room ${room.number}` : 'Add a room'}
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="room-form">{room ? 'Save room' : 'Add room'}</Button></>}
    >
      <form id="room-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="Room number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} error={errors.number} autoComplete="off" />
        <TextField label="Floor" type="number" min={0} value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} error={errors.floor} />
        <SelectField label="Category" wrapClass="full" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} error={errors.categoryId}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <TextField
          label={`Price override (${hotel.currency})`}
          wrapClass="full"
          type="number"
          min={0}
          placeholder={category ? `Category price: ${category.basePrice}` : ''}
          value={form.priceOverride}
          onChange={(e) => setForm({ ...form, priceOverride: e.target.value })}
          error={errors.priceOverride}
          hint="Leave empty to use the category price."
        />
        <TextAreaField label="Notes" wrapClass="full" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

/* ---------- Category form ---------- */

export function CategoryFormModal({ category, onClose }: { category?: RoomCategory; onClose: () => void }) {
  const { hotel } = useApp();
  const { toast } = useFeedback();
  const [form, setForm] = useState({
    name: category?.name ?? '',
    code: category?.code ?? '',
    description: category?.description ?? '',
    basePrice: category?.basePrice ?? 0,
    capacity: category?.capacity ?? 2,
    bed: category?.bed ?? 'King',
    sizeSqm: category?.sizeSqm ?? 30,
    view: category?.view ?? '',
    amenities: category?.amenities.join(', ') ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      name: required(form.name, 'Name'),
      code: required(form.code, 'Code'),
      basePrice: positive(Number(form.basePrice), 'Price'),
      capacity: positive(Number(form.capacity), 'Capacity'),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      await roomService.saveCategory({
        ...form,
        id: category?.id,
        code: form.code.trim().toUpperCase(),
        basePrice: Number(form.basePrice),
        capacity: Number(form.capacity),
        sizeSqm: Number(form.sizeSqm),
        amenities: form.amenities.split(',').map((a) => a.trim()).filter(Boolean),
        art: category?.art ?? 'courtyard',
      });
      toast(category ? `${form.name} updated` : `${form.name} added`);
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title={category ? `Edit ${category.name}` : 'Add a room category'}
      size="lg"
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="category-form">{category ? 'Save category' : 'Add category'}</Button></>}
    >
      <form id="category-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} autoComplete="off" />
        <TextField label="Short code" maxLength={4} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} error={errors.code} autoComplete="off" />
        <TextField label={`Price per night (${hotel.currency})`} type="number" min={0} value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} error={errors.basePrice} />
        <TextField label="Sleeps" type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} error={errors.capacity} />
        <TextField label="Bed" value={form.bed} onChange={(e) => setForm({ ...form, bed: e.target.value })} />
        <TextField label="Size (m²)" type="number" min={0} value={form.sizeSqm} onChange={(e) => setForm({ ...form, sizeSqm: Number(e.target.value) })} />
        <TextField label="View" wrapClass="full" value={form.view} onChange={(e) => setForm({ ...form, view: e.target.value })} />
        <TextField label="Amenities" wrapClass="full" hint="Separate with commas." value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
        <TextAreaField label="Description" wrapClass="full" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}
