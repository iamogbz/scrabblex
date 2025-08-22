# **App Name**: Lexicle

## Core Features:

- Home Screen Tile: Display a 'Scrabble' tile on the home screen that navigates to the game list or new game setup.
- Game List Display: List existing Scrabble games (if any) identified by their 6-character alphanumeric game keys.
- Game Key Generation: Generate a unique 6-character alphanumeric game key for new games.
- Join/Share Game: Allow up to 4 players to join a game using the game key, displayed via link and simple text.
- Turn Management: Manage the turn order to assign the turn of the next player correctly. Before the first player has played the second time, the next player to play is the newest player who hasn't played, after the first player has played for the second time it should just follow order of joining the game.
- Game Play UI: Display the game board, player's tiles, and necessary game controls (place tile, swap tile, pass turn etc.).
- Word Verification: Integrate a word verification tool, which leverages an LLM to make the appropriate API calls, to ensure every play is valid.

## Style Guidelines:

- Primary color: Dark purple (#6A478F), evocative of the vintage feel of libraries, clubs and study rooms. The feel should be warm and intriguing, never harsh or aggressive.
- Background color: Very light purple (#F2EEF5), similar hue to primary color but desaturated, for a relaxing yet elegant background.
- Accent color: Burgundy (#8F476A), contrasting hue from purple, for interactive elements to create engagement and draw the users attention.
- Body and headline font: 'Literata' (serif) for a traditional, readable feel.
- Use clean, minimalist icons representing game actions like shuffling, exchanging tiles, and skipping turns.
- Design a classic game board layout with a modern digital interface, ensuring touch-friendly controls on mobile devices.
- Employ subtle animations for tile movements and game events, enhancing user experience without being distracting.