// 无头百局模拟器：按当前《熊熊村 · 飞行棋大作战》完整规则统计各阶段回合数、拆散次数与胜率
// 用法: node scripts/sim100.mjs [局数，默认500]

const GAMES = Math.max(1, parseInt(process.argv[2] || '500', 10) || 500);
const HOME_END = 56;
const FLIGHT_FROM = 18;
const FLIGHT_STEP = 12;
const ITEM_ORDER = ['sixDie', 'twinDice', 'refuel', 'shield', 'missile'];

const GIFT_WEIGHTS = {
  0: { sixDie: 30, twinDice: 30, refuel: 30, shield: 10, missile: 0 },
  1: { sixDie: 85 / 3, twinDice: 85 / 3, refuel: 85 / 3, shield: 10, missile: 5 },
  2: { sixDie: 22.5, twinDice: 22.5, refuel: 22.5, shield: 22.5, missile: 10 },
  3: { sixDie: 18.75, twinDice: 18.75, refuel: 18.75, shield: 18.75, missile: 25 },
};

const SHOP_WEIGHTS = {
  0: { sixDie: 25, twinDice: 25, refuel: 25, shield: 25, missile: 0 },
  1: { sixDie: 20, twinDice: 20, refuel: 20, shield: 20, missile: 20 },
  2: { sixDie: 20, twinDice: 20, refuel: 20, shield: 20, missile: 20 },
  3: { sixDie: 20, twinDice: 20, refuel: 20, shield: 20, missile: 20 },
};

function pickWeighted(weights, exclude = null) {
  const cands = ITEM_ORDER.filter((it) => (!exclude || !exclude.has(it)) && weights[it] > 0);
  const total = cands.reduce((s, it) => s + weights[it], 0);
  let r = Math.random() * total;
  for (const it of cands) {
    r -= weights[it];
    if (r <= 0) return it;
  }
  return cands[cands.length - 1];
}

function ringIdx(start, pos) {
  return (start + 2 + pos) % 52;
}

function simulateMove(pos, die) {
  if (pos === -1) return { pos: 0, ringStops: [], jump: false, fly: false, bounced: false };
  let np = pos + die;
  let bounced = false;
  if (np > HOME_END) {
    np = HOME_END - (np - HOME_END);
    bounced = true;
  }
  if (np === HOME_END) return { pos: HOME_END, ringStops: [], jump: false, fly: false, bounced };
  const ringStops = [];
  if (np >= 1 && np <= 50) ringStops.push(np);
  let jump = false;
  let fly = false;
  if (!bounced && np >= 1 && np <= 49 && np % 4 === 2) {
    if (np === FLIGHT_FROM) {
      fly = true;
      jump = true;
      np = FLIGHT_FROM + FLIGHT_STEP;
      ringStops.push(np);
      np += 4;
      ringStops.push(np);
    } else {
      jump = true;
      np += 4;
      ringStops.push(np);
      if (np === FLIGHT_FROM) {
        fly = true;
        np = FLIGHT_FROM + FLIGHT_STEP;
        ringStops.push(np);
      }
    }
  }
  return { pos: np, ringStops, jump, fly, bounced };
}

function rollNaturalDie(turnNo, isBonus = false) {
  const minFace = isBonus ? 1 : turnNo === 1 ? 4 : turnNo === 2 ? 3 : turnNo === 3 ? 2 : 1;
  return minFace + Math.floor(Math.random() * (7 - minFace));
}

function runOneGame() {
  const players = [0, 1, 2, 3].map((pid) => ({
    pid,
    start: pid * 13,
    planes: [0, 1, 2, 3].map((idx) => ({ pid, idx, pos: -1, shielded: false })),
    items: { sixDie: 0, twinDice: 0, refuel: 0, shield: 0, missile: 0 },
    roll1: 0,
    roll2: 0,
    stomped: 0,
    done: 0,
    turnCount: 0,
  }));

  let turn = 0;
  let totalTurns = 0;
  let totalRolls = 0;
  let singleStompHome = 0;
  let stackSplits = 0;
  let shieldBreaks = 0;
  let totalItemsUsed = 0;
  const stageTurns = [0, 0, 0, 0];
  const stageRolls = [0, 0, 0, 0];
  const stageSingleStompHome = [0, 0, 0, 0];
  const stageStackSplits = [0, 0, 0, 0];
  const stageShieldBreaks = [0, 0, 0, 0];
  const finishedOrder = [];

  const getStage = () => {
    const maxDone = Math.max(...players.map((p) => p.done));
    return Math.min(3, maxDone);
  };

  while (finishedOrder.length < 1 && totalTurns < 2000) {
    const P = players[turn];
    if (P.done >= 4) {
      turn = (turn + 1) % 4;
      continue;
    }
    const curStageAtTurnStart = getStage();
    stageTurns[curStageAtTurnStart]++;
    totalTurns++;
    P.turnCount++;

    let sixChain = 0;
    let keepRolling = true;
    let usedAtkDef = false;
    let usedDef = false;
    let turnLoop = 0;

    while (keepRolling && finishedOrder.length < 1 && totalRolls < 4000) {
      const curStageNow = getStage();
      keepRolling = false;
      if (!usedDef && P.items.shield > 0) {
        const unshielded = P.planes.filter((q) => q.pos >= 1 && q.pos <= 50 && !q.shielded);
        if (unshielded.length > 0 && Math.random() < 0.45) {
          P.items.shield--;
          unshielded.sort((a, b) => b.pos - a.pos)[0].shielded = true;
          usedDef = true;
          totalItemsUsed++;
        }
      }
      if (!usedAtkDef && P.items.missile > 0) {
        const enemies = players.flatMap((op) =>
          op.pid === P.pid ? [] : op.planes.filter((q) => q.pos >= 1 && q.pos <= 55),
        );
        if (enemies.length > 0 && Math.random() < 0.55) {
          P.items.missile--;
          enemies.sort((a, b) => b.pos - a.pos);
          const tgt = enemies[0];
          const sameStack = players[tgt.pid].planes.filter((q) => q.pos === tgt.pos);
          if (sameStack.some((q) => q.shielded)) {
            sameStack.forEach((q) => (q.shielded = false));
            shieldBreaks++;
                stageShieldBreaks[curStageNow]++;
          } else {
            sameStack.forEach((q) => (q.pos = Math.max(0, q.pos - 6)));
            players[tgt.pid].stomped++;
            if (players[tgt.pid].stomped >= 2) {
              players[tgt.pid].stomped -= 2;
              players[tgt.pid].items[Math.random() < 0.7 ? 'shield' : 'twinDice']++;
            }
          }
          usedAtkDef = true;
          totalItemsUsed++;
        }
      }

      let useSix = false;
      let useTwin = false;
      let useRefuel = false;
      if (!usedAtkDef) {
        if (P.items.sixDie > 0 && (P.planes.some((q) => q.pos === -1) || P.planes.some((q) => q.pos === 50))) {
          P.items.sixDie--;
          useSix = true;
          usedAtkDef = true;
          totalItemsUsed++;
        } else if (P.items.twinDice > 0 && P.planes.some((q) => q.pos >= 0 && q.pos <= 44)) {
          P.items.twinDice--;
          useTwin = true;
          usedAtkDef = true;
          totalItemsUsed++;
        } else if (P.items.refuel > 0) {
          P.items.refuel--;
          useRefuel = true;
          usedAtkDef = true;
          totalItemsUsed++;
        }
      }

      totalRolls++;
      stageRolls[curStageNow]++;
      let die = rollNaturalDie(P.turnCount, turnLoop > 0);
      let allowTakeoff = false;
      let suppressSixBonus = useSix || useTwin;

      if (useTwin) {
        const d1 = rollNaturalDie(P.turnCount, turnLoop > 0);
        const d2 = rollNaturalDie(P.turnCount, turnLoop > 0);
        die = d1 + d2;
        allowTakeoff = die >= 5;
        if (d1 === 1 || d2 === 1) P.roll1++;
        if (d1 === 2 || d2 === 2) P.roll2++;
        if (d1 === 6 || d2 === 6) sixChain = useRefuel ? sixChain + 1 : 0;
        else if (!useRefuel) sixChain = 0;
      } else {
        if (useSix) die = 6;
        allowTakeoff = die === 5 || die === 6;
        if (die === 1) P.roll1++;
        if (die === 2) P.roll2++;
        if (die === 6) sixChain++;
        else if (!useRefuel) sixChain = 0;
      }

      while (P.roll1 >= 1 && P.roll2 >= 1) {
        P.roll1--;
        P.roll2--;
        const rw = pickWeighted(GIFT_WEIGHTS[getStage()]);
        P.items[rw]++;
      }

      const cands = P.planes.filter((q) => q.pos !== HOME_END && (q.pos !== -1 || allowTakeoff));
      if (cands.length > 0) {
        let best = cands[0];
        let bestScore = -1e9;
        for (const c of cands) {
          const sim = simulateMove(c.pos, die);
          let sc = 0;
          if (c.pos === -1) sc = 28;
          else if (sim.pos === HOME_END) sc = 200;
          else {
            sc = (sim.pos - c.pos) * 2 + c.pos * 0.4;
            if (sim.jump) sc += 25;
            if (sim.fly) sc += 60;
            for (const sp of sim.ringStops) {
              const r = ringIdx(P.start, sp);
              for (const op of players) {
                if (op.pid === P.pid) continue;
                if (op.planes.some((q) => q.pos >= 1 && q.pos <= 50 && ringIdx(op.start, q.pos) === r)) {
                  sc += 55;
                }
              }
            }
          }
          if (sc > bestScore) {
            bestScore = sc;
            best = c;
          }
        }

        const movingStack =
          best.pos >= 1 ? P.planes.filter((q) => q.pos === best.pos) : [best];
        const sim = simulateMove(best.pos, die);
        movingStack.forEach((q) => (q.pos = sim.pos));
        if (sim.pos === HOME_END) {
          movingStack.forEach((q) => (q.shielded = false));
          P.done = P.planes.filter((q) => q.pos === HOME_END).length;
          if (P.done >= 4) {
            finishedOrder.push(P.pid);
            break;
          }
        }

        for (const sp of sim.ringStops) {
          const r = ringIdx(P.start, sp);
          for (const op of players) {
            if (op.pid === P.pid) continue;
            const hits = op.planes.filter((q) => q.pos >= 1 && q.pos <= 50 && ringIdx(op.start, q.pos) === r);
            if (hits.length > 0) {
              if (hits.some((h) => h.shielded)) {
                hits.forEach((h) => (h.shielded = false));
                shieldBreaks++;
                stageShieldBreaks[curStageNow]++;
              } else {
                if (hits.length === 1) {
                  hits[0].pos = -1;
                  singleStompHome++;
                  stageSingleStompHome[curStageNow]++;
                } else {
                  hits.sort((a, b) => a.idx - b.idx);
                  hits.forEach((h, idx) => (h.pos = Math.max(0, h.pos - (6 + idx))));
                  stackSplits++;
                  stageStackSplits[curStageNow]++;
                }
                op.stomped++;
                if (op.stomped >= 2) {
                  op.stomped -= 2;
                  op.items[Math.random() < 0.7 ? 'shield' : 'twinDice']++;
                }
              }
            }
          }
        }
        if (sim.fly) {
          const opp = players[(P.pid + 2) % 4];
          const hits = opp.planes.filter((q) => q.pos === 54);
          if (hits.length > 0) {
            if (hits.some((h) => h.shielded)) {
              hits.forEach((h) => (h.shielded = false));
              shieldBreaks++;
                stageShieldBreaks[curStageNow]++;
            } else {
              if (hits.length === 1) {
                hits[0].pos = -1;
                singleStompHome++;
                  stageSingleStompHome[curStageNow]++;
              } else {
                hits.sort((a, b) => a.idx - b.idx);
                hits.forEach((h, idx) => (h.pos = Math.max(0, h.pos - (6 + idx))));
                stackSplits++;
                  stageStackSplits[curStageNow]++;
              }
            }
          }
        }
        if (sim.pos >= 1 && sim.pos <= 50 && ringIdx(P.start, sim.pos) === (P.start + 40) % 52) {
          const st = getStage();
          const pickedSet = new Set();
          const offer = [];
          if (st >= 3) {
            pickedSet.add('missile');
            offer.push('missile');
          }
          while (offer.length < 3) {
            const c = pickWeighted(SHOP_WEIGHTS[st], pickedSet);
            pickedSet.add(c);
            offer.push(c);
          }
          const chosen = st >= 3 && offer.includes('missile') && Math.random() < 0.65 ? 'missile' : offer[Math.floor(Math.random() * offer.length)];
          P.items[chosen]++;
        }
      }

      const gotSixBonus = !suppressSixBonus && die === 6 && sixChain < 3;
      if (gotSixBonus || useRefuel) {
        keepRolling = true;
      }
      turnLoop++;
    }
    turn = (turn + 1) % 4;
  }

  return {
    totalTurns,
    rounds: totalTurns / 4,
    totalRolls,
    stageTurns,
    stageRolls,
    stageSingleStompHome,
    stageStackSplits,
    stageShieldBreaks,
    singleStompHome,
    stackSplits,
    shieldBreaks,
    totalItemsUsed,
  };
}

const results = Array.from({ length: GAMES }, runOneGame);
const avg = (fn) => results.reduce((s, r) => s + fn(r), 0) / GAMES;
const sortedTurns = results.map((r) => r.totalTurns).sort((a, b) => a - b);
const avgTotal = avg((r) => r.totalTurns);

console.log(`=== 模拟 ${GAMES} 局分阶段详细统计 ===`);
console.log(`总回合数（平均 / 最短 / 中位 / 最长）: ${avgTotal.toFixed(1)} / ${sortedTurns[0]} / ${sortedTurns[Math.floor(GAMES / 2)]} / ${sortedTurns[GAMES - 1]} 回合`);
console.log(`平均每人轮数（大轮 / Rounds）       : ${avg((r) => r.rounds).toFixed(1)} 轮`);
console.log(`平均总投骰次数                       : ${avg((r) => r.totalRolls).toFixed(1)} 次`);
console.log('');
console.log('--- 各阶段耗时占比 ---');
for (let s = 0; s < 4; s++) {
  const st = avg((r) => r.stageTurns[s]);
  const sr = avg((r) => r.stageRolls[s]);
  const pct = (st / avgTotal) * 100;
  console.log(`阶段 ${s}（最高 ${s}/4 到终点）: 平均 ${st.toFixed(1)} 回合（${(st / 4).toFixed(1)} 大轮，占比 ${pct.toFixed(1)}%），投骰 ${sr.toFixed(1)} 次`);
}
console.log('');
console.log(`单熊踩回基地: ${avg((r) => r.singleStompHome).toFixed(1)} 次/局 | 多熊拆散分摊: ${avg((r) => r.stackSplits).toFixed(1)} 次/局 | 破盾: ${avg((r) => r.shieldBreaks).toFixed(1)} 次/局 | 道具使用: ${avg((r) => r.totalItemsUsed).toFixed(1)} 次/局`);
console.log('');
console.log('--- 各阶段踩踏次数统计（平均每局）---');
for (let s = 0; s < 4; s++) {
  const sHome = avg((r) => r.stageSingleStompHome[s]);
  const sSplit = avg((r) => r.stageStackSplits[s]);
  const sShield = avg((r) => r.stageShieldBreaks[s]);
  const sTotal = sHome + sSplit;
  console.log(`阶段 ${s}: 合计踩踏 ${sTotal.toFixed(1)} 次（单熊回基地 ${sHome.toFixed(1)} 次 / 叠叠乐拆散 ${sSplit.toFixed(1)} 次 / 破盾格挡 ${sShield.toFixed(1)} 次）`);
}
