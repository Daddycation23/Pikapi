// ===== BATTLE HISTORY - MODERN IMPLEMENTATION =====

let allBattles = [];
let filteredBattles = [];

// Update navigation visibility based on authentication status
function updateNavigationVisibility(isAuthenticated) {
    // Handle auth-required items (show when authenticated)
    const authRequiredItems = document.querySelectorAll('.auth-required');
    authRequiredItems.forEach(item => {
        if (isAuthenticated) {
            item.classList.add('authenticated');
        } else {
            item.classList.remove('authenticated');
        }
    });
    
    // Handle guest-only items (hide when authenticated)
    const guestOnlyItems = document.querySelectorAll('.guest-only');
    guestOnlyItems.forEach(item => {
        if (isAuthenticated) {
            item.classList.add('authenticated');
        } else {
            item.classList.remove('authenticated');
        }
    });
}

// Initialize page when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupLevelTooltips();
    setupPokemonMoveTooltips();
});

async function initializePage() {
    // Check authentication and setup UI
    await checkAuthAndSetupUI();
    
    // Setup mobile menu
    setupMobileMenu();
    
    // Load battle history
    await loadBattleHistory();
    
    // Setup event listeners
    setupEventListeners();
}

function setupMobileMenu() {
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const navLinks = document.getElementById('nav-links');
    const navAuth = document.getElementById('nav-auth');
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            navAuth.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.navbar')) {
            mobileToggle?.classList.remove('active');
            navLinks?.classList.remove('active');
            navAuth?.classList.remove('active');
        }
    });
}

async function checkAuthAndSetupUI() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        
        const authSection = document.getElementById('nav-auth');
        if (data.username) {
            // Update navigation visibility for authenticated user
            updateNavigationVisibility(true);
            authSection.innerHTML = `
                <span class="welcome-text">Welcome, ${data.username}</span>
                <button class="btn-standard btn-logout" onclick="logout()">Logout</button>
            `;
        } else {
            // Update navigation visibility for non-authenticated user
            updateNavigationVisibility(false);
            authSection.innerHTML = `
                <button class="btn-standard btn-profile" onclick="showAuthModal('login')">Login</button>
                <button class="btn-standard btn-profile" onclick="showAuthModal('register')">Register</button>
            `;
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
    }
}

async function loadBattleHistory() {
    const loadingState = document.getElementById('loading-state');
    const historyList = document.getElementById('history-list');
    const emptyState = document.getElementById('empty-state');
    
    try {
        // Show loading state
        loadingState.style.display = 'block';
        historyList.style.display = 'none';
        emptyState.style.display = 'none';
        
        const response = await fetch('/api/battle/history');
        if (!response.ok) {
            throw new Error('Failed to fetch battle history');
        }
        
        const data = await response.json();
        allBattles = data.records || [];
        filteredBattles = [...allBattles];
        
        // Hide loading state
        loadingState.style.display = 'none';
        
        if (allBattles.length === 0) {
            // Show empty state
            emptyState.style.display = 'block';
            historyList.style.display = 'none';
        } else {
            // Show battle history
            historyList.style.display = 'block';
            emptyState.style.display = 'none';
            
            // Calculate and display stats
            displayStatistics();
            
            // Render battle records
            renderBattleHistory();
        }
        
    } catch (error) {
        console.error('Error loading battle history:', error);
        loadingState.style.display = 'none';
        historyList.innerHTML = `
            <div class="error-message">
                <h3>Error Loading Battle History</h3>
                <p>Failed to load your battle records. Please try refreshing the page.</p>
                <button class="btn-standard btn-profile" onclick="loadBattleHistory()">Retry</button>
            </div>
        `;
        historyList.style.display = 'block';
    }
}

function displayStatistics() {
    const totalBattles = allBattles.length;
    const totalWins = allBattles.filter(b => b.result === 'win').length;
    const totalLosses = allBattles.filter(b => b.result === 'loss').length;
    const winRate = totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0;
    
    document.getElementById('total-battles').textContent = totalBattles;
    document.getElementById('total-wins').textContent = totalWins;
    document.getElementById('total-losses').textContent = totalLosses;
    document.getElementById('win-rate').textContent = `${winRate}%`;
}

function renderBattleHistory() {
    const historyList = document.getElementById('history-list');
    
    if (filteredBattles.length === 0) {
        historyList.innerHTML = `
            <div class="no-results">
                <h3>No battles match your filter</h3>
                <p>Try adjusting your filter settings to see more results.</p>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = filteredBattles.map((battle, index) => createBattleCard(battle, index)).join('');
}

function createBattleCard(battle, index) {
    const date = new Date(battle.timestamp);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const level = battle.level || 'Unknown';
    const result = battle.result;
    const resultClass = result === 'win' ? 'win' : 'loss';
    const resultText = result === 'win' ? 'Victory' : 'Defeat';
    
    return `
        <div class="battle-record battle-${result}" data-battle-index="${index}">
            <!-- Battle Header -->
            <div class="battle-header">
                <div class="battle-result-row">
                    <div class="battle-result ${resultClass}">
                        ${resultText}
                    </div>
                    <div class="battle-meta">
                        <div class="battle-date">
                            📅 ${dateStr} at ${timeStr}
                        </div>
                        <div class="battle-level" data-tooltip="This is the level of the battle. Higher levels mean tougher opponents!">
                            ⭐ Level ${level}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Teams Container -->
            <div class="teams-container">
                <div class="teams-row">
                    <!-- Player Team -->
                    <div class="team-section player-team">
                        <div class="team-title">Your Team</div>
                        <div class="pokemon-grid">
                            ${createTeamPokemon(battle.player_team || [])}
                        </div>
                    </div>
                    
                    <!-- VS Divider -->
                    <div class="vs-divider">VS</div>
                    
                    <!-- Enemy Team -->
                    <div class="team-section enemy-team">
                        <div class="team-title">Enemy Team</div>
                        <div class="pokemon-grid">
                            ${createTeamPokemon(battle.enemy_team || [])}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Battle Log Section -->
            <div class="battle-log-section">
                <div class="battle-log-toggle" onclick="toggleBattleLog(${index})">
                    <span>Battle Log</span>
                </div>
                <div class="battle-log" id="battle-log-${index}">
                    <div class="battle-log-content">
                        ${createBattleLogContent(battle.battle_log || [])}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createTeamPokemon(team) {
    if (!team || team.length === 0) {
        return '<div class="pokemon-card empty">No Pokemon</div>';
    }
    return team.map(pokemon => {
        const isFainted = pokemon.current_hp === 0 || pokemon.fainted;
        const hpPercent = pokemon.max_hp ? Math.max(0, (pokemon.current_hp / pokemon.max_hp) * 100) : 0;
        let hpClass = 'high';
        if (isFainted || hpPercent === 0) hpClass = 'fainted';
        else if (hpPercent < 25) hpClass = 'low';
        else if (hpPercent < 50) hpClass = 'medium';
        const pokemonId = pokemon.id || pokemon.pokemon_id;
        const imageUrl = `/static/images/${pokemonId}.png`;
        // Add data-moves if moves are present
        let movesAttr = '';
        if (pokemon.assigned_moves && pokemon.assigned_moves.length > 0) {
            movesAttr = ` data-moves='${JSON.stringify(pokemon.assigned_moves)}'`;
        } else if (pokemon.moves && pokemon.moves.length > 0) {
            movesAttr = ` data-moves='${JSON.stringify(pokemon.moves)}'`;
        }
        return `
            <div class="pokemon-card ${isFainted ? 'fainted' : ''}"${movesAttr}>
                <div class="pokemon-image">
                    <img src="${imageUrl}" alt="${pokemon.name}" 
                         onerror="this.src='/static/images/1.png'" />
                </div>
                <div class="pokemon-name">${pokemon.name}</div>
                <div class="pokemon-hp">${pokemon.current_hp || 0} / ${pokemon.max_hp || 0}</div>
                <div class="hp-bar">
                    <div class="hp-bar-fill ${hpClass}" style="width: ${hpPercent}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function createBattleLogContent(battleLog) {
    if (!battleLog || battleLog.length === 0) {
        return '<div class="battle-log-line">No battle log available</div>';
    }
    
    return battleLog.map(line => `<div class="battle-log-line">&gt; ${line}</div>`).join('');
}

function toggleBattleLog(index) {
    const logElement = document.getElementById(`battle-log-${index}`);
    const toggleElement = document.querySelector(`[onclick="toggleBattleLog(${index})"]`);
    
    // Close all other logs first
    document.querySelectorAll('.battle-log').forEach((log, i) => {
        if (i !== index) {
            log.classList.remove('expanded');
            const otherToggle = document.querySelector(`[onclick="toggleBattleLog(${i})"]`);
            if (otherToggle) {
                otherToggle.classList.remove('expanded');
            }
        }
    });
    
    // Toggle this log
    const isExpanded = logElement.classList.contains('expanded');
    if (isExpanded) {
        logElement.classList.remove('expanded');
        toggleElement.classList.remove('expanded');
            } else {
        logElement.classList.add('expanded');
        toggleElement.classList.add('expanded');
    }
}

function setupEventListeners() {
    // Filter by result
    const resultFilter = document.getElementById('result-filter');
    if (resultFilter) {
        resultFilter.addEventListener('change', (e) => {
            filterBattles(e.target.value);
        });
    }
}

function filterBattles(resultFilter) {
    if (resultFilter === '') {
        filteredBattles = [...allBattles];
    } else {
        filteredBattles = allBattles.filter(battle => battle.result === resultFilter);
    }
    
    renderBattleHistory();
}

// Utility functions for auth (should match other pages)
async function logout() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function showAuthModal(type) {
    // This function should match the implementation in other pages
    // For now, redirect to home page for auth
    window.location.href = '/';
} 

// Tooltip logic for data-tooltip elements
function setupLevelTooltips() {
    document.body.addEventListener('mouseenter', function(e) {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            showSimpleTooltip(target, target.getAttribute('data-tooltip'));
        }
    }, true);
    document.body.addEventListener('mouseleave', function(e) {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            hideSimpleTooltip();
        }
    }, true);
}
function showSimpleTooltip(element, text) {
    hideSimpleTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'simple-tooltip';
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + window.scrollX + 'px';
    tooltip.style.top = (rect.top + window.scrollY - tooltip.offsetHeight - 8) + 'px';
    setTimeout(() => tooltip.classList.add('visible'), 10);
}
function hideSimpleTooltip() {
    const existing = document.querySelector('.simple-tooltip');
    if (existing) existing.remove();
}

function setupPokemonMoveTooltips() {
    document.body.addEventListener('click', async function(e) {
        const card = e.target.closest('.pokemon-card[data-moves]');
        if (card && !card.classList.contains('empty')) {
            // If tooltip is already open for this card, close it
            if (card.classList.contains('tooltip-open')) {
                hideMoveTooltip();
                card.classList.remove('tooltip-open');
                return;
            }
            // Close any other open tooltip
            hideMoveTooltip();
            document.querySelectorAll('.pokemon-card.tooltip-open').forEach(c => c.classList.remove('tooltip-open'));
            card.classList.add('tooltip-open');
            const movesData = JSON.parse(card.getAttribute('data-moves'));
            if (!Array.isArray(movesData) || movesData.length === 0) return;
            try {
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
                const tooltipContent = moves.map(move =>
                    `<div class="move-tooltip-item">
                        <span class="move-name">${move.name}</span>
                        <span class="move-details">${move.power} power, ${move.accuracy}% acc</span>
                    </div>`
                ).join('');
                showMoveTooltip(card, tooltipContent);
            } catch (error) {
                // fail silently
            }
        } else {
            // Clicked outside any card: close tooltip
            hideMoveTooltip();
            document.querySelectorAll('.pokemon-card.tooltip-open').forEach(c => c.classList.remove('tooltip-open'));
        }
    });
}
function showMoveTooltip(element, content) {
    hideMoveTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'enemy-move-tooltip';
    tooltip.innerHTML = `<div class="tooltip-header">Moves:</div>${content}`;
    document.body.appendChild(tooltip);
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.right + 10 + 'px';
    tooltip.style.top = rect.top + 'px';
    setTimeout(() => tooltip.classList.add('visible'), 10);
}
function hideMoveTooltip() {
    const existingTooltip = document.querySelector('.enemy-move-tooltip');
    if (existingTooltip) existingTooltip.remove();
}

/* Add minimal CSS for tooltip */
const style = document.createElement('style');
style.textContent = `
.simple-tooltip {
  position: absolute;
  background: #222;
  color: #fff;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.95em;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 9999;
  white-space: pre-line;
}
.simple-tooltip.visible {
  opacity: 1;
}
`;
document.head.appendChild(style); 