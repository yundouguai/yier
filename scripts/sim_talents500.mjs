// 500 局角色天赋平衡性与阶段 0 提速模拟器
const GAMES = 5000;
const HOME_END = 56;
const FLIGHT_FROM = 18;
const FLIGHT_STEP = 12;
const ITEM_ORDER = ['sixDie', 'twinDice', 'refuel', 'shield', 'missile'];
const BASIC_ITEMS = ['sixDie', 'twinDice', 'refuel', 'shield'];
const TALENTS = ['yier', 'caomei', 'xiangyu', 'bubu', 'mocha', 'haiyan'];
const TALENT_NAMES = {
  yier: '奶白一二(甜梦先发)',
  caomei: '草莓一二(元气蹦跳)',
  xiangyu: '香芋一二(星愿百宝袋)',
  bubu: '焦糖布布(双盾守门)',
  mocha: '抹茶布布(茶香反震)',
  haiyan: '海盐布布(顺风破蛋)',
};

const GIFT_WEIGHTS = {
  0: { sixDie: 30, twinDice: 30, refuel: 30, shield: 10, missile: 0 },
  1: { sixDie: 85 / 3, twinDice: 85 / 3, refuel: 85 / 3, shield: 10, missile: 5 },
  2: { sixDie: 22.5, twinDice: 22.5, refuel: 22.5, shield: 22.5, missile: 10 },
  3: { sixDie: 18.75, twinDice: 18.75, refuel: 18.75, shield: 18.75, missile: 25 },
};

const SHOP_WEIGHTS = {
  0: { sixDie: 30, twinDice: 30, refuel: 30, shield: 10, missile: 0 },
  1: { sixDie: 20, twinDice: 20, refuel: 20, shield: 20, missile: 20 },
  2: { sixDie: 20, twinDice: 20, refuel: 20, shield: 20, missile: 20 },
  3: { sixDie: 18, twinDice: 18, refuel: 18, shield: 18, missile: 28 },
};

function pickWeighted(weights, excludeSet = null) {
  const entries = Object.entries(weights).filter(([k, w]) => w > 0 && (!excludeSet || !excludeSet.has(k)));
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return 'sixDie';
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

function ringIdx(start, pos) {
  return (start + 2 + pos) % 52;
}

function simulateMove(pos, die) {
  if (pos === -1) return { pos: 0, jump: false, fly: false, ringStops: [] };
  let cur = pos;
  if (cur + die <= HOME_END) {
    cur += die;
  } else {
    cur = HOME_END - (cur + die - HOME_END);
  }
  const ringStops = [];
  let jump = false;
  let fly = false;
  if (cur >= 1 && cur <= 50) {
    ringStops.push(cur);
    if (cur % 4 === 0 && cur < 50) {
      if (cur === FLIGHT_FROM) {
        cur += FLIGHT_STEP;
        fly = true;
        ringStops.push(cur);
        if (cur % 4 === 0 && cur < 50) {
          cur += 4;
          jump = true;
          ringStops.push(cur);
        }
      } else {
        cur += 4;
        jump = true;
        ringStops.push(cur);
        if (cur === FLIGHT_FROM) {
          cur += FLIGHT_STEP;
          fly = true;
          ringStops.push(cur);
        }
      }
    }
  }
  return { pos: cur, jump, fly, ringStops };
}

function rollNaturalDie(turnNo, isBonus = false) {
  const minFace = isBonus ? 1 : turnNo === 1 ? 4 : turnNo === 2 ? 3 : turnNo === 3 ? 2 : 1;
  return minFace + Math.floor(Math.random() * (7 - minFace));
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function runOneGame() {
  const pickedTalents = shuffled(TALENTS).slice(0, 4);
  const players = [0, 1, 2, 3].map((pid) => {
    const talent = pickedTalents[pid];
    const items = { sixDie: 0, twinDice: 0, refuel: 0, shield: 0, missile: 0 };
    if (talent === 'xiangyu') {
      for (let k = 0; k < 2; k++) {
        const it = BASIC_ITEMS[Math.floor(Math.random() * BASIC_ITEMS.length)];
        items[it]++;
      }
    }
    const planes = [0, 1, 2, 3].map((idx) => ({
      pid,
      idx,
      pos: talent === 'yier' && idx === 0 ? 0 : -1,
      shielded: false,
    }));
    return {
      pid,
      talent,
      start: pid * 13,
      planes,
      done: 0,
      items,
      roll1: 0,
      roll2: 0,
      stomped: 0,
      turnCount: 0,
      caomeiJumpLeft: talent === 'caomei' ? 3 : 0,
      bubuShieldLeft: talent === 'bubu' ? 3 : 0,
      mochaShieldLeft: talent === 'mocha' ? 1 : 0,
      haiyanSlideLeft: talent === 'haiyan' ? 1 : 0,
      recoilHits: 0,
    };
  });

  const stageTurns = [0, 0, 0, 0];
  const stageSingleStompHome = [0, 0, 0, 0];
  const stageStackSplits = [0, 0, 0, 0];
  const stageShieldBreaks = [0, 0, 0, 0];

  const getStage = () => Math.min(3, Math.max(...players.map((p) => p.done)));

  let turn = 0;
  let totalTurns = 0;
  let totalRolls = 0;
  let winner = -1;

  while (winner === -1 && totalTurns < 1200) {
    const P = players[turn];
    const curStageNow = getStage();
    stageTurns[curStageNow]++;
    totalTurns++;
    P.turnCount++;

    let sixChain = 0;
    let keepRolling = true;
    let usedAtkDef = false;
    let usedDef = false;
    let turnLoop = 0;

    while (keepRolling && winner === -1 && totalRolls < 4000) {
      keepRolling = false;

      if (!usedDef && P.items.shield > 0) {
        const unshielded = P.planes.filter((q) => q.pos >= 1 && q.pos <= 50 && !q.shielded);
        if (unshielded.length > 0 && Math.random() < 0.45) {
          P.items.shield--;
          unshielded.sort((a, b) => b.pos - a.pos)[0].shielded = true;
          usedDef = true;
        }
      }

      let useSix = false;
      let useTwin = false;
      let useRefuel = false;
      if (!usedAtkDef) {
        const enemiesOnRing = players
          .filter((op) => op.pid !== P.pid)
          .flatMap((op) => op.planes.filter((q) => q.pos >= 1 && q.pos <= 50));
        if (P.items.missile > 0 && enemiesOnRing.length > 0 && Math.random() < 0.45) {
          P.items.missile--;
          usedAtkDef = true;
          enemiesOnRing.sort((a, b) => b.pos - a.pos);
          const tgt = enemiesOnRing[0];
          const stack = players[tgt.pid].planes.filter((q) => q.pos === tgt.pos);
          if (stack.some((q) => q.shielded)) {
            stack.forEach((q) => (q.shielded = false));
            stageShieldBreaks[getStage()]++;
          } else {
            stack.forEach((q) => (q.pos = Math.max(0, q.pos - 6)));
            players[tgt.pid].stomped++;
            if (players[tgt.pid].stomped >= 2) {
              players[tgt.pid].stomped -= 2;
              players[tgt.pid].items[Math.random() < 0.7 ? 'shield' : 'twinDice']++;
            }
          }
        } else if (P.items.sixDie > 0 && Math.random() < 0.5) {
          P.items.sixDie--;
          useSix = true;
          usedAtkDef = true;
        } else if (P.items.twinDice > 0 && Math.random() < 0.5) {
          P.items.twinDice--;
          useTwin = true;
          usedAtkDef = true;
        } else if (P.items.refuel > 0 && Math.random() < 0.5) {
          P.items.refuel--;
          useRefuel = true;
          usedAtkDef = true;
        }
      }

      totalRolls++;
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
          else if (sim.pos === HOME_END || (P.haiyanSlideLeft > 0 && sim.pos >= 50)) sc = 220;
          else {
            sc = (sim.pos - c.pos) * 2 + c.pos * 0.45;
            if (sim.jump) sc += 25;
            if (sim.fly) sc += 60;
          }
          if (sc > bestScore) {
            bestScore = sc;
            best = c;
          }
        }

        const wasTakeoff = best.pos === -1;
        const movingStack = wasTakeoff ? [best] : P.planes.filter((q) => q.pos === best.pos);
        const sim = simulateMove(best.pos, die);
        let finalPos = sim.pos;
        const stops = [...sim.ringStops];

        // 焦糖布布：前 3 只起飞自带护盾；抹茶布布：第 1 只起飞自带护盾
        if (wasTakeoff && P.bubuShieldLeft > 0) {
          P.bubuShieldLeft--;
          best.shielded = true;
        } else if (wasTakeoff && P.mochaShieldLeft > 0) {
          P.mochaShieldLeft--;
          best.shielded = true;
        }

        // 草莓一二：第 1 次外圈移动未大跳/飞跃，自动补到前方最近己色格并触发大跳(+4)
        if (!wasTakeoff && P.caomeiJumpLeft > 0 && !sim.jump && !sim.fly && finalPos >= 1 && finalPos <= 48) {
          const nextOwn = Math.ceil(finalPos / 4) * 4;
          if (nextOwn > finalPos && nextOwn < 50) {
            P.caomeiJumpLeft--;
            stops.push(nextOwn);
            finalPos = nextOwn + 4;
            stops.push(finalPos);
          }
        }

        // 海盐布布：第 1 只进入终点走廊自动直达终点
        if (P.haiyanSlideLeft > 0 && finalPos >= 50 && finalPos < HOME_END) {
          P.haiyanSlideLeft--;
          finalPos = HOME_END;
        }

        movingStack.forEach((q) => (q.pos = finalPos));
        if (finalPos === HOME_END) {
          movingStack.forEach((q) => (q.shielded = false));
          P.done = P.planes.filter((q) => q.pos === HOME_END).length;
          if (P.done >= 4) {
            winner = P.pid;
            break;
          }
        }

        // 踩踏与抹茶布布反震 1 格
        for (const sp of stops) {
          const r = ringIdx(P.start, sp);
          for (const op of players) {
            if (op.pid === P.pid) continue;
            const hits = op.planes.filter((q) => q.pos >= 1 && q.pos <= 50 && ringIdx(op.start, q.pos) === r);
            if (hits.length > 0) {
              if (hits.some((h) => h.shielded)) {
                hits.forEach((h) => (h.shielded = false));
                stageShieldBreaks[getStage()]++;
                if (op.talent === 'mocha') {
                  op.recoilHits++;
                  movingStack.forEach((m) => {
                    if (m.pos >= 1 && m.pos <= 50) m.pos = Math.max(0, m.pos - 3);
                  });
                }
              } else {
                if (hits.length === 1) {
                  hits[0].pos = -1;
                  stageSingleStompHome[getStage()]++;
                } else {
                  hits.sort((a, b) => a.idx - b.idx);
                  hits.forEach((h, idx) => (h.pos = Math.max(0, h.pos - (6 + idx))));
                  stageStackSplits[getStage()]++;
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
              stageShieldBreaks[getStage()]++;
            } else {
              if (hits.length === 1) {
                hits[0].pos = -1;
                stageSingleStompHome[getStage()]++;
              } else {
                hits.sort((a, b) => a.idx - b.idx);
                hits.forEach((h, idx) => (h.pos = Math.max(0, h.pos - (6 + idx))));
                stageStackSplits[getStage()]++;
              }
            }
          }
        }

        if (finalPos >= 1 && finalPos <= 50 && ringIdx(P.start, finalPos) === (P.start + 40) % 52) {
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
          const chosen = offer[Math.floor(Math.random() * offer.length)];
          P.items[chosen]++;
        }
      }

      const gotSixBonus = !suppressSixBonus && die === 6 && sixChain < 3;
      if (gotSixBonus || useRefuel) keepRolling = true;
      turnLoop++;
    }
    turn = (turn + 1) % 4;
  }

  return {
    totalTurns,
    rounds: totalTurns / 4,
    stageTurns,
    stageSingleStompHome,
    stageStackSplits,
    stageShieldBreaks,
    winnerTalent: winner >= 0 ? players[winner].talent : null,
    participants: players.map((p) => ({ talent: p.talent, done: p.done, recoilHits: p.recoilHits })),
  };
}

const results = Array.from({ length: GAMES }, runOneGame);
const avg = (fn) => results.reduce((s, r) => s + fn(r), 0) / GAMES;
const avgTotal = avg((r) => r.totalTurns);

console.log(`=== 5000 局「含角色天赋」平衡性模拟 ===`);
console.log(`平均总回合: ${avgTotal.toFixed(1)} 回合（${avg((r) => r.rounds).toFixed(1)} 大轮）`);
console.log('');
console.log('--- 各阶段耗时与踩踏对比 ---');
for (let s = 0; s < 4; s++) {
  const st = avg((r) => r.stageTurns[s]);
  const sHome = avg((r) => r.stageSingleStompHome[s]);
  const sSplit = avg((r) => r.stageStackSplits[s]);
  const sShield = avg((r) => r.stageShieldBreaks[s]);
  console.log(`阶段 ${s}: 平均 ${st.toFixed(1)} 回合 (${((st / avgTotal) * 100).toFixed(1)}%) | 踩踏 ${(sHome + sSplit).toFixed(1)} 次 (单回 ${sHome.toFixed(1)} / 拆散 ${sSplit.toFixed(1)} / 破盾 ${sShield.toFixed(1)})`);
}
console.log('');
console.log('--- 6 位角色胜率统计 ---');
for (const t of TALENTS) {
  let apps = 0;
  let wins = 0;
  let sumDone = 0;
  let recoils = 0;
  for (const r of results) {
    if (r.winnerTalent === t) wins++;
    for (const p of r.participants) {
      if (p.talent === t) {
        apps++;
        sumDone += p.done;
        recoils += p.recoilHits;
      }
    }
  }
  const wr = apps > 0 ? (wins / apps) * 100 : 0;
  const extra = t === 'mocha' ? ` | 平均触发反震 ${(recoils / apps).toFixed(2)} 次/局` : '';
  console.log(`${TALENT_NAMES[t]}: 胜率 ${wr.toFixed(1)}% (${wins}/${apps}) | 局均完赛 ${(sumDone / apps).toFixed(2)} 只${extra}`);
}
