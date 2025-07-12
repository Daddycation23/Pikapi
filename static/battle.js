// Battle System JavaScript - Flask-based Version (Optimized)
let battleState = null;
let eventListenersSetup = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeBattle();
    setupEventListeners();
});

function initializeBattle() {
    // Get team_id from window object (passed from Flask template)
    const teamId = window.teamId;
    const hasExistingBattle = window.hasExistingBattle;
    
    // Check if there's an existing battle to restore
    if (hasExistingBattle) {
        const shouldRestore = confirm('You have an ongoing battle. Would you like to restore it or start fresh?\n\nClick OK to restore the battle\nClick Cancel to start fresh with full health');
        
        if (shouldRestore) {
            // Restore existing battle
            fetch('/api/battle/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Battle restore error:', data.error);
                    // Fallback to new battle
                    startNewBattle(teamId);
                    return;
                }
                
                battleState = data;
                updateBattleDisplay();
                updateBattleLog();
            })
            .catch(error => {
                console.error('Error restoring battle:', error);
                // Fallback to new battle
                startNewBattle(teamId);
            });
        } else {
            // Start fresh battle
            startNewBattle(teamId);
        }
    } else {
        // No existing battle, start new one
        startNewBattle(teamId);
    }
}

function startNewBattle(teamId) {
    // Start a new battle with the server
    fetch('/api/battle/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            team_id: teamId
        })
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
    

    
    // Update player level display
    if (battleState.player_level) {
        document.getElementById('player-level-display').textContent = battleState.player_level;
    }
    
    // Update player Pokemon display
    const player = battleState.player_pokemon;
    document.getElementById('player-name').textContent = player.name;
    document.getElementById('player-level').textContent = `Lv. ${player.level || 50}`;
    const playerId = player.id || player.pokemon_id;
    const playerSprite = document.getElementById('player-sprite');
    if (playerId) {
        playerSprite.src = `/api/pokemon_image/${playerId}`;
        playerSprite.style.display = 'block';
        playerSprite.onerror = function() { this.style.display = 'none'; };
    } else {
        playerSprite.style.display = 'none';
    }
    
    // Use current_hp and max_hp from server, fallback to hp if not available
    const playerCurrentHp = (typeof player.current_hp === 'number') ? Math.max(0, player.current_hp) : player.hp;
    const playerMaxHp = (typeof player.max_hp === 'number') ? player.max_hp : player.hp;
    const playerHpPercent = Math.max(0, Math.min(100, (playerCurrentHp / playerMaxHp) * 100));
    const playerHpBar = document.getElementById('player-health-fill');
    if (playerHpBar) playerHpBar.style.width = playerHpPercent + '%';
    const playerHpText = document.getElementById('player-health-text');
    if (playerHpText) playerHpText.textContent = `${Math.round(playerCurrentHp)}/${Math.round(playerMaxHp)}`;
    
    // Update enemy Pokemon display
    const enemy = battleState.enemy_pokemon;
    document.getElementById('enemy-name').textContent = enemy.name;
    document.getElementById('enemy-level').textContent = `Lv. ${enemy.level || 50}`;
    const enemyId = enemy.id || enemy.pokemon_id;
    const enemySprite = document.getElementById('enemy-sprite');
    if (enemyId) {
        enemySprite.src = `/api/pokemon_image/${enemyId}`;
        enemySprite.style.display = 'block';
        enemySprite.onerror = function() { this.style.display = 'none'; };
    } else {
        enemySprite.style.display = 'none';
    }
    
    const enemyCurrentHp = (typeof enemy.current_hp === 'number') ? Math.max(0, enemy.current_hp) : enemy.hp;
    const enemyMaxHp = (typeof enemy.max_hp === 'number') ? enemy.max_hp : enemy.hp;
    const enemyHpPercent = Math.max(0, Math.min(100, (enemyCurrentHp / enemyMaxHp) * 100));
    const enemyHpBar = document.getElementById('enemy-health-fill');
    if (enemyHpBar) enemyHpBar.style.width = enemyHpPercent + '%';
    const enemyHpText = document.getElementById('enemy-health-text');
    if (enemyHpText) enemyHpText.textContent = `${Math.round(enemyCurrentHp)}/${Math.round(enemyMaxHp)}`;
    
    // Update Pokemon type badges
    updatePokemonTypes();
    
    // Update enemy team display (if you want to show enemy team)
    if (battleState.enemy_team && document.getElementById('enemy-team-list')) {
        const enemyTeamList = document.getElementById('enemy-team-list');
        enemyTeamList.innerHTML = '';
        battleState.enemy_team.forEach((poke, idx) => {
            const pokeId = poke.id || poke.pokemon_id;
            const pokeDiv = document.createElement('div');
            pokeDiv.className = 'enemy-team-poke';
            if (pokeId) {
                pokeDiv.innerHTML = `<img src="/api/pokemon_image/${pokeId}" alt="${poke.name}" style="width:32px;height:32px;" onerror="this.style.display='none';"> <span>${poke.name}</span>`;
            } else {
                pokeDiv.innerHTML = `<span>${poke.name}</span>`;
            }
            enemyTeamList.appendChild(pokeDiv);
        });

    }
    
    // Update battle log
    const battleLog = document.getElementById('battle-log');
    battleLog.innerHTML = '';
    battleState.battle_log.forEach(log => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = log;
        battleLog.appendChild(logEntry);
    });
    battleLog.scrollTop = battleLog.scrollHeight;
    
    // Update move buttons
    updateMoveButtons();
    
    // Update team display
    updateTeamDisplay();
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
        const currentHp = (typeof pokemon.current_hp === 'number') ? Math.max(0, pokemon.current_hp) : 0;
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
    if (!battleState || !battleState.player_pokemon || !battleState.player_pokemon.assigned_moves) {
        return;
    }

    const assignedMoves = battleState.player_pokemon.assigned_moves;

    // Fetch move data with type information for each move
    const movePromises = assignedMoves.map(moveId =>
        fetch(`/api/move/${moveId}`)
            .then(response => response.json())
            .then(moveData => {
                return {
                    name: moveData.move_name || 'Unknown Move',
                    type: moveData.type_id || 1 // Default to Normal type
                };
            })
            .catch(error => {
                return { name: 'Unknown Move', type: 1 };
            })
    );
    
    Promise.all(movePromises)
        .then(moveData => {
            
            // Get type names for the move types
            const typePromises = moveData.map(move => {
                if (move.type === 1) return Promise.resolve('Normal');
                return fetch(`/api/type/${move.type}`)
                    .then(response => response.json())
                    .then(typeData => typeData.type_name || 'Normal')
                    .catch(() => 'Normal');
            });
            
            return Promise.all(typePromises).then(typeNames => {
                return moveData.map((move, index) => ({
                    name: move.name,
                    type: typeNames[index]
                }));
            });
        })
        .then(movesWithTypes => {
            // Update move buttons with the assigned move names and type colors
            for (let i = 0; i < 4; i++) {
                const moveBtn = document.getElementById(`move-${i + 1}`);
                if (moveBtn && movesWithTypes[i]) {
                    const move = movesWithTypes[i];
                    moveBtn.textContent = move.name || '---';
                    moveBtn.disabled = !move.name;
                    
                    // Apply type color styling
                    moveBtn.className = `move-btn type-${move.type.toLowerCase()}`;
                }
            }
        })
        .catch(error => {
            console.error('Error fetching move data:', error);
            // Fallback to default moves
            const moves = ['Tackle', 'Growl', 'Scratch', 'Leer'];
            for (let i = 0; i < 4; i++) {
                const moveBtn = document.getElementById(`move-${i + 1}`);
                if (moveBtn) {
                    moveBtn.textContent = moves[i] || '---';
                    moveBtn.disabled = !moves[i];
                    moveBtn.className = 'move-btn type-normal';
                }
            }
        });
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
    // Clear any leftover selection messages
    const pokemonList = document.getElementById('pokemon-list');
    if (pokemonList) {
        const messageDiv = pokemonList.querySelector('.selection-message');
        if (messageDiv) {
            messageDiv.remove();
        }
    }
    
    // Show main menu and hide others
    document.getElementById('battle-menu').style.display = 'flex';
    document.getElementById('move-selection').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'none';
    
    // Ensure back button is visible
    const backBtn = document.getElementById('back-to-menu-pokemon');
    if (backBtn) {
        backBtn.style.display = 'block';
    }
}

function showMoveSelection() {
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('move-selection').style.display = 'block';
    document.getElementById('pokemon-selection').style.display = 'none';
}

function showPokemonSelection() {
    // Only show the pokemon selection overlay, do not hide the rest of the UI
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('move-selection').style.display = 'none';
    document.getElementById('pokemon-selection').style.display = 'block';
    // Check if current Pokemon fainted - if so, disable back button
    const currentPokemon = battleState.player_pokemon;
    const backBtn = document.getElementById('back-to-menu-pokemon');
    if (currentPokemon && currentPokemon.current_hp <= 0) {
        backBtn.style.display = 'none'; // Hide the back button
        // Add a message to inform the player they must choose
        const pokemonList = document.getElementById('pokemon-list');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'selection-message';
        messageDiv.textContent = 'Choose your next Pokemon!';
        messageDiv.style.cssText = 'text-align: center; color: #ff4444; font-weight: bold; margin-bottom: 10px; padding: 10px; background: #ffeeee; border-radius: 5px;';
        pokemonList.insertBefore(messageDiv, pokemonList.firstChild);
    } else {
        backBtn.style.display = 'block';
    }
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
        const currentHp = (typeof pokemon.current_hp === 'number') ? Math.max(0, pokemon.current_hp) : 0;
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

        
        if (data.error) {
            console.error('Move error:', data.error);
            // Re-enable buttons on error
            moveBtns.forEach(btn => btn.disabled = false);
            return;
        }
        battleState = data;
        
        // Always update display and log first, regardless of what happens next
        updateBattleDisplay();
        updateBattleLog();
        
        // Handle level up if player won
        if (data.battle_ended && data.winner === 'player' && data.new_level) {
    
            // Update the level display immediately
            document.getElementById('player-level-display').textContent = data.new_level;
            // Add a visual effect for level up
            const levelDisplay = document.getElementById('player-level-display');
            levelDisplay.style.animation = 'levelUp 0.5s ease-in-out';
            setTimeout(() => {
                levelDisplay.style.animation = '';
            }, 500);
        }
        
        // Add a small delay to ensure UI updates are visible before any menu changes
        setTimeout(() => {
            if (data.battle_ended) {
        
                handleBattleEnd(data.winner);
            } else {
                // Check if player's Pokemon fainted and they need to choose next Pokemon
                const playerPokemon = data.player_pokemon;
                if (playerPokemon.current_hp <= 0) {
    
                    showPokemonSelection();
                } else {

                    showMainMenu();
                }
            }
            // Re-enable buttons for next turn
            moveBtns.forEach(btn => btn.disabled = false);
        }, 100); // Small delay to ensure UI updates are visible
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
            const playerPokemon = data.player_pokemon;
            if (playerPokemon.current_hp <= 0) {
                showPokemonSelection();
            } else {
                const backBtn = document.getElementById('back-to-menu-pokemon');
                backBtn.style.display = 'block';
                showMainMenu();
            }
        }
    })
    .catch(error => {
        console.error('Error switching Pokemon:', error);
    });
}

function handleBattleEnd(winner) {
    // Hide move selection and show main menu
    showMainMenu();
    
    // Clear any existing timeouts
    if (window.battleEndTimeout) {
        clearTimeout(window.battleEndTimeout);
    }
    
    window.battleEndTimeout = setTimeout(() => {
        // Show appropriate message based on winner
        const message = winner === 'player' 
            ? `Battle won! You are now level ${battleState.new_level || 'unknown'}! Redirecting to team building...`
            : `Battle lost! You have been reset to level ${battleState.reset_level || 1}. Redirecting to team building...`;
        
        alert(message);
        
        // Redirect to team building page
        window.location.href = '/player';
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

// Function to update Pokémon type badges for both player and enemy
async function updatePokemonTypes() {
    if (!battleState) return;
    
    // Update player types
    const playerId = battleState.player_pokemon?.id || battleState.player_pokemon?.pokemon_id;
    if (playerId) {
        try {
            const response = await fetch(`/api/pokemon/${playerId}`);
            const data = await response.json();
            
            if (data.success && data.pokemon && data.pokemon.type) {
                const typesContainer = document.getElementById('player-types');
                if (typesContainer) {
                    const typeBadges = data.pokemon.type.map(type => 
                        `<span class="type-badge type-${type.toLowerCase()}">${type}</span>`
                    ).join('');
                    typesContainer.innerHTML = typeBadges;
                }
            }
        } catch (error) {
            console.error('Error fetching player Pokémon types:', error);
        }
    }
    
    // Update enemy types
    const enemyId = battleState.enemy_pokemon?.id || battleState.enemy_pokemon?.pokemon_id;
    if (enemyId) {
        try {
            const response = await fetch(`/api/pokemon/${enemyId}`);
            const data = await response.json();
            
            if (data.success && data.pokemon && data.pokemon.type) {
                const typesContainer = document.getElementById('enemy-types');
                if (typesContainer) {
                    const typeBadges = data.pokemon.type.map(type => 
                        `<span class="type-badge type-${type.toLowerCase()}">${type}</span>`
                    ).join('');
                    typesContainer.innerHTML = typeBadges;
                }
            }
        } catch (error) {
            console.error('Error fetching enemy Pokémon types:', error);
        }
    }
}

// Function to update team display (placeholder for now)
function updateTeamDisplay() {
    // This function can be expanded later to show team status
    // For now, it's just a placeholder to prevent errors

} 