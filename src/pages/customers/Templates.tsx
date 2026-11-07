import { useState } from 'react';
import { useAuth } from '@/app/providers';
import { EmailLogo, WhatsAppLogo } from '@/components/brandIcons';
import { Icon } from '@/components/icons';
import { Badge, Button, EmptyState, Modal, PageHead, PageLoading, Panel, TextField, Tabs, useFeedback } from '@/components/ui';
import { CHANNEL_LABEL, renderTemplate, TEMPLATE_SEEDS, TEMPLATE_VARIABLES, type TemplateValues } from '@/domain/templates';
import { MessageEditor, MessagePreview } from '@/features/crm/MessageEditor';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/validation';
import { templateService } from '@/services';
import type { MessageChannel, MessageTemplate } from '@/types/domain';

const SAMPLE: TemplateValues = Object.fromEntries(TEMPLATE_VARIABLES.map((v) => [v.key, v.sample]));

const seedFor = (t: MessageTemplate) => TEMPLATE_SEEDS.find((s) => s.key === t.builtInKey);
const isEdited = (t: MessageTemplate) => {
  const seed = seedFor(t);
  if (!seed) return false;
  return t.channel === 'whatsapp' ? t.body !== seed.whatsapp : t.body !== seed.email || t.subject !== seed.emailSubject;
};

function TemplateEditor({ template, channel, onClose }: { template?: MessageTemplate; channel: MessageChannel; onClose: () => void }) {
  const { toast, confirm } = useFeedback();
  const creating = !template;
  const seed = template && seedFor(template);
  const [name, setName] = useState(template?.name ?? '');
  const [draft, setDraft] = useState({ subject: template?.subject ?? '', body: template?.body ?? '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (template) await templateService.update(template.id, { name, subject: draft.subject, body: draft.body });
      else await templateService.create({ channel, name, subject: draft.subject, body: draft.body });
      toast(creating ? 'Template created' : 'Template saved');
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const preview = { subject: renderTemplate(draft.subject, SAMPLE), body: renderTemplate(draft.body, SAMPLE) };

  return (
    <Modal
      title={creating ? `New ${CHANNEL_LABEL[channel]} template` : template.name}
      subtitle={seed ? seed.when : creating ? 'Write it once, then use it for any guest or lead.' : 'Your own template.'}
      size="xl"
      onClose={onClose}
      footer={
        <>
          {template && !template.builtInKey && (
            <Button
              className="left"
              variant="danger"
              icon="trash"
              onClick={async () => {
                const ok = await confirm({ title: `Delete “${template.name}”?`, message: 'It will no longer be offered when contacting a guest or lead. Messages already prepared are not affected.', confirmLabel: 'Delete template', danger: true });
                if (!ok) return;
                try { await templateService.remove(template.id); toast('Template deleted'); onClose(); } catch (e) { setError(errorMessage(e)); }
              }}
            >
              Delete
            </Button>
          )}
          {template && seed && isEdited(template) && (
            <Button
              className="left"
              icon="refresh"
              onClick={async () => {
                try {
                  const restored = await templateService.restore(template.id);
                  setDraft({ subject: restored.subject, body: restored.body });
                  toast('Original wording restored');
                } catch (e) { setError(errorMessage(e)); }
              }}
            >
              Restore original
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={busy}>{creating ? 'Create template' : 'Save changes'}</Button>
        </>
      }
    >
      <div className="contact-grid">
        <div className="stack">
          <TextField label="Template name" value={name} disabled={!!template?.builtInKey} onChange={(e) => setName(e.target.value)} hint={template?.builtInKey ? 'Built-in templates keep their name.' : undefined} />
          <MessageEditor channel={channel} subject={draft.subject} body={draft.body} onChange={setDraft} rows={12} />
          {error && <div className="alert alert-bad" role="alert"><Icon name="alert" /><span>{error}</span></div>}
        </div>
        <div className="stack">
          <h3 className="contact-h">Preview</h3>
          <MessagePreview channel={channel} subject={preview.subject} body={preview.body} />
          <p className="small muted">The preview uses sample details. When you contact a guest or lead, the placeholders are filled in with theirs.</p>
        </div>
      </div>
    </Modal>
  );
}

export default function Templates() {
  const { can } = useAuth();
  const [tab, setTab] = useState<MessageChannel>('whatsapp');
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null);
  const { data: templates } = useResource(() => templateService.list());
  const manage = can('customers.manage');
  if (!templates) return <PageLoading />;

  const list = templates.filter((t) => t.channel === tab);
  const custom = list.filter((t) => !t.builtInKey).length;

  return (
    <>
      <PageHead
        title="Message templates"
        subtitle="Ready-written WhatsApp messages and emails. Edit them, add your own, and pick one whenever you contact a guest or lead."
        actions={manage && <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>New {CHANNEL_LABEL[tab]} template</Button>}
      />
      <Panel>
        <div style={{ padding: '4px 14px 0' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'whatsapp' as MessageChannel, label: 'WhatsApp templates', count: templates.filter((t) => t.channel === 'whatsapp').length },
              { id: 'email' as MessageChannel, label: 'Email templates', count: templates.filter((t) => t.channel === 'email').length },
            ]}
          />
        </div>
        <div className="panel-body">
          <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            {tab === 'whatsapp' ? <WhatsAppLogo size={24} /> : <EmailLogo size={24} />}
            <span className="muted small">
              {list.length - custom} built-in{custom ? `, ${custom} of your own` : ''}. Placeholders such as {'{guest_name}'} and {'{booking_link}'} are filled in for each person.
            </span>
          </div>
          {list.length === 0 ? (
            <EmptyState icon="message" title="No templates yet" message="Create your first template." />
          ) : (
            <div className="template-grid">
              {list.map((t) => (
                <button key={t.id} type="button" className={`template-card is-${t.channel}`} onClick={() => setEditing(t)} data-testid="template-card">
                  <span className="template-top">
                    <span className="strong">{t.name}</span>
                    {t.builtInKey ? (isEdited(t) ? <Badge tone="info">Edited</Badge> : <Badge tone="quiet">Built-in</Badge>) : <Badge tone="brass">Custom</Badge>}
                  </span>
                  {t.channel === 'email' && (
                    <span className="template-subject"><Icon name="mail" size={13} /> <span>{t.subject}</span></span>
                  )}
                  <span className="template-body">{t.body}</span>
                  <span className="template-foot small">{seedFor(t)?.when ?? 'Custom template'} <Icon name="edit" size={13} /></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>
      {editing && <TemplateEditor key={editing === 'new' ? 'new' : editing.id} template={editing === 'new' ? undefined : editing} channel={editing === 'new' ? tab : editing.channel} onClose={() => setEditing(null)} />}
    </>
  );
}
