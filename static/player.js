// Player page JavaScript - Team Building Interface
const authSection = document.getElementById('auth-section');

let teamsList = [];
let currentTeamIndex = 0;

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

// Fetch all teams for the user
async function fetchTeams() {
  const res = await fetch('/api/teams');
  const data = await res.json();
  teamsList = data.teams || [];
  // If less than 3 teams, create empty slots for UI
  while (teamsList.length < 3) {
    teamsList.push(null);
  }
}

// Load team data for a given tab index
async function loadTeam(index = 0) {
  currentTeamIndex = index;
  let teamId = teamsList[index] && teamsList[index].team_id;
  let team = [];
  if (teamId) {
    try {
      const res = await fetch(`/api/team?team_id=${teamId}`);
      const data = await res.json();
      team = data.team || [];
    } catch (error) {
      console.error('Error loading team:', error);
    }
  }
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
  updateCostTracker(team);
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
      teamTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadTeam(index);
    });
  });
}

// Setup edit team buttons
function setupEditTeamButtons() {
  document.querySelectorAll('.edit-team-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      // Pass team_id as query param to edit_team if available
      let teamId = teamsList[currentTeamIndex] && teamsList[currentTeamIndex].team_id;
      if (teamId) {
        window.location.href = `/edit_team?team_id=${teamId}`;
      } else {
        window.location.href = '/edit_team';
      }
    });
  });
}

// Check session on load
async function checkSessionAndInit() {
  const res = await fetch('/api/me');
  const data = await res.json();
  updateAuthUI(data.username);
  await fetchTeams();
  loadTeam(0);
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  checkSessionAndInit();
  setupTeamTabs();
  setupEditTeamButtons();
}); 