import { useMemo, useState, type FormEvent } from 'react';
import { ORDER_STATUS } from '@/app/labels';
import { useAuth } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Badge, Button, EmptyState, IconButton, Modal, PageHead, PageLoading, Panel, SearchInput, SelectField, StatCard, StatGrid, Tabs, TextAreaField, TextField, useFeedback, type StatTone } from '@/components/ui';
import { useLookups, type Lookups } from '@/features/useLookups';
import { useFocusedRecord } from '@/hooks/useFocusedRecord';
import { useResource } from '@/hooks/useResource';
import { fmtTime, money } from '@/lib/format';
import { errorMessage, hasErrors, positive, required } from '@/lib/validation';
import { guestName, ORDER_FLOW, orderTotal, restaurantService } from '@/services';
import type { MenuCategory, MenuItem, OrderItem, OrderStatus, OrderType, RestaurantOrder } from '@/types/domain';

const CATEGORIES: MenuCategory[] = ['Breakfast', 'Starters', 'Mains', 'Desserts', 'Beverages'];
const NEXT_LABEL: Record<string, string> = { new: 'Start preparing', preparing: 'Mark ready', ready: 'Mark delivered' };
const COLUMN_TONE: Partial<Record<OrderStatus, StatTone>> = { new: 'warn', preparing: 'info', ready: 'gold', delivered: 'good' };

function Veg({ yes }: { yes: boolean }) {
  return <i className={`veg ${yes ? '' : 'nonveg'}`} role="img" aria-label={yes ? 'Vegetarian' : 'Non-vegetarian'} />;
}

function NewOrderModal({ menu, lookups, onClose }: { menu: MenuItem[]; lookups: Lookups; onClose: () => void }) {
  const { toast } = useFeedback();
  const [type, setType] = useState<OrderType>('room_service');
  const [reservationId, setReservationId] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');

  const inHouse = lookups.reservations.filter((r) => r.status === 'checked_in');
  const available = menu.filter((m) => m.available && m.name.toLowerCase().includes(search.trim().toLowerCase()));
  const lines: OrderItem[] = Object.entries(items)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => {
      const dish = menu.find((m) => m.id === id)!;
      return { menuItemId: id, name: dish.name, quantity, unitPrice: dish.price };
    });
  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const bump = (id: string, delta: number) => setItems((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      reservationId: type === 'room_service' ? required(reservationId, 'In-house guest') : '',
      tableLabel: type === 'dining_room' ? required(tableLabel, 'Table') : '',
      items: lines.length === 0 ? 'Add at least one item' : '',
    };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      const order = await restaurantService.createOrder({ type, reservationId: reservationId || null, tableLabel, items: lines, notes });
      toast(`Order ${order.code} sent to the kitchen`);
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title="New food order"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="left order-total">Total {money(total)}</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="order-form">Send to kitchen</Button>
        </>
      }
    >
      <form id="order-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <SelectField label="Order type" value={type} onChange={(e) => setType(e.target.value as OrderType)}>
            <option value="room_service">Room service</option>
            <option value="dining_room">Saffron Room (dining)</option>
          </SelectField>
          {type === 'room_service' ? (
            <SelectField label="In-house guest" value={reservationId} onChange={(e) => setReservationId(e.target.value)} error={errors.reservationId}>
              <option value="">Choose room and guest</option>
              {inHouse.map((r) => (
                <option key={r.id} value={r.id}>Room {lookups.roomById.get(r.roomId ?? '')?.number} · {guestName(lookups.guestById.get(r.guestId))}</option>
              ))}
            </SelectField>
          ) : (
            <TextField label="Table" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} error={errors.tableLabel} autoComplete="off" />
          )}
          {type === 'dining_room' && (
            <SelectField label="Charge to a stay (optional)" wrapClass="full" value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
              <option value="">Not a resident</option>
              {inHouse.map((r) => (
                <option key={r.id} value={r.id}>Room {lookups.roomById.get(r.roomId ?? '')?.number} · {guestName(lookups.guestById.get(r.guestId))}</option>
              ))}
            </SelectField>
          )}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Find a dish" label="Find a dish" />
        <div className="dish-list">
          {CATEGORIES.map((category) => {
            const dishes = available.filter((m) => m.category === category);
            if (dishes.length === 0) return null;
            return (
              <div key={category}>
                <div className="search-group" style={{ padding: '10px 0 2px' }}>{category}</div>
                {dishes.map((dish) => (
                  <div key={dish.id} className="order-line">
                    <span className="row" style={{ flexWrap: 'nowrap' }}><Veg yes={dish.vegetarian} /><span>{dish.name}</span></span>
                    <span className="row" style={{ flexWrap: 'nowrap' }}>
                      <span className="muted small nowrap">{money(dish.price)}</span>
                      <span className="qty">
                        <button type="button" aria-label={`Remove one ${dish.name}`} onClick={() => bump(dish.id, -1)}>−</button>
                        <span>{items[dish.id] ?? 0}</span>
                        <button type="button" aria-label={`Add one ${dish.name}`} onClick={() => bump(dish.id, 1)}>+</button>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {errors.items && <span className="field-error" role="alert">{errors.items}</span>}
        <TextAreaField label="Kitchen notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {failure && <div className="alert alert-bad"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

function MenuForm({ item, onClose }: { item?: MenuItem; onClose: () => void }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({
    name: item?.name ?? '',
    category: item?.category ?? ('Mains' as MenuCategory),
    description: item?.description ?? '',
    price: item?.price ?? 0,
    vegetarian: item?.vegetarian ?? true,
    available: item?.available ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { name: required(form.name, 'Name'), price: positive(Number(form.price), 'Price') };
    setErrors(next);
    if (hasErrors(next)) return;
    await restaurantService.saveMenuItem({ ...form, id: item?.id, price: Number(form.price) });
    toast(item ? `${form.name} updated` : `${form.name} added to the menu`);
    onClose();
  };

  return (
    <Modal
      title={item ? `Edit ${item.name}` : 'Add a menu item'}
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="menu-form">{item ? 'Save item' : 'Add item'}</Button></>}
    >
      <form id="menu-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="Name" wrapClass="full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} autoComplete="off" />
        <SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MenuCategory })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectField>
        <TextField label="Price" type="number" min={0} value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} error={errors.price} />
        <TextAreaField label="Description" wrapClass="full" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <label className="check"><input type="checkbox" checked={form.vegetarian} onChange={(e) => setForm({ ...form, vegetarian: e.target.checked })} /> Vegetarian</label>
        <label className="check"><input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} /> Available today</label>
      </form>
    </Modal>
  );
}

function OrderTicket({ order, lookups, focused }: { order: RestaurantOrder; lookups: Lookups; focused: boolean }) {
  const { run, confirm } = useFeedback();
  const stay = order.reservationId ? lookups.reservations.find((r) => r.id === order.reservationId) : undefined;
  const room = stay?.roomId ? lookups.roomById.get(stay.roomId) : undefined;
  const canPost = !!order.reservationId && !order.postedInvoiceId && order.status !== 'cancelled';
  return (
    <article className="ticket" data-testid={`ticket-${order.code}`} data-focused={focused || undefined}>
      <div className="row-between">
        <span className="strong">{order.code}</span>
        <span className="row" style={{ gap: 4 }}>
          <span className="small muted">{fmtTime(order.createdAt)}</span>
          {order.status !== 'delivered' && (
            <IconButton
              icon="x"
              label={`Cancel order ${order.code}`}
              onClick={async () => {
                const ok = await confirm({ title: `Cancel ${order.code}?`, message: 'The kitchen will stop work on this order.', confirmLabel: 'Cancel order', danger: true });
                if (ok) run(() => restaurantService.cancel(order.id), `${order.code} cancelled`);
              }}
            />
          )}
        </span>
      </div>
      <div className="ticket-where">
        <Icon name={order.type === 'room_service' ? 'bed' : 'fork'} size={14} />
        <span>
          {order.type === 'room_service' ? `Room ${room?.number ?? '–'}` : order.tableLabel}
          {stay && ` · ${guestName(lookups.guestById.get(stay.guestId))}`}
        </span>
      </div>
      <ul className="ticket-items">
        {order.items.map((i) => <li key={i.menuItemId}>{i.quantity} × {i.name}</li>)}
      </ul>
      {order.notes && <div className="small" style={{ color: 'var(--warn)' }}>{order.notes}</div>}
      <div className="row-between">
        <span className="strong">{money(orderTotal(order))}</span>
        {order.postedInvoiceId ? <Badge tone="good">On guest bill</Badge> : null}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {NEXT_LABEL[order.status] && (
          <Button size="sm" variant="primary" onClick={() => run(() => restaurantService.advance(order.id))}>{NEXT_LABEL[order.status]}</Button>
        )}
        {canPost && <Button size="sm" onClick={() => run(() => restaurantService.postToBill(order.id), `${order.code} added to the guest bill`)}>Add to bill</Button>}
      </div>
    </article>
  );
}

export default function Restaurant() {
  const lookups = useLookups();
  const { can } = useAuth();
  const { run, confirm } = useFeedback();
  const [tab, setTab] = useState<'orders' | 'menu'>('orders');
  const [ordering, setOrdering] = useState(false);
  const [menuDialog, setMenuDialog] = useState<MenuItem | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data } = useResource(async () => {
    const [menu, orders] = await Promise.all([restaurantService.menu(), restaurantService.orders()]);
    return { menu, orders };
  });
  const focusId = useFocusedRecord(!!data && !!lookups);

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.menu ?? []).filter((m) => (!category || m.category === category) && (!q || `${m.name} ${m.description}`.toLowerCase().includes(q)));
  }, [data, search, category]);

  if (!data || !lookups) return <PageLoading />;

  const orders = data.orders.filter((o) => !typeFilter || o.type === typeFilter);
  const active = data.orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const manageMenu = can('restaurant.menu');
  const countOf = (status: OrderStatus) => data.orders.filter((o) => o.status === status).length;
  const openValue = data.orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).reduce((sum, o) => sum + orderTotal(o), 0);

  return (
    <>
      <PageHead
        title="Restaurant & Room Service"
        subtitle={`${active} orders in progress`}
        actions={
          tab === 'orders'
            ? <Button variant="primary" icon="plus" onClick={() => setOrdering(true)}>New order</Button>
            : manageMenu && <Button variant="primary" icon="plus" onClick={() => setMenuDialog('new')}>Add item</Button>
        }
      />
      <StatGrid>
        <StatCard icon="clipboard" tone="warn" label="New tickets" value={countOf('new')} note="Waiting for the kitchen" />
        <StatCard icon="soup" tone="info" label="Preparing" value={countOf('preparing')} note="On the stove" />
        <StatCard icon="concierge" tone="gold" label="Ready to serve" value={countOf('ready')} note="Waiting to go out" />
        <StatCard icon="coins" label="Value in progress" value={money(openValue)} note={`${active} open orders`} />
      </StatGrid>
      <div style={{ marginBottom: 16 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'orders', label: 'Live orders', count: active },
            { id: 'menu', label: 'Menu', count: data.menu.length },
          ]}
        />
      </div>

      {tab === 'orders' ? (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <select className="input" style={{ width: 'auto' }} aria-label="Order type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All orders</option>
              <option value="room_service">Room service</option>
              <option value="dining_room">Saffron Room</option>
            </select>
          </div>
          <div className="kanban">
            {ORDER_FLOW.map((status) => {
              const column = orders.filter((o) => o.status === status);
              return (
                <section key={status} className="kanban-col" data-tone={COLUMN_TONE[status]} aria-label={ORDER_STATUS[status].label}>
                  <div className="kanban-head"><span>{ORDER_STATUS[status].label}</span><span className="kanban-count">{column.length}</span></div>
                  {column.length === 0 && <p className="kanban-empty">No orders here.</p>}
                  {column.map((order) => <OrderTicket key={order.id} order={order} lookups={lookups} focused={order.id === focusId} />)}
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <Panel>
          <div className="toolbar">
            <SearchInput value={search} onChange={setSearch} placeholder="Find a dish" />
            <select className="input" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="panel-body">
            {filteredMenu.length === 0 ? (
              <EmptyState icon="fork" title="No dishes match" message="Try another search." />
            ) : (
              <div className="menu-grid">
                {filteredMenu.map((item) => (
                  <article key={item.id} className={`menu-card ${item.available ? '' : 'off'}`}>
                    <div className="row-between">
                      <span className="row strong" style={{ gap: 7, flexWrap: 'nowrap' }}><Veg yes={item.vegetarian} />{item.name}</span>
                      <span className="menu-price">{money(item.price)}</span>
                    </div>
                    <p className="small muted">{item.description}</p>
                    <div className="row-between" style={{ marginTop: 'auto' }}>
                      <span className="small muted">{item.category}{item.available ? '' : ' · unavailable'}</span>
                      {manageMenu && (
                        <span className="row" style={{ gap: 0 }}>
                          <Button size="sm" variant="ghost" onClick={() => run(() => restaurantService.saveMenuItem({ ...item, available: !item.available }), item.available ? `${item.name} marked unavailable` : `${item.name} is back on`)}>
                            {item.available ? 'Mark off' : 'Mark on'}
                          </Button>
                          <IconButton icon="edit" label={`Edit ${item.name}`} onClick={() => setMenuDialog(item)} />
                          <IconButton
                            icon="trash"
                            label={`Delete ${item.name}`}
                            onClick={async () => {
                              const ok = await confirm({ title: `Delete ${item.name}?`, message: 'It will no longer appear on the menu.', confirmLabel: 'Delete', danger: true });
                              if (ok) run(() => restaurantService.removeMenuItem(item.id), `${item.name} deleted`);
                            }}
                          />
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {ordering && <NewOrderModal menu={data.menu} lookups={lookups} onClose={() => setOrdering(false)} />}
      {menuDialog && <MenuForm item={menuDialog === 'new' ? undefined : menuDialog} onClose={() => setMenuDialog(null)} />}
    </>
  );
}
