// Player page JavaScript - Team Building Interface
let teamsList = [];
let currentTeamIndex = 0;

// Player page authentication handling
async function checkPlayerAuth() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        
        if (!data.username) {
            // User not logged in, redirect to home
            window.location.href = '/';
            return null;
        }
        
        return data.username;
    } catch (error) {
        console.error('Error checking auth status:', error);
        window.location.href = '/';
        return null;
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

// Battle button functionality
function setupBattleButtons() {
  // Resume battle button
  const resumeBattleBtn = document.getElementById('resume-battle-btn');
  if (resumeBattleBtn) {
    resumeBattleBtn.onclick = async function() {
      // Check if current team has at least 1 Pokemon
      if (!(await validateTeamForBattle())) {
        showErrorModal('Please add at least 1 Pokemon to your team before resuming a battle.');
        return;
      }
      
      let teamId = teamsList[currentTeamIndex] && teamsList[currentTeamIndex].team_id;
      if (teamId) {
        window.location.href = `/battle?team_id=${teamId}&action=resume`;
      } else {
        window.location.href = '/battle?action=resume';
      }
    };
  }
  
  // New battle button
  const newBattleBtn = document.getElementById('new-battle-btn');
  if (newBattleBtn) {
    newBattleBtn.onclick = async function() {
      // Check if current team has at least 1 Pokemon
      if (!(await validateTeamForBattle())) {
        showErrorModal('Please add at least 1 Pokemon to your team before starting a new battle.');
        return;
      }
      
      let teamId = teamsList[currentTeamIndex] && teamsList[currentTeamIndex].team_id;
      if (teamId) {
        window.location.href = `/battle?team_id=${teamId}&action=new`;
      } else {
        window.location.href = '/battle?action=new';
      }
    };
  }
  
  // Single battle button (when no existing battle)
  const battleBtn = document.getElementById('battle-btn');
  if (battleBtn) {
    battleBtn.onclick = async function() {
      // Check if current team has at least 1 Pokemon
      if (!(await validateTeamForBattle())) {
        showErrorModal('Please add at least 1 Pokemon to your team before starting a battle.');
        return;
      }
      
      let teamId = teamsList[currentTeamIndex] && teamsList[currentTeamIndex].team_id;
      if (teamId) {
        window.location.href = `/battle?team_id=${teamId}`;
      } else {
        window.location.href = '/battle';
      }
    };
  }
}

// Validate team for battle
async function validateTeamForBattle() {
  // Check if we have a current team
  const currentTeam = teamsList[currentTeamIndex];
  if (!currentTeam || !currentTeam.team_id) {
    return false;
  }
  
  try {
    // Fetch the actual team data
    const res = await fetch(`/api/team?team_id=${currentTeam.team_id}`);
    const data = await res.json();
    const team = data.team || [];
    
    // Check if at least one Pokemon slot is not empty
    const hasAtLeastOnePokemon = team.some(pokemon => pokemon !== null && pokemon !== undefined);
    return hasAtLeastOnePokemon;
  } catch (error) {
    console.error('Error validating team:', error);
    return false;
  }
}

// Show error modal
function showErrorModal(message) {
  const errorModal = document.getElementById('error-modal');
  const errorMessage = document.getElementById('error-message');
  
  if (errorModal && errorMessage) {
    errorMessage.textContent = message;
    errorModal.style.display = 'flex';
  }
}

// Close error modal
function closeErrorModal() {
  const errorModal = document.getElementById('error-modal');
  if (errorModal) {
    errorModal.style.display = 'none';
  }
}

// Load current challenge information
async function loadCurrentChallenge() {
  try {
    const res = await fetch('/api/current-challenge');
    const data = await res.json();
    
    if (data.level_info && data.enemy_team) {
      // Update level information
      document.getElementById('current-level').textContent = data.level_info.current_level;
      document.getElementById('max-level').textContent = data.level_info.max_level_reached;
      
      // Update enemy cost
      if (data.enemy_cost !== undefined) {
        document.getElementById('enemy-cost').textContent = data.enemy_cost;
      }
      
      // Display enemy team
      const enemyGrid = document.getElementById('enemy-grid');
      enemyGrid.innerHTML = '';
      
      data.enemy_team.forEach(pokemon => {
        if (pokemon) {
          const enemyCard = document.createElement('div');
          enemyCard.className = 'enemy-pokemon-preview';
          enemyCard.innerHTML = `
            <img src="/api/pokemon_image/${pokemon.id}" alt="${pokemon.name}">
            <div class="pokemon-name">${pokemon.name}</div>
            <div class="pokemon-level">Level ${pokemon.level}</div>
            <div class="pokemon-types">
              ${(pokemon.types || []).map(type => `<span class="type-badge type-${type.toLowerCase()}">${type}</span>`).join('')}
            </div>
          `;
          
          // Add tooltip with moves
          if (pokemon.assigned_moves && pokemon.assigned_moves.length > 0) {
            enemyCard.setAttribute('data-moves', JSON.stringify(pokemon.assigned_moves));
            enemyCard.classList.add('has-moves');
          }
          
          enemyGrid.appendChild(enemyCard);
        }
      });
      
      // Load move data for tooltips
      loadEnemyMoveTooltips();
      
      // Show the challenge section
      document.getElementById('challenge-section').style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading current challenge:', error);
  }
}

// Load enemy move tooltips
async function loadEnemyMoveTooltips() {
  const enemyCards = document.querySelectorAll('.enemy-pokemon-preview.has-moves');
  
  for (const card of enemyCards) {
    const movesData = JSON.parse(card.getAttribute('data-moves'));
    
    try {
      // Fetch move data for each move
      const movePromises = movesData.map(moveId =>
        fetch(`/api/move/${moveId}`)
          .then(response => response.json())
          .then(moveData => ({
            name: moveData.move_name || 'Unknown Move',
            type: moveData.type_id || 1,
            power: moveData.power || 0,
            accuracy: moveData.accuracy || 0,
            category: moveData.category || 'physical'
          }))
          .catch(() => ({ name: 'Unknown Move', type: 1, power: 0, accuracy: 0, category: 'physical' }))
      );
      
      const moves = await Promise.all(movePromises);
      
      // Create tooltip content
      const tooltipContent = moves.map(move => 
        `<div class="move-tooltip-item">
          <span class="move-name">${move.name}</span>
          <span class="move-details">${move.power} power, ${move.accuracy}% acc</span>
        </div>`
      ).join('');
      
      // Add tooltip functionality
      card.addEventListener('mouseenter', () => {
        showTooltip(card, tooltipContent);
      });
      
      card.addEventListener('mouseleave', () => {
        hideTooltip();
      });
      
    } catch (error) {
      console.error('Error loading moves for tooltip:', error);
    }
  }
}

// Show tooltip
function showTooltip(element, content) {
  hideTooltip(); // Remove any existing tooltip
  
  const tooltip = document.createElement('div');
  tooltip.className = 'enemy-move-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-header">Moves:</div>
    ${content}
  `;
  
  document.body.appendChild(tooltip);
  
  // Position tooltip
  const rect = element.getBoundingClientRect();
  tooltip.style.left = rect.right + 10 + 'px';
  tooltip.style.top = rect.top + 'px';
  
  // Add fade-in animation
  setTimeout(() => tooltip.classList.add('visible'), 10);
}

// Hide tooltip
function hideTooltip() {
  const existingTooltip = document.querySelector('.enemy-move-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
}

// Check session on load
async function initializePlayerPage() {
    const username = await checkPlayerAuth();
    if (!username) return; // Will redirect if not authenticated
    
    // Continue with player page initialization
    await fetchTeams();
    loadTeam(0);
    await loadCurrentChallenge();
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializePlayerPage();
  setupTeamTabs();
  setupEditTeamButtons();
  setupBattleButtons();
});