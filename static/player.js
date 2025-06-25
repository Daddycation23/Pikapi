// Player page JavaScript - Team Building Interface
const authSection = document.getElementById('auth-section');

// Update UI for logged-in user
function updateAuthUI(username) {
  if (username) {
    authSection.innerHTML = `<span style='margin-right:15px;'>Welcome, <b>${username}</b>!</span><button class='auth-button' id='logout-btn'>Logout</button>`;
    document.getElementById('logout-btn').onclick = async function() {
      const response = await fetch('/api/logout', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        window.location.href = '/';
      }
    };
  } else {
    // User not logged in, redirect to home
    window.location.href = '/';
  }
}

// Check session on load
async function checkSessionAndInit() {
  const res = await fetch('/api/me');
  const data = await res.json();
  updateAuthUI(data.username);
  loadTeam();
}

// Load team data
async function loadTeam() {
  try {
    const res = await fetch('/api/team');
    const data = await res.json();
    const team = data.team || [];
    const slots = document.querySelectorAll('.team-grid .pokemon-slot');
    
    for (let i = 0; i < 3; i++) {
      const poke = team[i];
      if (poke && slots[i]) {
        slots[i].innerHTML = `
          <div class="pokemon-image" style="background-image:url('/api/pokemon_image/${poke.id}');background-size:contain;background-repeat:no-repeat;background-position:center;"></div>
          <div class="pokemon-name">${poke.name}</div>
          <div class="pokemon-cost">Cost: ${poke.cost}</div>
          <div class="pokemon-types">${(poke.type||[]).map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join(' ')}</div>
        `;
      } else if (slots[i]) {
        slots[i].innerHTML = `<div class='pokemon-image'></div><p>Add Pokemon</p>`;
      }
    }
    
    // Update team cost bar
    updateCostTracker(team);
  } catch (error) {
    console.error('Error loading team:', error);
  }
}

// Update cost tracker
function updateCostTracker(team) {
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

// Team tab switching functionality
function setupTeamTabs() {
  const teamTabs = document.querySelectorAll('.team-tab');
  teamTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      teamTabs.forEach(t => t.classList.remove('active'));
      // Add active class to clicked tab
      tab.classList.add('active');
      // Load team for this tab (for now just Team 1)
      if (index === 0) {
        loadTeam();
      }
    });
  });
}

// Setup edit team buttons
function setupEditTeamButtons() {
  document.querySelectorAll('.edit-team-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      window.location.href = '/edit_team';
    });
  });
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  checkSessionAndInit();
  setupTeamTabs();
  setupEditTeamButtons();
}); 