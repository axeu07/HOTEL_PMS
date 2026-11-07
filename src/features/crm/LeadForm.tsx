import { useState } from 'react';
import { useAuth } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Button, Modal, SelectField, TextAreaField, TextField, useFeedback } from '@/components/ui';
import { LEAD_SOURCE, LEAD_SOURCE_ORDER } from '@/domain/leads';
import { today } from '@/lib/dates';
import { errorMessage, isEmail } from '@/lib/validation';
import { emptyLead, leadService, type LeadInput } from '@/services';
import type { Lead } from '@/types/domain';
import type { Crm } from './useCrm';

/** Add an enquiry by hand, or correct one already in the list. */
export function LeadForm({ crm, lead, onClose, onSaved }: { crm: Crm; lead?: Lead; onClose: () => void; onSaved?: (lead: Lead) => void }) {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const [form, setForm] = useState<LeadInput>(
    lead
      ? { name: lead.name, phone: lead.phone, email: lead.email, source: lead.source, sourceDetail: lead.sourceDetail, checkIn: lead.checkIn, checkOut: lead.checkOut, adults: lead.adults, categoryId: lead.categoryId, budget: lead.budget, notes: lead.notes, assignedTo: lead.assignedTo }
      : emptyLead(),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const by = user?.name ?? 'Staff';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.email.trim() && !isEmail(form.email)) return setError('That email address does not look right.');
    setBusy(true);
    setError('');
    try {
      const saved = lead ? await leadService.update(lead.id, form, by) : await leadService.create(form, by);
      toast(lead ? 'Lead updated' : `${saved.name} added to leads`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={lead ? 'Edit lead' : 'Add a lead'}
      subtitle={lead ? undefined : 'For an enquiry that came by phone, in person or from a campaign.'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="lead-form" loading={busy}>{lead ? 'Save changes' : 'Add lead'}</Button>
        </>
      }
    >
      <form id="lead-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />
        <TextField label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="off" hint="Used for WhatsApp" />
        <TextField label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
        <SelectField label="Source" value={form.source} onChange={(e) => set('source', e.target.value as LeadInput['source'])}>
          {LEAD_SOURCE_ORDER.map((s) => <option key={s} value={s}>{LEAD_SOURCE[s].label}</option>)}
        </SelectField>
        <TextField label="Where exactly" wrapClass="full" placeholder="e.g. Facebook lead ad, MakeMyTrip message, travel fair" value={form.sourceDetail} onChange={(e) => set('sourceDetail', e.target.value)} />
        <span className="form-section">What they are looking for</span>
        <TextField label="Preferred check-in" type="date" min={today()} value={form.checkIn} onChange={(e) => set('checkIn', e.target.value)} />
        <TextField label="Preferred check-out" type="date" min={form.checkIn || today()} value={form.checkOut} onChange={(e) => set('checkOut', e.target.value)} />
        <SelectField label="Room type" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          <option value="">Not decided</option>
          {crm.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <TextField label="Guests" type="number" min={1} max={10} value={form.adults} onChange={(e) => set('adults', Math.max(1, Number(e.target.value) || 1))} />
        <TextField label="Budget per night" inputMode="numeric" placeholder="Optional" value={form.budget || ''} onChange={(e) => set('budget', Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
        <SelectField label="Assigned to" value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
          <option value="">Unassigned</option>
          {crm.staff.filter((s) => s.active && s.department !== 'Housekeeping').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <TextAreaField label="Notes" wrapClass="full" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        {error && <div className="alert alert-bad full" role="alert"><Icon name="alert" /><span>{error}</span></div>}
      </form>
    </Modal>
  );
}
