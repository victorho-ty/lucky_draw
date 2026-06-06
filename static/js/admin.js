'use strict';

const EMOJIS = [
  // Faces
  '😀','😎','🤓','😍','🥳','🤩','😄','😂','🤣','🥸','🧐','😏','🤔','🤗','😜',
  // Animals
  '🐶','🐱','🦊','🐻','🐼','🦁','🐯','🐸','🐧','🦆','🦅','🦋','🐬','🦈','🐙',
  // Objects & fun
  '🚀','⭐','🌟','💫','🎯','🏆','💎','🔥','⚡','🌈','🎸','🎮','🎲','🃏','🎪',
  // Sports
  '⚽','🏀','🏈','⚾','🎾','🏐','🏓','🥊','🏄','🏇',
  // Food
  '🍎','🍕','🍔','🌮','🍰','🎂','🍦','☕','🥂','🍺',
  // Nature
  '🌺','🌻','🌸','🍀','🌍','🌙','☀️','🌊','🏔️','🌴',
  // Misc
  '👑','💪','👍','🙌','🎭','🎨','🎵','🎤','🦄','🌀',
];

let selectedEmoji = EMOJIS[0];
let participants  = [];
let config        = { winners_count: 3, speed: 'medium' };
let banner        = { type: 'none', text: '', style: 'elegant', image_data: null };

// ─── API helpers ───────────────────────────────────────────────────────────
async function loadState() {
  const res = await fetch('/api/state');
  const data = await res.json();
  participants = data.participants;
  config       = data.config;
  banner       = data.banner ?? { type: 'none', text: '', style: 'elegant', image_data: null };
  renderParticipants();
  renderConfig();
  renderBanner();
}

// ─── Render functions ──────────────────────────────────────────────────────
function renderParticipants() {
  const tbody = document.getElementById('participant-tbody');
  if (participants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-msg">No participants yet — add some below</td></tr>';
  } else {
    tbody.innerHTML = participants.map(p => `
      <tr>
        <td class="emoji-cell">${p.emoji}</td>
        <td class="name-cell">${escapeHtml(p.name)}</td>
        <td class="action-cell">
          <button class="remove-btn" data-id="${p.id}">✕</button>
        </td>
      </tr>`).join('');
  }
  document.getElementById('count-badge').textContent = `${participants.length} participants`;
}

function renderConfig() {
  document.getElementById('winners-count').value = config.winners_count;
  document.querySelectorAll('.speed-radio').forEach(r => {
    r.checked = r.value === config.speed;
  });
}

// ─── Emoji picker ──────────────────────────────────────────────────────────
function buildEmojiPicker() {
  const container = document.getElementById('emoji-picker');
  container.innerHTML = EMOJIS.map(e => `
    <button class="emoji-btn${e === selectedEmoji ? ' selected' : ''}"
            data-emoji="${e}">${e}</button>`).join('');

  container.addEventListener('click', e => {
    const btn = e.target.closest('.emoji-btn');
    if (!btn) return;
    selectEmoji(btn.dataset.emoji);
  });
}

function selectEmoji(emoji) {
  selectedEmoji = emoji;
  document.getElementById('selected-emoji-display').textContent = emoji;
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.emoji === emoji);
  });
}

// ─── Participant CRUD ──────────────────────────────────────────────────────
async function addParticipant() {
  const nameInput = document.getElementById('participant-name');
  const name      = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }

  const res = await fetch('/api/participants', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ emoji: selectedEmoji, name }),
  });

  if (res.ok) {
    const newP = await res.json();
    participants.push(newP);
    nameInput.value = '';
    nameInput.focus();
    renderParticipants();
  }
}

async function removeParticipant(id) {
  const res = await fetch(`/api/participants/${id}`, { method: 'DELETE' });
  if (res.ok) {
    participants = participants.filter(p => p.id !== id);
    renderParticipants();
  }
}

// ─── Config save ───────────────────────────────────────────────────────────
async function saveConfig() {
  const winnersCount = parseInt(document.getElementById('winners-count').value, 10);
  const speed        = document.querySelector('.speed-radio:checked')?.value ?? 'medium';

  if (!Number.isFinite(winnersCount) || winnersCount < 1) {
    document.getElementById('winners-count').focus();
    return;
  }

  const res = await fetch('/api/config', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ winners_count: winnersCount, speed }),
  });

  if (res.ok) {
    config = await res.json();
    showSaved();
  }
}

function showSaved() {
  const btn = document.getElementById('save-config-btn');
  btn.textContent = '✓ Saved!';
  btn.classList.add('saved');
  setTimeout(() => {
    btn.textContent = 'Save Settings';
    btn.classList.remove('saved');
  }, 2000);
}

// ─── Banner ────────────────────────────────────────────────────────────────
function renderBanner() {
  document.querySelectorAll('.banner-type-radio').forEach(r => {
    r.checked = r.value === banner.type;
  });
  const textInput = document.getElementById('banner-text-input');
  textInput.value = banner.text;
  document.getElementById('banner-char-num').textContent = banner.text.length;
  document.querySelectorAll('.banner-style-radio').forEach(r => {
    r.checked = r.value === banner.style;
  });
  updateBannerPanelVisibility(banner.type);
  updateBannerPreview();
  if (banner.type === 'image' && banner.image_data) {
    document.getElementById('banner-drop-zone').classList.add('drop-zone-loaded');
  }
}

function updateBannerPanelVisibility(type) {
  document.getElementById('banner-text-panel').style.display  = type === 'text'  ? '' : 'none';
  document.getElementById('banner-image-panel').style.display = type === 'image' ? '' : 'none';
  document.getElementById('banner-preview-area').style.display = type !== 'none' ? '' : 'none';
}

function updateBannerPreview() {
  const box  = document.getElementById('banner-preview-box');
  const type = document.querySelector('.banner-type-radio:checked')?.value ?? 'none';
  if (type === 'none') {
    box.innerHTML = '';
    return;
  }
  if (type === 'text') {
    const text  = document.getElementById('banner-text-input').value.trim();
    const style = document.querySelector('.banner-style-radio:checked')?.value ?? 'elegant';
    box.innerHTML = text
      ? `<div class="custom-banner-text banner-style-${style}">${escapeHtml(text)}</div>`
      : `<span class="banner-placeholder">Enter text above to see preview</span>`;
    return;
  }
  if (type === 'image') {
    if (banner.image_data) {
      box.innerHTML = `<img class="custom-banner-img" src="${banner.image_data}" alt="banner">`;
    } else {
      box.innerHTML = `<span class="banner-placeholder">Upload an image to see preview</span>`;
    }
  }
}

async function saveBanner() {
  const type  = document.querySelector('.banner-type-radio:checked')?.value ?? 'none';
  const text  = document.getElementById('banner-text-input').value.trim();
  const style = document.querySelector('.banner-style-radio:checked')?.value ?? 'elegant';

  const res = await fetch('/api/banner', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ type, text, style }),
  });

  if (res.ok) {
    banner = await res.json();
    showBannerSaved();
  } else {
    const err = await res.json().catch(() => ({}));
    alert(err.detail ?? 'Failed to save banner.');
  }
}

function showBannerSaved() {
  const btn = document.getElementById('save-banner-btn');
  btn.textContent = '✓ Saved!';
  btn.classList.add('saved');
  setTimeout(() => {
    btn.textContent = 'Save Banner';
    btn.classList.remove('saved');
  }, 2000);
}

async function uploadBannerImage(file) {
  const errEl = document.getElementById('banner-upload-error');
  errEl.style.display = 'none';
  errEl.textContent   = '';

  if (file.size > 2 * 1024 * 1024) {
    errEl.textContent   = 'Image must be 2 MB or smaller.';
    errEl.style.display = '';
    return;
  }

  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/banner/upload', { method: 'POST', body: form });

  if (res.ok) {
    const data = await res.json();
    banner.image_data = data.data_url;
    banner.type       = 'image';
    document.querySelector('.banner-type-radio[value="image"]').checked = true;
    updateBannerPanelVisibility('image');
    updateBannerPreview();
    document.getElementById('banner-drop-zone').classList.add('drop-zone-loaded');
  } else {
    const err = await res.json().catch(() => ({}));
    errEl.textContent   = err.detail ?? 'Upload failed.';
    errEl.style.display = '';
  }
}

// ─── Utility ───────────────────────────────────────────────────────────────
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ─── Initialisation ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  buildEmojiPicker();
  await loadState();

  document.getElementById('add-participant-btn').addEventListener('click', addParticipant);
  document.getElementById('save-config-btn').addEventListener('click', saveConfig);

  document.getElementById('participant-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addParticipant();
  });

  // Event delegation for remove buttons
  document.getElementById('participant-tbody').addEventListener('click', e => {
    const btn = e.target.closest('.remove-btn');
    if (btn) removeParticipant(btn.dataset.id);
  });

  // Banner type toggle
  document.querySelectorAll('.banner-type-radio').forEach(r => {
    r.addEventListener('change', () => {
      updateBannerPanelVisibility(r.value);
      updateBannerPreview();
    });
  });

  // Style card toggle (live preview)
  document.querySelectorAll('.banner-style-radio').forEach(r => {
    r.addEventListener('change', updateBannerPreview);
  });

  // Text input — live preview + char count
  document.getElementById('banner-text-input').addEventListener('input', e => {
    document.getElementById('banner-char-num').textContent = e.target.value.length;
    updateBannerPreview();
  });

  // Save banner
  document.getElementById('save-banner-btn').addEventListener('click', saveBanner);

  // Drop zone — click to open file picker
  const dropZone  = document.getElementById('banner-drop-zone');
  const fileInput = document.getElementById('banner-file-input');
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) uploadBannerImage(file);
    fileInput.value = '';
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drop-zone-hover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drop-zone-hover');
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone-hover');
    const file = e.dataTransfer.files[0];
    if (file) uploadBannerImage(file);
  });
});
