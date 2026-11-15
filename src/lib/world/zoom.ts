/**
 * How far the map is zoomed in compared with the sprites. Tiles, trees and ground are drawn this much bigger, while
 * heroes and mobs keep their on-screen size, so less of the floor is in view and the party has to walk to find the way.
 * Anything measured against a sprite (reach, spacing, walking speed) is divided by it so the game plays the same.
 */
export const ZOOM = 1.45;
