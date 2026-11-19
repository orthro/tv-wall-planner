/* State and safe integrations. */
(() => {
  'use strict';
  const brand = window.BRAND || {};
  const options = window.OPTIONS || {};
  const labels = window.LABELS || {};
  const steps = window.STEPS || [];
  const root = document.querySelector('#wizard');
  if (!root) return;
  const storageKey = 'tvWallPlanner.v1';
  const contactKeys = ['name', 'phone', 'email', 'contactPref', 'referral', 'street', 'city', 'state', 'zip', 'consent'];
  const contactLabels = { name: 'Name', phone: 'Phone', email: 'Email', contactPref: 'Preferred contact', referral: 'Heard about us', street: 'Street', city: 'City', state: 'State', zip: 'ZIP code', consent: 'Consent to contact' };
  const preferences = ['Phone call', 'Text message', 'Email'];
  const referrals = ['Instagram', 'Facebook', 'Google search', 'Referral from a friend or family', 'Saw our work in person', 'Nextdoor', 'Home show or event', 'Other'];
  const subtitles = ['Tell us about the room the wall sits in.', 'Add a linear fireplace below the TV, or skip it.', 'Choose the layout and the main wall finish.', 'Add niches, shelves or cabinetry.', 'Finishing touches: lighting, slats and metal reveals.', 'Photos, budget and timing help us prepare.', 'Where should we send your concept?'];
  const defaults = Object.fromEntries(Object.entries(options).map(([key, values]) => [key, values[0].id]));
  const blankContact = Object.fromEntries(contactKeys.map(key => [key, key === 'consent' ? false : '']));
  blankContact.contactPref = preferences[0];
  let state = { ...defaults, notes: '', contact: { ...blankContact } };
  let step = 0;
  let photos = [];
  let ready = false;
  let company = '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeHex = hex => /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '';
  function preview(method, ...args) {
    try { return window.WallPreview && typeof window.WallPreview[method] === 'function' ? window.WallPreview[method](...args) : undefined; }
    catch (_) { return undefined; }
  }
  function clean(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Choose a valid design JSON file.');
    const result = { ...defaults, notes: '', contact: { ...blankContact } };
    Object.entries(options).forEach(([key, values]) => {
      if (key in data && !values.some(item => item.id === data[key])) throw Error(`Invalid option for ${key}.`);
      if (key in data) result[key] = data[key];
    });
    if (typeof data.notes === 'string') result.notes = data.notes.slice(0, 10000);
    if (data.contact && typeof data.contact === 'object') contactKeys.forEach(key => {
      if (key === 'consent') result.contact[key] = data.contact[key] === true;
      else if (typeof data.contact[key] === 'string') result.contact[key] = data.contact[key].slice(0, 1000);
    });
    if (!preferences.includes(result.contact.contactPref)) result.contact.contactPref = preferences[0];
    if (result.contact.referral && !referrals.includes(result.contact.referral)) result.contact.referral = '';
    return result;
  }
  try { const draft = localStorage.getItem(storageKey); if (draft) state = clean(JSON.parse(draft)); } catch (_) { /* A blocked store must not prevent designing. */ }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  function changed() { persist(); if (ready) preview('update', state); }
  function announce(message) { const el = document.querySelector('#planner-status'); if (el) el.textContent = message; }

  /* Option lookups shared by the wizard and the summary. */
  const option = key => options[key]?.find(x => x.id === state[key]);
  const labelOf = key => labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
  function inactive(key) {   // options that don't apply to the current design
    return (key === 'fireplaceFrame' && state.fireplace === 'none') || (key === 'slatTone' && state.slats === 'none');
  }

  /* Wizard rendering and option controls. */
  function optionGroup(key) {
    if (key === 'fireplaceFrame' && state.fireplace === 'none') return '';
    const disabled = key === 'slatTone' && state.slats === 'none';
    const chosen = option(key);
    return `<fieldset ${disabled ? 'disabled' : ''}><legend>${esc(labelOf(key))}${chosen && !disabled ? `<span class="current-value">· ${esc(chosen.label)}</span>` : ''}</legend><div class="chips">${options[key].map(item => {
      const hex = safeHex(item.hex);
      return `<button type="button" class="chip" data-key="${esc(key)}" data-value="${esc(item.id)}" aria-pressed="${state[key] === item.id}">${hex ? `<span class="swatch" style="background:${hex}" aria-hidden="true"></span>` : '<span class="check" aria-hidden="true"></span>'}${esc(item.label)}</button>`;
    }).join('')}</div></fieldset>${disabled ? '<p class="hint hint-after">Choose a slat placement to select its tone.</p>' : ''}`;
  }
  function field(key, label, type = 'text', required = false) {
    return `<div class="form-field"><label for="contact-${key}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label><input id="contact-${key}" name="${key}" type="${type}" autocomplete="${({ name: 'name', phone: 'tel', email: 'email', street: 'street-address', city: 'address-level2', state: 'address-level1', zip: 'postal-code' })[key]}" value="${esc(state.contact[key])}" ${required ? 'required' : ''}><span class="field-error" id="error-${key}"></span></div>`;
  }
  function contactForm() {
    return `<div class="form-grid">${field('name', 'Name', 'text', true)}<div class="form-field"><label for="contact-contactPref">Preferred contact method</label><select id="contact-contactPref" name="contactPref">${preferences.map(x => `<option ${state.contact.contactPref === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>${field('phone', 'Phone', 'tel')}${field('email', 'Email', 'email')}<p class="hint full" style="margin-top:-6px">Provide at least one phone number or email address.</p><div class="form-field full"><label for="contact-referral">How did you hear about us? <span class="req" aria-hidden="true">*</span></label><select id="contact-referral" name="referral" required><option value="">Choose one</option>${referrals.map(x => `<option ${state.contact.referral === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><span class="field-error" id="error-referral"></span></div><div class="full">${field('street', 'Street address', 'text', true)}</div>${field('city', 'City', 'text', true)}${field('state', 'State', 'text', true)}${field('zip', 'ZIP code', 'text', true)}</div><label class="consent"><input type="checkbox" name="consent" ${state.contact.consent ? 'checked' : ''}> <span>I agree that ${esc(brand.name)} may contact me about this project. <span class="req" aria-hidden="true">*</span></span></label><span class="field-error" id="error-consent"></span><div class="honeypot" aria-hidden="true"><label for="company">Company</label><input id="company" name="company" tabindex="-1" autocomplete="off" value="${esc(company)}"></div>`;
  }
  function photoForm() {
    return `<fieldset><legend>Project photos</legend><label for="project-photos">Add up to 6 images of the wall (kept only in this session)</label><input id="project-photos" type="file" accept="image/*" multiple><div class="photo-list">${photos.map((photo, i) => `<div class="photo"><img src="${esc(photo.url)}" alt="${esc(photo.name)}"><button type="button" data-remove="${i}" aria-label="Remove ${esc(photo.name)}">×</button></div>`).join('')}</div></fieldset>`;
  }
  function stepContent(current) {
    return current.keys.map(key => options[key] ? optionGroup(key)
      : key === 'photos' ? photoForm()
      : key === 'notes' ? `<div class="form-field"><label for="project-notes">Project notes</label><textarea id="project-notes" name="notes" rows="5" maxlength="10000" placeholder="Wall size, TV model, anything we should know…">${esc(state.notes)}</textarea></div>`
      : key === 'contact' ? contactForm() : '').join('');
  }
  function render(focus = false) {
    const current = steps[step];
    if (!current) { root.textContent = 'The planner configuration is unavailable.'; return; }
    const last = step === steps.length - 1;
    root.innerHTML = `<form id="planner-form" novalidate>
      <div class="wizard-head">
        <p class="eyebrow">Step ${step + 1} of ${steps.length}</p>
        <ol class="progress" aria-hidden="true">${steps.map((_, i) => `<li class="${i < step ? 'done' : i === step ? 'current' : ''}"></li>`).join('')}</ol>
        <ol class="step-tabs" aria-label="Design steps">${steps.map((s, i) => `<li><button type="button" data-goto="${i}" ${i === step ? 'aria-current="step"' : ''}><span class="num">${i + 1}</span>${esc(s.title)}</button></li>`).join('')}</ol>
        <h2 id="step-title" tabindex="-1">${esc(current.title)}</h2>
        <p class="step-sub">${esc(subtitles[step] || '')}</p>
      </div>
      <div class="wizard-body">
        ${step === 0 ? '<aside class="how-it-works"><span class="i" aria-hidden="true">i</span><div><strong>How this works</strong><p>Options are starting points. More detail helps us prepare a faster, more accurate quote. Nothing here is a quote — we measure your wall before anything is priced.</p></div></aside>' : ''}
        ${stepContent(current)}
      </div>
      <p id="planner-status" role="status" aria-live="polite"></p>
      <p class="footer-note">Your design autosaves in this browser. Nothing is sent until you press Send.</p>
      <div class="wizard-nav">
        <button type="button" class="ghost" data-nav="back" ${step === 0 ? 'disabled' : ''}>← Back</button>
        <span class="step-count">${step + 1} / ${steps.length}</span>
        <button type="submit" class="primary">${last ? 'Create summary' : `Next: ${esc(steps[step + 1].title)} →`}</button>
      </div>
    </form>`;
    if (focus) document.querySelector('#step-title').focus({ preventScroll: true });
    renderPresets();
  }
  function goto(index, focus = true) {
    step = Math.max(0, Math.min(steps.length - 1, index));
    render(focus);
    if (focus && root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* Inline contact validation. */
  function validate() {
    const errors = {};
    ['name', 'referral', 'street', 'city', 'state', 'zip'].forEach(key => { if (!state.contact[key].trim()) errors[key] = 'This field is required.'; });
    if (!state.contact.phone.trim() && !state.contact.email.trim()) errors.phone = 'Enter a phone number or email address.';
    if (state.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contact.email)) errors.email = 'Enter a valid email address.';
    if (state.contact.phone && state.contact.phone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a valid phone number.';
    if (!state.contact.consent) errors.consent = 'Your agreement is required.';
    contactKeys.forEach(key => {
      const input = root.querySelector(`[name="${key}"]`);
      const error = document.querySelector(`#error-${key}`);
      if (input) { input.setAttribute('aria-invalid', String(!!errors[key])); if (error) input.setAttribute('aria-describedby', error.id); }
      if (error) error.textContent = errors[key] || '';
    });
    if (company.trim()) { announce('This submission could not be accepted.'); return false; }
    if (Object.keys(errors).length) { root.querySelector(`[name="${Object.keys(errors)[0]}"]`).focus(); return false; }
    return true;
  }

  /* Summary model: one section per step, used by both the dialog and the text export. */
  function summarySections() {
    return steps.map((s, index) => {
      const rows = [];
      s.keys.forEach(key => {
        if (options[key]) {
          const item = option(key);
          rows.push(inactive(key) ? { label: labelOf(key), value: 'Not applicable', unset: true } : { label: labelOf(key), value: item?.label || 'Not selected', hex: safeHex(item?.hex), unset: !item });
        } else if (key === 'photos') rows.push({ label: 'Photos', value: photos.length ? `${photos.length} attached (send separately)` : 'None added', unset: !photos.length });
        else if (key === 'notes') rows.push({ label: 'Notes', value: state.notes.trim() || 'None', unset: !state.notes.trim(), notes: true });
        else if (key === 'contact') contactKeys.forEach(c => {
          const v = c === 'consent' ? (state.contact.consent ? 'Agreed' : 'Not given') : state.contact[c].trim();
          rows.push({ label: contactLabels[c], value: v || 'Not provided', unset: !v });
        });
      });
      return { index, title: s.title, rows };
    });
  }
  const newRef = () => 'TW-' + Date.now().toString(36).toUpperCase().slice(-6);
  // Downloadable text: aligned columns, one block per step.
  function summaryText(ref) {
    const pad = (s, n) => (s + ':').padEnd(n);
    const lines = [`${(brand.name || 'TV Wall Planner').toUpperCase()} - TV ACCENT WALL CONCEPT`, `Date: ${new Date().toISOString().slice(0, 10)}   Ref: ${ref}`,
      `Client: ${state.contact.name || '-'}   Budget: ${option('budget')?.label || '-'}   Timeline: ${option('timeline')?.label || '-'}`, ''];
    summarySections().forEach(sec => {
      lines.push(`${sec.index + 1}. ${sec.title.toUpperCase()}`, '-'.repeat(40));
      sec.rows.forEach(r => lines.push(r.notes ? `${pad(r.label, 28)}${r.value.replace(/\r?\n/g, '\n' + ' '.repeat(28))}` : `${pad(r.label, 28)}${r.value}${r.hex ? ` (${r.hex.toUpperCase()})` : ''}`));
      lines.push('');
    });
    lines.push('Nothing here is a quote. We measure properly before any work is priced.');
    return lines.join('\n');
  }
  // Email body: compact (no padding), contact first so it always survives, notes trimmed to fit
  // mailto's practical ~2,000-character limit. CRLF line endings throughout.
  function emailText(ref) {
    const c = state.contact;
    const head = [`TV wall enquiry - Ref ${ref}`, '', 'CONTACT', `Name: ${c.name}`, c.phone ? `Phone: ${c.phone}` : null, c.email ? `Email: ${c.email}` : null,
      `Prefers: ${c.contactPref}`, `Address: ${[c.street, c.city, c.state, c.zip].filter(Boolean).join(', ')}`, `Heard about us: ${c.referral}`,
      `Budget: ${option('budget')?.label || '-'}`, `Timeline: ${option('timeline')?.label || '-'}`, ''].filter(x => x !== null);
    const design = ['DESIGN'];
    summarySections().filter(s => s.title !== 'Contact' && s.title !== 'Your project').forEach(s =>
      s.rows.filter(r => !r.unset).forEach(r => design.push(`${r.label}: ${r.value}${r.hex ? ` (${r.hex.toUpperCase()})` : ''}`)));
    const tail = ['', `Photos: ${photos.length ? photos.length + ' (attached separately)' : 'none'}`, '', 'Please attach the downloaded image and summary. Nothing here is a quote.'];
    let body = [...head, ...design, ...tail].join('\r\n');
    const room = 1900 - body.length - 20;
    let notes = state.notes.trim();
    if (notes && room > 40) {
      if (notes.length > room) notes = notes.slice(0, room - 1).replace(/[\uD800-\uDBFF]$/, '') + '…';
      body = [...head, ...design, '', 'NOTES', notes.replace(/\r?\n/g, '\r\n'), ...tail].join('\r\n');
    }
    return body;
  }
  function download(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function sectionHtml(sec) {
    const wide = sec.title === 'Contact' || sec.title === 'Your project';
    const body = sec.rows.map(r => r.notes
      ? `<dt>${esc(r.label)}</dt><dd class="${r.unset ? 'unset' : ''}"><span class="sum-notes">${esc(r.value)}</span></dd>`
      : `<dt>${esc(r.label)}</dt><dd class="${r.unset ? 'unset' : ''}">${r.hex ? `<span class="sum-swatch" style="background:${r.hex}" aria-hidden="true"></span>` : ''}${esc(r.value)}</dd>`).join('');
    return `<section class="sum-section ${wide ? 'wide' : ''}" aria-labelledby="sum-h-${sec.index}"><div class="sum-section-head"><h3 id="sum-h-${sec.index}"><span class="n">${sec.index + 1}</span>${esc(sec.title)}</h3><button type="button" class="sum-edit" data-edit="${sec.index}" aria-label="Edit ${esc(sec.title)}">Edit</button></div><dl class="sum-list">${body}</dl></section>`;
  }
  function openSummary() {
    const previous = document.activeElement;
    const ref = newRef();   // one reference shared by the text download and the email
    const shot = ready ? preview('snapshot', 2) : '';
    const snapshot = typeof shot === 'string' && shot.startsWith('data:image/png') ? shot : '';
    const dialog = document.createElement('dialog');
    dialog.className = 'summary-modal';
    dialog.setAttribute('aria-labelledby', 'summary-title');
    const meta = [['Budget', option('budget')?.label], ['Timeline', option('timeline')?.label], ['Contact', state.contact.name]];
    dialog.innerHTML = `<header class="sum-header"><div><p class="eyebrow">${esc(brand.name || 'TV Wall Planner')}</p><h2 id="summary-title">Your project summary</h2></div><button type="button" class="modal-close" aria-label="Close summary">×</button></header>
      <div class="sum-body">
        <div class="sum-top">
          ${snapshot ? `<figure class="sum-hero"><img class="summary-image" src="${esc(snapshot)}" alt="Your configured TV wall"><figcaption>Concept render — proportions are approximate until we measure.</figcaption></figure>` : '<p class="sum-footnote">The preview image is unavailable. Your design choices are listed below.</p>'}
          <dl class="sum-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl>
        </div>
        <div class="sum-grid">${summarySections().map(sectionHtml).join('')}</div>
        <p class="sum-footnote">Photos aren't included in downloads or email — attach them yourself. Nothing here is a quote; we measure before anything is priced.</p>
        <p class="summary-status" role="status"></p>
      </div>
      <footer class="sum-footer"><button type="button" data-download="image" ${snapshot ? '' : 'disabled'}>Download image</button><button type="button" data-download="text">Download summary</button><button type="button" data-download="json">Save &amp; finish later</button><button type="button" class="ghost" data-print>Print</button><span class="spacer"></span>${brand.email ? '<button type="button" class="primary" data-send>Send to us</button>' : ''}</footer>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => { dialog.remove(); if (dialog.dataset.edit == null) previous?.focus(); });
    dialog.querySelector('.modal-close').onclick = () => dialog.close();
    let downInside = false;   // only a press AND release outside the dialog box counts as a backdrop click
    const outside = e => { const r = dialog.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    dialog.addEventListener('pointerdown', e => { downInside = !outside(e); });
    dialog.addEventListener('click', event => {
      if (event.target === dialog && !downInside && outside(event)) { dialog.close(); return; }
      const edit = event.target.closest('[data-edit]');
      if (edit) { dialog.dataset.edit = edit.dataset.edit; dialog.close(); goto(Number(edit.dataset.edit)); return; }
      const action = event.target.closest('[data-download], [data-send], [data-print]');
      if (!action) return;
      const status = dialog.querySelector('.summary-status');
      if (action.dataset.download === 'image' && snapshot) { const a = document.createElement('a'); a.href = snapshot; a.download = 'tv-wall-design.png'; a.click(); }
      if (action.dataset.download === 'text') download('tv-wall-summary.txt', summaryText(ref), 'text/plain;charset=utf-8');
      if (action.dataset.download === 'json') { const saved = persist(); download('tv-wall-design.json', JSON.stringify(state, null, 2), 'application/json'); status.textContent = saved ? 'Design downloaded and saved in this browser. Photos are not included.' : 'Design downloaded. Browser storage is unavailable. Photos are not included.'; }
      if (action.hasAttribute('data-print')) window.print();
      if (action.hasAttribute('data-send') && !company.trim()) {
        try {
          window.location.href = `mailto:${encodeURIComponent(brand.email)}?subject=${encodeURIComponent(`TV wall enquiry – ${state.contact.name} – ${new Date().toISOString().slice(0, 10)}`)}&body=${encodeURIComponent(emailText(ref))}`;
          status.textContent = 'Your email app should open. Download the image and summary, then attach them with any photos.';
        } catch (_) { status.textContent = 'Your email app could not be opened. Download the summary and email it to ' + brand.email + '.'; }
      }
    });
    dialog.showModal();
  }

  /* Wizard events, in-memory photos, and validated design import. */
  root.addEventListener('click', event => {
    const chip = event.target.closest('[data-key]');
    if (chip) { state[chip.dataset.key] = chip.dataset.value; changed(); render(); root.querySelector(`[data-key="${chip.dataset.key}"][data-value="${chip.dataset.value}"]`)?.focus(); return; }
    const jump = event.target.closest('[data-goto]');
    if (jump) { goto(Number(jump.dataset.goto)); return; }
    if (event.target.closest('[data-nav="back"]')) { goto(step - 1); return; }
    const remove = event.target.closest('[data-remove]');
    if (remove) { URL.revokeObjectURL(photos[Number(remove.dataset.remove)].url); photos.splice(Number(remove.dataset.remove), 1); render(); document.querySelector('#project-photos')?.focus(); }
  });
  root.addEventListener('input', event => {
    const input = event.target;
    if (input.name === 'company') { company = input.value; return; }
    if (input.name === 'notes') state.notes = input.value;
    else if (contactKeys.includes(input.name)) state.contact[input.name] = input.type === 'checkbox' ? input.checked : input.value;
    else return;
    changed();
  });
  root.addEventListener('change', event => {
    if (event.target.id !== 'project-photos') return;
    const files = Array.from(event.target.files || []);
    let rejected = false;
    files.forEach(file => {
      if (!file.type.startsWith('image/') || photos.length >= 6) { rejected = true; return; }
      photos.push({ name: file.name, url: URL.createObjectURL(file) });
    });
    render(); announce(rejected ? 'Only images are accepted, with a maximum of 6 photos.' : `${photos.length} photos added. Photos stay in this session only.`);
  });
  root.addEventListener('submit', event => { event.preventDefault(); if (step < steps.length - 1) goto(step + 1); else if (validate()) openSummary(); });
  document.querySelector('#load-design')?.addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 1000000) throw Error('This design file is too large.');
      const loaded = clean(JSON.parse(await file.text()));
      state = loaded; photos.forEach(p => URL.revokeObjectURL(p.url)); photos = []; company = ''; step = 0; changed(); render(true); announce('Saved design loaded. Add project photos again if needed.');
    } catch (error) { announce(error instanceof SyntaxError ? 'The file is not valid JSON.' : error.message); }
    event.target.value = '';
  });

  /* Design presets: validated against OPTIONS, applied in one click, active one highlighted. */
  const presets = (window.PRESETS || []).filter(p => p && p.values && Object.entries(p.values).every(([k, v]) => options[k]?.some(o => o.id === v)));
  const presetRoot = document.querySelector('#presets');
  function renderPresets() {
    if (!presetRoot) return;
    presetRoot.hidden = !presets.length;
    presetRoot.innerHTML = presets.map(p => {
      const active = Object.entries(p.values).every(([k, v]) => state[k] === v);
      const dots = ['wallColor', 'panelColor', 'cabinetFinish', p.values.slats !== 'none' ? 'slatTone' : 'floor']
        .map(k => safeHex(options[k].find(o => o.id === p.values[k])?.hex)).filter(Boolean)
        .map(hex => `<span style="background:${hex}"></span>`).join('');
      return `<button type="button" class="preset" data-preset="${esc(p.id)}" aria-pressed="${active}"><span class="preset-dots" aria-hidden="true">${dots}</span><span class="preset-name">${esc(p.name)}</span><span class="preset-blurb">${esc(p.blurb || '')}</span></button>`;
    }).join('');
  }
  presetRoot?.addEventListener('click', event => {
    const button = event.target.closest('[data-preset]'); if (!button) return;
    const preset = presets.find(p => p.id === button.dataset.preset); if (!preset) return;
    Object.assign(state, preset.values); changed(); render(); announce(`${preset.name} preset applied. Adjust any step to make it yours.`);
    presetRoot.querySelector(`[data-preset="${preset.id}"]`)?.focus();
  });

  /* Page branding and guarded preview toolbar. */
  const brandName = document.querySelector('#brand-name'); if (brandName) brandName.textContent = brand.name || 'TV Wall Planner';
  const tagline = document.querySelector('#brand-tagline'); if (tagline) { tagline.textContent = brand.tagline || ''; tagline.hidden = !brand.tagline; }
  const backLink = document.querySelector('#back-link');
  if (backLink) { try { const url = new URL(brand.siteUrl, location.href); if (['http:', 'https:'].includes(url.protocol)) backLink.href = url.href; } catch (_) { backLink.hidden = true; } }
  ready = preview('init', document.querySelector('#preview')) === true;
  const loading = document.querySelector('#preview-loading'); if (loading) loading.hidden = true;
  const fallback = document.querySelector('#preview-fallback'); if (fallback) fallback.hidden = ready;
  const hint = document.querySelector('#preview-hint');
  if (hint && ready) {
    hint.hidden = false;
    const fade = () => hint.classList.add('faded');
    document.querySelector('#preview').addEventListener('pointerdown', fade, { once: true });
    setTimeout(fade, 6000);
  }
  function syncToolbar(light, view) {
    if (light) document.querySelectorAll('#toolbar [data-light]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.light === light)));
    if (view !== undefined) document.querySelectorAll('#toolbar [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  }
  document.querySelectorAll('#toolbar button').forEach(button => { button.disabled = !ready; });
  document.querySelector('#toolbar')?.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || !ready) return;
    if (button.dataset.light) { preview('setLighting', button.dataset.light); syncToolbar(button.dataset.light); }
    if (button.dataset.view) { preview('setView', button.dataset.view); syncToolbar(null, button.dataset.view); }
    if (button.dataset.zoom) preview('zoom', Number(button.dataset.zoom));
    if (button.dataset.action === 'reset') { preview('reset'); syncToolbar('bright', 'front'); }
  });
  // Dragging the camera leaves the preset views: clear the highlighted view button.
  document.querySelector('#preview')?.addEventListener('wallpreview:orbit', () => syncToolbar(null, ''));
  if (ready) preview('update', state);
  render();
})();
