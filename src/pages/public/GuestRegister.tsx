import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { REG_IMAGE_EDGE, REG_ID_TYPES, REG_MIN_AGE, REG_NAME_MAX, validateIdFile, validateRegistration } from '@/domain/registration';
import { downscaleToJpeg } from '@/lib/image';
import { errorMessage } from '@/lib/validation';
import { publicRegistrationService, type PublicRegistrationHotel } from '@/services';

/*
 * The page a guest lands on after scanning the reception QR. Public: no sign-in, no app shell. It only
 * ever learns the hotel's name, and it can submit but never read: there is no way from here to see a
 * stored registration or ID. Styling is the self-contained light look from reviews.css.
 */

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

export default function GuestRegister() {
  const { token = '' } = useParams();
  const [hotel, setHotel] = useState<PublicRegistrationHotel | null | undefined>(undefined);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [idType, setIdType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const sending = useRef(false);

  useEffect(() => {
    let live = true;
    publicRegistrationService.hotel(token).then((h) => live && setHotel(h));
    document.title = 'Guest registration';
    return () => { live = false; };
  }, [token]);

  // The preview is for the guest to check their own photo. It lives only in this tab.
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setErrors((prev) => ({ ...prev, file: next ? validateIdFile(next) : '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    const found = { ...validateRegistration({ phone, name, age, idType }), file: validateIdFile(file) };
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      setFailure('');
      return;
    }
    sending.current = true;
    setBusy(true);
    setFailure('');
    try {
      const idDocument = await downscaleToJpeg(file!, REG_IMAGE_EDGE);
      await publicRegistrationService.submit(token, { phone, name, age: Number(age), idType, idDocument, submissionKey: key.current, website: trap });
      setDone(true);
    } catch (err) {
      setFailure(errorMessage(err));
      sending.current = false;
    } finally {
      setBusy(false);
    }
  };

  if (hotel === undefined) return <main className="gr" aria-busy="true" />;

  if (hotel === null) {
    return (
      <main className="gr">
        <div className="gr-card gr-center" data-testid="register-invalid">
          <h1>This link isn&apos;t valid</h1>
          <p>Please scan the QR code at reception again, or ask the front desk for help.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="gr">
      <div className="gr-card">
        {done ? (
          <div className="gr-thanks" role="status" data-testid="register-thanks">
            <svg className="gr-check" viewBox="0 0 80 80" aria-hidden="true">
              <circle className="gr-check-ring" cx="40" cy="40" r="34" />
              <path className="gr-check-tick" d="M25 41l11 11 20-23" />
            </svg>
            <h1>You&apos;re registered</h1>
            <p>Thank you, {name.trim().split(' ')[0]}. Please see the front desk at {hotel.name}. They will check your ID and hand over your key.</p>
            <p className="gr-thanks-sign">Welcome. We hope you enjoy your stay.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate aria-describedby={failure ? 'gr-error' : undefined} data-testid="register-form">
            <p className="gr-kicker">{hotel.name}</p>
            <h1>Register for your stay</h1>
            <p className="gr-lead">It takes about a minute. The front desk checks your details when you arrive.</p>

            <label className="gr-field">
              <span>Phone number</span>
              <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} aria-describedby="gr-phone-err" placeholder="e.g. 98765 43210" />
              {errors.phone && <small id="gr-phone-err" className="gr-field-error" role="alert">{errors.phone}</small>}
            </label>

            <label className="gr-field">
              <span>Full name</span>
              <input type="text" autoComplete="name" maxLength={REG_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby="gr-name-err" />
              {errors.name && <small id="gr-name-err" className="gr-field-error" role="alert">{errors.name}</small>}
            </label>

            <div className="gr-row gr-row-even">
              <label className="gr-field">
                <span>Age</span>
                <input type="number" inputMode="numeric" min={REG_MIN_AGE} max={120} value={age} onChange={(e) => setAge(e.target.value)} aria-invalid={!!errors.age} aria-describedby="gr-age-err" />
                {errors.age && <small id="gr-age-err" className="gr-field-error" role="alert">{errors.age}</small>}
              </label>
              <label className="gr-field">
                <span>ID type</span>
                <select value={idType} onChange={(e) => setIdType(e.target.value)} aria-invalid={!!errors.idType} aria-describedby="gr-idtype-err">
                  <option value="">Choose…</option>
                  {REG_ID_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                {errors.idType && <small id="gr-idtype-err" className="gr-field-error" role="alert">{errors.idType}</small>}
              </label>
            </div>

            <div className="gr-field">
              <span id="gr-file-label">Photo of your ID</span>
              <label className="gr-drop" data-filled={preview ? 'yes' : 'no'} data-invalid={errors.file ? 'yes' : 'no'}>
                <input type="file" accept="image/jpeg,image/png,image/webp" aria-labelledby="gr-file-label" aria-describedby="gr-file-err" onChange={pick} data-testid="register-file" />
                {preview ? (
                  <img src={preview} alt="The photo of your ID you chose" />
                ) : (
                  <span className="gr-drop-hint">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2-2h1.6l1.2-1.6h6.4L16.4 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.2" /></svg>
                    Take a photo or choose one
                  </span>
                )}
              </label>
              <small className="gr-field-note">{file ? `${file.name}. Tap the photo to change it.` : 'JPG, PNG or WebP, up to 8 MB. Make sure every corner is visible.'}</small>
              {errors.file && <small id="gr-file-err" className="gr-field-error" role="alert">{errors.file}</small>}
            </div>

            {/* Real guests never see or fill this. */}
            <div className="gr-trap" aria-hidden="true">
              <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
            </div>

            {failure && <p id="gr-error" className="gr-error" role="alert">{failure}</p>}

            <button type="submit" className="gr-submit" disabled={busy}>{busy ? 'Sending securely…' : 'Submit registration'}</button>
            <p className="gr-privacy">Your details and ID go only to {hotel.name}&apos;s front desk and are never shown publicly.</p>
          </form>
        )}
      </div>
    </main>
  );
}
