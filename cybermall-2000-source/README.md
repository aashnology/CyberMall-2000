# CyberMall 2000
Mood-first 3D digital mall for fashion discovery (laptop only: keyboard + mouse). React + TypeScript + Three.js.

    npm install
    npm run dev        # http://localhost:5173
    npm test
    npm run typecheck

## What is in it
- Two floors around a central atrium (animated fountain, palms, velvet seating, directory kiosk) and an elevator bank.
- Wings: apparel, books and stationery, accessories, food, wellness (floor 1); tech, living, luxury archives, cinema, collectibles (floor 2).
- Pincode delivery engine and a transparent weighted recommendation engine (`src/recommendation/weights.ts`).
- Blueprint "you are here" map (press M), day-to-night lighting, hidden collectibles that unlock badges and screen filters.
- Event telemetry (`src/telemetry`) feeding an analytics dashboard with CSV export.
- Brand logos load at runtime from the web; a text wordmark shows if offline.
