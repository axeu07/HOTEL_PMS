import { useState, type FormEvent } from 'react';
import { INVOICE_STATUS, PAYMENT_METHOD } from '@/app/labels';
import { useApp } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Badge, Button, IconButton, Modal, SelectField, TextField, useFeedback } from '@/components/ui';
import { taxByRate } from '@/domain/billing';
import { BillShareButtons } from './BillShare';
import { useResource } from '@/hooks/useResource';
import { fmtDate, money } from '@/lib/format';
import { errorMessage, hasErrors, positive, required } from '@/lib/validation';
import { billingService, guestName, guestService, reservationService, roomService } from '@/services';
import type { ChargeKind, ID, PaymentMethod } from '@/types/domain';

function AddChargeModal({ invoiceId, onClose }: { invoiceId: ID; onClose: () => void }) {
  const { hotel } = useApp();
  const { toast } = useFeedback();
  const [form, setForm] = useState({ kind: 'service' as Exclude<ChargeKind, 'room'>, description: '', quantity: 1, unitPrice: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const rate = form.kind === 'food' ? hotel.tax.foodRate : hotel.tax.serviceRate;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      description: required(form.description, 'Description'),
      quantity: positive(form.quantity, 'Quantity'),
      unitPrice: positive(form.unitPrice, 'Price'),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      await billingService.addCharge(invoiceId, form);
      toast('Charge added to the bill');
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title="Add a charge"
      size="sm"
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="charge-form">Add charge</Button></>}
    >
      <form id="charge-form" className="form-grid" onSubmit={submit} noValidate>
        <SelectField label="Type" wrapClass="full" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}>
          <option value="service">Additional service (laundry, spa, transfer)</option>
          <option value="food">Food & beverage</option>
        </SelectField>
        <TextField label="Description" wrapClass="full" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} autoComplete="off" />
        <TextField label="Quantity" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} error={errors.quantity} />
        <TextField label="Unit price" type="number" min={0} value={form.unitPrice || ''} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })} error={errors.unitPrice} hint={`Plus ${hotel.tax.label} at ${rate}%`} />
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

function PaymentModal({ invoiceId, balance, onClose }: { invoiceId: ID; balance: number; onClose: () => void }) {
  const { toast } = useFeedback();
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await billingService.recordPayment(invoiceId, { amount: Number(amount), method, reference });
      toast(`Payment of ${money(Number(amount))} recorded`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      title="Record a payment"
      subtitle={`${money(balance)} is due. This records the payment; no money moves in the demo.`}
      size="sm"
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="payment-form">Record payment</Button></>}
    >
      <form id="payment-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="Amount" wrapClass="full" type="number" min={0} step="0.01" value={amount} onChange={(e) => { setAmount(Number(e.target.value)); setError(''); }} error={error} />
        <SelectField label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_METHOD[m]}</option>)}
        </SelectField>
        <TextField label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
      </form>
    </Modal>
  );
}

export function InvoiceModal({ invoiceId, onClose }: { invoiceId: ID; onClose: () => void }) {
  const { hotel } = useApp();
  const { run, confirm } = useFeedback();
  const [dialog, setDialog] = useState<null | 'charge' | 'payment'>(null);

  const { data } = useResource(async () => {
    const view = await billingService.view(invoiceId);
    if (!view) return null;
    const [guest, reservation, rooms, categories] = await Promise.all([
      guestService.get(view.invoice.guestId),
      reservationService.get(view.invoice.reservationId),
      roomService.list(),
      roomService.categories(),
    ]);
    return {
      view,
      guest,
      reservation,
      room: rooms.find((r) => r.id === reservation?.roomId),
      category: categories.find((c) => c.id === reservation?.categoryId),
    };
  }, [invoiceId]);

  if (!data) {
    return (
      <Modal title="Invoice" size="sm" onClose={onClose}>
        <p className="muted">{data === null ? 'Loading invoice…' : 'Invoice not found.'}</p>
      </Modal>
    );
  }

  const { view, guest, reservation, room, category } = data;
  const { invoice, totals, payments } = view;
  const status = INVOICE_STATUS[invoice.status];
  const isVoid = invoice.status === 'void';

  return (
    <Modal
      title={`Invoice ${invoice.number}`}
      subtitle={<Badge tone={status.tone}>{status.label}</Badge>}
      size="xl"
      onClose={onClose}
      footer={
        <>
          {!isVoid && <Button className="left" icon="plus" onClick={() => setDialog('charge')}>Add charge</Button>}
          {!isVoid && totals.balance > 0 && <Button icon="receipt" onClick={() => setDialog('payment')}>Record payment</Button>}
          <BillShareButtons view={view} guest={guest} stay={reservation ? { checkIn: reservation.checkIn, checkOut: reservation.checkOut } : undefined} />
          <Button variant="primary" icon="print" onClick={() => window.print()}>Print invoice</Button>
        </>
      }
    >
      <article className="invoice-doc print-area" data-testid="invoice-doc">
        <header className="inv-head">
          <div>
            <h3>{hotel.name}</h3>
            <div>{hotel.address}, {hotel.city}, {hotel.country}</div>
            <div>{hotel.phone} · {hotel.email}</div>
            <div>{hotel.tax.label} no. {hotel.taxNumber}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow" style={{ color: '#8d6216' }}>{isVoid ? 'Voided invoice' : 'Tax invoice'}</div>
            <div className="serif" style={{ fontSize: 20 }}>{invoice.number}</div>
            <div>Issued {fmtDate(invoice.issuedOn)}</div>
          </div>
        </header>

        <div className="inv-meta">
          <div>
            <h4>Billed to</h4>
            <div className="strong">{guestName(guest)}</div>
            {guest?.company && <div>{guest.company}</div>}
            <div>{guest?.phone}</div>
            <div>{guest?.email}</div>
          </div>
          <div>
            <h4>Stay</h4>
            <div>{fmtDate(reservation?.checkIn)} to {fmtDate(reservation?.checkOut)}</div>
            <div>{category?.name}{room ? `, room ${room.number}` : ''}</div>
            <div>Booking {reservation?.code}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Date</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Tax</th>
              <th className="num">Amount</th>
              <th className="no-print" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td className="nowrap">{fmtDate(line.date)}</td>
                <td className="num">{line.quantity}</td>
                <td className="num nowrap">{money(line.unitPrice)}</td>
                <td className="num">{line.taxRate}%</td>
                <td className="num nowrap">{money(line.quantity * line.unitPrice)}</td>
                <td className="no-print" style={{ width: 34, padding: 0 }}>
                  {line.kind !== 'room' && !isVoid && (
                    <IconButton
                      icon="trash"
                      label={`Remove ${line.description}`}
                      onClick={async () => {
                        const ok = await confirm({ title: 'Remove this charge?', message: line.description, confirmLabel: 'Remove', danger: true });
                        if (ok) run(() => billingService.removeCharge(invoice.id, line.id), 'Charge removed');
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-bottom">
          <div style={{ minWidth: 240 }}>
            <div className="strong" style={{ marginBottom: 4 }}>{hotel.tax.label} summary</div>
            {taxByRate(invoice).map((row) => (
              <div key={row.rate}>{row.rate}% on {money(row.taxable)}: {money(row.tax)}</div>
            ))}
            {payments.length > 0 && (
              <>
                <div className="strong" style={{ margin: '10px 0 4px' }}>Payments</div>
                {payments.map((p) => (
                  <div key={p.id}>{fmtDate(p.receivedOn)} · {PAYMENT_METHOD[p.method]}{p.reference ? ` · ${p.reference}` : ''}: {money(p.amount)}</div>
                ))}
              </>
            )}
          </div>
          <div className="inv-totals">
            <div><span>Room charges</span><span>{money(totals.roomSubtotal)}</span></div>
            <div><span>Food & beverage</span><span>{money(totals.foodSubtotal)}</span></div>
            <div><span>Other services</span><span>{money(totals.serviceSubtotal)}</span></div>
            <div><span>{hotel.tax.label}</span><span>{money(totals.tax)}</span></div>
            <div className="grand"><span>Total</span><span data-testid="invoice-total">{money(totals.total)}</span></div>
            <div><span>Paid</span><span>{money(totals.paid)}</span></div>
            <div className="due"><span>Balance due</span><span data-testid="invoice-balance">{money(isVoid ? 0 : Math.max(0, totals.balance))}</span></div>
          </div>
        </div>
        <footer className="inv-foot">
          Thank you for staying with us. This is a sample invoice from a software demonstration and is not a valid tax document.
        </footer>
      </article>

      {dialog === 'charge' && <AddChargeModal invoiceId={invoice.id} onClose={() => setDialog(null)} />}
      {dialog === 'payment' && <PaymentModal invoiceId={invoice.id} balance={totals.balance} onClose={() => setDialog(null)} />}
    </Modal>
  );
}
