export const GAME_STATES = Object.freeze({
  TITLE_SCREEN: 'TITLE_SCREEN',
  CUTSCENE: 'CUTSCENE',
  LEVEL_0_ASTEROIDS: 'LEVEL_0_ASTEROIDS',
  LEVEL_1_MARS: 'LEVEL_1_MARS',
});

export const WIDTH = 960;
export const HEIGHT = 540;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);

export function createWorld(stage) {
  return {
    stage,
    elapsed: 0,
    player: { x: 150, y: 270, vx: 0, vy: 0, hull: 100, fireCooldown: 0, invulnerable: 0, facing: 1 },
    bullets: [],
    enemies: [],
    enemyBolts: [],
    asteroids: [],
    sparks: [],
    spawnCooldown: 0.5,
    boss: null,
    transition: 0,
    debrief: false,
    flash: 0,
    score: 0,
    ...(stage === GAME_STATES.LEVEL_0_ASTEROIDS
      ? { timeLeft: 45, distance: 100 }
      : { marsTime: 0, bossSpawned: false, bossCountdown: 48, shake: 0 }),
  };
}

function addSparks(world, x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(35, 180);
    world.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: random(0.2, 0.6),
      maxLife: 0.6,
      color,
      size: random(1, 3),
    });
  }
}

function hitPlayer(world, x, y, callbacks) {
  if (world.player.invulnerable > 0) return;
  world.player.hull = Math.max(0, world.player.hull - 12);
  world.player.invulnerable = 0.65;
  world.flash = 0.16;
  addSparks(world, x, y, '#6eeaff', 8);
  callbacks.sound('shield');
  if (world.player.hull <= 0) {
    world.debrief = true;
    world.result = 'lost';
  }
}

function firePlayerShot(world, stage, aim, callbacks) {
  const { player } = world;
  player.fireCooldown = stage === GAME_STATES.LEVEL_0_ASTEROIDS ? 0.2 : 0.18;
  if (stage === GAME_STATES.LEVEL_0_ASTEROIDS) {
    for (const offset of [-9, 9]) {
      world.bullets.push({ x: player.x + 23, y: player.y + offset, vx: 620, vy: 0, damage: 1, life: 1.5 });
    }
  } else {
    const dx = aim.x - (player.x + 20);
    const dy = aim.y - (player.y - 22);
    const angle = Math.atan2(dy, dx);
    world.bullets.push({
      x: player.x + 20,
      y: player.y - 22,
      vx: Math.cos(angle) * 650,
      vy: Math.sin(angle) * 650,
      damage: 1,
      life: 1.4,
    });
  }
  callbacks.sound('pew');
}

function makeEnemy(type, x, y) {
  const armored = type === 'cyborg';
  return {
    type,
    x,
    y,
    hp: armored ? 6 : 2,
    maxHp: armored ? 6 : 2,
    speed: armored ? random(42, 60) : random(82, 112),
    fireCooldown: random(1.5, 3),
    flash: 0,
    radius: armored ? 24 : 17,
  };
}

function updateLevel0(world, dt, controls, callbacks) {
  if (world.debrief) return;
  const player = world.player;
  world.timeLeft = Math.max(0, world.timeLeft - dt);
  world.distance = (world.timeLeft / 45) * 100;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.x = clamp(player.x + controls.moveX * 330 * dt, 64, 520);
  player.y = clamp(player.y + controls.moveY * 300 * dt, 92, 475);

  if (controls.fire && player.fireCooldown <= 0) firePlayerShot(world, GAME_STATES.LEVEL_0_ASTEROIDS, controls.aim, callbacks);
  world.spawnCooldown -= dt;
  if (world.spawnCooldown <= 0) {
    world.asteroids.push({
      x: WIDTH + 40,
      y: random(70, HEIGHT - 48),
      radius: random(17, 37),
      vx: random(-220, -130),
      spin: random(-2, 2),
      angle: random(0, Math.PI * 2),
      points: Array.from({ length: 9 }, () => random(0.72, 1.2)),
    });
    world.spawnCooldown = random(0.48, 0.9);
  }

  for (const bullet of world.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }
  for (const asteroid of world.asteroids) {
    asteroid.x += asteroid.vx * dt;
    asteroid.angle += asteroid.spin * dt;
    for (const bullet of world.bullets) {
      if (bullet.life > 0 && Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y) < asteroid.radius) {
        bullet.life = 0;
        asteroid.hp = (asteroid.hp ?? 2) - 1;
        addSparks(world, bullet.x, bullet.y, '#ffb34e', 5);
        if (asteroid.hp <= 0) {
          const explosionX = asteroid.x;
          const explosionY = asteroid.y;
          asteroid.x = -100;
          world.score += 10;
          addSparks(world, explosionX, explosionY, '#ff753d', 15);
          callbacks.sound('explosion');
        }
      }
    }
    if (Math.hypot(player.x - asteroid.x, player.y - asteroid.y) < asteroid.radius + 20) {
      asteroid.x = -100;
      hitPlayer(world, player.x, player.y, callbacks);
    }
  }
  world.bullets = world.bullets.filter((bullet) => bullet.life > 0 && bullet.x < WIDTH + 40);
  world.asteroids = world.asteroids.filter((asteroid) => asteroid.x > -80);
  if (world.timeLeft <= 0) {
    world.transition = world.transition || 2.2;
    world.transition -= dt;
    if (world.transition <= 0) callbacks.stageChange(GAME_STATES.LEVEL_1_MARS);
  }
}

function updateLevel1(world, dt, controls, callbacks) {
  if (world.debrief) return;
  const player = world.player;
  world.marsTime += dt;
  world.bossCountdown = Math.max(0, world.bossCountdown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.vx = controls.moveX * 230;
  player.x = clamp(player.x + player.vx * dt, 72, 700);
  player.facing = controls.aim.x >= player.x ? 1 : -1;
  player.vy += 370 * dt;
  player.y += player.vy * dt;
  if (player.y >= 470) {
    player.y = 470;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }
  if (controls.jump && player.grounded) {
    player.vy = -425;
    player.grounded = false;
  }
  if (controls.fire && player.fireCooldown <= 0) firePlayerShot(world, GAME_STATES.LEVEL_1_MARS, controls.aim, callbacks);

  if (!world.bossSpawned && world.bossCountdown <= 0) {
    world.bossSpawned = true;
    world.boss = { x: WIDTH - 130, y: 235, hp: 36, maxHp: 36, teleport: 2.7, spread: 1.8, summon: 5.5, hitFlash: 0 };
  }

  world.spawnCooldown -= dt;
  if (!world.bossSpawned && world.spawnCooldown <= 0) {
    const type = Math.random() < 0.28 ? 'cyborg' : 'foot';
    world.enemies.push(makeEnemy(type, WIDTH + 25, 470));
    world.spawnCooldown = random(2, 3.4);
  }

  for (const bullet of world.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    for (const enemy of world.enemies) {
      if (bullet.life > 0 && enemy.hp > 0 && Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.radius + 4) {
        bullet.life = 0;
        enemy.hp -= 1;
        enemy.flash = 0.12;
        addSparks(world, bullet.x, bullet.y, enemy.type === 'cyborg' ? '#eaf7ff' : '#ff6955', 5);
        if (enemy.hp <= 0) {
          world.score += enemy.type === 'cyborg' ? 50 : 20;
          addSparks(world, enemy.x, enemy.y - 20, '#ff753d', 14);
          callbacks.sound('explosion');
        } else if (enemy.type === 'cyborg') {
          callbacks.sound('shield');
        }
      }
    }
    if (bullet.life > 0 && world.boss && world.boss.hp > 0 && Math.hypot(bullet.x - world.boss.x, bullet.y - world.boss.y) < 52) {
      bullet.life = 0;
      world.boss.hp -= 1;
      world.boss.hitFlash = 0.12;
      addSparks(world, bullet.x, bullet.y, '#d7eaff', 6);
      if (world.boss.hp <= 0) {
        addSparks(world, world.boss.x, world.boss.y, '#ffa657', 45);
        callbacks.sound('explosion');
        world.debrief = true;
        world.result = 'won';
      } else {
        callbacks.sound('shield');
      }
    }
  }

  for (const enemy of world.enemies) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    const dx = player.x - enemy.x;
    enemy.x += Math.sign(dx) * enemy.speed * dt;
    if (Math.abs(dx) < enemy.radius + 18 && Math.abs(player.y - 470) < 40) hitPlayer(world, player.x, player.y - 20, callbacks);
    if (enemy.type === 'cyborg') {
      enemy.fireCooldown -= dt;
      if (enemy.fireCooldown <= 0) {
        const angle = Math.atan2(player.y - 20 - (enemy.y - 28), player.x - enemy.x);
        world.enemyBolts.push({ x: enemy.x, y: enemy.y - 30, vx: Math.cos(angle) * 180, vy: Math.sin(angle) * 180, life: 5 });
        enemy.fireCooldown = 3.2;
      }
    }
  }
  world.enemies = world.enemies.filter((enemy) => enemy.hp > 0 && enemy.x > -60);

  if (world.boss && world.boss.hp > 0) {
    const boss = world.boss;
    boss.hitFlash = Math.max(0, boss.hitFlash - dt);
    boss.teleport -= dt;
    boss.spread -= dt;
    boss.summon -= dt;
    if (boss.teleport <= 0) {
      boss.x = clamp(player.x + random(190, 390), 300, WIDTH - 65);
      boss.y = random(150, 305);
      addSparks(world, boss.x, boss.y, '#b066ff', 16);
      boss.teleport = 3.4;
    }
    if (boss.spread <= 0) {
      for (const angleOffset of [-0.32, 0, 0.32]) {
        const angle = Math.atan2(player.y - 30 - boss.y, player.x - boss.x) + angleOffset;
        world.enemyBolts.push({ x: boss.x - 25, y: boss.y + 8, vx: Math.cos(angle) * 205, vy: Math.sin(angle) * 205, life: 5 });
      }
      boss.spread = 2.2;
    }
    if (boss.summon <= 0) {
      world.enemies.push(makeEnemy('foot', WIDTH + 15, 470));
      boss.summon = 7;
    }
  }

  for (const bolt of world.enemyBolts) {
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;
    if (Math.hypot(bolt.x - player.x, bolt.y - (player.y - 24)) < 22) {
      bolt.life = 0;
      hitPlayer(world, player.x, player.y - 20, callbacks);
    }
  }
  world.enemyBolts = world.enemyBolts.filter((bolt) => bolt.life > 0 && bolt.x > -60 && bolt.x < WIDTH + 60);
  world.bullets = world.bullets.filter((bullet) => bullet.life > 0 && bullet.x > -60 && bullet.x < WIDTH + 60);
  for (const spark of world.sparks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.life -= dt;
  }
  world.sparks = world.sparks.filter((spark) => spark.life > 0);
  world.flash = Math.max(0, world.flash - dt);
  world.shake = Math.max(0, world.shake - dt);
}

export function updateWorld(world, dt, controls, callbacks) {
  world.elapsed += dt;
  if (world.stage === GAME_STATES.LEVEL_0_ASTEROIDS) updateLevel0(world, dt, controls, callbacks);
  if (world.stage === GAME_STATES.LEVEL_1_MARS) updateLevel1(world, dt, controls, callbacks);
  return world;
}

function drawStars(ctx, time, warm = false, maxY = HEIGHT) {
  for (let i = 0; i < 80; i += 1) {
    const x = ((i * 137 + time * (8 + (i % 5) * 4)) % (WIDTH + 20)) - 10;
    const y = (i * 79) % maxY;
    ctx.globalAlpha = 0.2 + ((Math.sin(time * 1.8 + i) + 1) * 0.5) * 0.55;
    ctx.fillStyle = warm && i % 5 === 0 ? '#ffb77a' : '#d8edff';
    ctx.fillRect(Math.floor(x), Math.floor(y), i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invulnerable > 0 && Math.floor(time * 20) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#54e6ff';
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#21cfff';
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(-18, -18);
  ctx.lineTo(-9, -5);
  ctx.lineTo(-25, 0);
  ctx.lineTo(-9, 5);
  ctx.lineTo(-18, 18);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e2fbff';
  ctx.fillRect(-3, -5, 16, 10);
  ctx.fillStyle = '#ffb65c';
  ctx.globalAlpha *= 0.75 + Math.sin(time * 30) * 0.25;
  ctx.fillRect(-27, -4, 11, 8);
  ctx.restore();
}

function drawAsteroid(ctx, asteroid) {
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.angle);
  ctx.fillStyle = '#4d6170';
  ctx.strokeStyle = '#9fb3bb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  asteroid.points.forEach((point, index) => {
    const angle = (index / asteroid.points.length) * Math.PI * 2;
    const x = Math.cos(angle) * asteroid.radius * point;
    const y = Math.sin(angle) * asteroid.radius * point;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMars(ctx, time, background) {
  if (background?.complete && background.naturalWidth > 0) {
    const drift = Math.sin(time * 0.055) * 12;
    ctx.drawImage(background, drift - 12, -5, WIDTH + 24, HEIGHT + 10);
    ctx.fillStyle = 'rgba(189, 71, 48, .08)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#151c31');
    sky.addColorStop(0.55, '#783d43');
    sky.addColorStop(1, '#e17645');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#f4a16d';
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(755, 145, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#752f35';
    ctx.beginPath();
    ctx.moveTo(0, 396);
    for (let x = 0; x <= WIDTH; x += 60) ctx.lineTo(x, 380 + Math.sin(x * 0.014 + time * 0.08) * 18);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.fill();
    ctx.fillStyle = '#ac5141';
    ctx.beginPath();
    ctx.moveTo(0, 440);
    for (let x = 0; x <= WIDTH; x += 48) ctx.lineTo(x, 438 + Math.sin(x * 0.018 + time * 0.12) * 9);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.fill();
    ctx.fillStyle = '#d16c48';
    ctx.fillRect(0, 478, WIDTH, 62);
  }

  drawStars(ctx, time, true, 225);

  for (let i = 0; i < 34; i += 1) {
    const x = (i * 173 + time * (13 + (i % 4) * 5)) % WIDTH;
    const y = 342 + ((i * 47) % 178);
    ctx.globalAlpha = 0.2 + (i % 3) * 0.12;
    ctx.fillStyle = i % 4 === 0 ? '#ffd17d' : '#ff9864';
    ctx.fillRect(Math.floor(x), y, 1 + (i % 3), 1);
  }
  ctx.globalAlpha = 1;
}

function drawHero(ctx, player, time, sprite) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.facing < 0) ctx.scale(-1, 1);
  if (player.invulnerable > 0 && Math.floor(time * 20) % 2 === 0) ctx.globalAlpha = 0.38;
  const bob = Math.abs(player.vx) > 0 ? Math.sin(time * 12) * 2 : Math.sin(time * 3) * 1;
  if (sprite?.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, -38, -72 + bob, 76, 72);
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#162538';
  ctx.fillRect(-12, -48 + bob, 25, 38);
  ctx.fillStyle = '#d5e1e9';
  ctx.fillRect(-11, -56 + bob, 23, 12);
  ctx.fillStyle = '#6ae8fa';
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#47d8ff';
  ctx.fillRect(2, -53 + bob, 12, 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#a9bdc8';
  ctx.fillRect(-15, -12 + bob, 12, 10);
  ctx.fillRect(4, -12 + bob, 12, 10);
  ctx.fillStyle = '#53ddff';
  ctx.fillRect(7, -36 + bob, 22, 7);
  ctx.fillStyle = '#f7a94e';
  ctx.fillRect(-13, -2 + bob, 11, 3);
  ctx.fillRect(2, -2 + bob, 11, 3);
  ctx.restore();
}

function drawEnemy(ctx, enemy, playerX, footSprite, cyborgSprite) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.x > playerX) ctx.scale(-1, 1);
  const sprite = enemy.type === 'cyborg' ? cyborgSprite : footSprite;
  if (sprite?.complete && sprite.naturalWidth > 0) {
    const width = enemy.type === 'cyborg' ? 70 : 74;
    const height = enemy.type === 'cyborg' ? 78 : 82;
    ctx.filter = enemy.flash > 0 ? 'brightness(0) invert(1)' : 'none';
    ctx.drawImage(sprite, -width / 2, -height, width, height);
    ctx.restore();
    return;
  }
  const isCyborg = enemy.type === 'cyborg';
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : isCyborg ? '#647787' : '#70904f';
  ctx.strokeStyle = isCyborg ? '#c8e7f2' : '#b5c77a';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  ctx.shadowColor = isCyborg ? '#96dfff' : '#9ad44e';
  ctx.fillRect(-13, -48, 26, 40);
  ctx.fillRect(-10, -61, 20, 17);
  ctx.fillStyle = '#ff504b';
  ctx.fillRect(2, -55, 8, 4);
  ctx.fillStyle = '#263843';
  ctx.fillRect(-15, -8, 11, 8);
  ctx.fillRect(4, -8, 11, 8);
  ctx.restore();
}

function drawBoss(ctx, boss, time, sprite) {
  if (!boss || boss.hp <= 0) return;
  ctx.save();
  ctx.translate(boss.x, boss.y + Math.sin(time * 3) * 7);
  if (sprite?.complete && sprite.naturalWidth > 0) {
    ctx.filter = boss.hitFlash > 0 ? 'brightness(0) invert(1)' : 'none';
    ctx.drawImage(sprite, -66, -66, 132, 132);
    ctx.restore();
    return;
  }
  ctx.shadowBlur = 28;
  ctx.shadowColor = '#be52ff';
  ctx.fillStyle = boss.hitFlash > 0 ? '#fff' : '#493364';
  ctx.strokeStyle = '#d9a1ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-44, -30);
  ctx.lineTo(-24, -48);
  ctx.lineTo(-4, -39);
  ctx.lineTo(10, -55);
  ctx.lineTo(32, -38);
  ctx.lineTo(48, -12);
  ctx.lineTo(40, 26);
  ctx.lineTo(10, 39);
  ctx.lineTo(-18, 35);
  ctx.lineTo(-47, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff526e';
  ctx.fillRect(-25, -13, 17, 8);
  ctx.fillRect(11, -13, 17, 8);
  ctx.fillStyle = '#d6a0ff';
  ctx.fillRect(-9, 5, 18, 5);
  ctx.restore();
}

function drawWorldScene(ctx, world, art) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (world.stage === GAME_STATES.LEVEL_0_ASTEROIDS) {
    const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, '#07101c');
    background.addColorStop(1, '#111d2a');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawStars(ctx, world.elapsed);
    ctx.fillStyle = 'rgba(55, 105, 135, .12)';
    ctx.beginPath();
    ctx.ellipse(760, 230, 240, 120, -0.3, 0, Math.PI * 2);
    ctx.fill();
    for (const asteroid of world.asteroids) drawAsteroid(ctx, asteroid);
    drawShip(ctx, world.player, world.elapsed);
    for (const bullet of world.bullets) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#56e8ff';
      ctx.fillStyle = '#a6faff';
      ctx.fillRect(bullet.x, bullet.y - 2, 18, 4);
    }
  } else {
    drawMars(ctx, world.marsTime, art.marsBackground);
    for (const enemy of world.enemies) {
      drawEnemy(ctx, enemy, world.player.x, art.footSoldier, art.cyborg);
    }
    drawBoss(ctx, world.boss, world.marsTime, art.hivemind);
    drawHero(ctx, world.player, world.marsTime, art.protagonist);
    for (const bullet of world.bullets) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#77f3ff';
      ctx.fillStyle = '#c9ffff';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const bolt of world.enemyBolts) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#e34dff';
      ctx.fillStyle = '#ff8cff';
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const spark of world.sparks) {
    ctx.globalAlpha = clamp(spark.life / spark.maxLife, 0, 1);
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x, spark.y, spark.size, spark.size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(130, 225, 255, ${world.flash * 0.65})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

const pixelBuffers = new WeakMap();

export function drawWorld(ctx, world, art = {}) {
  let buffer = pixelBuffers.get(ctx);
  if (!buffer) {
    const canvas = ctx.canvas.ownerDocument.createElement('canvas');
    canvas.width = WIDTH / 3;
    canvas.height = HEIGHT / 3;
    buffer = { canvas, context: canvas.getContext('2d') };
    pixelBuffers.set(ctx, buffer);
  }

  buffer.context.setTransform(1 / 3, 0, 0, 1 / 3, 0, 0);
  buffer.context.imageSmoothingEnabled = false;
  drawWorldScene(buffer.context, world, art);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.drawImage(buffer.canvas, 0, 0, WIDTH, HEIGHT);
  ctx.restore();
}
