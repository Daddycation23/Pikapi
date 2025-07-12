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
    // Logged-in users shouldn't be on this page - redirect to player page
    window.location.href = '/player';
  } else {
    // Show login/register UI for non-logged-in users
    authSection.innerHTML = `<button class='btn-standard login-btn' id='login-btn' style='background: var(--primary-color); margin-right: 10px;'>Login</button><button class='btn-standard register-btn' id='register-btn' style='background: var(--secondary-color);'>Register</button>`;
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

async function loadAllPokemon(filters = null) {
  try {
    let url = '/api/pokemon';
    if (filters) {
      const params = new URLSearchParams();
      
      // Add search filter
      if (filters.search) {
        params.append('search', filters.search);
      }
      
      // Add cost filter
      if (filters.cost && filters.cost !== 'all') {
        params.append('cost', filters.cost);
      }
      
      // Add cost range filters
      if (filters.costRange) {
        params.append('cost_min', filters.costRange[0]);
        params.append('cost_max', filters.costRange[1]);
      }
      
      // Add type filters
      if (filters.types && filters.types.length > 0) {
        params.append('types', filters.types.join(','));
      }
      
      // Add generation filters
      if (filters.generations && filters.generations.length > 0) {
        params.append('generations', filters.generations.join(','));
      }
      
      // Add rarity filters
      if (filters.special && filters.special.length > 0) {
        params.append('rarity', filters.special.join(','));
      }
      
      // Add stat range filters
      if (filters.stats) {
        Object.entries(filters.stats).forEach(([stat, range]) => {
          if (range[0] !== 0) params.append(`${stat}_min`, range[0]);
          if (range[1] !== 255) params.append(`${stat}_max`, range[1]);
        });
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
    }
    
    const res = await fetch(url);
    const data = await res.json();
    const pokemonList = Array.isArray(data) ? data : (data.pokemon || []);
    
    if (filters) {
      // If we're filtering, update the filtered list
      filteredPokemon = pokemonList;
    } else {
      // If no filters, load all Pokémon
      allPokemon = pokemonList;
      filteredPokemon = [...allPokemon];
    }
    
    
  } catch (error) {
    console.error('Error loading Pokemon:', error);
  }
}

function setupPokedexEventListeners() {
  // Cost filter buttons
  document.querySelectorAll('.cost-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.cost-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilters.cost = btn.textContent.toLowerCase();
      await applyFilters();
    });
  });

  // Search input
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        activeFilters.search = e.target.value.toLowerCase();
        await applyFilters();
      }, 300); // Debounce search to avoid too many API calls
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
    filterApply.addEventListener('click', async () => {
      await applyAdvancedFilters();
      filterModal.style.display = 'none';
    });
  }

  if (filterClear) {
    filterClear.addEventListener('click', async () => {
      await clearAllFilters();
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

async function applyAdvancedFilters() {
  // Get selected types
  activeFilters.types = Array.from(document.querySelectorAll('.type-btn.active'))
    .map(btn => btn.dataset.type);

  // Get selected generations and convert Roman numerals to numbers
  const romanToNumber = {
    'I': '1', 'II': '2', 'III': '3', 'IV': '4', 
    'V': '5', 'VI': '6', 'VII': '7', 'VIII': '8'
  };
  activeFilters.generations = Array.from(document.querySelectorAll('.gen-btn.active'))
    .map(btn => romanToNumber[btn.dataset.gen]);

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

  await applyFilters();
  updateFilterCount();
}

async function clearAllFilters() {
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

  await applyFilters();
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

async function applyFilters() {
  // Use server-side filtering for better performance and accuracy
  await loadAllPokemon(activeFilters);
  renderPokemonGrid();
}

function renderPokemonGrid() {
  const grid = document.querySelector('.pokemon-selection-grid');
  if (!grid) {
    
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
      // Fetch moves with type information
      let movesWithTypes = [];
      if (detailedPokemon.id) {
        try {
          const movesResponse = await fetch(`/api/pokemon/${detailedPokemon.id}/moves-with-types`);
          const movesData = await movesResponse.json();
          if (movesData.moves) {
            movesWithTypes = movesData.moves;
          }
        } catch (error) {
          console.error('Error fetching moves with types:', error);
          // Fallback to basic moves if API fails
          movesWithTypes = (detailedPokemon.moves || []).map(move => ({ name: move, type: 'Normal' }));
        }
      } else {
        // Fallback for Pokemon without ID
        movesWithTypes = (detailedPokemon.moves || []).map(move => ({ name: move, type: 'Normal' }));
      }
      
      detailMoves.innerHTML = `
        <h4>Moves (${movesWithTypes.length})</h4>
        <div class="moves-container">
          ${movesWithTypes.map(move => 
            `<span class="move-badge type-${move.type.toLowerCase()}">${move.name.replace('-', ' ')}</span>`
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