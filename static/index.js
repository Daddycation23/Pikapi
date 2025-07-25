// Index page specific logic
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
let currentUser = null;

function showLogin() { loginModal.style.display = 'flex'; }
function showRegister() { registerModal.style.display = 'flex'; }
function closeLogin() { loginModal.style.display = 'none'; document.getElementById('login-error').textContent = ''; }
function closeRegister() { registerModal.style.display = 'none'; document.getElementById('register-error').textContent = ''; }

// Close Pokemon detail modal
function closePokemonModal() {
  const pokemonModal = document.getElementById('pokemon-modal');
  if (pokemonModal) {
    pokemonModal.style.display = 'none';
  }
}

// Setup modal close handlers
function setupModalHandlers() {
    const loginClose = document.getElementById('login-close');
    const registerClose = document.getElementById('register-close');
    
    if (loginClose) loginClose.onclick = closeLogin;
    if (registerClose) registerClose.onclick = closeRegister;
    
    window.onclick = function(event) {
        if (event.target === loginModal) closeLogin();
        if (event.target === registerModal) closeRegister();
    };
}

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
// Index page authentication handling
async function checkIndexAuth() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        
        if (data.username) {
            // Logged-in users shouldn't be on this page - redirect to player page
            window.location.href = '/player';
            return;
        }
        
        // Setup login/register buttons for non-authenticated users
        const authSection = document.getElementById('nav-auth');
        if (authSection && !authSection.innerHTML.trim()) {
            authSection.innerHTML = `
                <button class="btn-standard btn-profile" onclick="showLogin()">Login</button>
                <button class="btn-standard btn-profile" onclick="showRegister()">Register</button>
            `;
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
  setupModalHandlers();
  checkIndexAuth();
  initPokedex();
  setupPokemonModalDrag();
  setupPokemonModalDragScroll(); // enable drag-scroll inside Pokémon details modal
  document.querySelectorAll('.edit-team-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      window.location.href = '/edit_team';
    });
  });
});

/* loadTeam function removed - not used on index page (only for logged-in users) */

// Pokedex functionality
let allPokemon = [];
let filteredPokemon = [];
let activeFilters = {
  search: '',
  costs: [1, 2, 3, 4, 5], // Changed to array of selected costs like edit_team
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
  }
};

async function initPokedex() {
  await loadAllPokemon();
  setupPokedexEventListeners();
  applyFilters();
  // Update total Pokemon count in welcome section
  updatePokemonCount();
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
      
      // Add cost filter - only if costs are selected
      if (filters.costs && filters.costs.length > 0) {
        params.append('costs', filters.costs.join(','));
      } else if (filters.costs && filters.costs.length === 0) {
        // If no costs are selected, return empty result immediately
        if (filters) {
          filteredPokemon = [];
        } else {
          allPokemon = [];
          filteredPokemon = [];
        }
        updatePokemonCount();
        return;
      }
      
      // Add cost range filters - remove these lines since we now use checkbox costs
      // if (filters.costRange) {
      //   params.append('cost_min', filters.costRange[0]);
      //   params.append('cost_max', filters.costRange[1]);
      // }
      
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
    
    // Update Pokemon count after loading
    updatePokemonCount();
    
  } catch (error) {
    console.error('Error loading Pokemon:', error);
  }
}

function setupPokedexEventListeners() {
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
    filterClear.addEventListener('click', () => {
      clearAllFilters();
    });
  }

  // Cost checkboxes - like edit_team
  const costCheckboxes = document.querySelectorAll('.cost-checkbox');
  costCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateCostFilter();
    });
  });

  // Setup stat range sliders
  setupStatSliders();
  
  // Setup other filter buttons
  setupFilterButtons();
}

function setupStatSliders() {
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

function updateCostFilter() {
  const costCheckboxes = document.querySelectorAll('.cost-checkbox:checked');
  activeFilters.costs = Array.from(costCheckboxes).map(cb => parseInt(cb.value));
}

function setupFilterButtons() {
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

  // Close modal when clicking outside
  const filterModal = document.getElementById('filter-modal');
  window.addEventListener('click', (event) => {
    if (event.target === filterModal) {
      filterModal.style.display = 'none';
    }
  });
}

async function applyAdvancedFilters() {
  // Collect active type filters
  const activeTypes = Array.from(document.querySelectorAll('.type-btn.active')).map(btn => btn.dataset.type);
  activeFilters.types = activeTypes;

  // Collect active generation filters
  const activeGens = Array.from(document.querySelectorAll('.gen-btn.active')).map(btn => btn.dataset.gen);
  activeFilters.generations = activeGens;

  // Collect active special filters
  const activeSpecial = Array.from(document.querySelectorAll('.special-btn.active')).map(btn => btn.dataset.special);
  activeFilters.special = activeSpecial;

  // Update cost filter from checkboxes
  updateCostFilter();

  await applyFilters();
  updateFilterCount();
}

function clearAllFilters() {
  // Reset all filter states
  activeFilters.search = '';
  activeFilters.costs = [1, 2, 3, 4, 5];
  activeFilters.types = [];
  activeFilters.generations = [];
  activeFilters.special = [];
  activeFilters.stats = {
    hp: [0, 255],
    attack: [0, 255],
    defense: [0, 255],
    'sp-attack': [0, 255],
    'sp-defense': [0, 255],
    speed: [0, 255]
  };

  // Reset UI elements
  document.querySelector('.search-input').value = '';
  
  // Check all cost checkboxes
  document.querySelectorAll('.cost-checkbox').forEach(cb => cb.checked = true);
  
  // Uncheck all filter buttons
  document.querySelectorAll('.filter-toggle-btn').forEach(btn => btn.classList.remove('active'));
  
  // Reset all stat sliders
  const stats = ['hp', 'attack', 'defense', 'sp-attack', 'sp-defense', 'speed'];
  stats.forEach(stat => {
    const minSlider = document.getElementById(`${stat}-min`);
    const maxSlider = document.getElementById(`${stat}-max`);
    const valueSpan = document.getElementById(`${stat}-value`);
    
    if (minSlider) minSlider.value = 0;
    if (maxSlider) maxSlider.value = 255;
    if (valueSpan) valueSpan.textContent = '0-255';
  });

  updateFilterCount();
}

function updateFilterCount() {
  const filterCount = document.getElementById('filter-count');
  if (filterCount) {
    const count = activeFilters.types.length + 
                  activeFilters.generations.length + 
                  activeFilters.special.length +
                  (activeFilters.costs.length !== 5 ? 1 : 0) + // Cost filter active if not all costs selected
                  Object.values(activeFilters.stats).filter(range => range[0] !== 0 || range[1] !== 255).length;
    
    filterCount.textContent = count > 0 ? count : '';
    filterCount.style.display = count > 0 ? 'inline' : 'none';
  }
}

async function applyFilters() {
  // Use server-side filtering for better performance and accuracy
  await loadAllPokemon(activeFilters);
  renderPokemonGrid();
  updatePokemonCount(); // Ensure count is updated after filtering
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
    // Include basic info like before but with improved structure
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
  
  // Update count after rendering
  updatePokemonCount();
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
  
  modal.style.display = 'flex';
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

// ---------------------------
// DRAG-SCROLL SUPPORT FOR POKÉMON DETAILS MODAL
// ---------------------------
function setupPokemonModalDragScroll() {
  const content = document.querySelector('#pokemon-modal .notification-modal-content');
  if (!content) return;

  let isDown = false;
  let startY = 0;
  let startScrollTop = 0;

  content.addEventListener('mousedown', (e) => {
    // Allow normal clicks on buttons, links, and the close icon
    if (e.target.closest('button') || e.target.classList.contains('modal-close-btn')) {
      return;
    }

    isDown = true;
    startY = e.clientY;
    startScrollTop = content.scrollTop;
    content.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const deltaY = e.clientY - startY;
    content.scrollTop = startScrollTop - deltaY;
  });

  window.addEventListener('mouseup', () => {
    if (!isDown) return;
    isDown = false;
    content.style.cursor = '';
  });
}

// ---------------------------
// DRAGGABLE POKÉMON DETAILS MODAL
// ---------------------------
function setupPokemonModalDrag() {
  const modal = document.getElementById('pokemon-modal');
  if (!modal) return;
  const content = modal.querySelector('.notification-modal-content');
  if (!content) return;
  const header = content.querySelector('.notification-modal-header');
  if (!header) return;

  // Avoid re-initialising multiple times
  if (header.dataset.dragInit) return;
  header.dataset.dragInit = 'true';

  header.style.cursor = 'move';

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener('mousedown', (e) => {
    // Ignore clicks that originate on close (<span>) or any <button>
    if (e.target.closest('button') || e.target.classList.contains('modal-close-btn')) {
      return;
    }

    isDragging = true;
    const rect = content.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // Switch to absolute positioning so we can freely move the card
    content.style.position = 'absolute';
    content.style.margin = '0';
    content.style.transform = 'none';
    content.style.left = `${rect.left}px`;
    content.style.top = `${rect.top}px`;
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    // Keep the card inside the viewport
    const maxLeft = window.innerWidth - content.offsetWidth;
    const maxTop = window.innerHeight - content.offsetHeight;
    newLeft = Math.min(Math.max(0, newLeft), maxLeft);
    newTop = Math.min(Math.max(0, newTop), maxTop);

    content.style.left = `${newLeft}px`;
    content.style.top = `${newTop}px`;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
    }
  });
}

function updatePokemonCount() {
  const totalPokemonElement = document.getElementById('total-pokemon');
  const pokemonLabel = document.getElementById('pokemon-label');
  
  if (totalPokemonElement) {
    // Show filtered count vs total count when filters are active
    const hasActiveFilters = activeFilters.search || 
                            activeFilters.costs.length !== 5 || 
                            activeFilters.types.length > 0 || 
                            activeFilters.generations.length > 0 || 
                            activeFilters.special.length > 0 ||
                            Object.values(activeFilters.stats).some(range => range[0] !== 0 || range[1] !== 255);
    
    if (hasActiveFilters) {
      totalPokemonElement.textContent = `${filteredPokemon.length}/${allPokemon.length}`;
      if (pokemonLabel) {
        pokemonLabel.textContent = 'Filtered';
      }
    } else {
      totalPokemonElement.textContent = allPokemon.length;
      if (pokemonLabel) {
        pokemonLabel.textContent = 'Pokémon';
      }
    }
  }
}