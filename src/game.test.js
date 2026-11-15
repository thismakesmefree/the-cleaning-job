import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, GAME_STATES, updateWorld } from './game.js';

const controls = { moveX: 0, moveY: 0, jump: false, fire: false, aim: { x: 480, y: 270 } };
const callbacks = { sound: () => {}, stageChange: () => {} };

test('the mission uses the four requested game states', () => {
  assert.deepEqual(Object.keys(GAME_STATES), [
    'TITLE_SCREEN',
    'CUTSCENE',
    'LEVEL_0_ASTEROIDS',
    'LEVEL_1_MARS',
  ]);
});

test('asteroid progress reaches the atmosphere transition', () => {
  const world = createWorld(GAME_STATES.LEVEL_0_ASTEROIDS);
  let nextStage = null;
  world.timeLeft = 0.02;
  world.transition = 0.01;

  updateWorld(world, 0.02, controls, {
    sound: () => {},
    stageChange: (stage) => { nextStage = stage; },
  });

  assert.equal(world.distance, 0);
  assert.equal(nextStage, GAME_STATES.LEVEL_1_MARS);
});

test('defeating the Mars boss completes the mission', () => {
  const world = createWorld(GAME_STATES.LEVEL_1_MARS);
  world.bossSpawned = true;
  world.bossCountdown = 10;
  world.boss = { x: 820, y: 220, hp: 1, maxHp: 36, teleport: 10, spread: 10, summon: 10, hitFlash: 0 };
  world.bullets.push({ x: 820, y: 220, vx: 0, vy: 0, damage: 1, life: 1 });

  updateWorld(world, 0.016, controls, callbacks);

  assert.equal(world.debrief, true);
  assert.equal(world.result, 'won');
});
