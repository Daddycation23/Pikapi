// Battle System JavaScript - Flask-based Version (Optimized)
let battleState = null;
let eventListenersSetup = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeBattle();
    setupEventListeners();
});

function initializeBattle() {
    // Start a new battle with the server
    fetch('/api/battle/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Battle start error:', data.error);
            return;
        }
        
        battleState = data;
        updateBattleDisplay();
        updateBattleLog();
    })
    .catch(error => {
        console.error('Error starting battle:', error);
    });
}

function updateBattleDisplay() {
    if (!battleState) return;
    
    // Update player Pokemon display
    const player = battleState.player_pokemon;
    document.getElementById('player-name').textContent = player.name;
    document.getElementById('player-level').textContent = `Lv. ${player.level || 50}`;
    document.getElementById('player-sprite').src = `/api/pokemon_image/${player.id}`;
    
    // Use current_hp and max_hp from server, fallback to hp if not available
    const playerCurrentHp = Math.max(0, player.current_hp || player.hp || 100); // Ensure HP doesn't go below 0
    const playerMaxHp = player.max_hp || player.hp || 100;
    updateHealthBar('player', playerCurrentHp, playerMaxHp);

    // Update enemy Pokemon display
    const enemy = battleState.enemy_pokemon;
    document.getElementById('enemy-name').textContent = enemy.name;
    document.getElementById('enemy-level').textContent = `Lv. ${enemy.level || 50}`;
    document.getElementById('enemy-sprite').src = `/api/pokemon_image/${enemy.id}`;
    
    // Use current_hp and max_hp from server, fallback to hp if not available
    const enemyCurrentHp = Math.max(0, enemy.current_hp || enemy.hp || 100); // Ensure HP doesn't go below 0
    const enemyMaxHp = enemy.max_hp || enemy.hp || 100;
    updateHealthBar('enemy', enemyCurrentHp, enemyMaxHp);

    // Update enemy team display
    updateEnemyTeamDisplay();

    // Update move buttons
    updateMoveButtons();
}

function updateEnemyTeamDisplay() {
    if (!battleState || !battleState.enemy_team) return;
    
    const enemyTeamList = document.getElementById('enemy-team-list');
    if (!enemyTeamList) return;
    
    enemyTeamList.innerHTML = '';

    battleState.enemy_team.forEach((pokemon, index) => {
        const teamItem = document.createElement('div');
        teamItem.className = 'enemy-team-item';
        
        // Use current_hp and max_hp from server, fallback to hp if not available
        const currentHp = Math.max(0, pokemon.current_hp || pokemon.hp || 100); // Ensure HP doesn't go below 0
        const maxHp = pokemon.max_hp || pokemon.hp || 100;
        
        // Determine if this Pokemon is active or fainted
        const isActive = index === battleState.current_enemy_index;
        const isFainted = currentHp <= 0;
        
        if (isActive) teamItem.classList.add('active');
        if (isFainted) teamItem.classList.add('fainted');
        
        teamItem.innerHTML = `
            <img src="/api/pokemon_image/${pokemon.id}" alt="${pokemon.name}" onerror="this.src='/static/images/placeholder.png'">
            <div class="name">${pokemon.name}</div>
            <div class="health">${currentHp}/${maxHp}</div>
            ${isActive ? '<div class="status">ACTIVE</div>' : ''}
            ${isFainted ? '<div class="status">FAINTED</div>' : ''}
        `;
        
        enemyTeamList.appendChild(teamItem);
    });
}

function updateMoveButtons() {
    if (!battleState || !battleState.player_pokemon) return;
    
    const moves = battleState.player_pokemon.moves || ['Tackle', 'Growl', 'Scratch', 'Leer'];
    for (let i = 0; i < 4; i++) {
        const moveBtn = document.getElementById(`move-${i + 1}`);
        if (moveBtn) {
            moveBtn.textContent = moves[i] || '---';
            moveBtn.disabled = !moves[i];
        }
    }
}

function updateHealthBar(target, currentHp, maxHp) {
    const percentage = (currentHp / maxHp) * 100;
    const healthFill = document.getElementById(`${target}-health-fill`);
    const healthText = document.getElementById(`${target}-health-text`);
    
    if (healthFill && healthText) {
        healthFill.style.width = `${percentage}%`;
        healthText.textContent = `${currentHp}/${maxHp}`;

        // Change color based on health percentage
        if (percentage > 50) {
            healthFill.style.background = 'linear-gradient(90deg, #44aa44, #66cc66)';
        } else if (percentage > 25) {
            healthFill.style.background = 'linear-gradient(90deg, #ffaa44, #ffcc66)';
        } else {
            healthFill.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
        }
    }
}

function updateBattleLog() {
    if (!battleState || !battleState.battle_log) return;
    
    const battleLog = document.getElementById('battle-log');
    battleLog.innerHTML = '';
    
    battleState.battle_log.forEach(message => {
        const logMessage = document.createElement('div');
        logMessage.className = 'log-message';
        logMessage.textContent = message;
        battleLog.appendChild(logMessage);
    });
    
    // Auto-scroll to bottom
    battleLog.scrollTop = battleLog.scrollHeight;
}

function setupEventListeners() {
    if (eventListenersSetup) return; // Prevent duplicate setup
    
    // Menu buttons
    const fightBtn = document.getElementById('fight-btn');
    const pokemonBtn = document.getElementById('pokemon-btn');
    
    if (fightBtn) {
        fightBtn.addEventListener('click', function() {
            showMoveSelection();
        });
    }
    
    if (pokemonBtn) {
        pokemonBtn.addEventListener('click', function() {
            showPokemonSelection();
        });
    }

    // Move selection
    const backToMenuBtn = document.getElementById('back-to-menu');
    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', function() {
            showMainMenu();
        });
    }
    
    // Set up move button event listeners once
    const moveBtns = document.querySelectorAll('.move-btn');
    moveBtns.forEach((btn, index) => {
        btn.addEventListener('click', function(e) {
            useMove(index);
        });
    });

    // Pokemon selection
    const backToMenuPokemonBtn = document.getElementById('back-to-menu-pokemon');
    if (backToMenuPokemonBtn) {
        backToMenuPokemonBtn.addEventListener('click', function() {
            showMainMenu();
        });
    }
    
    eventListenersSetup = true;
}

function showMainMenu() {
    document.getElementById('battle-menu').style.display = 'block';
    document.getElementById('move-selection').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'none';
}

function showMoveSelection() {
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('move-selection').style.display = 'block';
    document.getElementById('pokemon-selection').style.display = 'none';
}

function showPokemonSelection() {
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'block';
    populatePokemonList();
}

function populatePokemonList() {
    if (!battleState || !battleState.player_team) return;
    
    const pokemonList = document.getElementById('pokemon-list');
    pokemonList.innerHTML = '';

    battleState.player_team.forEach((pokemon, index) => {
        const pokemonItem = document.createElement('div');
        pokemonItem.className = 'pokemon-item';
        
        // Use current_hp and max_hp from server, fallback to hp if not available
        const currentHp = Math.max(0, pokemon.current_hp || pokemon.hp || 100); // Ensure HP doesn't go below 0
        const maxHp = pokemon.max_hp || pokemon.hp || 100;
        
        pokemonItem.innerHTML = `
            <img src="/api/pokemon_image/${pokemon.id}" alt="${pokemon.name}" onerror="this.src='/static/images/placeholder.png'">
            <div class="name">${pokemon.name}</div>
            <div class="health">${currentHp}/${maxHp}</div>
        `;
        
        if (currentHp > 0) {
            if (index === battleState.current_player_index) {
                pokemonItem.style.opacity = '0.5';
                pokemonItem.style.cursor = 'not-allowed';
                pokemonItem.innerHTML += '<div style="color: #666; font-size: 12px;">Current</div>';
            } else {
                pokemonItem.addEventListener('click', function() {
                    switchPokemon(index);
                });
                pokemonItem.style.cursor = 'pointer';
            }
        } else {
            pokemonItem.style.opacity = '0.5';
            pokemonItem.style.cursor = 'not-allowed';
            pokemonItem.innerHTML += '<div style="color: #666; font-size: 12px;">Fainted</div>';
        }
        
        pokemonList.appendChild(pokemonItem);
    });
}

function useMove(moveIndex) {
    console.log('Using move:', moveIndex);
    
    // Disable move buttons to prevent spam
    const moveBtns = document.querySelectorAll('.move-btn');
    moveBtns.forEach(btn => btn.disabled = true);
    
    fetch('/api/battle/use-move', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            move_index: moveIndex
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Move response:', data);
        
        if (data.error) {
            console.error('Move error:', data.error);
            // Re-enable buttons on error
            moveBtns.forEach(btn => btn.disabled = false);
            return;
        }
        
        battleState = data;
        updateBattleDisplay();
        updateBattleLog();
        
        if (data.battle_ended) {
            console.log('Battle ended, handling...');
            handleBattleEnd(data.winner);
        } else {
            console.log('Battle continues, showing main menu');
            showMainMenu();
            // Re-enable buttons for next turn
            moveBtns.forEach(btn => btn.disabled = false);
        }
    })
    .catch(error => {
        console.error('Error using move:', error);
        // Re-enable buttons on error
        moveBtns.forEach(btn => btn.disabled = false);
    });
}

function switchPokemon(pokemonIndex) {
    fetch('/api/battle/switch-pokemon', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            pokemon_index: pokemonIndex
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Switch error:', data.error);
            return;
        }
        
        battleState = data;
        updateBattleDisplay();
        updateBattleLog();
        
        if (data.battle_ended) {
            handleBattleEnd(data.winner);
        } else {
            showMainMenu();
        }
    })
    .catch(error => {
        console.error('Error switching Pokemon:', error);
    });
}

function handleBattleEnd(winner) {
    console.log('Battle ended, winner:', winner);
    console.log('Current battle state:', battleState);
    
    // Hide move selection and show main menu
    showMainMenu();
    
    // Clear any existing timeouts
    if (window.battleEndTimeout) {
        clearTimeout(window.battleEndTimeout);
    }
    
    window.battleEndTimeout = setTimeout(() => {
        const message = winner === 'player' ? 'Battle won! Start a new battle?' : 'Battle lost! Start a new battle?';
        if (confirm(message)) {
            console.log('User chose to start new battle');
            // End current battle and start new one
            fetch('/api/battle/end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => {
                console.log('Battle end response:', response);
                return response.json();
            })
            .then(data => {
                console.log('Battle end data:', data);
                initializeBattle();
            })
            .catch(error => {
                console.error('Error ending battle:', error);
                // Fallback: just reload the page
                location.reload();
            });
        } else {
            console.log('User chose to return to main menu');
            // User doesn't want to start new battle, redirect to main menu
            window.location.href = '/';
        }
    }, 1000);
}

// Add error handling for network issues
function handleNetworkError(error, context) {
    console.error(`Network error in ${context}:`, error);
    alert(`Connection error: ${error.message}. Please refresh the page.`);
}

// Add this to the end of the file for better debugging
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    console.error('Error details:', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
    });
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault();
}); 