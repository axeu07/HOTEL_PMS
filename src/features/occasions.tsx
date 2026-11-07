import { Icon } from '@/components/icons';
import { SelectField, TextAreaField, TextField } from '@/components/ui';
import { asksCelebrant, asksDate, OCCASION_CHOICES, OCCASION_ICON, OCCASION_LABEL, type OccasionDraft } from '@/domain/occasions';
import type { OccasionType } from '@/types/domain';

export { OCCASION_LABEL };

/**
 * The optional occasion questions, shared by the booking form, check-in and the guest profile.
 * The dependent fields only appear once an occasion is chosen, so a guest who skips it sees one line.
 */
export function OccasionFields({
  draft,
  onChange,
  label = 'What’s the occasion for your stay?',
  hint,
  error,
  idPrefix = 'occasion',
}: {
  draft: OccasionDraft;
  onChange: (next: OccasionDraft) => void;
  label?: string;
  hint?: string;
  error?: string;
  idPrefix?: string;
}) {
  const set = <K extends keyof OccasionDraft>(key: K, value: OccasionDraft[K]) => onChange({ ...draft, [key]: value });
  const celebrantLabel = draft.type === 'anniversary' ? 'Whose anniversary is it?' : draft.type === 'birthday' ? 'Whose birthday is it?' : 'Who are we celebrating?';
  return (
    <>
      <SelectField
        label={`${label} (optional)`}
        wrapClass="full"
        value={draft.type}
        onChange={(e) => set('type', e.target.value as OccasionDraft['type'])}
        hint={hint}
        name={`${idPrefix}-type`}
      >
        <option value="">Select an occasion</option>
        {OCCASION_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </SelectField>
      {draft.type && draft.type !== 'none' && (
        <>
          {asksDate(draft.type) && (
            <TextField label="Occasion date" type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} error={error} name={`${idPrefix}-date`} />
          )}
          {asksCelebrant(draft.type) && (
            <TextField label={celebrantLabel} value={draft.celebrant} maxLength={80} onChange={(e) => set('celebrant', e.target.value)} autoComplete="off" name={`${idPrefix}-celebrant`} />
          )}
          <TextAreaField
            label="Notes or preferences"
            wrapClass="full"
            rows={2}
            maxLength={500}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="A cake, flowers, a quiet table…"
            name={`${idPrefix}-notes`}
          />
        </>
      )}
    </>
  );
}

export function OccasionIcon({ type, size = 14 }: { type: OccasionType; size?: number }) {
  return <Icon name={OCCASION_ICON[type]} size={size} />;
}
