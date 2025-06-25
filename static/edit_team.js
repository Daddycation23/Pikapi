// --- Enhanced Team Editor with Full Features ---
    let team = [];
    let pokedex = [];
    let selectedTeamIdx = null;
    let selectedPokeIdx = null;
    let selectedPokemon = null;
    let maxCost = 10;

    // Fetch team and pokedex data from backend
    async function fetchData() {
      // Team data is passed from Flask as a Jinja variable
      let loadedTeam = window.team || [];
      // Pad team to length 3 with nulls
      while (loadedTeam.length < 3) loadedTeam.push(null);
      team = loadedTeam.slice(0, 3);
      await fetchPokemon();
      renderTeam();
      renderSelection();
      renderDetails();
      updateCostDisplay();
    }

    // Fetch Pokemon with filters
    async function fetchPokemon(search = '', type = '', cost = '') {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (type) params.append('type', type);
      if (cost) params.append('cost', cost);
      
      const res = await fetch(`/api/pokemon?${params}`);
      pokedex = await res.json();
    }

    // Render team slots
    function renderTeam() {
      for (let i = 0; i < 3; i++) {
        const slot = document.getElementById(`team-slot-${i+1}`);
        slot.innerHTML = '';
        if (team[i]) {
          const img = document.createElement('img');
          img.src = team[i].img;
          img.alt = team[i].name;
          img.className = 'team-pokemon-img';
          img.loading = 'lazy'; 
          slot.appendChild(img);
          
          // Add remove button
          const removeBtn = document.createElement('div');
          removeBtn.innerHTML = '×';
          removeBtn.style.cssText = 'position:absolute; top:5px; right:5px; background:red; color:white; border-radius:50%; width:20px; height:20px; text-align:center; cursor:pointer; font-size:14px; line-height:20px;';
          removeBtn.onclick = (e) => {
            e.stopPropagation();
            removePokemonFromTeam(i);
          };
          slot.style.position = 'relative';
          slot.appendChild(removeBtn);
        }
        slot.classList.remove('selected');
        slot.onclick = () => {
          selectedTeamIdx = i;
          selectedPokeIdx = null;
          selectedPokemon = team[i] || null;
          highlightTeam();
          renderDetails(team[i]);
          updateActionButtons();
        };
      }
    }

    function highlightTeam() {
      for (let i = 0; i < 3; i++) {
        const slot = document.getElementById(`team-slot-${i+1}`);
        if (selectedTeamIdx === i) slot.classList.add('selected');
        else slot.classList.remove('selected');
      }
      // Keep selection cards highlighted - don't deselect them when team is selected
    }

    // Render selection panel
    function renderSelection() {
      const grid = document.querySelector('.pokemon-selection-grid');
      grid.innerHTML = '';
      pokedex.forEach((poke, idx) => {
        const card = document.createElement('div');
        card.className = 'pokemon-card-img';
        card.id = `select-pokemon-${poke.id}`;
        const img = document.createElement('img');
        img.src = poke.img;
        img.alt = poke.name;
        img.style.width = '60px';
        img.style.height = '60px';
        img.setAttribute('loading', 'lazy'); 
        card.appendChild(img);
        
        // Add cost badge
        const costBadge = document.createElement('div');
        costBadge.textContent = poke.cost;
        costBadge.style.cssText = 'position:absolute; top:2px; left:2px; background:#e74c3c; color:white; border-radius:50%; width:18px; height:18px; text-align:center; font-size:12px; line-height:18px;';
        
        card.appendChild(costBadge);
        
        // Double click to add to team
        card.ondblclick = () => addPokemonToTeam(poke);
        
        card.onclick = () => {
          selectedPokeIdx = idx;
          // Don't clear team selection - keep both selections active
          selectedPokemon = poke;
          highlightSelection(idx);
          renderDetails(poke);
          updateActionButtons();
        };
        grid.appendChild(card);
      });
    }

    function highlightSelection(idx) {
      document.querySelectorAll('.pokemon-card-img').forEach((card, i) => {
        if (i === idx) card.classList.add('selected');
        else card.classList.remove('selected');
      });
      // Keep team slots highlighted - don't deselect them when selection is made
    }

    // Add Pokemon to team
    async function addPokemonToTeam(pokemon) {
      // Check for duplicate Pokemon
      const isDuplicate = team.some(slot => slot && slot.id === pokemon.id);
      if (isDuplicate) {
        alert(`${pokemon.name} is already in your team! You cannot have duplicate Pokemon.`);
        return;
      }
      
      // Find first empty slot
      const emptySlot = team.findIndex(slot => !slot);
      if (emptySlot === -1) {
        alert('Team is full! Remove a Pokemon first.');
        return;
      }
      
      // Check cost constraint
      const newTeam = [...team];
      newTeam[emptySlot] = pokemon;
      const validation = await validateTeam(newTeam);
      
      if (!validation.valid) {
        alert(`Cannot add ${pokemon.name}. Total cost would be ${validation.total_cost}/${maxCost}.`);
        return;
      }
      
      team[emptySlot] = pokemon;
      renderTeam();
      updateCostDisplay();
    }

    // Remove Pokemon from team
    function removePokemonFromTeam(slotIdx) {
      team[slotIdx] = null;
      renderTeam();
      updateCostDisplay();
      if (selectedTeamIdx === slotIdx) {
        selectedTeamIdx = null;
        selectedPokemon = null;
        renderDetails();
        updateActionButtons();
      }
    }

    // Replace Pokemon in team
    async function replacePokemonInTeam() {
      if (selectedTeamIdx === null || selectedPokeIdx === null) {
        alert('Please select both a team slot and a Pokemon to replace with!');
        return;
      }

      const pokemonToAdd = pokedex[selectedPokeIdx];
      
      // Check for duplicate Pokemon (excluding the slot being replaced)
      const isDuplicate = team.some((slot, idx) => slot && slot.id === pokemonToAdd.id && idx !== selectedTeamIdx);
      if (isDuplicate) {
        alert(`${pokemonToAdd.name} is already in your team! You cannot have duplicate Pokemon.`);
        return;
      }
      
      // Check cost constraint with replacement
      const newTeam = [...team];
      newTeam[selectedTeamIdx] = pokemonToAdd;
      const validation = await validateTeam(newTeam);
      
      if (!validation.valid) {
        alert(`Cannot replace with ${pokemonToAdd.name}. Total cost would be ${validation.total_cost}/${maxCost}.`);
        return;
      }
      
      team[selectedTeamIdx] = pokemonToAdd;
      renderTeam();
      updateCostDisplay();
      updateActionButtons();
      
      // Keep the team slot selected and update details to show the new Pokemon
      renderDetails(pokemonToAdd);
    }

    // Update action buttons state
    function updateActionButtons() {
      const compareBtn = document.querySelector('.compare-btn');
      const replaceBtn = document.querySelector('.replace-btn');
      
      if (!compareBtn || !replaceBtn) return;
      
      // Compare button: enabled when we have a team Pokemon and a selection Pokemon
      const canCompare = selectedTeamIdx !== null && team[selectedTeamIdx] && selectedPokeIdx !== null;
      compareBtn.disabled = !canCompare;
      compareBtn.style.opacity = canCompare ? '1' : '0.5';
      
      // Replace button: enabled when we have a team slot selected and a selection Pokemon
      const canReplace = selectedTeamIdx !== null && selectedPokeIdx !== null;
      replaceBtn.disabled = !canReplace;
      replaceBtn.style.opacity = canReplace ? '1' : '0.5';
    }

    // Validate team cost
    async function validateTeam(teamToValidate) {
      const validTeam = teamToValidate.filter(p => p !== null);
      const res = await fetch('/api/team/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: validTeam })
      });
      return await res.json();
    }

    // Update cost display
    async function updateCostDisplay() {
      const validation = await validateTeam(team);
      const costDisplay = document.querySelector('#current-cost');
      const costFill = document.querySelector('.cost-fill');
      
      if (costDisplay) {
        costDisplay.textContent = validation.total_cost;
        costFill.style.width = `${(validation.total_cost / maxCost) * 100}%`;
        costFill.style.backgroundColor = validation.valid ? '#4CAF50' : '#e74c3c';
      }
    }

    // Render details panel
    function renderDetails(poke) {
      const detailsColumn = document.querySelector('.details-column');
      
      if (!poke) {
        // Show completely blank space when no Pokemon is selected
        detailsColumn.innerHTML = '';
        return;
      }
      
      const typeColors = {
        'fire': '#F08030', 'water': '#6890F0', 'grass': '#78C850', 'electric': '#F8D030',
        'psychic': '#F85888', 'ice': '#98D8D8', 'dragon': '#7038F8', 'dark': '#705848',
        'fairy': '#EE99AC', 'fighting': '#C03028', 'poison': '#A040A0', 'ground': '#E0C068',
        'flying': '#A890F0', 'bug': '#A8B820', 'rock': '#B8A038', 'ghost': '#705898',
        'steel': '#B8B8D0', 'normal': '#A8A878'
      };
      
      const typeDisplay = (poke.type||[]).map(t => 
        `<span class="type-badge" style="background-color:${typeColors[t.toLowerCase()] || '#888'}">${t}</span>`
      ).join(' ');
      
      // Show Pokemon details with new split layout
      detailsColumn.innerHTML = `
        <div class="details-left">
          <div class="details-img">
            <img src="${poke.img}" alt="${poke.name}" style="width:160px;height:160px;object-fit:contain;" loading="lazy">
          </div>
        </div>
        <div class="details-right">
          <div class="details-info">
            <div class="details-name">${poke.name}</div>
            <div class="details-type">${typeDisplay}</div>
            <div class="details-cost">Cost: ${poke.cost}</div>
          </div>
          <div class="details-stats">
            <div class="stat-row">
              <div class="stat-header">
                <span class="stat-label">HP</span>
                <span class="stat-value">${poke.hp}</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${Math.min(poke.hp/2, 100)}%"></div></div>
            </div>
            <div class="stat-row">
              <div class="stat-header">
                <span class="stat-label">Attack</span>
                <span class="stat-value">${poke.attack}</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${Math.min(poke.attack/2, 100)}%"></div></div>
            </div>
            <div class="stat-row">
              <div class="stat-header">
                <span class="stat-label">Defense</span>
                <span class="stat-value">${poke.defense}</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${Math.min(poke.defense/2, 100)}%"></div></div>
            </div>
            <div class="stat-row">
              <div class="stat-header">
                <span class="stat-label">Sp. Attack</span>
                <span class="stat-value">${poke.sp_atk}</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${Math.min(poke.sp_atk/2, 100)}%"></div></div>
            </div>
            <div class="stat-row">
              <div class="stat-header">
                <span class="stat-label">Sp. Defense</span>
                <span class="stat-value">${poke.sp_def}</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${Math.min(poke.sp_def/2, 100)}%"></div></div>
            </div>
            <div class="stat-row">
              <div class="stat-header">
                <span class="stat-label">Speed</span>
                <span class="stat-value">${poke.speed}</span>
              </div>
              <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${Math.min(poke.speed/2, 100)}%"></div></div>
            </div>
          </div>
        </div>
        <div class="action-buttons">
          <button class="compare-btn">Compare</button>
          <button class="replace-btn" id="replace-btn">Replace</button>
        </div>
        <div class="comparison-overlay" id="comparison-overlay">
          <div class="comparison-content">
            <button class="comparison-close" onclick="hideComparison()">&times;</button>
            <div class="comparison-pokemon" id="comparison-pokemon">
              <!-- Comparison content will be inserted here -->
            </div>
          </div>
        </div>
      `;
      
      // Re-attach button event listeners
      const compareBtn = document.querySelector('.compare-btn');
      const replaceBtn = document.querySelector('.replace-btn');
      
      compareBtn.onclick = () => {
        if (selectedTeamIdx !== null && team[selectedTeamIdx] && selectedPokeIdx !== null) {
          showComparison(team[selectedTeamIdx], pokedex[selectedPokeIdx]);
        } else {
          alert('Please select both a team Pokemon and a selection Pokemon to compare!');
        }
      };
      
      replaceBtn.onclick = () => {
        replacePokemonInTeam();
      };
      
      updateActionButtons();
    }

    // Filter functions
    async function applyFilters() {
      const search = document.querySelector('.search-input').value;
      // Remove or comment out the unused type-select reference
      // const type = document.querySelector('.type-select').value;
      const type = '';
      const activeCostBtn = document.querySelector('.cost-btn.active');
      const cost = activeCostBtn && activeCostBtn.textContent !== 'All' ? parseInt(activeCostBtn.textContent) : '';
      await fetchPokemon(search, type, cost);
      renderSelection();
    }

    // Cost filter buttons
    function setupCostFilter() {
      document.querySelectorAll('.cost-btn').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.cost-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyFilters();
        };
      });
    }

    // Search and type filter
    function setupFilters() {
      document.querySelector('.search-input').oninput = applySimpleFilters;
    }

    async function applySimpleFilters() {
      const search = document.querySelector('.search-input').value;
      
      if (!search.trim()) {
        // If no search, load all Pokemon (respecting any advanced filters)
        const res = await fetch('/api/pokemon');
        pokedex = await res.json();
      } else {
        // Apply search filter
        const params = new URLSearchParams();
        params.append('search', search);
        const res = await fetch(`/api/pokemon?${params}`);
        pokedex = await res.json();
      }
      
      renderSelection();
    }

    // Show comparison overlay
    function showComparison(pokemon1, pokemon2) {
      const overlay = document.getElementById('comparison-overlay');
      const comparisonContainer = document.getElementById('comparison-pokemon');
      
      const stats = ['hp', 'attack', 'defense', 'sp_atk', 'sp_def', 'speed'];
      const statLabels = ['HP', 'Attack', 'Defense', 'Sp. Attack', 'Sp. Defense', 'Speed'];
      
      const typeColors = {
        'fire': '#F08030', 'water': '#6890F0', 'grass': '#78C850', 'electric': '#F8D030',
        'psychic': '#F85888', 'ice': '#98D8D8', 'dragon': '#7038F8', 'dark': '#705848',
        'fairy': '#EE99AC', 'fighting': '#C03028', 'poison': '#A040A0', 'ground': '#E0C068',
        'flying': '#A890F0', 'bug': '#A8B820', 'rock': '#B8A038', 'ghost': '#705898',
        'steel': '#B8B8D0', 'normal': '#A8A878'
      };
      
      const typeDisplay = (pokemon1.type||[]).map(t => 
        `<span class="type-badge" style="background-color:${typeColors[t.toLowerCase()] || '#888'}">${t}</span>`
      ).join(' ');
      
      let statsHTML = '';
      stats.forEach((stat, idx) => {
        const value1 = pokemon1[stat];
        const value2 = pokemon2[stat];
        const isWinner = value1 > value2;
        
        statsHTML += `
          <div class="stat-row ${isWinner ? 'winner' : 'loser'}">
            <div class="stat-header">
              <span class="stat-label">${statLabels[idx]}</span>
              <span class="stat-value">${value1}</span>
            </div>
            <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${Math.min(value1/2, 100)}%"></div></div>
          </div>
        `;
      });
      
      const comparisonHTML = `
        <div class="comparison-pokemon-details">
          <div class="details-info">
            <div class="details-name">${pokemon1.name}</div>
            <div class="details-type">${typeDisplay}</div>
            <div class="details-cost">Cost: ${pokemon1.cost}</div>
          </div>
          <div class="details-stats">
            ${statsHTML}
          </div>
          <div class="action-buttons">
            <button class="replace-btn" id="comparison-replace-btn">Replace</button>
          </div>
        </div>
      `;
      
      comparisonContainer.innerHTML = comparisonHTML;
      
      // Add event listener for comparison replace button
      const comparisonReplaceBtn = document.getElementById('comparison-replace-btn');
      comparisonReplaceBtn.onclick = () => {
        replacePokemonInTeam();
        hideComparison(); // Close comparison after replacement
      };
      
      overlay.style.display = 'block';
    }
    
    // Hide comparison overlay
    function hideComparison() {
      const overlay = document.getElementById('comparison-overlay');
      overlay.style.display = 'none';
    }

    // Add cost tracker to team section
    function addCostTracker() {
      const teamColumn = document.querySelector('.team-column');
      const costTracker = document.createElement('div');
      costTracker.innerHTML = `
        <div style="margin-top: 20px; text-align: center;">
          <h4>Team Cost: <span id="current-cost">0</span>/${maxCost}</h4>
          <div style="width: 80%; height: 10px; background: #e9ecef; border-radius: 5px; margin: 10px auto;">
            <div class="cost-fill" style="height: 100%; background: #4CAF50; border-radius: 5px; width: 0%; transition: width 0.3s;"></div>
          </div>
        </div>
      `;
      teamColumn.appendChild(costTracker);
    }

    // Advanced Filter System
    let activeFilters = {
      types: [],
      generations: [],
      special: [],
      stats: {
        hp: { min: 0, max: 255 },
        attack: { min: 0, max: 255 },
        defense: { min: 0, max: 255 },
        sp_atk: { min: 0, max: 255 },
        sp_def: { min: 0, max: 255 },
        speed: { min: 0, max: 255 }
      },
      cost: { min: 1, max: 5 }
    };

    function setupAdvancedFilters() {
      const modal = document.getElementById('filter-modal');
      const openBtn = document.getElementById('advanced-filter-btn');
      const closeBtn = document.getElementById('filter-close');
      const clearBtn = document.getElementById('filter-clear');
      const applyBtn = document.getElementById('filter-apply');

      // Open modal
      openBtn.onclick = () => {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
      };

      // Close modal
      const closeModal = () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      };
      closeBtn.onclick = closeModal;
      modal.onclick = (e) => {
        if (e.target === modal) closeModal();
      };

      // Setup filter toggle buttons
      setupFilterToggleButtons();
      
      // Setup stat range sliders
      setupStatRangeSliders();

      // Clear all filters
      clearBtn.onclick = () => {
        clearAllFilters();
        updateFilterDisplay();
        updateFilterCount();
      };

      // Apply filters
      applyBtn.onclick = () => {
        closeModal();
        applyAdvancedFilters();
        updateFilterCount();
      };
    }

    function setupFilterToggleButtons() {
      // Type filters
      document.querySelectorAll('.type-btn').forEach(btn => {
        btn.onclick = () => {
          const type = btn.dataset.type;
          toggleArrayFilter(activeFilters.types, type);
          btn.classList.toggle('active');
        };
      });

      // Generation filters
      document.querySelectorAll('.gen-btn').forEach(btn => {
        btn.onclick = () => {
          const gen = btn.dataset.gen;
          toggleArrayFilter(activeFilters.generations, gen);
          btn.classList.toggle('active');
        };
      });

      // Special property filters
      document.querySelectorAll('.special-btn').forEach(btn => {
        btn.onclick = () => {
          const special = btn.dataset.special;
          toggleArrayFilter(activeFilters.special, special);
          btn.classList.toggle('active');
        };
      });
    }

    function setupStatRangeSliders() {
      const stats = ['hp', 'attack', 'defense', 'sp-attack', 'sp-defense', 'speed'];
      
      stats.forEach(stat => {
        const minSlider = document.getElementById(`${stat}-min`);
        const maxSlider = document.getElementById(`${stat}-max`);
        const valueDisplay = document.getElementById(`${stat}-value`);
        
        const statKey = stat.replace('-', '_');
        
        const updateValues = () => {
          const min = parseInt(minSlider.value);
          const max = parseInt(maxSlider.value);
          
          // Ensure min doesn't exceed max
          if (min > max) {
            minSlider.value = max;
          }
          if (max < min) {
            maxSlider.value = min;
          }
          
          const finalMin = parseInt(minSlider.value);
          const finalMax = parseInt(maxSlider.value);
          
          activeFilters.stats[statKey] = { min: finalMin, max: finalMax };
          valueDisplay.textContent = `${finalMin}-${finalMax}`;
        };
        
        minSlider.oninput = updateValues;
        maxSlider.oninput = updateValues;
      });

      // Cost range slider
      const costMin = document.getElementById('cost-min');
      const costMax = document.getElementById('cost-max');
      const costValue = document.getElementById('cost-value');
      
      const updateCostValues = () => {
        const min = parseInt(costMin.value);
        const max = parseInt(costMax.value);
        
        if (min > max) {
          costMin.value = max;
        }
        if (max < min) {
          costMax.value = min;
        }
        
        const finalMin = parseInt(costMin.value);
        const finalMax = parseInt(costMax.value);
        
        activeFilters.cost = { min: finalMin, max: finalMax };
        costValue.textContent = `${finalMin}-${finalMax}`;
      };
      
      costMin.oninput = updateCostValues;
      costMax.oninput = updateCostValues;
    }

    function toggleArrayFilter(array, value) {
      const index = array.indexOf(value);
      if (index > -1) {
        array.splice(index, 1);
      } else {
        array.push(value);
      }
    }

    function clearAllFilters() {
      // Clear arrays
      activeFilters.types = [];
      activeFilters.generations = [];
      activeFilters.special = [];
      
      // Reset stat ranges
      Object.keys(activeFilters.stats).forEach(stat => {
        activeFilters.stats[stat] = { min: 0, max: 255 };
      });
      activeFilters.cost = { min: 1, max: 5 };
      
      // Reset UI
      document.querySelectorAll('.filter-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Reset sliders
      document.querySelectorAll('.stat-range-min').forEach(slider => {
        slider.value = slider.min;
      });
      document.querySelectorAll('.stat-range-max').forEach(slider => {
        slider.value = slider.max;
      });
      
      // Update value displays
      const stats = ['hp', 'attack', 'defense', 'sp-attack', 'sp-defense', 'speed'];
      stats.forEach(stat => {
        const valueDisplay = document.getElementById(`${stat}-value`);
        valueDisplay.textContent = '0-255';
      });
      document.getElementById('cost-value').textContent = '1-5';
    }

    function updateFilterDisplay() {
      // This function can be used to update any visual indicators
      // of active filters in the main interface
    }

    function updateFilterCount() {
      const totalFilters = activeFilters.types.length + 
                          activeFilters.generations.length + 
                          activeFilters.special.length +
                          getModifiedStatRangesCount() +
                          (hasModifiedCostRange() ? 1 : 0);
      
      const countElement = document.getElementById('filter-count');
      if (totalFilters > 0) {
        countElement.textContent = totalFilters;
        countElement.classList.add('active');
      } else {
        countElement.classList.remove('active');
      }
    }

    function getModifiedStatRangesCount() {
      return Object.values(activeFilters.stats).filter(range => 
        range.min > 0 || range.max < 255
      ).length;
    }

    function hasModifiedStatRanges() {
      return Object.values(activeFilters.stats).some(range => 
        range.min > 0 || range.max < 255
      );
    }

    function hasModifiedCostRange() {
      return activeFilters.cost.min > 1 || activeFilters.cost.max < 5;
    }

    async function applyAdvancedFilters() {
      const search = document.querySelector('.search-input').value;
      
      // Build filter parameters
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      
      // Add type filters
      if (activeFilters.types.length > 0) {
        params.append('types', activeFilters.types.join(','));
      }
      
      // Add generation filters - convert Roman numerals to integers
      if (activeFilters.generations.length > 0) {
        const genMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8 };
        const genNumbers = activeFilters.generations.map(gen => genMap[gen]).filter(num => num);
        if (genNumbers.length > 0) {
          params.append('generations', genNumbers.join(','));
        }
      }
      
      // Add special property filters
      if (activeFilters.special.length > 0) {
        params.append('special', activeFilters.special.join(','));
      }
      
      // Add stat range filters
      Object.keys(activeFilters.stats).forEach(stat => {
        const range = activeFilters.stats[stat];
        if (range.min > 0 || range.max < 255) {
          params.append(`${stat}_min`, range.min);
          params.append(`${stat}_max`, range.max);
        }
      });
      
      // Add cost range filter
      if (activeFilters.cost.min > 1 || activeFilters.cost.max < 5) {
        params.append('cost_min', activeFilters.cost.min);
        params.append('cost_max', activeFilters.cost.max);
      }
      
      
      // Fetch filtered Pokemon
      const res = await fetch(`/api/pokemon?${params}`);
      pokedex = await res.json();
      renderSelection();
    }

    // Initial load
    document.addEventListener('DOMContentLoaded', () => {
      fetchData();
      setupCostFilter();
      setupFilters();
      addCostTracker();
      updateActionButtons();
      setupAdvancedFilters();

      // Save Team button logic
      const saveBtn = document.getElementById('save-team-btn');
      if (saveBtn) {
        saveBtn.onclick = async function() {
          // Collect current team Pokémon IDs (filter out nulls)
          const teamIds = (window.team || team || []).filter(p => p && p.id).map(p => p.id);
          if (!teamIds.length) {
            document.getElementById('save-team-msg').style.color = 'red';
            document.getElementById('save-team-msg').textContent = 'No Pokémon in team!';
            return;
          }
          // Optional: prompt for team name or use default
          const teamName = 'Team 1';
          const res = await fetch('/api/team/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pokemon_ids: teamIds, team_name: teamName })
          });
          const data = await res.json();
          if (data.success) {
            document.getElementById('save-team-msg').style.color = 'green';
            document.getElementById('save-team-msg').textContent = 'Team saved!';
          } else {
            document.getElementById('save-team-msg').style.color = 'red';
            document.getElementById('save-team-msg').textContent = data.error || 'Failed to save team.';
          }
        };
      }
    });