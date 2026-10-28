import { auth } from '../auth.js';
import { esc, toast } from '../ui.js';

/** Borang log masuk admin: emel → kod 6 digit. Memanggil onDone() selepas berjaya. */
export function mountLogin(box, onDone, { title = 'Log masuk admin', lead = '' } = {}) {
  let email = '';
  let cooldown = 0;
  let timer = null;

  function stepEmail(err = '') {
    box.innerHTML = `
      <h2>${title}</h2>
      ${lead ? `<p class="lead">${lead}</p>` : ''}
      <form id="lf" class="stack" novalidate>
        <div class="field">
          <label for="lEmail">Emel anda</label>
          <input id="lEmail" type="email" inputmode="email" autocomplete="email" placeholder="nama@contoh.com" value="${esc(email)}" required>
          <span class="hint">Kami hantar kod 6 digit ke emel ini. Tiada kata laluan diperlukan.</span>
        </div>
        <p class="err" role="alert">${esc(err)}</p>
        <button class="btn gold wide" type="submit">Hantar kod</button>
      </form>`;
    const f = box.querySelector('#lf');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      email = box.querySelector('#lEmail').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { stepEmail('Masukkan alamat emel yang sah.'); return; }
      const b = f.querySelector('button');
      b.disabled = true; b.textContent = 'Menghantar kod…';
      try {
        await auth.sendCode(email);
        startCooldown();
        stepCode();
      } catch (ex) {
        stepEmail(ex.message);
      }
    });
  }

  function startCooldown() {
    cooldown = 60;
    clearInterval(timer);
    timer = setInterval(() => {
      cooldown -= 1;
      const r = box.querySelector('#resend');
      if (r) { r.disabled = cooldown > 0; r.textContent = cooldown > 0 ? `Hantar semula kod (${cooldown}s)` : 'Hantar semula kod'; }
      if (cooldown <= 0) clearInterval(timer);
    }, 1000);
  }

  function stepCode(err = '') {
    box.innerHTML = `
      <h2>Masukkan kod</h2>
      <p class="lead">Kod 6 digit telah dihantar ke <b>${esc(email)}</b>. Semak juga folder Spam.</p>
      <form id="cf" class="stack" novalidate>
        <div class="field">
          <label for="lCode">Kod 6 digit</label>
          <input id="lCode" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="••••••">
        </div>
        <p class="err" role="alert">${esc(err)}</p>
        <button class="btn gold wide" type="submit">Log masuk</button>
        <div class="row-btns">
          <button class="btn small" id="resend" type="button" ${cooldown > 0 ? 'disabled' : ''}>${cooldown > 0 ? `Hantar semula kod (${cooldown}s)` : 'Hantar semula kod'}</button>
          <button class="btn small ghost" id="change" type="button">Tukar emel</button>
        </div>
      </form>`;
    const input = box.querySelector('#lCode');
    input.focus();
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 6);
      if (input.value.length === 6) box.querySelector('#cf').requestSubmit();
    });
    box.querySelector('#cf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = input.value;
      if (code.length !== 6) { stepCode('Kod mesti 6 digit.'); return; }
      const b = box.querySelector('#cf button[type=submit]');
      b.disabled = true; b.textContent = 'Menyemak…';
      try {
        await auth.verify(email, code);
        clearInterval(timer);
        toast('Berjaya log masuk.');
        onDone();
      } catch (ex) {
        stepCode(ex.message);
      }
    });
    box.querySelector('#resend').onclick = async () => {
      try { await auth.sendCode(email); startCooldown(); toast('Kod baru dihantar.'); stepCode(); }
      catch (ex) { stepCode(ex.message); }
    };
    box.querySelector('#change').onclick = () => stepEmail();
  }

  stepEmail();
  return () => clearInterval(timer);
}
