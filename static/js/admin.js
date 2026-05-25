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

// ─── API helpers ───────────────────────────────────────────────────────────
async function loadState() {
  const res = await fetch('/api/state');
  const data = await res.json();
  participants = data.participants;
  config       = data.config;
  renderParticipants();
  renderConfig();
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
});
