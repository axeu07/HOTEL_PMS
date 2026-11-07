import { useMemo, useState, type FormEvent } from 'react';
import { useApp } from '@/app/providers';
import { Icon } from '@/components/icons';
import { downloadQrPng, QrCode } from '@/components/qr';
import { Badge, Button, DataTable, EmptyState, Modal, Panel, PersonCell, SelectField, TextField, useFeedback, type Column } from '@/components/ui';
import { REG_ID_TYPES, splitName } from '@/domain/registration';
import { useResource } from '@/hooks/useResource';
import { fmtDate, fmtTime, timeAgo } from '@/lib/format';
import { samePhone } from '@/lib/phone';
import { errorMessage, hasErrors, required } from '@/lib/validation';
import { guestService, registrationService } from '@/services';
import type { QrRegistration, RegistrationStatus } from '@/types/domain';

const ID_LABEL = Object.fromEntries(REG_ID_TYPES.map((t) => [t.id, t.label.replace(/ \(.*\)/, '')])) as Record<string, string>;
const STATUS: Record<RegistrationStatus, { label: string; tone: 'warn' | 'good' | 'bad' }> = {
  pending: { label: 'Pending verification', tone: 'warn' },
  verified: { label: 'Verified', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' },
};

/* ---------- Guest ID QR: generate, preview, download, print ---------- */

export function GuestIdQrPanel() {
  const { hotel } = useApp();
  const { toast } = useFeedback();
  const { data: url } = useResource(() => registrationService.publicUrl());
  const slug = hotel.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url!);
      toast('Registration link copied');
    } catch {
      toast('Copy is blocked here. Select the link and copy it by hand.');
    }
  };

  return (
    <div className="gd-qr" data-testid="guest-id-qr">
      <Panel
        icon="shield"
        title="Registration QR"
        subtitle={`Linked to ${hotel.name} only`}
        actions={<Badge tone="quiet">Demo</Badge>}
      >
        <div className="panel-body">
          <div className="print-area gx-poster gd-poster" data-testid="register-qr-poster">
            <p className="gx-poster-kicker">{hotel.name}</p>
            <h3 className="gx-poster-title">Welcome. Check in by phone.</h3>
            <p className="gx-poster-sub">Scan with your phone camera, enter your details and upload your ID. Then see the front desk.</p>
            {url && <QrCode value={url} label={`QR code to register at ${hotel.name}`} testId="register-qr" />}
            <p className="gx-poster-url" data-testid="register-url">{url}</p>
          </div>
          <div className="gx-qr-tools no-print">
            <Button size="sm" icon="download" disabled={!url} onClick={() => downloadQrPng(url!, `${slug}-guest-registration-qr.png`)}>Download PNG</Button>
            <Button size="sm" variant="primary" icon="print" disabled={!url} onClick={() => window.print()}>Print</Button>
            <Button size="sm" icon="check" disabled={!url} onClick={copy}>Copy link</Button>
            <a className="btn btn-sm" href={url ?? '#'} target="_blank" rel="noreferrer">Open guest page</a>
          </div>
        </div>
      </Panel>

      <Panel icon="clipboard" title="Place it at reception">
        <div className="panel-body">
          <ol className="gd-steps">
            <li><b>Print the poster</b> on A4 and slip it into a stand, or download the PNG for your own signage.</li>
            <li><b>Place it on the front desk</b> where arriving guests wait, at about eye level and well lit. Keep it flat, with no glare.</li>
            <li><b>Tell guests</b> to scan it with their phone camera, fill in the form and upload a photo of their ID.</li>
            <li><b>Watch for the submission</b> under QR registrations. Check the ID against the guest in front of you, correct anything, then check them in.</li>
          </ol>
          <ul className="gd-notes">
            <li><Icon name="lock" size={14} /> The link carries a code unique to this hotel. It opens only the registration form, never any guest data.</li>
            <li><Icon name="shield" size={14} /> Uploaded IDs are visible to signed-in front desk staff only.</li>
            <li><Icon name="info" size={14} /> Demo: submissions are saved in this browser. A guest&apos;s phone can only reach the page once this site is hosted at an address the phone can open.</li>
          </ul>
        </div>
      </Panel>
    </div>
  );
}

/* ---------- QR registrations: pending verification ---------- */

function IdThumb({ reg, onOpen }: { reg: QrRegistration; onOpen: () => void }) {
  return (
    <button type="button" className="gd-thumb" onClick={onOpen} aria-label={`View ID document for ${reg.name}`}>
      <img src={reg.idDocument} alt="" loading="lazy" />
    </button>
  );
}

function VerifyModal({ registration, onClose, onProceed }: { registration: QrRegistration; onClose: () => void; onProceed: (phone: string) => void }) {
  const { toast, confirm } = useFeedback();
  const readOnly = registration.status !== 'pending';
  const { data: known } = useResource(async () => (await guestService.list()).find((g) => samePhone(g.phone, registration.phone)) ?? null, [registration.phone]);
  const start = splitName(registration.name);
  const [edit, setEdit] = useState({
    firstName: start.firstName,
    lastName: start.lastName,
    phone: registration.phone,
    age: String(registration.age),
    idType: registration.idType,
    idNumber: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof edit>(key: K, value: (typeof edit)[K]) => setEdit((e) => ({ ...e, [key]: value }));

  // A returning guest already has an ID number on file; offer it rather than asking again.
  const savedId = known && known.idType === edit.idType && known.idNumber ? known.idNumber : '';

  const save = async (proceed: boolean) => {
    const next = {
      firstName: required(edit.firstName, 'First name'),
      phone: required(edit.phone, 'Phone'),
      age: !Number.isInteger(Number(edit.age)) || Number(edit.age) < 1 || Number(edit.age) > 120 ? 'Enter an age between 1 and 120' : '',
      idNumber: required(edit.idNumber, 'ID number'),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    setBusy(true);
    setFailure('');
    try {
      await registrationService.verify(registration.id, { ...edit, age: Number(edit.age) });
      toast(proceed ? `${edit.firstName} verified. Continue with check-in.` : `${edit.firstName} ${edit.lastName} verified and saved to guests`);
      onClose();
      if (proceed) onProceed(edit.phone);
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    const ok = await confirm({ title: 'Reject this registration?', message: `${registration.name}'s submission will be marked as rejected. The guest is not told automatically.`, confirmLabel: 'Reject', danger: true });
    if (!ok) return;
    await registrationService.reject(registration.id);
    toast('Registration rejected');
    onClose();
  };

  return (
    <Modal
      title={readOnly ? 'Registration' : 'Verify registration'}
      subtitle={<><Badge tone={STATUS[registration.status].tone}>{STATUS[registration.status].label}</Badge>{registration.demo && <> <Badge tone="quiet">Demo submission</Badge></>}</>}
      size="lg"
      onClose={onClose}
      footer={
        readOnly ? <Button onClick={onClose}>Close</Button> : (
          <>
            <Button className="left" variant="ghost" icon="ban" onClick={reject}>Reject</Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button loading={busy} onClick={() => save(false)}>Verify</Button>
            <Button variant="primary" icon="key" loading={busy} onClick={() => save(true)}>Verify and check in</Button>
          </>
        )
      }
    >
      <div className="gd-verify">
        <figure className="gd-doc">
          <img src={registration.idDocument} alt={`ID document submitted by ${registration.name}`} data-testid="id-document" />
          <figcaption><Icon name="lock" size={13} /> Visible to front desk staff only. Submitted {fmtDate(registration.submittedAt.slice(0, 10))} at {fmtTime(registration.submittedAt)}.</figcaption>
        </figure>
        <form className="form-grid" onSubmit={(e: FormEvent) => { e.preventDefault(); void save(false); }} noValidate>
          {known && !readOnly && (
            <div className="lookup-card full" data-kind="returning">
              <div className="lookup-head"><span className="lookup-icon"><Icon name="check" size={15} /></span><strong>Matches a saved guest</strong></div>
              <p className="lookup-line">{known.firstName} {known.lastName} already has a record with this number. Verifying updates it rather than creating another.</p>
            </div>
          )}
          <TextField label="First name" value={edit.firstName} disabled={readOnly} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} autoComplete="off" />
          <TextField label="Last name" value={edit.lastName} disabled={readOnly} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />
          <TextField label="Phone" type="tel" value={edit.phone} disabled={readOnly} onChange={(e) => set('phone', e.target.value)} error={errors.phone} autoComplete="off" />
          <TextField label="Age" type="number" min={1} max={120} value={edit.age} disabled={readOnly} onChange={(e) => set('age', e.target.value)} error={errors.age} />
          <SelectField label="ID document" value={edit.idType} disabled={readOnly} onChange={(e) => set('idType', e.target.value as QrRegistration['idType'])}>
            {REG_ID_TYPES.map((t) => <option key={t.id} value={t.id}>{ID_LABEL[t.id]}</option>)}
          </SelectField>
          {!readOnly && (
            <TextField
              label="ID number"
              value={edit.idNumber}
              onChange={(e) => set('idNumber', e.target.value)}
              error={errors.idNumber}
              hint="Type the number shown on the document."
              autoComplete="off"
            />
          )}
          {savedId && !readOnly && !edit.idNumber && (
            <div className="full"><button type="button" className="btn btn-sm" onClick={() => set('idNumber', savedId)}>Use ID on file ({savedId})</button></div>
          )}
          {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
        </form>
      </div>
    </Modal>
  );
}

export function QrRegistrationsPanel({ onProceed }: { onProceed: (phone: string) => void }) {
  const { data: rows } = useResource(() => registrationService.list());
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [openId, setOpenId] = useState<string | null>(null);

  const pending = useMemo(() => (rows ?? []).filter((r) => r.status === 'pending'), [rows]);
  const shown = filter === 'pending' ? pending : rows ?? [];
  const open = (rows ?? []).find((r) => r.id === openId);

  const columns: Column<QrRegistration>[] = [
    { key: 'guest', header: 'Guest', primary: true, sort: (r) => r.name, render: (r) => <PersonCell name={r.name} sub={`${r.phone} · age ${r.age}`} /> },
    { key: 'id', header: 'ID document', render: (r) => <span className="gd-id-cell"><IdThumb reg={r} onOpen={() => setOpenId(r.id)} /><span>{ID_LABEL[r.idType]}</span></span> },
    {
      key: 'at',
      header: 'Submitted',
      sort: (r) => r.submittedAt,
      render: (r) => <span className="nowrap" title={new Date(r.submittedAt).toLocaleString()}>{fmtTime(r.submittedAt)} · {timeAgo(r.submittedAt)}</span>,
    },
    { key: 'status', header: 'Status', render: (r) => <span className="row"><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>{r.demo && <Badge tone="quiet">Demo</Badge>}</span> },
    {
      key: 'act',
      header: 'Actions',
      actions: true,
      render: (r) => <Button size="sm" variant={r.status === 'pending' ? 'primary' : 'default'} icon={r.status === 'pending' ? 'checks' : 'search'} onClick={() => setOpenId(r.id)}>{r.status === 'pending' ? 'Review' : 'View'}</Button>,
    },
  ];

  return (
    <Panel
      icon="shield"
      title="QR registrations"
      subtitle="Guests who registered by scanning the reception QR. Check each ID, correct the details and check the guest in."
      actions={
        <div className="segmented" role="group" aria-label="Show">
          <button type="button" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>Pending ({pending.length})</button>
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
        </div>
      }
    >
      <DataTable
        key={filter}
        caption="QR registrations"
        columns={columns}
        rows={shown}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        defaultSort={{ key: 'at', dir: 'desc' }}
        empty={<EmptyState icon="check" title={filter === 'pending' ? 'Nothing waiting for verification' : 'No registrations yet'} message="Guests who scan the reception QR will appear here as soon as they submit." />}
      />
      {open && <VerifyModal key={open.id} registration={open} onClose={() => setOpenId(null)} onProceed={onProceed} />}
    </Panel>
  );
}
