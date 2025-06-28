CREATE TABLE IF NOT EXISTS Pokemon (
    pokemon_id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    generation TINYINT NOT NULL,
    cost INTEGER NOT NULL,
    height_cm DECIMAL(6,2),
    weight_kg DECIMAL(6,2),
    hp SMALLINT NOT NULL,
    atk SMALLINT NOT NULL,
    def SMALLINT NOT NULL,
    sp_atk SMALLINT NOT NULL,
    sp_def SMALLINT NOT NULL,
    speed SMALLINT NOT NULL,
    rarity VARCHAR(32),
    image BLOB
);

CREATE TABLE IF NOT EXISTS Type (
    type_id TINYINT PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS Move (
    move_id INTEGER PRIMARY KEY,
    type_id TINYINT NOT NULL,
    move_name VARCHAR(100) NOT NULL,
    power SMALLINT NOT NULL,
    accuracy TINYINT NOT NULL,
    priority INTEGER DEFAULT 0,
    category VARCHAR(20) DEFAULT 'physical',
    FOREIGN KEY (type_id) REFERENCES Type(type_id)
);

CREATE TABLE IF NOT EXISTS TypeEffectiveness (
    attacking_type_id TINYINT NOT NULL,
    defending_type_id TINYINT NOT NULL,
    effectiveness DECIMAL(3,2) NOT NULL,
    PRIMARY KEY (attacking_type_id, defending_type_id),
    FOREIGN KEY (attacking_type_id) REFERENCES Type(type_id),
    FOREIGN KEY (defending_type_id) REFERENCES Type(type_id)
);

CREATE TABLE IF NOT EXISTS PokemonHasType (
    type_id TINYINT NOT NULL,
    pokemon_id INTEGER NOT NULL,
    PRIMARY KEY (type_id, pokemon_id),
    FOREIGN KEY (type_id) REFERENCES Type(type_id),
    FOREIGN KEY (pokemon_id) REFERENCES Pokemon(pokemon_id)
);

CREATE TABLE IF NOT EXISTS PokemonHasMove (
    move_id INTEGER NOT NULL,
    pokemon_id INTEGER NOT NULL,
    PRIMARY KEY (move_id, pokemon_id),
    FOREIGN KEY (move_id) REFERENCES Move(move_id),
    FOREIGN KEY (pokemon_id) REFERENCES Pokemon(pokemon_id)
);

CREATE TABLE IF NOT EXISTS Player (
  player_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50)  NOT NULL UNIQUE,
  email    VARCHAR(100) NOT NULL UNIQUE,
  password_hash CHAR(60) NOT NULL,
  registration_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Team (
    team_id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    player_id INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES Player(player_id)
);

CREATE TABLE IF NOT EXISTS TeamPokemon (
    team_id INTEGER NOT NULL,
    pokemon_id INTEGER NOT NULL,
    slot TINYINT NOT NULL,
    PRIMARY KEY (team_id, pokemon_id),
    FOREIGN KEY (team_id) REFERENCES Team(team_id),
    FOREIGN KEY (pokemon_id) REFERENCES Pokemon(pokemon_id)
);

