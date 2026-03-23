# Xgame

A classic arcade space shooter built with vanilla JavaScript and the Canvas API. No dependencies, no build step — just open `index.html` in a browser.

## Gameplay

- Destroy all enemy waves to advance levels
- Enemies speed up as their numbers dwindle
- Survive as long as possible and aim for the high score

## Controls

| Action       | Key                          |
|--------------|------------------------------|
| Move left    | `←` / `A`                   |
| Move right   | `→` / `D`                   |
| Shoot        | `Space` / `↑` / `W`         |
| Pause        | `Escape` / `P`               |

## Running locally

```bash
# Option 1: any static server
npx serve .

# Option 2: Python
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

## Project structure

```
Xgame/
├── index.html
├── package.json
├── src/
│   ├── main.js              # Entry point & UI wiring
│   ├── styles/
│   │   └── main.css
│   ├── game/
│   │   ├── constants.js     # Tunable game values
│   │   ├── Game.js          # Main game loop
│   │   ├── Player.js
│   │   ├── Enemy.js
│   │   ├── EnemyGrid.js     # Grid movement & wave logic
│   │   ├── Bullet.js
│   │   ├── Particle.js      # Explosion effects
│   │   ├── StarField.js     # Scrolling background
│   │   └── InputHandler.js  # Keyboard input
│   └── ui/
│       └── HighScores.js    # localStorage persistence
└── assets/
    ├── images/
    └── sounds/
```
