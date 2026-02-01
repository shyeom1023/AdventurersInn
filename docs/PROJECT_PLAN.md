# Adventurers Inn - Project Plan

## Vision
A cozy pixel-art 2D inn-building game where the player explores a tile grid, harvests resources, and upgrades the inn over time.

## Core Pillars
- Small, readable 2D tile world
- Simple movement and harvesting loop
- Clear upgrade goals with visible progress
- Expandable systems with minimal refactor

## MVP Scope
- 2D grid-based map (20x20 tiles)
- Player movement on a grid
- Harvesting by key input (trees and rocks only)
- Resource inventory (wood, stone)
- Inn upgrade levels (1 -> 3) with resource costs
- Basic UI: inventory, inn level, controls, log

## Gameplay Loop
1) Move around the map
2) Harvest trees/rocks (key input)
3) Accumulate resources
4) Upgrade the inn
5) Unlock bigger costs (future expansion)

## Rules (Initial)
- Walkable tiles: grass, inn
- Blocked tiles: tree, rock
- Harvesting works on the tile the player is facing
- Trees: 3 hits, Rocks: 4 hits
- Inn upgrade requires wood/stone

## Upgrade Costs
- Level 2: 20 wood + 10 stone
- Level 3: 50 wood + 30 stone

## UI/UX Notes
- Pixel-art vibe with strong silhouettes
- Use a small log for feedback (harvests, upgrades, errors)
- Controls shown on screen

## Expansion Ideas
- Tools (axes/pickaxes) that increase harvest speed
- Inn visitors who generate coins
- Multiple regions (forest, quarry, river)
- Time system (day/night)

## Tech Stack
- HTML + Canvas + Vanilla JS for the MVP
- Optional future move to React for UI scaling
