// Modal logic
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const loginClose = document.getElementById('login-close');
const registerClose = document.getElementById('register-close');
const authSection = document.getElementById('auth-section');
let currentUser = null;

function showLogin() { loginModal.style.display = 'block'; }
function showRegister() { registerModal.style.display = 'block'; }
function closeLogin() { loginModal.style.display = 'none'; document.getElementById('login-error').textContent = ''; }
function closeRegister() { registerModal.style.display = 'none'; document.getElementById('register-error').textContent = ''; }

loginBtn.onclick = showLogin;
registerBtn.onclick = showRegister;
loginClose.onclick = closeLogin;
registerClose.onclick = closeRegister;
window.onclick = function(event) {
  if (event.target === loginModal) closeLogin();
  if (event.target === registerModal) closeRegister();
};

// Login form submit
document.getElementById('login-form').onsubmit = async function(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const loginError = document.getElementById('login-error');
  const loginBtn = this.querySelector('button[type="submit"]');
  loginBtn.disabled = true;
  loginError.textContent = '';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      loginError.textContent = '';
      updateAuthUI(data.username);
      closeLogin();
      loadTeam();
    } else {
      loginError.textContent = data.error || 'Login failed';
    }
  } catch (err) {
    loginError.textContent = 'Network error. Please try again.';
  } finally {
    loginBtn.disabled = false;
  }
};

// Register form submit
document.getElementById('register-form').onsubmit = async function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById('register-error').style.color = 'green';
    document.getElementById('register-error').textContent = 'Registration successful! You can now log in.';
  } else {
    document.getElementById('register-error').style.color = 'red';
    document.getElementById('register-error').textContent = data.error || 'Registration failed';
  }
};

// Update UI for logged-in user
function updateAuthUI(username) {
  if (username) {
    authSection.innerHTML = `<span style='margin-right:15px;'>Logged in as <b>${username}</b></span><button class='auth-button' id='logout-btn'>Logout</button>`;
    document.getElementById('logout-btn').onclick = async function() {
      await fetch('/api/logout', { method: 'POST' });
      location.reload();
    };
  } else {
    authSection.innerHTML = `<button class='auth-button login-btn' id='login-btn'>Login</button><button class='auth-button register-btn' id='register-btn'>Register</button>`;
    document.getElementById('login-btn').onclick = showLogin;
    document.getElementById('register-btn').onclick = showRegister;
  }
}

// Check session on load
async function checkSessionAndInit() {
  const res = await fetch('/api/me');
  const data = await res.json();
  updateAuthUI(data.username);
  loadTeam();
}

document.addEventListener('DOMContentLoaded', () => {
  checkSessionAndInit();
  document.querySelectorAll('.edit-team-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      window.location.href = '/edit_team';
    });
  });
});

async function loadTeam() {
  const res = await fetch('/api/team');
  const data = await res.json();
  const team = data.team || [];
  const slots = document.querySelectorAll('.team-grid .pokemon-slot');
  for (let i = 0; i < 3; i++) {
    const poke = team[i];
    if (poke && slots[i]) {
      slots[i].innerHTML = `
        <div class="pokemon-image" style="background-image:url('${poke.img}');background-size:contain;background-repeat:no-repeat;background-position:center;"></div>
        <div class="pokemon-name">${poke.name}</div>
        <div class="pokemon-cost">Cost: ${poke.cost}</div>
        <div class="pokemon-types">${(poke.type||[]).map(t => `<span class="type-badge">${t}</span>`).join(' ')}</div>
      `;
    } else if (slots[i]) {
      slots[i].innerHTML = `<div class='pokemon-image'></div><p>Add Pokemon</p>`;
    }
  }
  // Update team cost bar
  const maxCost = 10;
  const totalCost = team.filter(p => p).reduce((sum, p) => sum + (p.cost || 0), 0);
  const costDisplay = document.getElementById('current-cost');
  const costFill = document.querySelector('.cost-fill');
  if (costDisplay && costFill) {
    costDisplay.textContent = totalCost;
    const percent = Math.min((totalCost / maxCost) * 100, 100);
    costFill.style.width = percent + '%';
    costFill.style.backgroundColor = totalCost <= maxCost ? '#4CAF50' : '#e74c3c';
  }
}