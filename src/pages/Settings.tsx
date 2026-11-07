import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp, useAuth } from '@/app/providers';
import { Icon, type IconName } from '@/components/icons';
import { Avatar, Badge, Button, EmptyState, IconButton, PageHead, Panel, SelectField, Tabs, TextField, useFeedback } from '@/components/ui';
import { CategoryFormModal, RoomFormModal } from '@/features/rooms';
import { useLookups } from '@/features/useLookups';
import { money } from '@/lib/format';
import { errorMessage, hasErrors, nonNegative, required, validEmail, validPhone } from '@/lib/validation';
import { authService, demoService, hotelService, roomService } from '@/services';
import type { CurrencyCode, Hotel, RoomCategory, TaxConfig, UserPreferences } from '@/types/domain';

type Tab = 'hotel' | 'rooms' | 'tax' | 'preferences' | 'account';

function HotelProfile() {
  const { hotel } = useApp();
  const { toast } = useFeedback();
  const [form, setForm] = useState<Hotel>(hotel);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => setForm(hotel), [hotel]);

  const set = (key: keyof Hotel) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      name: required(form.name, 'Hotel name'),
      email: required(form.email, 'Email') || validEmail(form.email),
      phone: required(form.phone, 'Phone') || validPhone(form.phone),
      invoicePrefix: required(form.invoicePrefix, 'Prefix'),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    await hotelService.update(form);
    toast('Hotel profile saved');
  };

  return (
    <Panel icon="building" title="Hotel profile" subtitle="Shown on the public site and printed on invoices.">
      <form className="panel-body form-grid" onSubmit={submit} noValidate>
        <TextField label="Hotel name" value={form.name} onChange={set('name')} error={errors.name} />
        <TextField label="Tagline" value={form.tagline} onChange={set('tagline')} />
        <TextField label="Address" wrapClass="full" value={form.address} onChange={set('address')} />
        <TextField label="City" value={form.city} onChange={set('city')} />
        <TextField label="Country" value={form.country} onChange={set('country')} />
        <TextField label="Phone" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
        <TextField label="Check-in time" type="time" value={form.checkInTime} onChange={set('checkInTime')} />
        <TextField label="Check-out time" type="time" value={form.checkOutTime} onChange={set('checkOutTime')} />
        <SelectField label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}>
          <option value="INR">Indian rupee (₹)</option>
          <option value="USD">US dollar ($)</option>
          <option value="EUR">Euro (€)</option>
          <option value="GBP">British pound (£)</option>
          <option value="AED">UAE dirham (AED)</option>
        </SelectField>
        <TextField label="Invoice prefix" value={form.invoicePrefix} onChange={set('invoicePrefix')} error={errors.invoicePrefix} />
        <div className="full"><Button variant="primary" type="submit">Save profile</Button></div>
      </form>
    </Panel>
  );
}

function RoomConfiguration() {
  const lookups = useLookups();
  const { run, confirm } = useFeedback();
  const [categoryDialog, setCategoryDialog] = useState<RoomCategory | 'new' | null>(null);
  const [addingRoom, setAddingRoom] = useState(false);
  if (!lookups) return null;
  return (
    <Panel
      icon="bed"
      title="Room configuration"
      subtitle="Categories and their pricing. Individual rooms are managed under Rooms."
      actions={
        <>
          <Button icon="plus" onClick={() => setAddingRoom(true)}>Add room</Button>
          <Button variant="primary" icon="plus" onClick={() => setCategoryDialog('new')}>Add category</Button>
        </>
      }
    >
      {lookups.categories.length === 0 ? (
        <EmptyState icon="bed" title="No categories yet" message="Add a category to start building your room inventory." />
      ) : (
        <ul className="mini-list">
          {lookups.categories.map((c) => (
            <li key={c.id}>
              <span className="grow">
                <span className="cell-title">{c.name} <span className="muted small">({c.code})</span></span>
                <span className="cell-sub" style={{ display: 'block' }}>
                  {lookups.rooms.filter((r) => r.categoryId === c.id).length} rooms · sleeps {c.capacity} · {money(c.basePrice)} a night
                </span>
              </span>
              <IconButton icon="edit" label={`Edit ${c.name}`} onClick={() => setCategoryDialog(c)} />
              <IconButton
                icon="trash"
                label={`Delete ${c.name}`}
                onClick={async () => {
                  const ok = await confirm({ title: `Delete ${c.name}?`, message: 'Only categories with no rooms or booking history can be deleted.', confirmLabel: 'Delete', danger: true });
                  if (ok) run(() => roomService.removeCategory(c.id), `${c.name} deleted`);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {categoryDialog && <CategoryFormModal category={categoryDialog === 'new' ? undefined : categoryDialog} onClose={() => setCategoryDialog(null)} />}
      {addingRoom && <RoomFormModal categories={lookups.categories} onClose={() => setAddingRoom(false)} />}
    </Panel>
  );
}

function TaxConfiguration() {
  const { hotel } = useApp();
  const { toast } = useFeedback();
  const [form, setForm] = useState<TaxConfig>(hotel.tax);
  const [taxNumber, setTaxNumber] = useState(hotel.taxNumber);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { setForm(hotel.tax); setTaxNumber(hotel.taxNumber); }, [hotel]);
  const setNumber = (key: keyof TaxConfig) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      label: required(form.label, 'Tax name'),
      roomThreshold: nonNegative(form.roomThreshold, 'Threshold'),
      roomLowRate: nonNegative(form.roomLowRate, 'Rate'),
      roomHighRate: nonNegative(form.roomHighRate, 'Rate'),
      foodRate: nonNegative(form.foodRate, 'Rate'),
      serviceRate: nonNegative(form.serviceRate, 'Rate'),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    await hotelService.update({ tax: form, taxNumber });
    toast('Tax settings saved. They apply to new charges.');
  };

  return (
    <Panel icon="percent" title="Tax configuration" subtitle="Demo values. Confirm the correct rates with your tax adviser before going live.">
      <form className="panel-body form-grid" onSubmit={submit} noValidate>
        <TextField label="Tax name on invoices" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} error={errors.label} />
        <TextField label="Tax registration number" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
        <TextField label={`Room tariff threshold per night (${hotel.currency})`} wrapClass="full" type="number" min={0} value={form.roomThreshold} onChange={setNumber('roomThreshold')} error={errors.roomThreshold} />
        <TextField label="Room tax at or below threshold (%)" type="number" min={0} value={form.roomLowRate} onChange={setNumber('roomLowRate')} error={errors.roomLowRate} />
        <TextField label="Room tax above threshold (%)" type="number" min={0} value={form.roomHighRate} onChange={setNumber('roomHighRate')} error={errors.roomHighRate} />
        <TextField label="Food & beverage tax (%)" type="number" min={0} value={form.foodRate} onChange={setNumber('foodRate')} error={errors.foodRate} />
        <TextField label="Other services tax (%)" type="number" min={0} value={form.serviceRate} onChange={setNumber('serviceRate')} error={errors.serviceRate} />
        <div className="full"><Button variant="primary" type="submit">Save tax settings</Button></div>
      </form>
    </Panel>
  );
}

function Preferences() {
  const { prefs, setPrefs } = useApp();
  const { toast, confirm } = useFeedback();
  const navigate = useNavigate();

  return (
    <div className="stack">
      <Panel icon="sliders" title="Your preferences" subtitle="Saved in this browser, for this demo user.">
        <div className="panel-body form-grid form-grid-3">
          <SelectField label="Theme" value={prefs.theme} onChange={(e) => setPrefs({ theme: e.target.value as UserPreferences['theme'] })}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </SelectField>
          <SelectField label="Table density" value={prefs.density} onChange={(e) => setPrefs({ density: e.target.value as UserPreferences['density'] })}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </SelectField>
          <SelectField label="Date format" value={prefs.dateFormat} onChange={(e) => setPrefs({ dateFormat: e.target.value as UserPreferences['dateFormat'] })}>
            <option value="dmy">4 Nov 2026</option>
            <option value="mdy">Nov 4, 2026</option>
          </SelectField>
        </div>
      </Panel>
      <Panel icon="refresh" title="Demo data" subtitle="Start each presentation from a clean, rehearsed story.">
        <div className="panel-body row-between">
          <p className="muted small" style={{ maxWidth: '60ch' }}>Restores every booking, guest, invoice and setting to the sample data, with dates rebuilt around today. Your theme preferences stay as they are.</p>
          <Button
            variant="danger"
            icon="refresh"
            onClick={async () => {
              const ok = await confirm({ title: 'Reset demo data?', message: 'All changes made in this browser will be lost.', confirmLabel: 'Reset demo', danger: true });
              if (!ok) return;
              demoService.reset();
              toast('Demo data reset. Ready for the next presentation.');
              navigate('/app/dashboard');
            }}
          >
            Reset demo data
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="pref-row">
      <span className="icon-line"><Icon name={icon} />{label}</span>
      <b>{children}</b>
    </div>
  );
}

function Account() {
  const { user, role, refreshUser, signOut } = useAuth();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const next = { name: required(name, 'Name'), email: required(email, 'Email') || validEmail(email) };
    setErrors(next);
    if (hasErrors(next) || !user) return;
    try {
      await authService.updateProfile(user.id, { name, email });
      await refreshUser();
      toast('Your profile was saved');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  if (!user) return null;

  return (
    <div className="settings-layout">
      <div className="stack">
        <Panel icon="user" title="Your profile" subtitle="How you appear across the suite.">
          <form className="panel-body form-grid" onSubmit={saveProfile} noValidate>
            <div className="full profile-hero">
              <Avatar name={user.name} large />
              <div>
                <div className="serif" style={{ fontSize: 21 }}>{user.name}</div>
                <div className="cell-sub">{role?.name}</div>
              </div>
            </div>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="off" />
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="off" hint="Sign in with this address after changing it, or reset the demo." />
            {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
            <div className="full"><Button variant="primary" type="submit">Save profile</Button></div>
          </form>
        </Panel>
        <Panel icon="lock" title="Password & security" subtitle="How sign-in works in this demo.">
          <div className="panel-body">
            <div className="alert alert-info">
              <Icon name="info" />
              <span>Demo accounts use fixed, published passwords, so a password cannot be changed here. A live deployment would manage passwords through its identity provider.</span>
            </div>
          </div>
        </Panel>
      </div>
      <div className="stack">
        <Panel icon="shield" title="Account details">
          <DetailRow icon="mail" label="Sign-in email">{user.email}</DetailRow>
          <DetailRow icon="badge" label="Access role">{role?.name}</DetailRow>
          <DetailRow icon="key" label="Permissions">{role?.permissions.length ?? 0} granted</DetailRow>
          <div className="pref-row">
            <span className="icon-line"><Icon name="activity" />Session</span>
            <Badge tone="good">Active</Badge>
          </div>
        </Panel>
        <Panel icon="logout" title="Sign out" subtitle="End your session in this browser." className="danger-panel">
          <div className="panel-body">
            <Button
              variant="danger"
              icon="logout"
              block
              onClick={() => {
                signOut();
                navigate('/login');
              }}
            >
              Sign out
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function Settings() {
  const { can } = useAuth();
  const admin = can('settings.hotel');
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as Tab | null;
  const adminOnly = requested === 'hotel' || requested === 'rooms' || requested === 'tax';
  const tab: Tab = requested && (admin || !adminOnly) ? requested : admin ? 'hotel' : 'preferences';

  return (
    <>
      <PageHead title="Settings" subtitle={admin ? 'Property configuration, personal preferences and your account.' : 'Your preferences and account. Property settings belong to the administrator.'} />
      <div style={{ marginBottom: 18 }}>
        <Tabs
          value={tab}
          onChange={(id) => setParams({ tab: id }, { replace: true })}
          tabs={[
            ...(admin
              ? ([
                  { id: 'hotel', label: 'Hotel profile' },
                  { id: 'rooms', label: 'Room configuration' },
                  { id: 'tax', label: 'Tax' },
                ] as { id: Tab; label: string }[])
              : []),
            { id: 'preferences', label: 'Preferences' },
            { id: 'account', label: 'Account & security' },
          ]}
        />
      </div>
      {tab === 'hotel' && admin && <HotelProfile />}
      {tab === 'rooms' && admin && <RoomConfiguration />}
      {tab === 'tax' && admin && <TaxConfiguration />}
      {tab === 'preferences' && <Preferences />}
      {tab === 'account' && <Account />}
    </>
  );
}
