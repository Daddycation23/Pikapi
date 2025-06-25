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
      // Redirect to player.html after successful login
      window.location.href = '/player';
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
  initPokedex();
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

// Pokedex functionality
let allPokemon = [];
let filteredPokemon = [];
let activeFilters = {
  cost: 'all',
  search: '',
  types: [],
  generations: [],
  special: [],
  stats: {
    hp: [0, 255],
    attack: [0, 255],
    defense: [0, 255],
    'sp-attack': [0, 255],
    'sp-defense': [0, 255],
    speed: [0, 255]
  },
  costRange: [1, 5]
};

async function initPokedex() {
  await loadAllPokemon();
  setupPokedexEventListeners();
  applyFilters();
}

async function loadAllPokemon() {
  try {
    const res = await fetch('/api/pokemon');
    const data = await res.json();
    allPokemon = Array.isArray(data) ? data : (data.pokemon || []);
    filteredPokemon = [...allPokemon];
    console.log('Loaded Pokemon:', allPokemon.length, 'items');
  } catch (error) {
    console.error('Error loading Pokemon:', error);
  }
}

function setupPokedexEventListeners() {
  // Cost filter buttons
  document.querySelectorAll('.cost-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cost-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilters.cost = btn.textContent.toLowerCase();
      applyFilters();
    });
  });

  // Search input
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeFilters.search = e.target.value.toLowerCase();
      applyFilters();
    });
  }

  // Advanced filter modal
  const advancedFilterBtn = document.getElementById('advanced-filter-btn');
  const filterModal = document.getElementById('filter-modal');
  const filterClose = document.getElementById('filter-close');
  const filterApply = document.getElementById('filter-apply');
  const filterClear = document.getElementById('filter-clear');

  if (advancedFilterBtn) {
    advancedFilterBtn.addEventListener('click', () => {
      filterModal.style.display = 'block';
    });
  }

  if (filterClose) {
    filterClose.addEventListener('click', () => {
      filterModal.style.display = 'none';
    });
  }

  if (filterApply) {
    filterApply.addEventListener('click', () => {
      applyAdvancedFilters();
      filterModal.style.display = 'none';
    });
  }

  if (filterClear) {
    filterClear.addEventListener('click', () => {
      clearAllFilters();
    });
  }

  // Type filter buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  // Generation filter buttons
  document.querySelectorAll('.gen-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  // Special property filter buttons
  document.querySelectorAll('.special-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  // Stat range sliders
  setupStatRangeSliders();

  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === filterModal) {
      filterModal.style.display = 'none';
    }
  });
}

function setupStatRangeSliders() {
  const stats = ['hp', 'attack', 'defense', 'sp-attack', 'sp-defense', 'speed'];
  
  stats.forEach(stat => {
    const minSlider = document.getElementById(`${stat}-min`);
    const maxSlider = document.getElementById(`${stat}-max`);
    const valueDisplay = document.getElementById(`${stat}-value`);
    
    if (minSlider && maxSlider && valueDisplay) {
      function updateDisplay() {
        const min = parseInt(minSlider.value);
        const max = parseInt(maxSlider.value);
        if (min > max) {
          minSlider.value = max;
        }
        if (max < min) {
          maxSlider.value = min;
        }
        valueDisplay.textContent = `${minSlider.value}-${maxSlider.value}`;
      }
      
      minSlider.addEventListener('input', updateDisplay);
      maxSlider.addEventListener('input', updateDisplay);
    }
  });

  // Cost range slider
  const costMinSlider = document.getElementById('cost-min');
  const costMaxSlider = document.getElementById('cost-max');
  const costValueDisplay = document.getElementById('cost-value');
  
  if (costMinSlider && costMaxSlider && costValueDisplay) {
    function updateCostDisplay() {
      const min = parseInt(costMinSlider.value);
      const max = parseInt(costMaxSlider.value);
      if (min > max) {
        costMinSlider.value = max;
      }
      if (max < min) {
        costMaxSlider.value = min;
      }
      costValueDisplay.textContent = `${costMinSlider.value}-${costMaxSlider.value}`;
    }
    
    costMinSlider.addEventListener('input', updateCostDisplay);
    costMaxSlider.addEventListener('input', updateCostDisplay);
  }
}

function applyAdvancedFilters() {
  // Get selected types
  activeFilters.types = Array.from(document.querySelectorAll('.type-btn.active'))
    .map(btn => btn.dataset.type);

  // Get selected generations
  activeFilters.generations = Array.from(document.querySelectorAll('.gen-btn.active'))
    .map(btn => btn.dataset.gen);

  // Get selected special properties
  activeFilters.special = Array.from(document.querySelectorAll('.special-btn.active'))
    .map(btn => btn.dataset.special);

  // Get stat ranges
  const stats = ['hp', 'attack', 'defense', 'sp-attack', 'sp-defense', 'speed'];
  stats.forEach(stat => {
    const minSlider = document.getElementById(`${stat}-min`);
    const maxSlider = document.getElementById(`${stat}-max`);
    if (minSlider && maxSlider) {
      activeFilters.stats[stat] = [parseInt(minSlider.value), parseInt(maxSlider.value)];
    }
  });

  // Get cost range
  const costMinSlider = document.getElementById('cost-min');
  const costMaxSlider = document.getElementById('cost-max');
  if (costMinSlider && costMaxSlider) {
    activeFilters.costRange = [parseInt(costMinSlider.value), parseInt(costMaxSlider.value)];
  }

  applyFilters();
  updateFilterCount();
}

function clearAllFilters() {
  // Clear type filters
  document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
  
  // Clear generation filters
  document.querySelectorAll('.gen-btn').forEach(btn => btn.classList.remove('active'));
  
  // Clear special property filters
  document.querySelectorAll('.special-btn').forEach(btn => btn.classList.remove('active'));
  
  // Reset stat sliders
  const stats = ['hp', 'attack', 'defense', 'sp-attack', 'sp-defense', 'speed'];
  stats.forEach(stat => {
    const minSlider = document.getElementById(`${stat}-min`);
    const maxSlider = document.getElementById(`${stat}-max`);
    const valueDisplay = document.getElementById(`${stat}-value`);
    if (minSlider && maxSlider && valueDisplay) {
      minSlider.value = 0;
      maxSlider.value = 255;
      valueDisplay.textContent = '0-255';
    }
  });

  // Reset cost range
  const costMinSlider = document.getElementById('cost-min');
  const costMaxSlider = document.getElementById('cost-max');
  const costValueDisplay = document.getElementById('cost-value');
  if (costMinSlider && costMaxSlider && costValueDisplay) {
    costMinSlider.value = 1;
    costMaxSlider.value = 5;
    costValueDisplay.textContent = '1-5';
  }

  // Reset active filters
  activeFilters = {
    cost: activeFilters.cost,
    search: activeFilters.search,
    types: [],
    generations: [],
    special: [],
    stats: {
      hp: [0, 255],
      attack: [0, 255],
      defense: [0, 255],
      'sp-attack': [0, 255],
      'sp-defense': [0, 255],
      speed: [0, 255]
    },
    costRange: [1, 5]
  };

  applyFilters();
  updateFilterCount();
}

function updateFilterCount() {
  const filterCount = document.getElementById('filter-count');
  if (filterCount) {
    const count = activeFilters.types.length + 
                  activeFilters.generations.length + 
                  activeFilters.special.length +
                  (activeFilters.costRange[0] !== 1 || activeFilters.costRange[1] !== 5 ? 1 : 0) +
                  Object.values(activeFilters.stats).filter(range => range[0] !== 0 || range[1] !== 255).length;
    
    filterCount.textContent = count > 0 ? count : '';
    filterCount.style.display = count > 0 ? 'inline' : 'none';
  }
}

function applyFilters() {
  filteredPokemon = allPokemon.filter(pokemon => {
    // Cost filter
    if (activeFilters.cost !== 'all' && pokemon.cost !== parseInt(activeFilters.cost)) {
      return false;
    }

    // Search filter
    if (activeFilters.search && !pokemon.name.toLowerCase().includes(activeFilters.search)) {
      return false;
    }

    // Type filter
    if (activeFilters.types.length > 0) {
      const pokemonTypes = (pokemon.type || []).map(t => t.toLowerCase());
      if (!activeFilters.types.some(type => pokemonTypes.includes(type))) {
        return false;
      }
    }

    // Generation filter
    if (activeFilters.generations.length > 0) {
      if (!activeFilters.generations.includes(pokemon.gen)) {
        return false;
      }
    }

    // Special property filter
    if (activeFilters.special.length > 0) {
      const hasSpecialProperty = activeFilters.special.some(special => {
        switch (special) {
          case 'legendary': return pokemon.is_legendary;
          case 'mythical': return pokemon.is_mythical;
          case 'sublegendary': return pokemon.is_sublegendary;
          case 'mega': return pokemon.name.includes('Mega');
          case 'gigantamax': return pokemon.name.includes('Gigantamax');
          default: return false;
        }
      });
      if (!hasSpecialProperty) {
        return false;
      }
    }

    // Stat range filters
    const statKeys = {
      'hp': 'hp',
      'attack': 'attack',
      'defense': 'defense',
      'sp-attack': 'sp_atk',
      'sp-defense': 'sp_def',
      'speed': 'speed'
    };

    for (const [filterKey, pokemonKey] of Object.entries(statKeys)) {
      const range = activeFilters.stats[filterKey];
      const pokemonStat = pokemon[pokemonKey] || 0;
      if (pokemonStat < range[0] || pokemonStat > range[1]) {
        return false;
      }
    }

    // Cost range filter
    if (pokemon.cost < activeFilters.costRange[0] || pokemon.cost > activeFilters.costRange[1]) {
      return false;
    }

    return true;
  });

  renderPokemonGrid();
}

function renderPokemonGrid() {
  const grid = document.querySelector('.pokemon-selection-grid');
  if (!grid) {
    console.error('Pokemon grid element not found');
    return;
  }

  grid.innerHTML = '';
  
  filteredPokemon.forEach(pokemon => {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    card.innerHTML = `
      <div class="pokemon-card-image">
        <img src="${pokemon.img}" alt="${pokemon.name}" onerror="this.src='/static/images/placeholder.png'">
      </div>
      <div class="pokemon-card-info">
        <div class="pokemon-card-name">${pokemon.name}</div>
        <div class="pokemon-card-cost">Cost: ${pokemon.cost}</div>
        <div class="pokemon-card-types">
          ${(pokemon.type || []).map(type => 
            `<span class="type-badge type-${type.toLowerCase()}">${type}</span>`
          ).join('')}
        </div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      showPokemonDetails(pokemon);
    });
    
    grid.appendChild(card);
  });
}

async function showPokemonDetails(pokemon) {
  const modal = document.getElementById('pokemon-modal');
  const detailImage = document.getElementById('modal-pokemon-img');
  const pokemonName = document.getElementById('modal-pokemon-name');
  const pokemonCost = document.getElementById('modal-pokemon-cost');
  const pokemonTypes = document.getElementById('modal-pokemon-type');
  const pokemonPhysical = document.getElementById('modal-pokemon-physical');
  const pokemonGeneration = document.getElementById('modal-pokemon-generation');
  const detailStats = document.getElementById('modal-pokemon-stats');
  const detailMoves = document.getElementById('modal-pokemon-moves');
  
  // Get detailed Pokemon data if needed (fetch for moves data)
  let detailedPokemon = pokemon;
  if (pokemon.id && (!pokemon.moves || pokemon.moves.length === 0)) {
    try {
      const response = await fetch(`/api/pokemon/${pokemon.id}`);
      const data = await response.json();
      detailedPokemon = data.success ? data.pokemon : pokemon;
    } catch (error) {
      console.error('Error fetching detailed Pokemon:', error);
    }
  }
  
  // Set Pokemon image
  if (detailImage) {
    detailImage.innerHTML = `<img src="${detailedPokemon.img}" alt="${detailedPokemon.name}" onerror="this.src='/static/images/placeholder.png'">`;
  }
  
  // Set Pokemon name
  if (pokemonName) {
    pokemonName.textContent = detailedPokemon.name;
  }
  
  // Set Pokemon cost
  if (pokemonCost) {
    pokemonCost.textContent = `Cost: ${detailedPokemon.cost}`;
  }
  
  // Set Pokemon types
  if (pokemonTypes) {
    pokemonTypes.innerHTML = (detailedPokemon.type || []).map(type => 
      `<span class="type-badge type-${type.toLowerCase()}">${type}</span>`
    ).join('');
  }
  
  // Set Pokemon stats with edit_team style layout
  if (detailStats) {
    const stats = [
      { key: 'HP', label: 'HP', value: detailedPokemon.hp || 0 },
      { key: 'Attack', label: 'Attack', value: detailedPokemon.attack || 0 },
      { key: 'Defense', label: 'Defense', value: detailedPokemon.defense || 0 },
      { key: 'Sp. Attack', label: 'Sp. Attack', value: detailedPokemon.sp_atk || 0 },
      { key: 'Sp. Defense', label: 'Sp. Defense', value: detailedPokemon.sp_def || 0 },
      { key: 'Speed', label: 'Speed', value: detailedPokemon.speed || 0 }
    ];
    
    detailStats.innerHTML = stats.map(stat => {
      const percentage = Math.min((stat.value / 255) * 100, 100);
      return `
        <div class="stat-row">
          <div class="stat-header">
            <span class="stat-label">${stat.label}</span>
            <span class="stat-value">${stat.value}</span>
          </div>
          <div class="stat-bar-bg">
            <div class="stat-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // Set Pokemon physical info
  if (pokemonPhysical) {
    const height = (detailedPokemon.height_cm !== null && detailedPokemon.height_cm !== undefined) ? `${detailedPokemon.height_cm} cm` : 'Unknown';
    const weight = (detailedPokemon.weight_kg !== null && detailedPokemon.weight_kg !== undefined) ? `${detailedPokemon.weight_kg} kg` : 'Unknown';
    pokemonPhysical.innerHTML = `<strong>Height:</strong> ${height} | <strong>Weight:</strong> ${weight}`;
  }
  
  // Set Pokemon generation
  if (pokemonGeneration) {
    pokemonGeneration.innerHTML = `<strong>Generation:</strong> ${detailedPokemon.gen || 'Unknown'}`;
  }
  
  // Set Pokemon moves
  if (detailMoves) {
    if (detailedPokemon.moves && detailedPokemon.moves.length > 0) {
      detailMoves.innerHTML = `
        <h4>Moves (${detailedPokemon.moves.length})</h4>
        <div class="moves-container">
          ${detailedPokemon.moves.map(move => 
            `<span class="move-badge">${move.replace('-', ' ')}</span>`
          ).join('')}
        </div>
      `;
    } else {
      detailMoves.innerHTML = `<h4>Moves</h4><p style="color: var(--text-secondary); font-size: 14px;">No moves available</p>`;
    }
  }
  
  modal.style.display = 'block';
}

// Close modal functionality for Pokemon details
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('pokemon-modal');
  const closeButton = modal?.querySelector('.close-button');
  
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
});