/* ==========================================================
   Keeper's Voyage v2: app logic (vanilla JS, no frameworks)
   1 Helpers and state   2 Content data   3 Views   4 Events   5 Start up
   Everything is saved on the phone in localStorage. Nothing is sent anywhere.
   ========================================================== */
(function () {
  'use strict';

  /* ---------- 1. HELPERS AND STATE ---------- */
  var KEY = 'keepersVoyage.v2', OLD_KEY = 'keepersVoyage.v1';
  var SATS_DATE = '2027-05-10';   // KS2 SATs week starts (GOV.UK, checked November 2026)

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isoDate(d) { d = d || new Date(); return d.toLocaleDateString('en-CA'); }
  function parseIso(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(iso) { return parseIso(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function dayIndex() { return Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000); }
  function daysBetween(aIso, bIso) { return Math.round((parseIso(bIso) - parseIso(aIso)) / 86400000); }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function yt(q) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q); }
  function mapsUrl(q) { return 'https://www.google.com/maps/search/' + encodeURIComponent(q); }

  var DEFAULTS = {
    name: 'Ell', dream: '', avatar: '', gileroDay: '', start: '',
    xp: 0, streak: 0, best: 0, lastDay: '',
    tri: {}, claimed: { date: '', counts: {} },
    skills: { pos: 1, foot: 1, dist: 1, read: 1 },
    sessions: [], favs: [], catches: [], spots: [], venues: {},
    links: { drive1: '', drive2: '', drive3: '' },
    coachNotes: [], matches: [], matchCheck: {}, wins: [],
    speed: { start: '', tests: [], done: {} },
    study: { scores: [], reading: [], mission: {} },
    photos: { win: '', bounce: '' }, setbacks: [], mood: { date: '', v: '' }, clipNotes: [], mute: false, spotify: '', kit: 'green'
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    var s = clone(DEFAULTS), raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || '{}'); } catch (e) { raw = {}; }
    Object.keys(raw).forEach(function (k) { s[k] = raw[k]; });
    s.skills = Object.assign({}, DEFAULTS.skills, raw.skills || {});
    s.links = Object.assign({}, DEFAULTS.links, raw.links || {});
    s.speed = Object.assign({}, DEFAULTS.speed, raw.speed || {});
    s.study = Object.assign({}, DEFAULTS.study, raw.study || {});
    s.photos = Object.assign({}, DEFAULTS.photos, raw.photos || {});
    if (!Array.isArray(s.setbacks)) s.setbacks = [];
    if (!Array.isArray(s.clipNotes)) s.clipNotes = [];
    if (!s.mood || typeof s.mood !== 'object') s.mood = { date: '', v: '' };
    if (!s.start) s.start = isoDate();
    if (typeof s.tri !== 'object' || s.tri === null) s.tri = {};
    return s;
  }
  var state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: carry on */ } }

  // Short term screen state (not saved)
  var ui = {
    callQ: null, gkq: null,
    view: 'home', trainSub: 'gk', chillSub: 'fish', studySub: 'mission',
    gkSub: 'skills', gkFilter: 'all', fishSub: 'species', fitSub: 'builder',
    fitType: 'gym', fitDur: 30, cur: null, whereSpecies: 'all', whereCost: 'all',
    openDrill: null, chat: [], stretch: null, quiz: null, breath: null, pick: ''
  };

  /* ---------- XP, streak, ranks ---------- */
  var RANKS = [
    { xp: 0, name: 'Cabin Keeper' }, { xp: 150, name: 'Deckhand Keeper' }, { xp: 400, name: 'Lookout' },
    { xp: 800, name: 'First Mate' }, { xp: 1500, name: 'Navigator' }, { xp: 2500, name: 'Captain of the Net' },
    { xp: 4000, name: 'Legend of the Seven Seas' }
  ];
  function rankInfo() {
    var i = 0;
    for (var r = 0; r < RANKS.length; r++) { if (state.xp >= RANKS[r].xp) i = r; }
    var next = RANKS[i + 1];
    var pct = next ? Math.round(((state.xp - RANKS[i].xp) / (next.xp - RANKS[i].xp)) * 100) : 100;
    return { name: RANKS[i].name, next: next, pct: pct, toGo: next ? next.xp - state.xp : 0 };
  }
  function dispStreak() {
    var t = isoDate(), y = isoDate(new Date(Date.now() - 86400000));
    return (state.lastDay === t || state.lastDay === y) ? state.streak : 0;
  }
  function touchStreak() {
    var t = isoDate(), y = isoDate(new Date(Date.now() - 86400000));
    if (state.lastDay === t) return;
    state.streak = (state.lastDay === y) ? state.streak + 1 : 1;
    state.lastDay = t;
    if (state.streak > state.best) state.best = state.streak;
  }
  // claim(key, max): true if this reward is not used up today (stops XP being farmed)
  function claim(key, max) {
    var t = isoDate();
    if (state.claimed.date !== t) state.claimed = { date: t, counts: {} };
    var n = state.claimed.counts[key] || 0;
    if (n >= (max || 1)) return false;
    state.claimed.counts[key] = n + 1;
    return true;
  }
  function claimed(key) { return state.claimed.date === isoDate() && (state.claimed.counts[key] || 0) > 0; }
  var SFX = ['BOOM!', 'ZOOM!', 'WHAM!', 'POW!', 'KABOOM!'];
  function sfx(text) {
    var e = $('#sfx'); if (!e) return;
    e.textContent = text; e.classList.remove('go'); void e.offsetWidth; e.classList.add('go');
  }
  function playTone(freq, dur) {
    if (state.mute) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq;
      o.type = 'square';
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) {}
  }
  function addXP(n, msg) {
    var before = rankInfo().name;
    state.xp += n; touchStreak(); save(); updatePills();
    var after = rankInfo().name;
    playTone(after !== before ? 660 : 440, 0.15);
    if (after !== before) { sfx('RANK UP!'); toast('You are now ' + after + ' 🏴‍☠️'); }
    else { sfx(pick(SFX)); toast('+' + n + ' 🪙 ' + (msg || '')); }
  }
  function updatePills() {
    $('#pillXp').textContent = '🪙 ' + state.xp;
    $('#pillStreak').textContent = '🔥 ' + dispStreak();
  }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ---------- 2. CONTENT DATA ---------- */
  var SKILLS = [
    { id: 'pos', icon: '🎯', name: 'Positioning and Angles', tip: 'Stand on the line between ball and goal centre.' },
    { id: 'foot', icon: '⚡', name: 'Footwork and First Step Speed', tip: 'Short, powerful steps. Stay on your toes.' },
    { id: 'dist', icon: '🚀', name: 'Distribution (quick release, calm choice)', tip: 'Scan, choose, release inside three seconds.' },
    { id: 'read', icon: '🧭', name: 'Resilience and Reading the Game', tip: 'Next job. Spot danger early. Reset fast.' }
  ];
  function skillName(id) { var s = SKILLS.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }

  var BANNERS = [
    'Set your feet, steady your breath, and own your goal, Captain!',
    'Every great keeper started with one brave step off the line.',
    'Storms make sailors. Goals against make keepers. Reset and go again!',
    'Your goal is your ship. Guard it, organise your crew, and shout loud!',
    'Quick hands, calm head. Release the ball and start the attack!',
    'Treasure is earned one session at a time. Chase your next doubloon!',
    'Body, brain and downtime. A strong crew trains all three.'
  ];

  // The weekly plan. Club nights Monday and Thursday, match day Saturday.
  var GILERO = { t: 'Keeper coaching session', x: 'Take your focus list and log what your coach tells you afterwards.', go: { view: 'gk', sub: 'coach' } };
  var PLAN = {
    0: { arc: 'The Rest and Reel Arc',
      body: { t: 'Recovery day', x: 'Easy stretch or a walk after the match. Rest is when you grow stronger.', go: { view: 'fit', sub: 'stretch' } },
      mind: { t: 'Weekly review', x: 'Look back at the week and pick one thing to improve. Fifteen minutes of reading counts too.', go: { view: 'study', sub: 'read' } },
      chill: { t: 'Reel day', x: 'Fishing trip if you can. If not, tie rigs and plan your next trip.', go: { view: 'fish', sub: 'where' } } },
    1: { arc: 'The Club Night Arc',
      body: { t: 'Club night prep', x: 'Light stretch today. At club pick one thing to work on and tell your coach.', go: { view: 'fit', sub: 'stretch' } },
      mind: { t: 'Maths warm up', x: 'Five minute arithmetic blitz, then your Purple Mash tasks.', go: { view: 'study', sub: 'arith' } },
      chill: { t: 'Calm corner', x: 'Two minutes of box breathing before club.', go: { view: 'calm' } } },
    2: { arc: 'The Speed Arc',
      body: { t: 'Speed Lab session', x: 'Short sharp work for your first step. Ten to fifteen minutes.', go: { view: 'speed' } },
      mind: { t: 'Spelling spotter', x: 'Ten words, five minutes. Listen, then type.', go: { view: 'study', sub: 'spell' } },
      chill: { t: 'Knot practice', x: 'Tie the Palomar knot five times with a wet line.', go: { view: 'fish', sub: 'knots' } } },
    3: { arc: 'The Strength Arc',
      body: { t: 'Strength session', x: 'Bodyweight strength for twenty minutes. Technique first, with a grown up nearby.', go: { view: 'fit', sub: 'builder', type: 'gym' } },
      mind: { t: 'Grammar quickfire', x: 'Eight quick questions. Learn from every wrong answer.', go: { view: 'study', sub: 'gps' } },
      chill: { t: 'Downtime pick', x: 'Draw, build, listen to music or read a manga. Your choice.', go: { view: 'calm' } } },
    4: { arc: 'The Club Night Arc, Part Two',
      body: { t: 'Club night prep', x: 'Light stretch today. At club pick one thing to work on and tell your coach.', go: { view: 'fit', sub: 'stretch' } },
      mind: { t: 'Reading quest', x: 'Read for fifteen minutes and log it. Match reports and fishing magazines count.', go: { view: 'study', sub: 'read' } },
      chill: { t: 'Fishing plan', x: 'Pick your next water and check the rules before you go.', go: { view: 'fish', sub: 'where' } } },
    5: { arc: 'The Calm Before Match Day',
      body: { t: 'Match eve', x: 'Stretch, pack your kit and get an early night.', go: { view: 'match' } },
      mind: { t: 'School tasks', x: 'Do your Purple Mash tasks, then stop. Your brain gets the weekend off.', go: { view: 'study', sub: 'tools' } },
      chill: { t: 'Media time', x: 'Watch Jamie Johnson or a fishing video.', go: { view: 'media' } } },
    6: { arc: 'The Match Day Arc',
      body: { t: 'Match day', x: 'Use your three mission cards: talk, release, reset.', go: { view: 'match' } },
      mind: { t: 'Reading for fun only', x: 'No study today. Read something you love for fifteen minutes.', go: { view: 'study', sub: 'read' } },
      chill: { t: 'Post match chill', x: 'Food, rest, then a show or some fishing.', go: { view: 'media' } } }
  };

  var DRILLS = [
    { id: 'set-position', skill: 'pos', title: 'Set Position Snap', mins: 8, kit: 'A ball, a partner or a wall, a few cones.',
      steps: ['Stand on your goal line with feet a little wider than shoulders, knees soft, hands up in front of your chest.', 'Your partner stands about 8 metres away with a ball. As they begin their strike, take one small hop and land on the balls of your feet. That is your set position.', 'Your partner strikes low, then to either side. Push off and save.', 'Reset to the set position every time. Do 3 rounds of 8 shots.'],
      points: ['Be set before the ball is hit, not while it is moving.', 'Weight forward, head still, eyes on the ball.', 'Hands in front of the body, not hanging by your sides.'] },
    { id: 'cone-angles', skill: 'pos', title: 'Cone Principle (Angles Game)', mins: 12, kit: 'Three cones, a ball, a goal or two marker cones.',
      steps: ['Put cone A in the middle of your goal line. Put cone B on the ball (about 12 metres out). Imagine a string joining A and B.', 'Stand on that string, two steps off your line. This makes the goal look small to the shooter.', 'Your partner walks the ball slowly around in an arc. Shuffle sideways and step out or back to stay on the string. Feet never cross.', 'Now partner passes the ball around and shoots when ready. Set your feet as the ball is struck.', 'Finish with 6 shots. Count how many you were in the right place for.'],
      points: ['The closer the ball, the further you step out. Narrow the angle.', 'Always stay in line with the middle of the goal.', 'Small steps. Stop and set when the shot is coming.'] },
    { id: 'first-step', skill: 'foot', title: 'First Step Starts (3 to 5 metres)', mins: 10, kit: 'Two cones 4 metres apart, a partner to call.',
      steps: ['Start in your set position with a split stance (one foot slightly ahead), knees soft, hands ready.', 'Your partner calls "Left" or "Right" at random. Explode to that cone with three short, powerful steps. Push the floor away behind you.', 'Stop under control with your feet set, then walk back and rest for 20 seconds.', 'Do 6 each way. Quality matters more than speed on the day.'],
      points: ['Short powerful steps beat long reaching strides.', 'Lean into the move: your chest leads for the first two steps.', 'Tall keepers have long levers, so the first step needs more push. Practise it.'] },
    { id: 'footwork-ladder', skill: 'foot', title: 'Quick Feet Ladder', mins: 10, kit: 'An agility ladder (or chalk lines), a ball.',
      steps: ['Pattern one: one foot in each square, run through the ladder as fast as you can with tiny steps.', 'Pattern two: two feet in each square, then sideways in and out.', 'Pattern three: lateral shuffle through the ladder facing forwards, hands up.', 'After each run, a partner rolls a ball to either side for a quick save. Reset and go again.', 'Do 3 rounds of each pattern. Rest 30 seconds between rounds.'],
      points: ['Light feet, tiny steps, head up.', 'Quality first, then speed.', 'Bend the knees and stay low to keep control.'] },
    { id: 'shuttle-shuffle', skill: 'foot', title: 'Shuttle Shuffle', mins: 8, kit: 'Four cones set 3 metres apart in a line.',
      steps: ['Start at cone one in your set position.', 'Shuffle sideways to cone two, touch it with your hand, and shuffle back. Never cross your feet.', 'Next go to cone three, then cone four, touching each one and coming back to the start each time.', 'Work for 20 seconds, rest 20 seconds. Do 6 rounds.'],
      points: ['Push off the back foot.', 'Keep your chest facing the pitch.', 'Count your touches and try to beat your score each day.'] },
    { id: 'quick-release', skill: 'dist', title: 'Quick Release Clock', mins: 10, kit: 'A ball, three cones or mini goals as targets, a partner.',
      steps: ['Place three targets around you: one wide left, one wide right, one long.', 'Your partner throws or shoots an easy ball to your hands.', 'The moment you catch it, scan the targets, then release within three seconds. Your partner counts out loud.', 'Mix your options: roll, overarm throw, and kick from the hands.', 'Score a point for every release inside three seconds that hits a target. Aim for 8 out of 10.'],
      points: ['Decide before you catch. Look up, spot your free player.', 'Quick does not mean rushed. Pick the safe good option.', 'Roll to a defender in space, throw to feet, kick long only when no one is free.'] },
    { id: 'pressure-release', skill: 'dist', title: 'Distribution Under Pressure', mins: 12, kit: 'A ball, 2 or 3 friends, small grid or a half pitch.',
      steps: ['You are in goal with two defenders as your outlets, standing wide.', 'A coach or friend shoots. Catch it, then one attacker presses you after you have the ball.', 'Choose your outlet and release the ball cleanly before the presser gets to you.', 'Your defender gets a point for every pass that stays under control.', 'Swap roles after 8 balls. Talk to your outlets: shout their name or "Man on!" as you release.'],
      points: ['Hold the ball up high and look around before you move.', 'Use your voice, tell your outlets what you want.', 'Calm hands. A good short pass beats a panic kick.'] },
    { id: 'low-dives', skill: 'pos', title: 'Low Dives From Set', mins: 10, kit: 'Soft ground or a mat, a ball, a partner.',
      steps: ['Kneel or crouch in your set position on soft ground. Partner rolls the ball to one side, about an arm and a half away.', 'Push off the far foot. Lead with the hand that is behind the ball and get your other hand on top.', 'Land on the side of your body (hip, then ribs, then shoulder) and cover the ball tightly.', 'Get up quickly and return to set. Do 8 each side, then rise to a standing start.'],
      points: ['Hands behind the ball, never reaching across it.', 'Land on the side of the body, not on your elbow or chest.', 'Only on soft ground, and stop if anything hurts.'] },
    { id: 'read-spotter', skill: 'read', title: 'Spotter on Watch', mins: 15, kit: 'A small sided game, or a match clip on a phone.',
      steps: ['In a small sided game, play in goal and give a running commentary of what you see: "Man on!", "Switch!", "Space behind!".', 'Name the danger before the pass is played. Where is the free attacker? Where is the space behind the defence?', 'When your team has the ball high up the pitch, take a starting position a few steps off your line, ready to sweep.', 'After the game write down three things you spotted early.'],
      points: ['Your eyes are your best save.', 'Talk early and loud. Clear words: name, instruction.', 'Always get back to a good position when the ball moves.'] },
    { id: 'bounce-back', skill: 'read', title: 'Bounce Back Reset', mins: 8, kit: 'A ball, a coach or friend.',
      steps: ['A friend scores a goal past you on purpose (or imagine one).', 'Do the three step reset: 1) Breathe out slowly. 2) Say your cue word, for example "Next". 3) Look up and set your feet.', 'Your friend takes the next shot straight away. Save it.', 'Repeat 5 times. The goal is the quickest reset, not the best save.'],
      points: ['Mistakes happen to every keeper, even the best in the world.', 'Reset in five seconds. Next ball is the only ball.', 'Chat to your coach or a grown up if a mistake is still bothering you after the game.'] }
  ];
  function drillTitle(id) { var d = DRILLS.filter(function (x) { return x.id === id; })[0]; return d ? d.title : ''; }

  var GK_CHANNELS = [
    { name: 'Modern Goalkeeping', q: 'Modern Goalkeeping' },
    { name: 'Loris (goalkeeper coaching)', q: 'Loris goalkeeper training' },
    { name: 'Ground Glory', q: 'Ground Glory goalkeeper' },
    { name: 'Pro GK Academy', q: 'Pro GK Academy' },
    { name: 'Gilero Goalkeeping', q: 'Gilero Goalkeeping' }
  ];
  var FISH_CHANNELS = [
    { name: 'Westys Angling (Carl and Westy)', q: 'Westys Angling Carl and Westy' },
    { name: 'Angler Carl', q: 'Angler Carl' }
  ];
  var FISH_TIPS = [
    'Wet your hands before you touch a fish. It protects its slime coat.',
    'Feed little and often. A few pellets every ten minutes keeps carp interested.',
    'Tench love dawn and dusk. Get there early and be quiet on the bank.',
    'Always check your knots by pulling them tight with wet line.',
    'Cast to the same spot every time. A clip on your reel helps a lot.',
    'Watch for bubbles, they can show where tench and carp are feeding.',
    'Barbless hooks are kinder to fish, and many venues insist on them.'
  ];

  // Speed Lab: a six week programme in three arcs. Two short sessions a week, never on club nights or the day before a match.
  var SPEED = [
    { arc: 'Arc 1: Foundations', focus: 'Move well. Soft landings and strong positions.',
      A: [['Split stance lean and drive', '4 goes of 3 short steps. Fall forwards, then push the floor away.'], ['Pogo hops', '3 sets of 10. Quick, light, stiff ankles.'], ['Glute bridge', '3 sets of 10. Squeeze at the top.'], ['Wall march', '3 sets of 6 each leg. Lean on a wall and drive the knee.']],
      B: [['Squat and stick jump', '3 sets of 5. Land quietly, hold for two seconds.'], ['Single leg balance', '3 holds of 20 seconds each leg.'], ['Dead bug', '3 sets of 8. Back flat.'], ['Walking lunges', '2 sets of 6 each leg.']] },
    { arc: 'Arc 1: Foundations', focus: 'Same moves, a touch more. Add one set to each.',
      A: [['Split stance lean and drive', '5 goes of 3 short steps.'], ['Pogo hops', '4 sets of 10.'], ['Glute bridge', '3 sets of 12.'], ['Wall march', '3 sets of 8 each leg.']],
      B: [['Squat and stick jump', '4 sets of 5.'], ['Single leg balance', '3 holds of 25 seconds each leg.'], ['Dead bug', '3 sets of 10.'], ['Walking lunges', '3 sets of 6 each leg.']] },
    { arc: 'Arc 2: Power', focus: 'Push hard off the floor. Short and sharp.',
      A: [['Broad jump and stick', '4 sets of 4. Swing the arms, land soft.'], ['Lateral bounds', '4 sets of 4 each side. Stick each landing.'], ['Set position starts', '6 starts over 3 metres on a partner\'s call.'], ['Overhead ball throw', '3 sets of 6 with a football. Use the whole body.']],
      B: [['Skater hops', '3 sets of 6 each side.'], ['Low step ups', '3 sets of 6 each leg on a low step.'], ['Falling starts', '6 goes. Lean until you must step, then drive.'], ['Press ups', '3 sets of 8. Knees down if needed.']] },
    { arc: 'Arc 2: Power', focus: 'Add a little distance or one more rep.',
      A: [['Broad jump and stick', '4 sets of 5.'], ['Lateral bounds', '4 sets of 5 each side.'], ['Set position starts', '8 starts over 4 metres.'], ['Overhead ball throw', '3 sets of 8.']],
      B: [['Skater hops', '3 sets of 8 each side.'], ['Low step ups', '3 sets of 8 each leg.'], ['Falling starts', '8 goes.'], ['Press ups', '3 sets of 10.']] },
    { arc: 'Arc 3: Reaction', focus: 'Fast brain, fast feet. React, then explode.',
      A: [['Colour call starts', 'Three cones, a friend calls a colour. Sprint 3 metres to it. 8 goes.'], ['Drop ball reaction', 'A friend drops a ball. Catch it before the second bounce. 8 goes.'], ['Shuffle then dive start', 'Shuffle 3 metres, then push into a low dive on soft ground. 6 each side.']],
      B: [['Wall ball catches', '3 sets of 10 against a wall.'], ['Lateral hop and stick', '3 sets of 6 each side.'], ['5 metre sprints', '6 sprints with 45 seconds rest.']] },
    { arc: 'Arc 3: Reaction', focus: 'Test week. Retest your 5 metre time and enjoy it.',
      A: [['Warm up and strides', '4 easy strides.'], ['Retest: 5 metre sprint', 'Best of 3. Log it in the test box below.'], ['Favourite drill', 'Pick your favourite drill from the six weeks.']],
      B: [['Fun reaction game', 'Reaction games with friends or family.'], ['Stretch', 'Full daily stretch routine.']] }
  ];

  var SPECIES = [
    { id: 'carp', icon: '🐟', name: 'Carp', tag: 'Powerful fighter',
      facts: [['Where', 'Lakes, ponds, slow rivers and canals. Look for margins, islands and overhanging trees.'], ['When', 'Best from late spring to early autumn. Warm, calm days and early mornings are excellent.'], ['Baits', 'Pellets, boilies, sweetcorn, bread punch, and mixed groundbait.'], ['Size', 'Common carp in day ticket lakes often range from 2 lb to over 20 lb.']],
      tips: ['Use a method feeder with a short hooklength to start.', 'Carp spook easily. Walk softly and keep voices low.', 'Let the fish take the bait, then lift the rod firmly and wind down.', 'Use a big landing net and an unhooking mat every time.'] },
    { id: 'tench', icon: '🐠', name: 'Tench', tag: 'Dawn and dusk specialist',
      facts: [['Where', 'Quiet lakes and ponds with weed, lily pads, and muddy bottoms.'], ['When', 'Summer, especially at dawn and dusk.'], ['Baits', 'Sweetcorn, worms, maggots, and small pellets. Pale groundbait works well.'], ['Size', 'Typical sizes run from 1 lb to 5 lb. Beautiful green fish with orange eyes.']],
      tips: ['Look for rising bubbles in the weed, a sign of feeding fish.', 'A little groundbait with corn mixed in is a great start.', 'Be patient and keep casting accurate.', 'Tench pull hard. Keep your drag set sensibly.'] }
  ];
  var FISH_CARE = 'Fish care: wet hands, a big landing net, an unhooking mat, quick photos close to the ground, then back in gently. Always fish with a grown up near water.';

  var METHOD = {
    setup: ['Rod: a 10 to 12 foot feeder rod. Reel: a 3000 size reel loaded with 6 to 8 lb main line.', 'Slide a method feeder on to your main line, then a small bead, then tie on a quick change swivel or a rig stop.', 'Hooklength: 4 to 6 inches (10 to 15 cm) of 8 to 10 lb line, tied to a size 10 to 14 barbless hook. In cold water go a little longer.', 'Hair rig the bait: a small loop of line off the bend of the hook holds the bait so the hook point stays free.', 'Pack groundbait around the feeder, press your hook bait into the mould, and cast to your marked spot.'],
    bait: ['Micro pellets (2 mm) mixed with groundbait to build the feed.', 'Hookbait: a 6 mm or 8 mm wafter, a pop up, or two grains of sweetcorn.', 'Add a splash of water. Groundbait should hold in the feeder and break up slowly on the bottom.'],
    tips: ['Cast out, let the rod tip settle, and watch the tip. A pull round or a drop back is a bite.', 'Recast every 10 to 15 minutes to keep a steady trail of food.', 'Clip up your line so you can cast to the same distance every time.', 'Check the venue rules: some limit feeder weights or ban certain hooks.']
  };

  var KNOTS = [
    { id: 'palomar', name: 'Palomar Knot', use: 'Tying a hook or swivel. Strong and simple.',
      steps: ['Double about 15 cm of line to make a loop and pass the loop through the eye of the hook.', 'Tie a loose overhand knot with the doubled line, letting the hook hang below.', 'Pass the loop over the whole hook.', 'Wet the knot with a little spit or water and pull both ends slowly to tighten.', 'Trim the tag end close to the knot.'] },
    { id: 'knotless', name: 'Knotless Knot (hair rig)', use: 'Building a hair rig so the bait sits off the hook.',
      steps: ['Tie a small overhand knot at one end of your hooklength. This is your bait stop.', 'Thread the line through the eye of the hook so the hair hangs below the bend. Check the bait sits at the bend.', 'Hold the line against the shank. Wrap the line neatly down the shank, 6 to 8 turns, working towards the bend.', 'Take the end back through the eye the same way as you first threaded it.', 'Wet the line and pull slowly. The wraps should sit tight with no gaps.'] },
    { id: 'uni', name: 'Uni (Grinner) Knot', use: 'Tying main line to a swivel or feeder link.',
      steps: ['Pass the line through the swivel eye and double it back parallel, leaving a tag of about 15 cm.', 'Make a loop with the tag end, laid back alongside the doubled line.', 'Wrap the tag around both lines and through the loop 5 or 6 times.', 'Wet it, pull the tag to snug the turns, then pull the main line to slide the knot down to the swivel.', 'Trim the tag end.'] },
    { id: 'feeder-rig', name: 'Simple Method Feeder Rig', use: 'Putting everything together at the bank.',
      steps: ['Slide an inline method feeder on to the main line, then a bead.', 'Tie a swivel or use a quick change swivel to the end of the main line using the Uni knot.', 'Attach a 4 to 6 inch hooklength to the swivel.', 'Fit your bait to the hair and put a little groundbait mould around the feeder.', 'Check every knot by pulling hard before you cast.'] }
  ];

  // Five home waters: names only. Check prices, rules and junior policy with each venue before going.
  var WATERS = [
    { id: 'gorses', name: 'Gorses Fishery', place: 'Aspull', q: 'Gorses Fishery Aspull Wigan' },
    { id: 'wrightington', name: 'Wrightington Fisheries', place: 'Wrightington', q: 'Wrightington Fisheries Wigan' },
    { id: 'charity', name: 'Charity Farm', place: 'Parbold area', q: 'Charity Farm fishery Parbold' },
    { id: 'beacon', name: 'Beacon View', place: 'Appley Bridge', q: 'Beacon View fishery Appley Bridge' },
    { id: 'coppull', name: 'Coppull Mill Fishery', place: 'Coppull', q: 'Coppull Mill Fishery Coppull' }
  ];
  var VENUES = [
    { name: 'Commercial day ticket fishery', species: ['carp', 'tench'], cost: 'ticket', why: 'Stocked with carp, often with tench too. Easy to book, good facilities, and friendly staff. A great first choice.', check: 'Check junior rules, barbless hook rules, and which swims are open.' },
    { name: 'Canal stretch', species: ['carp', 'tench'], cost: 'free', why: 'Often free or cheap, and perfect for practising bite reading. Some canals hold carp and tench.', check: 'Some stretches belong to clubs. Look for signs, check the Canal and River Trust site, and take a grown up.' },
    { name: 'Angling club lake', species: ['carp', 'tench'], cost: 'member', why: 'Junior membership is usually low cost and you meet experienced anglers who share tips.', check: 'Ask about junior coaching days and the club rules before you join.' },
    { name: 'Junior coaching session', species: ['carp', 'tench'], cost: 'ticket', why: 'Get Fishing events from the Angling Trust are often free and kit can be lent out.', check: 'Look for a Get Fishing event near you on the Angling Trust website.' }
  ];

  var FIT = {
    gym: {
      warm: [{ n: 'Easy bike or cross trainer', m: 4, how: 'Light effort, nice and steady.' }, { n: 'Joint circles and arm swings', m: 2, how: 'Shoulders, hips, ankles. Slow and smooth.' }],
      pools: [
        [{ n: 'Goblet squat (light)', m: 5, how: '3 sets of 8. Light weight, chest tall, knees over toes.' }, { n: 'Bodyweight lunges', m: 5, how: '3 sets of 8 each leg. Slow down, control the step.' }, { n: 'Glute bridge', m: 4, how: '3 sets of 10. Squeeze at the top for two seconds.' }],
        [{ n: 'Plank', m: 3, how: '3 holds of 20 to 30 seconds. Straight back.' }, { n: 'Dead bug', m: 4, how: '3 sets of 8. Lower back stays flat.' }, { n: 'Side plank', m: 3, how: '2 holds of 20 seconds each side.' }],
        [{ n: 'Press ups (knees if needed)', m: 4, how: '3 sets of 6 to 10 with good form.' }, { n: 'Band pull aparts', m: 3, how: '3 sets of 12. Squeeze shoulder blades.' }, { n: 'Light cable row', m: 4, how: '3 sets of 10. Light weight only.' }],
        [{ n: 'Single leg balance', m: 3, how: '3 holds of 20 seconds each leg. Eyes on a spot.' }, { n: 'Soft landing jumps', m: 4, how: '3 sets of 5. Land quietly on the balls of your feet and bend your knees.' }, { n: 'Side to side bounds (small)', m: 4, how: '3 sets of 6. Stick the landing each time.' }]
      ],
      cool: { n: 'Cool down stretch', m: 4, how: 'Legs, hips, shoulders. 20 to 30 seconds each.' },
      note: 'Technique first, light weights, no maximum lifts. A coach or gym staff member should check your form and a grown up should be with you.'
    },
    running: {
      warm: [{ n: 'Easy jog', m: 4, how: 'Talking pace.' }, { n: 'High knees and heel flicks', m: 2, how: '2 rounds of 15 metres.' }],
      pools: [
        [{ n: 'Strides', m: 4, how: '4 runs of 40 metres, building up to fast but relaxed. Walk back to rest.' }, { n: '10 metre sprints and turn', m: 4, how: '6 sprints, turning each time. Rest 30 seconds between.' }],
        [{ n: 'Side shuffle and sprint', m: 4, how: 'Shuffle 5 metres, then sprint 10. 6 rounds.' }, { n: 'Reaction starts', m: 4, how: 'A friend shouts "Go" while you stand ready. 6 starts.' }],
        [{ n: 'Steady run', m: 6, how: 'Easy pace, nose breathing if you can.' }, { n: 'Fartlek play', m: 6, how: 'Jog, then run fast between two lamp posts, then jog. Repeat.' }]
      ],
      cool: { n: 'Walk and stretch', m: 4, how: 'Slow walk then calves, quads and hamstrings.' },
      note: 'Run on soft ground when you can and wear proper trainers. Stop and tell a grown up if anything hurts.'
    },
    stretching: {
      warm: [{ n: 'Gentle march on the spot', m: 2, how: 'Wake the legs up first.' }],
      pools: [
        [{ n: 'Hamstring stretch', m: 2, how: '30 seconds each leg, 2 times.' }, { n: 'Quad stretch', m: 2, how: '30 seconds each leg, 2 times. Stand tall.' }, { n: 'Calf stretch', m: 2, how: '30 seconds each leg against a wall.' }],
        [{ n: 'Hip flexor lunge', m: 2, how: '30 seconds each side. Tuck your tail bone.' }, { n: 'Figure four glute stretch', m: 2, how: '30 seconds each side.' }, { n: 'Adductor (groin) stretch', m: 2, how: 'Gentle. 30 seconds, 2 times.' }],
        [{ n: 'Shoulder across body stretch', m: 2, how: '20 seconds each arm.' }, { n: 'Wrist and finger stretch', m: 2, how: 'Keepers need strong hands: gently stretch both ways.' }, { n: 'Chest doorway stretch', m: 2, how: '30 seconds, 2 times.' }]
      ],
      cool: { n: 'Deep breathing', m: 2, how: 'Breathe in for 4, out for 6. Five times.' },
      note: 'Stretch gently. You should feel a pull, never pain. Never bounce.'
    }
  };
  var STRETCH_ROUTINE = [
    { n: 'Calf stretch', how: 'Hands on a wall, one foot back, heel down.' },
    { n: 'Hamstring stretch', how: 'Foot up on a step, back straight, lean forward gently.' },
    { n: 'Quad stretch', how: 'Hold your ankle behind you, knees together.' },
    { n: 'Hip flexor lunge', how: 'Kneel on one knee, push the hips forward.' },
    { n: 'Glute stretch', how: 'Lie on your back, ankle over knee, pull in.' },
    { n: 'Groin stretch', how: 'Sit with soles of feet together, gentle pressure.' },
    { n: 'Shoulder and chest', how: 'Arm across the body, then both arms behind you.' },
    { n: 'Wrists and fingers', how: 'Stretch your keeper hands gently both ways.' }
  ];

  var MATCH_CHECK = ['Boots and studs checked', 'Gloves clean and packed', 'Shin pads and kit', 'Water bottle filled', 'Good breakfast eaten', 'Warm layer for the touchline', 'Know my three mission cards'];
  var MATCH_CARDS = [
    { icon: '🗣️', t: 'TALK', x: 'Name plus instruction to a defender every five minutes. "Josh, man on!"' },
    { icon: '🚀', t: 'RELEASE', x: 'Catch, scan, release inside three seconds. Safe and good beats rushed.' },
    { icon: '🔄', t: 'RESET', x: 'Breathe out, say "Next", set your feet. Five seconds, then the next job.' }
  ];

  /* ----- Study content ----- */
  var SPELL = ['accommodate', 'achieve', 'aggressive', 'amateur', 'ancient', 'apparent', 'appreciate', 'attached', 'available', 'average', 'awkward', 'bargain', 'bruise', 'category', 'cemetery', 'committee', 'communicate', 'community', 'competition', 'conscience', 'controversy', 'convenience', 'correspond', 'criticise', 'curiosity', 'definite', 'desperate', 'determined', 'develop', 'dictionary', 'disastrous', 'embarrass', 'environment', 'equip', 'especially', 'exaggerate', 'excellent', 'existence', 'explanation', 'familiar', 'foreign', 'forty', 'frequently', 'government', 'guarantee', 'harass', 'hindrance', 'identity', 'immediate', 'individual', 'interfere', 'interrupt', 'language', 'leisure', 'lightning', 'marvellous', 'mischievous', 'muscle', 'necessary', 'neighbour', 'nuisance', 'occupy', 'occur', 'opportunity', 'parliament', 'persuade', 'physical', 'prejudice', 'privilege', 'profession', 'programme', 'pronunciation', 'queue', 'recognise', 'recommend', 'relevant', 'restaurant', 'rhyme', 'rhythm', 'sacrifice', 'secretary', 'shoulder', 'signature', 'sincere', 'soldier', 'stomach', 'sufficient', 'suggest', 'symbol', 'system', 'temperature', 'thorough', 'twelfth', 'variety', 'vegetable', 'vehicle', 'yacht'];

  var GPS = [
    { q: 'Which sentence starts with a fronted adverbial?', o: ['After the match, we went fishing.', 'We went fishing after the match.', 'Fishing is my favourite hobby.', 'The goalkeeper made a save.'], a: 0, e: 'A fronted adverbial comes at the start and is followed by a comma.' },
    { q: 'Choose the correct word: "___ going to the lake after school."', o: ['Their', 'There', "They're", 'Thare'], a: 2, e: "They're means they are." },
    { q: 'Which is correct? "The ___ gloves were muddy."', o: ['keepers', "keeper's", "keepers'", "keepe'rs"], a: 1, e: "One keeper owns the gloves, so the apostrophe goes before the s: keeper's." },
    { q: 'Which is correct? "The two ___ boots were by the door."', o: ["keeper's", 'keepers', "keepers'", "keeper'"], a: 2, e: "Two keepers own the boots, so the apostrophe goes after the s: keepers'." },
    { q: 'Which sentence uses a semicolon correctly?', o: ['I love fishing; it is relaxing.', 'I love; fishing it is relaxing.', 'I love fishing it; is relaxing.', 'I; love fishing it is relaxing.'], a: 0, e: 'A semicolon joins two closely linked main clauses that could each stand alone.' },
    { q: 'Which sentence is in the passive voice?', o: ['The ball was caught by the keeper.', 'The keeper caught the ball.', 'The keeper is catching the ball.', 'The keeper will catch the ball.'], a: 0, e: 'In the passive, the thing receiving the action comes first: the ball was caught.' },
    { q: 'Which word starts the subordinate clause? "We stayed at the lake until it got dark."', o: ['We', 'stayed', 'until', 'lake'], a: 2, e: 'The subordinating conjunction "until" starts the clause that cannot stand alone.' },
    { q: 'Which is the relative pronoun? "The boy who caught the carp smiled."', o: ['boy', 'who', 'caught', 'smiled'], a: 1, e: 'A relative pronoun (who, which, that, whose) starts a relative clause.' },
    { q: 'Which sentence has a modal verb showing possibility?', o: ['It might rain later.', 'It rained yesterday.', 'It is raining now.', 'It has rained.'], a: 0, e: 'Modal verbs include might, may, could, should, will and must.' },
    { q: 'Which word is closest in meaning to "enormous"?', o: ['tiny', 'huge', 'ordinary', 'quiet'], a: 1, e: 'Enormous and huge are synonyms.' },
    { q: 'Which word is an antonym (opposite) of "ancient"?', o: ['old', 'modern', 'historic', 'dusty'], a: 1, e: 'Antonyms have opposite meanings.' },
    { q: 'Which prefix makes "appear" mean the opposite?', o: ['dis', 'un', 're', 'mis'], a: 0, e: 'Disappear. Prefixes go at the start of a word.' },
    { q: 'Which word is spelt correctly?', o: ['definately', 'definitely', 'definitly', 'defanitely'], a: 1, e: 'Definitely: think "finite" is in the middle.' },
    { q: 'Which sentence punctuates a list correctly?', o: ['I packed bait, a net, a mat and a rod.', 'I packed, bait a net, a mat and a rod.', 'I packed bait a net, a mat, and, a rod.', 'I packed bait, a net a mat, and a rod.'], a: 0, e: 'Commas separate the items in a list, with "and" before the last one.' },
    { q: 'Which is punctuated correctly?', o: ['"I\'m ready," said the keeper.', '"I\'m ready" said the keeper.', '"I\'m ready", said the keeper.', '"Im ready, said the keeper."'], a: 0, e: 'The comma goes inside the speech marks before the speaker is named.' },
    { q: 'Which is an expanded noun phrase?', o: ['the huge, muddy lake', 'lake', 'swam quickly', 'very'], a: 0, e: 'An expanded noun phrase adds detail before or after a noun.' },
    { q: 'In "The keeper dived bravely", what word class is "bravely"?', o: ['noun', 'verb', 'adverb', 'adjective'], a: 2, e: 'It tells us how the keeper dived, so it is an adverb.' },
    { q: 'Which sentence uses brackets for parenthesis correctly?', o: ['The carp (a big one) fought hard.', 'The carp a big one) fought hard.', 'The (carp a big) one fought hard.', 'The carp fought (hard a big one).'], a: 0, e: 'Brackets add extra information that can be removed without breaking the sentence.' },
    { q: 'Which word is a coordinating conjunction?', o: ['because', 'but', 'although', 'when'], a: 1, e: 'The coordinating conjunctions are for, and, nor, but, or, yet, so.' }
  ];

  var VIPERS = [
    ['V', 'Vocabulary', 'What does this word mean here? Find another word that fits.'],
    ['I', 'Inference', 'What is the writer hinting at? Find a clue in the text to prove it.'],
    ['P', 'Prediction', 'What will happen next, and what in the text tells you?'],
    ['E', 'Explanation', 'Why did the writer choose this word or this layout?'],
    ['R', 'Retrieval', 'Find the fact. Skim for key words, then read the lines around them.'],
    ['S', 'Sequence or summarise', 'Put events in order, or sum up the main idea in a sentence.']
  ];

  var TOOLS = [
    { icon: '🟣', name: 'Purple Mash', note: 'Your school login. Has a SATs skills area, practice papers and Serial Mash ebooks. Check your 2Dos for set tasks.', url: 'https://www.purplemash.com', tag: 'School login' },
    { icon: '📘', name: 'BBC Bitesize (KS2)', note: 'Free videos, games and quizzes for Year 6 maths and English.', url: 'https://www.bbc.co.uk/bitesize/primary', tag: 'Free' },
    { icon: '🎓', name: 'Oak National Academy', note: 'Free video lessons and quizzes, Year 6 maths and English.', url: 'https://www.thenational.academy', tag: 'Free' },
    { icon: '📄', name: 'Past SATs papers (GOV.UK)', note: 'Real papers from the test makers. Parent guide to the 2027 tests is there too.', url: 'https://www.gov.uk/government/publications/key-stage-2-national-curriculum-tests-and-results-information-for-parents/2027-key-stage-2-national-curriculum-tests-information-for-parents', tag: 'Free' },
    { icon: '➕', name: 'Corbettmaths', note: 'Short maths videos and practice questions on every topic.', url: 'https://corbettmaths.com', tag: 'Free' },
    { icon: '📝', name: 'Third Space free SATs papers', note: 'Free practice papers with answers and mark schemes.', url: 'https://thirdspacelearning.com/blog/free-ks2-sats-papers-sats-revision-maths/', tag: 'Free' },
    { icon: '🎸', name: 'Times Tables Rock Stars', note: 'Fast times table practice. Works through your school login.', url: 'https://ttrockstars.com', tag: 'School login' },
    { icon: '🎮', name: 'Topmarks maths games', note: 'Quick maths games, good for a five minute warm up.', url: 'https://www.topmarks.co.uk', tag: 'Free' },
    { icon: '🧠', name: 'DoodleMaths and DoodleEnglish', note: 'Ten minutes a day, tailored to gaps. Has a free trial.', url: 'https://doodlelearning.com', tag: 'Trial, then paid' },
    { icon: '🧮', name: 'Maths Frame', note: 'Games and practice. Some free, some paid.', url: 'https://mathsframe.co.uk', tag: 'Part free' },
    { icon: '✅', name: 'SATs Companion', note: 'Large question bank and full practice tests with instant marking.', url: 'https://satscompanion.com', tag: 'Paid' }
  ];

  var ARCS = [
    { when: 'November to December', name: 'Arc 1: Foundations', todo: 'Times tables fluency, the Year 5 and 6 spelling list, a daily reading habit.' },
    { when: 'January to February', name: 'Arc 2: Skills', todo: 'Grammar and punctuation, every arithmetic type, reasoning problems. Fix weak spots first.' },
    { when: 'March to April', name: 'Arc 3: Practice papers', todo: 'One paper a week. First without a timer, then timed. Spend longer on the mistakes than on the paper.' },
    { when: 'May', name: 'Arc 4: Calm Sea', todo: 'Light practice only. Sleep, food and football. Tests are 10 to 13 May.' }
  ];

  var DOWNTIME = ['Draw your own pirate crew or a manga page', 'Read a manga or an adventure book', 'Build something: Lego, a model or a den', 'Kick a ball in the garden with no rules', 'Cook or bake something with family', 'Listen to a playlist and tidy your room', 'Tie rigs and sort your tackle box', 'Board game or cards with family', 'Go for a bike ride or a walk outside'];

  var COACH = [
    { k: ['sats', 'revise', 'revision', 'exam', 'test', 'study', 'studying'],
      a: 'The tests are 10 to 13 May 2027. Little and often wins: about 15 minutes on school days and a rest on match days. Mix maths, spelling and reading, learn from your mistakes, and keep your football and fishing going. That keeps your head fresh and your confidence up.',
      go: [{ t: 'Study mission', view: 'study', sub: 'mission' }, { t: 'SATs plan', view: 'study', sub: 'plan' }] },
    { k: ['purple', 'mash', '2do', '2dos', 'homework'],
      a: 'Purple Mash is your school login. Check your 2Dos first for tasks your teacher set, then look in the SATs skills area for practice. Serial Mash books are good reading practice too.',
      go: [{ t: 'Study toolbox', view: 'study', sub: 'tools' }] },
    { k: ['maths', 'arithmetic', 'times', 'tables', 'fractions', 'percentage', 'multiply', 'divide', 'sum', 'sums'],
      a: 'Arithmetic is quick and sharp: five minutes a day beats an hour on Sunday. Try the Maths blitz, which asks ten questions and gets harder as you level up. Check every wrong answer so you know why.',
      go: [{ t: 'Maths blitz', view: 'study', sub: 'arith' }] },
    { k: ['spelling', 'spell', 'words', 'dictation'],
      a: 'Say the word, split it into chunks, then write it. Look at the tricky bit, cover it, write it, check it. Ten words in five minutes is plenty. The spelling spotter reads the words aloud.',
      go: [{ t: 'Spelling spotter', view: 'study', sub: 'spell' }] },
    { k: ['grammar', 'punctuation', 'apostrophe', 'comma', 'semicolon', 'adverbial', 'clause', 'gps', 'spag'],
      a: 'For grammar, learn the names (fronted adverbial, subordinate clause, relative pronoun) and then spot them in real sentences. The Grammar quickfire gives you eight questions with explanations.',
      go: [{ t: 'Grammar quickfire', view: 'study', sub: 'gps' }] },
    { k: ['reading', 'comprehension', 'inference', 'book', 'vipers'],
      a: 'Read for fifteen minutes every day. Match reports, fishing magazines and manga all count. When you answer questions, use VIPERS: vocabulary, inference, prediction, explanation, retrieval, sequence. Always go back to the text for proof.',
      go: [{ t: 'Reading quest', view: 'study', sub: 'read' }] },
    { k: ['nervous', 'worried', 'anxious', 'scared', 'stress', 'stressed', 'calm', 'panic', 'butterflies'],
      a: 'Butterflies mean you care. Slow your breathing: in for 4, hold 4, out 4, hold 4. It works before a test and before a penalty. If the worry stays, tell a grown up or your teacher. They want to help.',
      go: [{ t: 'Calm corner', view: 'calm' }] },
    { k: ['first step', 'off the mark', 'slow', 'explosive', 'power', 'sprint', 'acceleration', 'quicker'],
      a: 'Over 3 to 5 metres, a tall keeper wins with a good start position and a strong first push. Use a split stance, lean into the move, and take short powerful steps. The Speed Lab has a six week plan and a 5 metre test so you can watch your time drop.',
      go: [{ t: 'Speed Lab', view: 'speed' }, { t: 'First Step Starts drill', view: 'gk', sub: 'drills', drill: 'first-step' }] },
    { k: ['match', 'game', 'saturday', 'nerves', 'before the game'],
      a: 'On match day use your three mission cards: talk, release, reset. Pack your kit the night before, eat a good breakfast, and warm up properly. Afterwards log how it went and what to improve.',
      go: [{ t: 'Match day', view: 'match' }] },
    { k: ['distribution', 'release', 'throw', 'holding', 'hold the ball', 'too long', 'kick', 'sling', 'pass'],
      a: 'Holding the ball is a habit, so train it like a skill. Rule of three: ball in your hands, count three in your head, then release. Better still, scan before the ball arrives so you already know your free player. Roll to a defender in space, throw to feet, and kick long only when no one is free.',
      go: [{ t: 'Quick Release Clock', view: 'gk', sub: 'drills', drill: 'quick-release' }, { t: 'Pressure drill', view: 'gk', sub: 'drills', drill: 'pressure-release' }] },
    { k: ['angle', 'angles', 'cone', 'position', 'positioning', 'narrow', 'close down', 'near post', 'far post'],
      a: 'Imagine a straight line from the ball to the middle of your goal and stand on it. The closer the ball, the more you step out, which makes the goal look smaller. Do the Cone Principle drill. Set your feet as the shot is struck.',
      go: [{ t: 'Cone Principle drill', view: 'gk', sub: 'drills', drill: 'cone-angles' }] },
    { k: ['footwork', 'tall', 'feet', 'quick feet', 'speed', 'agility', 'ladder', 'coordination', 'growth', 'clumsy', 'fast'],
      a: 'Tall keepers have long levers, so the aim is quick small steps and a low, strong set position, not big stretches. Use ladder drills and sideways shuffles. Feeling clumsy during a growth spurt is common, so keep practising a little and often.',
      go: [{ t: 'Quick Feet Ladder', view: 'gk', sub: 'drills', drill: 'footwork-ladder' }, { t: 'Speed Lab', view: 'speed' }] },
    { k: ['goal', 'conceded', 'mistake', 'confidence', 'bounce', 'resilience', 'howler', 'upset', 'cry', 'sad', 'let in', 'blame'],
      a: 'Every keeper concedes, even the very best. What matters is the reset. Breathe out slowly, say your cue word (like "Next"), then set your feet for the next job. Write one thing to improve in your log and move on. If a mistake is still weighing on you, chat to your coach or a grown up.',
      go: [{ t: 'Bounce Back zone', view: 'bounce' }, { t: 'Bounce Back Reset drill', view: 'gk', sub: 'drills', drill: 'bounce-back' }] },
    { k: ['test', 'quiz', 'quick test', 'clip', 'clips', 'watch', 'video'],
      a: 'Take the Quick keeper test for a three minute brain workout, or pick a clip in Think clips and answer the questions while you watch. Thinking while you watch is how top keepers learn.',
      go: [{ t: 'Quick test', view: 'gk', sub: 'test' }, { t: 'Think clips', view: 'gk', sub: 'videos' }] },
    { k: ['call', 'calls', 'keeper call', 'man on', 'away', 'time call', 'shout what'],
      a: 'Five calls run your defence: KEEPER (I am coming), AWAY (clear it), UP (squeeze out), MAN ON (pressure is coming) and TIME (calm, take a touch). Say them early, say them loud, and say them once.',
      go: [{ t: 'GK Calls', view: 'gk', sub: 'calls' }] },
    { k: ['read', 'sweeper', 'through ball', 'space', 'communicate', 'shout', 'organise', 'talk', 'spot', 'danger'],
      a: 'Reading the game starts with your eyes. Scan before the ball arrives. Where is the free attacker, where is the space behind the defence? Then talk early and loud with short clear words, like names and "Man on!".',
      go: [{ t: 'Spotter on Watch drill', view: 'gk', sub: 'drills', drill: 'read-spotter' }] },
    { k: ['dive', 'diving', 'low save', 'ground', 'low ball'],
      a: 'For low dives, start in a set position, push off the far foot, lead with the hand behind the ball and put your other hand on top. Land on your side, cover the ball, and get back up quickly. Soft ground only.',
      go: [{ t: 'Low Dives From Set', view: 'gk', sub: 'drills', drill: 'low-dives' }] },
    { k: ['method feeder', 'rig', 'feeder', 'hair rig', 'hooklength', 'hook length'],
      a: 'A great starter method feeder rig: an inline method feeder on 6 to 8 lb main line, a bead, a swivel, and a 4 to 6 inch hooklength of 8 to 10 lb line with a size 10 to 14 barbless hook. Use a hair rig, pack groundbait around the feeder, and cast to the same spot every time.',
      go: [{ t: 'Method feeder guide', view: 'fish', sub: 'method' }, { t: 'Knots and rigs', view: 'fish', sub: 'knots' }] },
    { k: ['carp', 'bait', 'boilie', 'pellet', 'sweetcorn', 'corn', 'bread', 'groundbait'],
      a: 'Carp love pellets, boilies, sweetcorn and groundbait. Feed little and often, keep your voice low, and cast to the same spot every time. Always use a big landing net and an unhooking mat.',
      go: [{ t: 'Carp guide', view: 'fish', sub: 'species' }] },
    { k: ['tench', 'lily', 'dawn', 'dusk', 'weed', 'bubbles'],
      a: 'Tench love dawn and dusk and quiet, weedy water. Look for lines of bubbles. Sweetcorn, worms, maggots and small pellets with a bit of groundbait are great. They pull hard, so keep your drag set sensibly.',
      go: [{ t: 'Tench guide', view: 'fish', sub: 'species' }] },
    { k: ['knot', 'tie', 'palomar', 'grinner', 'uni', 'tangle', 'line', 'hook'],
      a: 'Learn three knots and you are sorted: the Palomar for hooks, the Knotless Knot for hair rigs, and the Uni knot for swivels. Wet the line before you tighten and pull each knot hard to test it before you cast.',
      go: [{ t: 'Knot tutorials', view: 'fish', sub: 'knots' }] },
    { k: ['where', 'venue', 'lake', 'canal', 'day ticket', 'near me', 'pond', 'licence', 'license', 'permit'],
      a: 'Check the rules for each water and go with a grown up. In England, anglers under 13 do not need a rod licence, but a grown up who takes hold of the rod to help needs one. Get Fishing events from the Angling Trust are a great way to try new waters.',
      go: [{ t: 'My waters', view: 'fish', sub: 'where' }] },
    { k: ['gym', 'weights', 'strength', 'squat', 'lift', 'press', 'stronger'],
      a: 'In the gym, technique comes first. Use bodyweight moves and light weights, work legs, core and upper body, and add balance and soft landing work. No maximum lifts, and ask staff or a coach to check your form.',
      go: [{ t: 'Build a gym session', view: 'fit', sub: 'builder', type: 'gym' }] },
    { k: ['ww2', 'world war', 'war', 'hitler', 'churchill', 'blitz', 'evacuation'],
      a: 'World War 2 is a big SATs topic. Key points: started 1939, Britain and allies against Germany and others. Evacuation of children, the Blitz, rationing, and the role of the home front. Ask your teacher or check Purple Mash / BBC Bitesize for the exact facts your class is covering. Never copy whole paragraphs.',
      go: [{ t: 'Study toolbox', view: 'study', sub: 'tools' }] },
    { k: ['man utd', 'manchester united', 'united', 'man united', 'result', 'fixture', 'who did'],
      a: 'For the latest Man Utd result or fixture, open BBC Sport. The app stays offline so it cannot pull live scores.',
      go: [{ t: 'Open BBC Sport', view: 'media' }] },
    { k: ['weather', 'rain', 'forecast', 'playing', 'match day weather'],
      a: 'Check the Met Office or BBC Weather for the pitch you are playing at. Weather can change the surface and how the ball travels. Ask a grown up to confirm on the day.',
      go: [{ t: 'Media links', view: 'media' }] },
    { k: ['scan', 'options', 'both sides', 'same way', 'rhythm', 'distribution', 'bounce', 'gino', 'isaac', 'trigger', 'feint'],
      a: 'Before you release, look both ways. Do not fall into always going the same side. Use the bounce into a dropping midfielder (Gino is excellent at this) or deliberately miss him as a feint and play direct to Isaac or Theo. Concentration on the trigger is what unlocks it. Practice scanning in training.',
      go: [{ t: 'Squad notes', view: 'squad' }, { t: 'Keeper drills', view: 'gk', sub: 'drills' }, { t: 'Build a running session', view: 'fit', sub: 'builder', type: 'running' }] },
    { k: ['stretch', 'sore', 'flexible', 'warm up', 'cool down', 'tight', 'ache', 'aching'],
      a: 'Five minutes of stretching a day keeps you loose. Hold each stretch for 30 seconds, breathe slowly, and never bounce. If something hurts rather than just feeling tight, tell a grown up.',
      go: [{ t: 'Daily stretch routine', view: 'fit', sub: 'stretch' }] },
    { k: ['sleep', 'tired', 'bedtime', 'rest'],
      a: 'Most children your age need about 9 to 12 hours of sleep. It is when your muscles repair and your brain stores what you learned. Aim for a calm hour before bed, no screens, and a regular time, especially before match day.',
      go: [{ t: 'Calm corner', view: 'calm' }] },
    { k: ['jamie', 'johnson', 'iplayer', 'watch', 'tv', 'telly', 'show', 'series'],
      a: 'Jamie Johnson is on BBC iPlayer, a football series about a young player chasing his dream. You will find it in the Media section.',
      go: [{ t: 'Open Media', view: 'media' }] },
    { k: ['motivation', 'lazy', 'bored', 'streak', 'xp', 'doubloon', 'rank', 'level'],
      a: 'You earn doubloons for drills, sessions, study, catches and quests. Do something every day to build your streak. Small steps every day beat big sessions once a month. Take on today\'s voyage and watch your rank climb.',
      go: [{ t: 'Back to the Deck', view: 'home' }] }
  ];

  /* ----- GK calls and Bounce Back ----- */
  var CALLS = [
    { w: 'KEEPER!', t: 'You are coming for it', x: 'Say it once, say it early and loud, then go and take it.' },
    { w: 'AWAY!', t: 'You are staying', x: 'Not yours. Tell your defender to clear it high and wide.' },
    { w: 'UP!', t: 'Ball is cleared', x: 'Push the back line out together and shrink the space.' },
    { w: 'MAN ON!', t: 'Pressure is coming', x: 'Someone is closing your teammate down. Warn them before the ball arrives.' },
    { w: 'TIME!', t: 'Nobody near them', x: 'Calm them down so they take a touch instead of panicking.' }
  ];
  var CALL_SCENES = [
    { q: 'A high ball drops in your box. You can reach it first.', a: 0, e: 'You are coming, so call KEEPER early and loud.' },
    { q: 'A cross is flying in but your centre back is nearer and unchallenged.', a: 1, e: 'Not yours, so call AWAY and tell them to clear it.' },
    { q: 'The ball has been cleared out of your box and your line is deep.', a: 2, e: 'Call UP so the whole back line squeezes out together.' },
    { q: 'Your full back has the ball and a striker is sprinting at him from behind.', a: 3, e: 'Warn him early with MAN ON before the ball reaches him.' },
    { q: 'Your defender has the ball and there is no one within ten metres.', a: 4, e: 'Call TIME so he stays calm and takes a touch.' }
  ];
  var SB_TYPES = ['I let a goal in', 'I dropped or spilled the ball', 'I was not picked or got subbed', 'A test or school task went badly', 'I lost a fish or had a blank day', 'Something else'];
  var SB_NEXT = ['Breathe out slowly and say my cue word', 'Tell my coach or a grown up how I feel', 'Pick one thing to practise this week', 'Go and do something I love', 'Write down one thing I did well'];
  var SWAPS = [['I am rubbish.', 'I am still learning, and every keeper has this.'], ['I always mess up.', 'That one went wrong. Next one I will set my feet.'], ['I cannot do this.', 'I cannot do this yet.'], ['Everyone saw it.', 'Most people have already moved on, so I can too.']];
  var MOODS = {
    ready: { say: 'Ready for anything!', cls: 'ready' },
    win: { say: 'That is how it is done!', cls: 'win' },
    bounce: { say: 'Down? Never out. Next ball!', cls: 'bounce' }
  };


  /* ----- Keeper quick test, clips and check in ----- */
  var GKQ = [
    { q: 'A shot is coming from the right. Where do you aim to stand?', o: ['Right on your goal line, close to the post', 'On the line between the ball and the middle of your goal', 'As far forward as you can run', 'In the exact middle of the goal, always'], a: 1, e: 'Stand on the line between ball and goal centre. It covers the most of your goal.' },
    { q: 'Why do you step out as the ball gets closer?', o: ['To look taller to the crowd', 'To make the goal look smaller to the shooter', 'Because the rules say so', 'To be nearer your defenders'], a: 1, e: 'Stepping out narrows the angle, so there is less goal to shoot at.' },
    { q: 'What is the set position?', o: ['Standing still with arms by your sides', 'Feet about shoulder width, knees soft, hands ready, set as the ball is struck', 'Lying down ready to dive', 'Jumping as high as you can'], a: 1, e: 'Be balanced and on the balls of your feet. Set before the strike, not after.' },
    { q: 'You want to move quickly to your left. Which foot pushes off?', o: ['Your left foot', 'Your right foot', 'Both together', 'Neither, you just lean'], a: 1, e: 'Push off the far foot, which here is the right, to drive towards the left.' },
    { q: 'A high ball comes straight at your chest. What hand shape is best?', o: ['Fists', 'A W shape behind the ball, thumbs close together', 'Palms flat facing the sky', 'One hand only'], a: 1, e: 'Get hands behind the ball in a W shape so it cannot squeeze through.' },
    { q: 'You are going to catch a cross. What do you call?', o: ['AWAY!', 'TIME!', 'KEEPER!', 'UP!'], a: 2, e: 'KEEPER, early and loud, so nobody gets in your way.' },
    { q: 'The ball is cleared and your back line is deep. What do you shout?', o: ['UP!', 'MAN ON!', 'AWAY!', 'Nothing'], a: 0, e: 'UP tells the line to push out together and squeeze the space.' },
    { q: 'You get the ball under pressure. What is the best first choice?', o: ['Blast it as far as you can', 'A safe, good pass to a free defender', 'Hold it for ten seconds', 'Throw it at the striker'], a: 1, e: 'Safe and good beats rushed. Scan early so you already know your free player.' },
    { q: 'You hold the ball too long. What is a good habit?', o: ['Look at the floor', 'Scan before the ball arrives, then release within three seconds', 'Always kick long', 'Wait for a whistle'], a: 1, e: 'The decision is made before you catch it, so the release is quick and calm.' },
    { q: 'You cannot hold a hard shot. Where do you push it?', o: ['Straight back into the middle', 'Wide, away from danger', 'Up in the air', 'Behind you'], a: 1, e: 'Parry it wide so there is no easy rebound for an attacker.' },
    { q: 'You dive low to your side. Where should you land?', o: ['On your elbow', 'On the side of your body, hands behind the ball', 'On your face', 'On your back'], a: 1, e: 'Land on the side of the body, hip then ribs then shoulder, hands behind the ball.' },
    { q: 'You make a mistake and a goal goes in. What is the best next step?', o: ['Throw your gloves', 'Breathe out, say your cue word, set your feet for the next job', 'Blame the defender', 'Stop talking for the rest of the game'], a: 1, e: 'Reset in five seconds. The next ball is the only ball.' },
    { q: 'You are tall and a bit slow off the mark. What helps most?', o: ['Standing further back', 'Explosive first two steps and strength work', 'Only long kicks', 'Waiting for the shot'], a: 1, e: 'Short powerful first steps and building strength make a tall keeper quicker over a few metres.' },
    { q: 'After a save, how quickly should you look to distribute?', o: ['Take as long as you like', 'Within three seconds if a good pass is on', 'Always wait for the referee', 'Only on goal kicks'], a: 1, e: 'Scan early, decide fast, and release calmly. Holding the ball too long invites pressure.' },
    { q: 'You read the cross well, chose the right option, then fumbled the catch. Which part needs work?', o: ['Positioning', 'Game reading', 'Decision making', 'Technical execution (the handling)'], a: 3, e: 'Four things can go wrong: positioning, game reading, decision, technique. Name which one, then fix that one.' },
    { q: 'A striker is closing down your full back from behind. What do you call?', o: ['TIME!', 'MAN ON!', 'KEEPER!', 'UP!'], a: 1, e: 'MAN ON warns your teammate before the ball arrives.' },
    { q: 'What is the best way to deal with nerves before a match?', o: ['Ignore them completely', 'Slow breathing, then focus on your first job', 'Eat lots of sweets', 'Skip the warm up'], a: 1, e: 'Slow breathing calms your body. Butterflies mean you care.' },
    { q: 'Why do tall keepers work on a quick first step?', o: ['They never need to move', 'Long legs take longer to get going, so a strong short first push helps', 'To look cool', 'It does not matter'], a: 1, e: 'Short powerful steps and a lean into the move get you going quickly.' }
  ];
  var FA_CLIPS = [
    { t: 'FA Bootroom: goalkeeping basics', u: 'https://www.thefa.com/bootroom/resources/coaching/goalkeeping-goalkeeping-basics', x: 'Handling, footwork, positioning, saving and distribution, for ages 5 to 11.' },
    { t: 'FA Bootroom: utilising your goalkeeper', u: 'https://www.thefa.com/bootroom/resources/coaching/goalkeeping-utilising-your-goalkeeper', x: 'How a keeper helps the team with distribution and positioning.' },
    { t: 'FA Bootroom: goalkeeping and transition', u: 'https://www.thefa.com/bootroom/resources/coaching/goalkeeping---goalkeeping-and-transition', x: 'Decisions in and out of possession, and reacting when the ball changes sides.' },
    { t: 'FA Bootroom: decisions, distribution and support', u: 'https://www.thefa.com/bootroom/resources/coaching/goalkeeping---goalkeeping-decisions-distribution-and-support', x: 'An England goalkeeper coach with academy keepers.' }
  ];
  var CLIP_TOPICS = [
    ['Angles and positioning', 'youth goalkeeper positioning angles'],
    ['Distribution under pressure', 'goalkeeper distribution under pressure youth'],
    ['One v one saves', 'goalkeeper one v one saves technique'],
    ['Crosses and communication', 'goalkeeper claiming crosses communication'],
    ['Bouncing back from a mistake', 'goalkeeper bounce back after mistake mentality']
  ];
  var THINK_QS = ['Where was the keeper standing before the shot or pass?', 'What did the keeper look at first?', 'What was their body shape and where were their hands?', 'What would you have done, and why?', 'What did they do straight after a mistake?'];
  var PILLARS = [
    ['Positioning', 'Where did I stand? Was I on the line between ball and goal?'],
    ['Game reading', 'Did I see it early? Where was the free player or the danger?'],
    ['Decision', 'Did I choose the right option: catch, parry, claim, pass or roll?'],
    ['Technique', 'Hands, feet, body shape and landing. Was the execution clean?']
  ];
  var MOOD_REPLY = {
    great: 'Brilliant! Ride that wave. Pick your favourite thing on the Deck today.',
    ok: 'Solid. A steady day is a good day. Start with one small job.',
    tired: 'Tired is fine. Go gentle today, do your stretch and get an early night.',
    rough: 'Thanks for telling me. Try the Calm corner or Bounce Back, and tell a grown up if it feels heavy.'
  };

  var COACH_SUGGEST = ['How do I get quicker at distribution?', 'Help me with SATs', 'Footwork for tall keepers', 'I let a goal in, what now?', 'Best method feeder rig for carp', 'I feel nervous'];

  /* ---------- 3. VIEWS ---------- */
  function seg(items, current, act, cls) {
    return '<div class="seg ' + (cls || '') + '">' + items.map(function (i) {
      return '<button data-act="' + act + '" data-sub="' + i[0] + '" class="' + (current === i[0] ? 'on' : '') + '">' + i[1] + '</button>';
    }).join('') + '</div>';
  }
  function goAttrs(g) {
    return 'data-act="go" data-view="' + g.view + '"' + (g.sub ? ' data-sub="' + g.sub + '"' : '') + (g.type ? ' data-type="' + g.type + '"' : '') + (g.drill ? ' data-drill="' + g.drill + '"' : '');
  }
  function refresh() { RENDER[ui.view](); }
  function daysToSats() { return daysBetween(isoDate(), SATS_DATE); }


  /* ----- Character sprites (original art) or photos (photos stay on this phone only) ----- */
  function kitKey() { return (window.KVChar && KVChar.KITS[state.kit]) ? state.kit : 'green'; }
  var ART = { save: 'ell_save', ready: 'ell_ready', win: 'ell_win', bounce: 'ell_bounce', fishing: 'ell_fishing', study: 'ell_study', calm: 'ell_calm' };
  function figure(pose, extra) {
    var f = ART[pose] || ART.ready;
    if (extra && extra.bust) return '<img class="kvart" alt="Ell" src="assets/' + f + '.png" style="object-fit:cover;object-position:top center;width:100%;height:100%">';
    return '<img class="kvart" alt="Ell, the keeper" src="assets/' + f + '.png">';
  }
  function charHtml(mood, big) {
    var m = MOODS[mood] || MOODS.ready;
    return '<div class="charcard ' + m.cls + (big ? ' big' : '') + '"><div class="kvfig">' + figure(mood === 'win' ? 'win' : mood === 'bounce' ? 'bounce' : 'ready') + '</div><div class="speech">' + esc(m.say) + '</div></div>';
  }
  function bounceStats() {
    var tot = state.setbacks.length, back = state.setbacks.filter(function (x) { return x.back; }).length;
    return { tot: tot, back: back };
  }

  function renderSquad(el) {
    var players = [
      { name: 'Archie (Action Man)', pos: 'Defender', notes: 'Strong. Likes driving forward and wants the ball from goal kicks. Great defender but sometimes shies away from receiving it. Emotional at times.' },
      { name: 'Gino', pos: 'CM', notes: 'Aggressive. Fantastic passer and finisher. Real box to box. Very good at the bounce pass when he drops. Play him in to bounce back or go round the corner.' },
      { name: 'George', pos: 'Midfield', notes: 'Skilful and intelligent footballer.' },
      { name: 'Harvey (Pele)', pos: 'Midfield / wide', notes: 'Cheeky, can be arrogant, quick to blame. Drifts in and out. Sometimes lazy tracking runners. Good passer and runner with the ball.' },
      { name: 'Logan', pos: 'Wide / midfield', notes: 'Quick, aggressive, highly strung. Loses his head at times. Loves running with the ball.' },
      { name: 'Jacob', pos: 'CM or CB', notes: 'Hard as nails, no nonsense. Great passing range and shot. Not always the cleverest with his passes. Technically solid.' },
      { name: 'Alfie', pos: 'Wide', notes: 'Quiet, tends to hide in games. Lovely lad. Great crosser. Plays wide left or right but is right footed.' },
      { name: 'Theo', pos: 'CF', notes: 'In your class at school. Quite shy. Great finisher and shot, but work rate can be low.' },
      { name: 'Isaac', pos: 'CF', notes: 'Top CF. Never stops. Great finisher, hold up play, touch and strength. Always be aware when he is 1v1 and how to deliver the ball to him.' },
      { name: 'Ellis', pos: 'Forward / midfield', notes: 'New friend. Strong, aggressive, works hard. Lovely touch and finish.' },
      { name: 'Jax', pos: 'Other GK', notes: 'Small, good with his feet, agile, polished. Been in academy since age 5. You are the better talker.' }
    ];
    var html = '<div class="card"><h2>👥 9 a side squad notes</h2><p class="muted">These stay on your phone. Use them before matches to plan distribution.</p>';
    players.forEach(function (p) {
      html += '<div class="card tight mate"><div class="matefig">' + '' + '</div><div><strong>' + esc(p.name) + '</strong> <span class="tag">' + esc(p.pos) + '</span><p>' + esc(p.notes) + '</p></div></div>';
    });
    html += '<div class="card"><h3>🎯 Your key habits</h3><ul>' +
      '<li>Scan both options before you receive or release. Do not get into a rhythm of always going the same way.</li>' +
      '<li>Bounce pass into a dropping CM (especially Gino). He can play round the corner or bounce it back.</li>' +
      '<li>Sometimes miss the dropping player on purpose as a feint, then play direct to the CF (Isaac or Theo).</li>' +
      '<li>Concentration is the trigger. Watch for the cue and decide early.</li>' +
      '<li>Talk more than Jax. Your voice helps the team.</li>' +
      '</ul></div></div>';
    el.innerHTML = html;
  }

  function renderBounce(el) {
    var st = bounceStats();
    var html = '<div class="card"><h2>🔄 Bounce Back</h2>' + charHtml('bounce') +
      '<p>Every keeper concedes, drops one or has a bad day. What makes a great keeper is how fast they reset. Here you get stronger at it.</p></div>';
    html += '<div class="card"><h3>The 3 R Reset</h3>' +
      '<div class="tile"><div class="badge">1</div><div><div class="t">RESET your body</div><div class="muted">Breathe out slowly. Shake your hands. Say your cue word, for example "Next".</div></div></div>' +
      '<div class="tile"><div class="badge">2</div><div><div class="t">REFRAME the thought</div><div class="muted">Swap the harsh thought for a fair one (see the swaps below).</div></div></div>' +
      '<div class="tile"><div class="badge">3</div><div><div class="t">RESTART with a job</div><div class="muted">Look up, set your feet and do the next job: talk, scan, set.</div></div></div>' +
      '<button class="btn blue block" style="margin-top:8px" data-act="go" data-view="calm">Open Calm corner</button></div>';
    html += '<div class="card"><h3>Log a setback (then log your comeback)</h3><p class="muted">Writing it down shrinks it. This is private, just for you.</p>' +
      '<label for="sbType">What happened?</label><select id="sbType">' + SB_TYPES.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<label for="sbFeel">How big did it feel? (1 small, 5 huge)</label><select id="sbFeel"><option>3</option><option>1</option><option>2</option><option>4</option><option>5</option></select>' +
      '<label for="sbNext">What will I do next?</label><select id="sbNext">' + SB_NEXT.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<label for="sbLearn">One thing I learnt</label><input type="text" id="sbLearn" placeholder="e.g. I need to set my feet earlier">' +
      '<button class="btn red block" style="margin-top:12px" data-act="sbsave">Save it +20 🪙</button></div>';
    html += '<div class="card"><h3>🏅 Comeback record</h3><div class="bounty" style="text-align:center">' + st.back + '<small>COMEBACKS</small></div>' +
      '<div class="bar"><i style="width:' + (st.tot ? Math.round(st.back / st.tot * 100) : 0) + '%"></i></div><div class="muted">' + st.back + ' of ' + st.tot + ' setbacks bounced back from</div>';
    if (!state.setbacks.length) html += '<p class="muted">Nothing logged. That is fine. This is here for when you need it.</p>';
    state.setbacks.slice(0, 8).forEach(function (x, i) {
      html += '<div class="item"><div class="top"><div><strong>' + fmtDate(x.date) + '</strong> ' + esc(x.type) + (x.learn ? '<div>💡 ' + esc(x.learn) + '</div>' : '') + '<div class="muted">Felt ' + esc(x.feel) + ' of 5. Next: ' + esc(x.next) + '</div></div>' +
        '<button class="btn small ghost" data-act="sbdel" data-i="' + i + '" aria-label="Delete">🗑️</button></div>' +
        '<button class="btn small ' + (x.back ? 'done' : 'red') + '" style="margin-top:6px" data-act="sbback" data-i="' + i + '">' + (x.back ? '✔ Bounced back' : 'I bounced back! +30') + '</button></div>';
    });
    html += '</div>';
    html += '<div class="card"><h3>Thought swaps</h3>' + SWAPS.map(function (w) { return '<div class="item"><div class="muted">Instead of: ' + esc(w[0]) + '</div><div><strong>Try:</strong> ' + esc(w[1]) + '</div></div>'; }).join('') + '</div>';
    html += '<div class="card tight muted">If a setback keeps weighing on you for days, tell your coach, your teacher or a grown up you trust. Asking for help is a strength.</div>';
    el.innerHTML = html;
  }


  function gkqHtml() {
    var q = ui.gkq, html = '<div class="card"><h2>🧠 Quick keeper test</h2>';
    if (!q) {
      var ls = state.study.scores.filter(function (x) { return x.kind === 'gk'; }).slice(0, 3);
      html += '<p>Eight quick questions on positioning, handling, calls and mindset. Takes about three minutes.</p><button class="btn red block" data-act="gkqstart">Start the test</button>';
      if (ls.length) html += '<p class="muted" style="margin-top:10px">Recent: ' + ls.map(function (x) { return x.score + '/' + x.out; }).join(', ') + '</p>';
      return html + '</div>';
    }
    if (q.done) {
      var pct = Math.round(q.score / q.qs.length * 100);
      return html + '<div class="qbox"><div class="q">' + q.score + ' out of ' + q.qs.length + '</div><div class="bar"><i style="width:' + pct + '%"></i></div><p>' + (pct >= 85 ? 'Keeper brain on fire!' : pct >= 60 ? 'Good work. Read the ones you missed again.' : 'Good effort. Every miss is a lesson. Try again tomorrow.') + '</p><button class="btn red block" data-act="gkqstart">Play again</button></div></div>';
    }
    var c = q.qs[q.i];
    html += '<div class="muted">Question ' + (q.i + 1) + ' of ' + q.qs.length + ' &nbsp; Score ' + q.score + '</div><div class="bar blue"><i style="width:' + Math.round(q.i / q.qs.length * 100) + '%"></i></div><h3 style="margin:10px 0">' + esc(c.q) + '</h3>' +
      c.o.map(function (o, i) {
        var cls = ''; if (q.fb) { if (i === c.a) cls = ' right'; else if (i === q.fb.pick) cls = ' wrong'; }
        return '<button class="btn opt' + cls + '" data-act="gkqpick" data-i="' + i + '"' + (q.fb ? ' disabled' : '') + '>' + esc(o) + '</button>';
      }).join('') + (q.fb ? '<div class="fb ' + (q.fb.ok ? 'ok' : 'no') + '">' + (q.fb.ok ? 'Correct! ' : 'Not quite. ') + esc(c.e) + '</div><button class="btn red block" data-act="gkqnext">' + (q.i + 1 >= q.qs.length ? 'See my score' : 'Next') + '</button>' : '');
    return html + '</div>';
  }

  function clipsHtml() {
    var html = '<div class="card"><h2>🎬 Think clips</h2><p>Watching is better when you think while you watch. Pick a clip, watch for a minute, then answer the questions out loud or write them down.</p></div>';
    html += '<div class="card"><h3>Free FA coaching videos</h3><p class="muted">Made for coaches, so watch with your dad.</p>' + FA_CLIPS.map(function (c) { return '<a class="linkcard" href="' + esc(c.u) + '" target="_blank" rel="noopener"><span class="ico">🎬</span><span>' + esc(c.t) + '<small>' + esc(c.x) + '</small></span></a>'; }).join('') + '</div>';
    html += '<div class="card"><h3>Find a clip on YouTube</h3>' + CLIP_TOPICS.map(function (c) { return '<a class="linkcard" href="' + yt(c[1]) + '" target="_blank" rel="noopener"><span class="ico">▶️</span><span>' + esc(c[0]) + '<small>Search on YouTube</small></span></a>'; }).join('') + GK_CHANNELS.map(function (c) { return '<a class="linkcard" href="' + yt(c.q) + '" target="_blank" rel="noopener"><span class="ico">▶️</span><span>' + esc(c.name) + '<small>Search on YouTube</small></span></a>'; }).join('') + '</div>';
    html += '<div class="card"><h3>Think while you watch</h3><ol>' + THINK_QS.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
      '<label for="clipTitle">Which clip?</label><input type="text" id="clipTitle" placeholder="Name or topic">' +
      '<label for="clipNote">What I noticed</label><textarea id="clipNote" placeholder="One thing the keeper did well, and one thing I will try"></textarea>' +
      '<button class="btn red block" style="margin-top:10px" data-act="clipsave">Save my notes +10 🪙</button>';
    state.clipNotes.slice(0, 5).forEach(function (n, i) { html += '<div class="item"><div class="top"><span>' + fmtDate(n.date) + ': <strong>' + esc(n.title || 'Clip') + '</strong><div>' + esc(n.note) + '</div></span><button class="btn small ghost" data-act="clipdel" data-i="' + i + '" aria-label="Delete">🗑️</button></div></div>'; });
    html += '</div>';
    html += '<div class="card"><h3>After my own match: four pillars</h3><p class="muted">When something goes wrong, name which part it was. Then you fix the right thing.</p>' + PILLARS.map(function (p, i) { return '<div class="tile"><div class="badge">' + (i + 1) + '</div><div><div class="t">' + esc(p[0]) + '</div><div class="muted">' + esc(p[1]) + '</div></div></div>'; }).join('') + '<p class="muted">A fumbled catch does not mean a bad decision. Do not blame the wrong thing.</p>' +
      '<button class="btn blue block" data-act="go" data-view="gk" data-sub="videos">Find my own match videos</button></div>';
    return html;
  }

  function moodHtml() {
    var t = state.mood.date === isoDate() ? state.mood.v : '';
    var opts = [['great', '😄 Great'], ['ok', '🙂 OK'], ['tired', '😴 Tired'], ['rough', '😟 Rough']];
    return '<div class="card tight"><strong>How are you today?</strong><div class="chips" style="margin-top:8px">' + opts.map(function (o) { return '<button class="chip ' + (t === o[0] ? 'on' : '') + '" data-act="mood" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>' + (t ? '<p style="margin:8px 0 0">🦜 ' + esc(MOOD_REPLY[t]) + '</p>' : '') + '</div>';
  }

  function callsHtml() {
    var q = ui.callQ;
    var html = '<div class="card"><h2>🗣️ GK Calls</h2><p>Your voice is a save. Five calls that organise the whole team. Say them early and loud.</p></div>';
    html += CALLS.map(function (c) { return '<div class="tile"><div class="badge">🗣️</div><div><div class="t">' + esc(c.w) + ' <span class="tag">' + esc(c.t) + '</span></div><div class="muted">' + esc(c.x) + '</div></div></div>'; }).join('');
    html += '<div class="card"><h3>Which call?</h3>';
    if (!q || q.done) {
      html += (q && q.done ? '<p>You got ' + q.score + ' out of ' + CALL_SCENES.length + '.</p>' : '<p class="muted">Five quick situations. Pick the right call.</p>') + '<button class="btn red block" data-act="callstart">' + (q && q.done ? 'Play again' : 'Start') + '</button>';
    } else {
      var sc = CALL_SCENES[q.i];
      html += '<p><strong>' + esc(sc.q) + '</strong></p>' + CALLS.map(function (c, i) {
        var cls = ''; if (q.fb) { if (i === sc.a) cls = ' right'; else if (i === q.fb.pick) cls = ' wrong'; }
        return '<button class="btn opt' + cls + '" data-act="callpick" data-i="' + i + '"' + (q.fb ? ' disabled' : '') + '>' + esc(c.w) + '</button>';
      }).join('') + (q.fb ? '<div class="fb ' + (q.fb.ok ? 'ok' : 'no') + '">' + (q.fb.ok ? 'Correct! ' : 'Not quite. ') + esc(sc.e) + '</div><button class="btn red block" data-act="callnext">' + (q.i + 1 >= CALL_SCENES.length ? 'Finish' : 'Next') + '</button>' : '');
    }
    return html + '</div>';
  }

  /* ----- Home (Deck) ----- */
  function renderHome() {
    var el = $('#view-home'), r = rankInfo(), day = new Date().getDay(), p = PLAN[day];
    var body = p.body;
    if (state.gileroDay !== '' && String(state.gileroDay) === String(day)) body = GILERO;
    var tri = state.tri[isoDate()] || {};
    var chapter = daysBetween(state.start, isoDate()) + 1;
    var dts = daysToSats();
    var weekAgo = isoDate(new Date(Date.now() - 6 * 86400000));
    var weekCount = state.sessions.filter(function (s) { return s.date >= weekAgo; }).length;
    var d = DRILLS[dayIndex() % DRILLS.length];
    var tip = FISH_TIPS[dayIndex() % FISH_TIPS.length];
    var focus = state.coachNotes.length ? state.coachNotes[0].focus : '';
    var allDone = tri.body && tri.mind && tri.chill;

    function tile(k, icon, cls, t, x, g) {
      var ok = tri[k];
      return '<div class="tile ' + cls + (ok ? ' ok' : '') + '"><div class="badge">' + (ok ? '✔' : icon) + '</div><div>' +
        '<div class="t">' + esc(t) + '</div><div class="muted">' + esc(x) + '</div>' +
        '<div class="row" style="margin-top:6px"><button class="btn small blue" ' + goAttrs(g) + '>Go</button>' +
        '<button class="btn small ' + (ok ? 'done' : 'red') + '" data-act="tri" data-k="' + k + '">' + (ok ? '✔ Done' : 'Done! +20') + '</button></div></div></div>';
    }

    var dayOpts = ['Not set', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(function (n, i) {
      var v = i === 0 ? '' : String(i - 1);
      return '<option value="' + v + '"' + (String(state.gileroDay) === v ? ' selected' : '') + '>' + n + '</option>';
    }).join('');

    el.innerHTML =
      '<div class="episode"><span class="ep-tag">Episode ' + chapter + '</span>' +
        '<div class="ep-title">' + esc(p.arc) + '</div>' +
        '<p class="ep-line">' + (allDone ? 'Everything done today. Legend!' : 'Your crew is waiting, Captain. Ready?') + '</p>' +
        '<button class="btn red ep-go" ' + goAttrs(body.go) + '>⚡ Start today\'s mission</button>' +
        '<div class="ep-stats"><span class="tag red">🔥 ' + dispStreak() + '</span><span class="tag gold">🪙 ' + state.xp + '</span></div>' +
        '<div class="ep-hero">' + figure(allDone ? 'win' : 'ready') + '</div>' +
      '</div>' +
      '<div class="banner">' + esc(BANNERS[dayIndex() % BANNERS.length]) + '</div>' +
      '<div class="card poster">' +
        '<p class="wanted">WANTED</p><div class="sub">The keeper of the net</div>' +
        '<div class="avatar">' + (state.avatar ? '<img alt="" src="' + esc(state.avatar) + '">' : figure('ready', { bust: true })) + '</div>' +
        '<div class="rank">' + esc(state.name || 'Keeper') + ': ' + esc(r.name) + '</div>' +
        (state.dream ? '<div class="muted" style="font-weight:800">My dream: ' + esc(state.dream) + '</div>' : '') +
        '<div class="bounty"><small>BOUNTY</small>🪙 ' + state.xp + '</div>' +
        '<div class="bar"><i style="width:' + r.pct + '%"></i></div>' +
        '<div class="muted">' + (r.next ? (r.toGo + ' doubloons to ' + esc(r.next.name)) : 'Top rank reached!') + '</div>' +
        '<div class="row" style="justify-content:center;margin-top:10px"><span class="tag red">🔥 Streak ' + dispStreak() + '</span><span class="tag gold">Best ' + state.best + '</span><span class="tag">Logs this week: ' + weekCount + '</span></div>' +
      '</div>' +
      '<div class="card tight" style="text-align:center">' + charHtml(allDone ? 'win' : 'ready') + '<button class="btn small blue" data-act="go" data-view="bounce">Having a tough day? Bounce back</button></div>' +
      '<div class="card tight"><h3 style="margin:0">Your crew</h3><img class="crewpic" alt="Ell\'s team mates" src="assets/ell_crew.png"><button class="btn small blue block" data-act="go" data-view="squad">Squad notes</button></div>' +
      '<div class="card"><h2>⚡ What do you want to do?</h2><div class="qgrid">' +
        '<button class="qbtn" ' + goAttrs(body.go) + '>🧤<span>Today\'s training</span></button>' +
        '<button class="qbtn" data-act="go" data-view="bounce">🔄<span>Bounce back</span></button>' +
        '<button class="qbtn" data-act="go" data-view="gk" data-sub="test">🧠<span>Quick keeper test</span></button>' +
        '<button class="qbtn" data-act="go" data-view="gk" data-sub="videos">🎬<span>Think clips</span></button>' +
        '<button class="qbtn" data-act="go" data-view="gk" data-sub="calls">🗣️<span>GK calls</span></button>' +
        '<button class="qbtn" data-act="go" data-view="study" data-sub="mission">📚<span>Study mission</span></button>' +
        '<button class="qbtn" data-act="go" data-view="fish" data-sub="where">🎣<span>Fishing</span></button>' +
        '<button class="qbtn" data-act="go" data-view="calm">🌊<span>Calm corner</span></button></div></div>' +
      moodHtml() +
      '<div class="card"><h2>🗺️ Today\'s Voyage</h2><p class="muted">Body, brain and downtime. Tick all three for a bonus.</p>' +
        tile('body', '⚽', '', body.t, body.x, body.go) +
        tile('mind', '📚', 'mind', p.mind.t, p.mind.x, p.mind.go) +
        tile('chill', '🎣', 'chill', p.chill.t, p.chill.x, p.chill.go) +
        (allDone ? '<div class="banner" style="margin:10px 0 0">TRIPLE THREAT! All three done today. Brilliant!</div>' : '') +
      '</div>' +
      (dts > 0 ? '<div class="card tight"><strong>📚 SATs voyage:</strong> ' + dts + ' days to go (10 May 2027). Little and often, and plenty of football and fishing too. <button class="btn small blue" style="margin-top:8px" data-act="go" data-view="study" data-sub="plan">See the plan</button></div>' : '') +
      (focus ? '<div class="card tight"><strong>🎯 My keeper focus this week:</strong> ' + esc(focus) + '</div>' : '') +
      '<div class="card tight"><strong>🧤 Today\'s drill:</strong> ' + esc(d.title) + ' <span class="muted">(' + d.mins + ' mins)</span> <button class="btn small" style="margin-top:8px" data-act="go" data-view="gk" data-sub="drills" data-drill="' + d.id + '">Open it</button></div>' +
      '<div class="card tight"><strong>🎣 Tip of the day:</strong> ' + esc(tip) + '</div>' +
      '<div class="card"><details><summary><span>⚙️ Captain settings</span></summary><div class="inner">' +
        '<label><input type="checkbox" id="setMute"' + (state.mute ? ' checked' : '') + '> Mute sounds</label>' +
        '<label for="setSpotify">Spotify playlist or album link</label><input type="url" id="setSpotify" placeholder="Paste a Spotify link here" value="' + esc(state.spotify || '') + '">' +
        '<label for="setDream">My dream</label><input type="text" id="setDream" placeholder="e.g. Play in goal for Wigan Athletic first team" value="' + esc(state.dream) + '">' +
        '<label for="setGil">Keeper coaching session day</label><select id="setGil">' + dayOpts + '</select>' +
        '<label for="avatarFile">My crew picture (stays on this phone)</label><input type="file" id="avatarFile" accept="image/*">' +
        '<label for="photoWin">Celebration picture (big smile!)</label><input type="file" id="photoWin" data-slot="win" accept="image/*">' +
        '<label for="photoBounce">Bounce back picture (determined face)</label><input type="file" id="photoBounce" data-slot="bounce" accept="image/*">' +
        '<p class="muted">Pictures are shrunk and kept on this phone only. They are never uploaded anywhere.</p>' +
        '<div class="row" style="margin-top:12px"><button class="btn" data-act="savesettings">Save settings</button>' + (state.avatar ? '<button class="btn ghost small" data-act="clearavatar">Remove picture</button>' : '') + '</div>' +
        '<h3 style="margin-top:16px">Backup</h3><p class="muted">Copy the text to keep your progress safe, or paste it back to restore.</p>' +
        '<textarea id="backupBox" placeholder="Backup text appears here"></textarea>' +
        '<div class="row" style="margin-top:8px"><button class="btn small blue" data-act="export">Make backup</button><button class="btn small" data-act="import">Restore from text</button></div>' +
      '</div></details></div>';
  }

  /* ----- Train: keeper, speed, fitness, match ----- */
  var TRAIN_SUBS = [['gk', '🧤 Keeper'], ['speed', '⚡ Speed Lab'], ['fit', '💪 Fitness'], ['match', '🏟️ Match day'], ['squad', '👥 Squad'], ['bounce', '🔄 Bounce back']];
  function renderTrain() {
    var el = $('#view-train');
    el.innerHTML = seg(TRAIN_SUBS, ui.trainSub, 'trainsub') + '<div id="trainBody"></div>';
    var b = $('#trainBody');
    ({ gk: renderGK, speed: renderSpeed, fit: renderFit, match: renderMatch, squad: renderSquad, bounce: renderBounce })[ui.trainSub](b);
  }

  function renderGK(el) {
    var html = seg([['skills', 'Skills'], ['drills', 'Drills'], ['log', 'Session log'], ['coach', 'Coach notes'], ['test', '🧠 Test'], ['calls', 'Calls'], ['videos', '🎬 Clips']], ui.gkSub, 'gksub', 'inner');

    if (ui.gkSub === 'skills') {
      var lowest = SKILLS.slice().sort(function (a, b) { return state.skills[a.id] - state.skills[b.id]; })[0];
      html += '<div class="card"><h3>Skill trackers</h3><p class="muted">Tap the stars to rate yourself honestly. 1 star is just starting, 5 is a real strength. Update after each session.</p>';
      SKILLS.forEach(function (s) {
        var lvl = state.skills[s.id], stars = '';
        for (var i = 1; i <= 5; i++) stars += '<button data-act="skill" data-id="' + s.id + '" data-n="' + i + '" class="' + (i <= lvl ? 'lit' : '') + '" aria-label="' + i + ' stars">⭐</button>';
        html += '<div class="skill"><strong>' + s.icon + ' ' + esc(s.name) + '</strong><div class="muted">' + esc(s.tip) + '</div><div class="stars">' + stars + '</div></div>';
      });
      html += '</div><div class="card tight"><strong>🎯 Your next focus:</strong> ' + esc(lowest.name) + '. <button class="btn small" data-act="gkfilter" data-f="' + lowest.id + '" style="margin-top:8px">See drills for it</button></div>';
    }

    if (ui.gkSub === 'drills') {
      var filters = [['all', 'All']].concat(SKILLS.map(function (s) { return [s.id, s.icon + ' ' + s.name.split(' ')[0]]; }));
      html += '<div class="chips">' + filters.map(function (f) { return '<button class="chip ' + (ui.gkFilter === f[0] ? 'on' : '') + '" data-act="gkfilter" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
      DRILLS.filter(function (d) { return ui.gkFilter === 'all' || d.skill === ui.gkFilter; }).forEach(function (d) {
        var did = claimed('drill:' + d.id);
        html += '<div class="card tight"><details id="drill-' + d.id + '"' + (ui.openDrill === d.id ? ' open' : '') + '>' +
          '<summary><span>' + esc(d.title) + '<span class="tag">' + d.mins + ' mins</span></span></summary><div class="inner">' +
          '<p class="muted"><strong>Kit:</strong> ' + esc(d.kit) + '</p>' +
          '<strong>How to do it</strong><ol>' + d.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
          '<strong>Coaching points</strong><ul>' + d.points.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
          '<button class="btn block ' + (did ? 'done' : 'red') + '" data-act="drilldone" data-id="' + d.id + '">' + (did ? '✔ Done today' : 'I did it! +20 🪙') + '</button>' +
          '</div></details></div>';
      });
    }

    if (ui.gkSub === 'log') {
      html += '<div class="card"><h3>Log a session</h3>' +
        '<label for="logDate">Date</label><input type="date" id="logDate" value="' + isoDate() + '">' +
        '<label for="logFocus">Focus</label><select id="logFocus">' + SKILLS.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') + '<option value="match">Match day</option></select>' +
        '<label for="logGood">What went well?</label><textarea id="logGood" placeholder="e.g. I stayed on my line and set my feet early"></textarea>' +
        '<label for="logBetter">What can I improve?</label><textarea id="logBetter" placeholder="e.g. Release the ball quicker"></textarea>' +
        '<button class="btn red block" style="margin-top:12px" data-act="logsave">Save log +30 🪙</button></div>';
      html += '<div class="card"><h3>My logbook</h3>';
      if (!state.sessions.length) html += '<p class="muted">No entries yet. Your first one earns doubloons!</p>';
      state.sessions.slice(0, 20).forEach(function (s, i) {
        html += '<div class="item"><div class="top"><div><strong>' + fmtDate(s.date) + '</strong> <span class="tag">' + esc(s.focus === 'match' ? 'Match day' : skillName(s.focus)) + '</span></div>' +
          '<button class="btn small ghost" data-act="logdel" data-i="' + i + '" aria-label="Delete entry">🗑️</button></div>' +
          (s.good ? '<div>✅ ' + esc(s.good) + '</div>' : '') + (s.better ? '<div>🔧 ' + esc(s.better) + '</div>' : '') + '</div>';
      });
      html += '</div>';
    }

    if (ui.gkSub === 'coach') {
      html += '<div class="card"><h3>🧠 Coach notes</h3><p class="muted">After each keeper coaching session, write down what your coach said and your one focus for the week.</p>' +
        '<label for="cnDate">Date</label><input type="date" id="cnDate" value="' + isoDate() + '">' +
        '<label for="cnSaid">What my coach told me</label><textarea id="cnSaid" placeholder="e.g. Get set earlier, and take a bigger first step"></textarea>' +
        '<label for="cnFocus">My focus for next week (one thing)</label><input type="text" id="cnFocus" placeholder="e.g. Set before the shot">' +
        '<label for="cnHome">Homework drill</label><input type="text" id="cnHome" placeholder="e.g. First Step Starts, twice this week">' +
        '<button class="btn red block" style="margin-top:12px" data-act="cnsave">Save coach notes +30 🪙</button></div>';
      html += '<div class="card"><h3>Past notes</h3>';
      if (!state.coachNotes.length) html += '<p class="muted">Nothing yet.</p>';
      state.coachNotes.slice(0, 15).forEach(function (n, i) {
        html += '<div class="item"><div class="top"><strong>' + fmtDate(n.date) + '</strong><button class="btn small ghost" data-act="cndel" data-i="' + i + '" aria-label="Delete note">🗑️</button></div>' +
          (n.said ? '<div>💬 ' + esc(n.said) + '</div>' : '') + (n.focus ? '<div>🎯 ' + esc(n.focus) + '</div>' : '') + (n.home ? '<div>📋 ' + esc(n.home) + '</div>' : '') + '</div>';
      });
      html += '</div>';
    }

    if (ui.gkSub === 'calls') html += callsHtml();
    if (ui.gkSub === 'test') html += gkqHtml();

    if (ui.gkSub === 'videos') {
      html += clipsHtml();
      html += '<div class="card"><h3>📂 My match videos</h3><p class="muted">Paste the share links to your Google Drive folders. Tap Save, then Open any time.</p>';
      [['drive1', 'Match videos folder'], ['drive2', 'Training clips folder'], ['drive3', 'Best saves folder']].forEach(function (l) {
        var v = state.links[l[0]];
        html += '<label for="' + l[0] + '">' + l[1] + '</label><input type="url" id="' + l[0] + '" placeholder="https://drive.google.com/..." value="' + esc(v) + '">' +
          '<div class="row" style="margin-top:6px"><button class="btn small" data-act="linksave" data-k="' + l[0] + '">Save</button>' +
          (v ? '<a class="btn small blue" href="' + esc(v) + '" target="_blank" rel="noopener">Open</a>' : '') + '</div>';
      });
      html += '</div><div class="card"><h3>▶️ Keeper channels on YouTube</h3>' +
        GK_CHANNELS.map(function (c) { return '<a class="linkcard" href="' + yt(c.q) + '" target="_blank" rel="noopener"><span class="ico">▶️</span><span>' + esc(c.name) + '<small>Search on YouTube</small></span></a>'; }).join('') + '</div>';
    }
    el.innerHTML = html;
  }

  /* ----- Speed Lab ----- */
  function speedWeekIndex() {
    if (!state.speed.start) return -1;
    return Math.min(5, Math.floor(daysBetween(state.speed.start, isoDate()) / 7));
  }
  function sessionList(items) { return '<ol>' + items.map(function (x) { return '<li><strong>' + esc(x[0]) + '</strong><br><span class="muted">' + esc(x[1]) + '</span></li>'; }).join('') + '</ol>'; }
  function renderSpeed(el) {
    var wk = speedWeekIndex();
    var html = '<div class="card"><h2>⚡ Speed Lab</h2>' +
      '<p>Being tall is a superpower: long reach. Long legs just take a touch longer to get moving, so we train a strong first step over 3 to 5 metres, and a good start position so you are already on your way.</p>' +
      '<p class="muted">Two short sessions a week, about 10 to 15 minutes. Do them on free days, never on club nights and never the day before a match. Wear trainers, use soft ground and have a grown up nearby. Stop if anything hurts.</p></div>';

    if (wk < 0) {
      html += '<div class="card"><h3>Ready to start?</h3><p>Six weeks, three arcs: Foundations, Power, Reaction. Start with a 5 metre test so you can beat it later.</p><button class="btn red block" data-act="speedstart">Start my 6 week voyage</button></div>';
    } else {
      html += '<div class="card"><h3>Week ' + (wk + 1) + ' of 6 <span class="tag red">' + esc(SPEED[wk].arc) + '</span></h3><p class="muted">' + esc(SPEED[wk].focus) + '</p>' +
        '<div class="bar"><i style="width:' + Math.round(((wk + 1) / 6) * 100) + '%"></i></div></div>';
      ['A', 'B'].forEach(function (s) {
        var did = !!state.speed.done[isoDate() + s];
        html += '<div class="card"><h3>Session ' + s + '</h3>' + sessionList(SPEED[wk][s]) +
          '<button class="btn block ' + (did ? 'done' : 'red') + '" data-act="speeddone" data-s="' + s + '">' + (did ? '✔ Done today' : 'Session ' + s + ' done +25 🪙') + '</button></div>';
      });
    }

    // 5 metre test
    var tests = state.speed.tests.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var best = tests.length ? Math.min.apply(null, tests.map(function (t) { return t.t; })) : 0;
    var first = tests.length ? tests[tests.length - 1].t : 0;
    html += '<div class="card"><h3>⏱️ 5 metre test</h3><p class="muted">Mark two lines 5 metres apart. Start in your set position. A grown up starts a phone stopwatch on "Go" and stops it when you cross the line. Take the best of three.</p>' +
      '<label for="spT">Best time (seconds)</label><input type="number" id="spT" step="0.01" min="0.5" max="5" inputmode="decimal" placeholder="e.g. 1.45">' +
      '<button class="btn red block" style="margin-top:10px" data-act="testsave">Save my time +20 🪙</button>';
    if (tests.length) {
      html += '<p style="margin-top:12px"><strong>Best:</strong> ' + best.toFixed(2) + 's' + (tests.length > 1 ? ' &nbsp; <strong>First:</strong> ' + first.toFixed(2) + 's' + (first > best ? ' &nbsp; <span class="tag gold">' + (first - best).toFixed(2) + 's faster!</span>' : '') : '') + '</p>';
      tests.slice(0, 8).forEach(function (t, i) {
        html += '<div class="item"><div class="top"><span>' + fmtDate(t.date) + ' <strong>' + t.t.toFixed(2) + 's</strong></span><button class="btn small ghost" data-act="testdel" data-d="' + t.date + '" data-t="' + t.t + '" aria-label="Delete time">🗑️</button></div>' +
          '<div class="bar blue"><i style="width:' + Math.min(100, Math.round((best / t.t) * 100)) + '%"></i></div></div>';
      });
    }
    html += '</div>';

    html += '<div class="card"><h3>The whole voyage</h3>' + SPEED.map(function (w, i) {
      return '<details' + (i === wk ? ' open' : '') + '><summary><span>Week ' + (i + 1) + '<span class="tag">' + esc(w.arc) + '</span></span></summary><div class="inner"><p class="muted">' + esc(w.focus) + '</p><strong>Session A</strong>' + sessionList(w.A) + '<strong>Session B</strong>' + sessionList(w.B) + '</div></details>';
    }).join('') + '</div>';
    html += '<div class="card tight muted">Research on young athletes says well supervised bodyweight, jumping and speed work is safe and helps, as long as technique is good, loads are light and a qualified adult is involved. Check with your club coach if you are unsure.</div>';
    el.innerHTML = html;
  }

  /* ----- Fitness Lab ----- */
  function buildSession(type, dur) {
    var cfg = FIT[type];
    var items = cfg.warm.slice(0, dur >= 30 ? 2 : 1);
    var used = items.reduce(function (t, x) { return t + x.m; }, 0);
    var budget = dur - used - cfg.cool.m;
    var pools = cfg.pools.map(function (p) { return shuffle(p); });
    var round = 0, safety = 0;
    while (budget > 0 && safety < 40) {
      var pool = pools[round % pools.length];
      var it = pool[Math.floor(round / pools.length) % pool.length];
      if (it.m <= budget + 1 && items.indexOf(it) === -1) { items.push(it); budget -= it.m; }
      round++; safety++;
    }
    items.push(cfg.cool);
    var total = items.reduce(function (t, x) { return t + x.m; }, 0);
    var names = { gym: 'Gym', running: 'Running', stretching: 'Stretching' };
    return { id: Date.now(), title: names[type] + ' session', type: type, mins: total, items: items, note: cfg.note };
  }
  function sessionHtml(s) {
    return '<div class="card"><h3>' + esc(s.title) + ' <span class="tag">' + s.mins + ' mins</span></h3>' +
      '<ol>' + s.items.map(function (x) { return '<li><strong>' + esc(x.n) + '</strong> (' + x.m + ' min)<br><span class="muted">' + esc(x.how) + '</span></li>'; }).join('') + '</ol>' +
      '<p class="muted">⚠️ ' + esc(s.note) + '</p>' +
      '<div class="row"><button class="btn" data-act="fitsave">⭐ Save favourite</button><button class="btn red" data-act="fitdone">Session done +40 🪙</button></div></div>';
  }
  function renderFit(el) {
    var html = seg([['builder', 'Builder'], ['stretch', 'Daily stretch'], ['saved', 'Favourites']], ui.fitSub, 'fitsub', 'inner');
    if (ui.fitSub === 'builder') {
      html += '<div class="card"><h3>Build a session</h3>' +
        '<label>Type</label><div class="chips">' + [['gym', '🏋️ Gym'], ['running', '🏃 Running'], ['stretching', '🧘 Stretching']].map(function (c) { return '<button class="chip ' + (ui.fitType === c[0] ? 'on' : '') + '" data-act="fittype" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
        '<label>Time</label><div class="chips">' + [15, 30, 45, 60].map(function (m) { return '<button class="chip ' + (ui.fitDur === m ? 'on' : '') + '" data-act="fitdur" data-v="' + m + '">' + m + ' mins</button>'; }).join('') + '</div>' +
        '<button class="btn red block" data-act="fitgen">⚓ Build my session</button>' +
        '<p class="muted" style="margin-top:8px">Made for a tall growing keeper: light loads, good technique, and plenty of leg, core and balance work.</p></div>';
      if (ui.cur) html += sessionHtml(ui.cur);
    }
    if (ui.fitSub === 'stretch') {
      html += '<div class="card timer" id="stretchBox">' + stretchHtml() + '</div>' +
        '<div class="card"><h3>The routine</h3><ol>' + STRETCH_ROUTINE.map(function (s) { return '<li><strong>' + esc(s.n) + '</strong><br><span class="muted">' + esc(s.how) + '</span></li>'; }).join('') + '</ol><p class="muted">30 seconds each, gently. Never bounce, and stop if anything hurts.</p></div>';
    }
    if (ui.fitSub === 'saved') {
      if (!state.favs.length) html += '<div class="card"><p class="muted">No favourites yet. Build a session and tap Save favourite.</p></div>';
      state.favs.forEach(function (s, i) {
        html += '<div class="card tight"><details><summary><span>' + esc(s.title) + '<span class="tag">' + s.mins + ' mins</span></span></summary><div class="inner">' +
          '<ol>' + s.items.map(function (x) { return '<li><strong>' + esc(x.n) + '</strong> (' + x.m + ' min)<br><span class="muted">' + esc(x.how) + '</span></li>'; }).join('') + '</ol>' +
          '<div class="row"><button class="btn small red" data-act="fitdone">Done +40 🪙</button><button class="btn small ghost" data-act="favdel" data-i="' + i + '">🗑️ Remove</button></div></div></details></div>';
      });
    }
    el.innerHTML = html;
  }
  function stretchHtml() {
    var s = ui.stretch;
    if (!s) return '<h3>Daily stretch voyage</h3><p class="muted">8 stretches, 30 seconds each. About 4 minutes.</p><button class="btn red block" data-act="stretchstart">▶ Start the routine</button>';
    if (s.done) return '<h3>🎉 Routine complete!</h3><p>Smooth sailing, Captain.</p><button class="btn block" data-act="stretchstart">Go again</button>';
    var st = STRETCH_ROUTINE[s.i];
    return '<div class="muted">Stretch ' + (s.i + 1) + ' of ' + STRETCH_ROUTINE.length + '</div><h3>' + esc(st.n) + '</h3><div class="count">' + s.t + '</div><p>' + esc(st.how) + '</p><button class="btn ghost block" data-act="stretchstop">Stop</button>';
  }
  function paintStretch() { var b = $('#stretchBox'); if (b) b.innerHTML = stretchHtml(); }
  var stretchTimer = null;
  function stopStretch() { clearInterval(stretchTimer); stretchTimer = null; ui.stretch = null; }
  function startStretch() {
    stopStretch();
    ui.stretch = { i: 0, t: 30, done: false };
    paintStretch();
    stretchTimer = setInterval(function () {
      var s = ui.stretch; if (!s) return;
      s.t--;
      if (s.t <= 0) {
        s.i++; s.t = 30;
        if (s.i >= STRETCH_ROUTINE.length) {
          clearInterval(stretchTimer); stretchTimer = null; s.done = true;
          if (claim('stretch', 1)) addXP(25, 'Stretch routine');
        }
      }
      paintStretch();
    }, 1000);
  }

  /* ----- Match day ----- */
  function renderMatch(el) {
    var t = isoDate(), checks = state.matchCheck[t] || {};
    var html = '<div class="card"><h2>🏟️ Match day mode</h2><h3>Pack and prep</h3>' +
      MATCH_CHECK.map(function (c, i) { return '<button class="btn block ' + (checks[i] ? 'done' : 'ghost') + '" style="margin-bottom:8px;justify-content:flex-start" data-act="mcheck" data-i="' + i + '">' + (checks[i] ? '✔ ' : '⬜ ') + esc(c) + '</button>'; }).join('') + '</div>';
    html += '<div class="card"><h3>Your three mission cards</h3>' + MATCH_CARDS.map(function (c) { return '<div class="tile"><div class="badge">' + c.icon + '</div><div><div class="t">' + c.t + '</div><div class="muted">' + esc(c.x) + '</div></div></div>'; }).join('') + '</div>';
    html += '<div class="card"><h3>After the game</h3>' +
      '<label for="mDate">Date</label><input type="date" id="mDate" value="' + t + '">' +
      '<label for="mOpp">Who did we play?</label><input type="text" id="mOpp" placeholder="Team name">' +
      '<div class="grid3"><div><label for="mTalk">Talk (1 to 5)</label><select id="mTalk"><option>3</option><option>1</option><option>2</option><option>4</option><option>5</option></select></div>' +
      '<div><label for="mRel">Release (1 to 5)</label><select id="mRel"><option>3</option><option>1</option><option>2</option><option>4</option><option>5</option></select></div>' +
      '<div><label for="mRes">Reset (1 to 5)</label><select id="mRes"><option>3</option><option>1</option><option>2</option><option>4</option><option>5</option></select></div></div>' +
      '<label for="mQuick">Quick releases (under 3 seconds)</label><input type="number" id="mQuick" min="0" max="99" inputmode="numeric" placeholder="How many?">' +
      '<label for="mBest">Best moment</label><input type="text" id="mBest" placeholder="e.g. Great save in the second half">' +
      '<label for="mBetter">One thing to improve</label><input type="text" id="mBetter" placeholder="e.g. Talk more at corners">' +
      '<button class="btn red block" style="margin-top:12px" data-act="msave">Save match +40 🪙</button></div>';
    html += '<div class="card"><h3>Match history</h3>';
    if (!state.matches.length) html += '<p class="muted">No matches logged yet.</p>';
    state.matches.slice(0, 10).forEach(function (m, i) {
      html += '<div class="item"><div class="top"><div><strong>' + fmtDate(m.date) + '</strong> ' + (m.opp ? 'v ' + esc(m.opp) : '') + '<div class="muted">Talk ' + m.talk + ', Release ' + m.rel + ', Reset ' + m.res + (m.quick !== '' ? ', quick releases ' + esc(m.quick) : '') + '</div></div>' +
        '<button class="btn small ghost" data-act="mdel" data-i="' + i + '" aria-label="Delete match">🗑️</button></div>' +
        (m.best ? '<div>⭐ ' + esc(m.best) + '</div>' : '') + (m.better ? '<div>🔧 ' + esc(m.better) + '</div>' : '') + '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  /* ----- Study ----- */
  var STUDY_SUBS = [['mission', 'Mission'], ['arith', 'Maths'], ['spell', 'Spelling'], ['gps', 'Grammar'], ['read', 'Reading'], ['tools', 'Toolbox'], ['plan', 'SATs plan']];
  function renderStudy() {
    var el = $('#view-study');
    el.innerHTML = '<div class="card tight" style="text-align:center"><div class="kvfig solo">' + figure('study') + '</div></div>' + seg(STUDY_SUBS, ui.studySub, 'studysub') + '<div id="studyBody"></div>';
    var b = $('#studyBody'), s = ui.studySub;
    if (s === 'mission') return studyMission(b);
    if (s === 'arith' || s === 'spell' || s === 'gps') return renderQuiz(b, s);
    if (s === 'read') return studyRead(b);
    if (s === 'tools') return studyTools(b);
    if (s === 'plan') return studyPlan(b);
  }

  function studyMission(el) {
    var day = new Date().getDay(), m = state.study.mission[isoDate()] || {};
    var dts = daysToSats();
    var word = (day === 2 || day === 5) ? { t: 'Spelling spotter', sub: 'spell', x: 'Ten words, five minutes.' } : { t: 'Grammar quickfire', sub: 'gps', x: 'Eight questions with explanations.' };
    var rest = (day === 6);
    var blocks = [
      { k: 'maths', icon: '➕', t: 'Maths blitz (5 min)', x: 'Ten arithmetic questions. Check every wrong answer.', sub: 'arith' },
      { k: 'words', icon: '🔤', t: word.t + ' (5 min)', x: word.x, sub: word.sub },
      { k: 'school', icon: '🟣', t: 'School task', x: 'Open Purple Mash and do your 2Dos from your teacher.', sub: 'tools' },
      { k: 'reading', icon: '📖', t: 'Read for 15 minutes', x: 'A book, a match report, a fishing magazine or a manga.', sub: 'read' }
    ];
    var html = '<div class="card"><h2>🎯 Today\'s study mission</h2>' +
      '<p>' + (rest ? 'Match day: no study today. A bit of reading for fun is plenty.' : 'About 20 minutes in total. Little and often beats long sessions.') + '</p>' +
      (dts > 0 ? '<p class="muted">SATs are on 10 to 13 May 2027, ' + dts + ' days away. You have plenty of time.</p>' : '') + '</div>';
    blocks.forEach(function (b) {
      if (rest && b.k !== 'reading') return;
      var ok = m[b.k];
      html += '<div class="card tight"><div class="tile mind' + (ok ? ' ok' : '') + '"><div class="badge">' + (ok ? '✔' : b.icon) + '</div><div><div class="t">' + esc(b.t) + '</div><div class="muted">' + esc(b.x) + '</div>' +
        '<div class="row" style="margin-top:6px"><button class="btn small blue" data-act="studysub" data-sub="' + b.sub + '">Open</button><button class="btn small ' + (ok ? 'done' : 'red') + '" data-act="mtick" data-k="' + b.k + '">' + (ok ? '✔ Done' : 'Done +10') + '</button></div></div></div></div>';
    });
    html += '<div class="card tight muted">Keep normal life going. Football, fishing, friends and sleep all help your brain work better.</div>';
    el.innerHTML = html;
  }

  /* Quiz engine: arithmetic, spelling and grammar share one flow */
  function genArith(level) {
    var t = rnd(1, 6), a, b, c, x, y;
    if (level === 1) {
      t = rnd(1, 3);
      if (t === 1) { a = rnd(2, 12); b = rnd(2, 12); return { q: a + ' × ' + b, a: a * b }; }
      if (t === 2) { b = rnd(2, 12); c = rnd(2, 12); return { q: (b * c) + ' ÷ ' + b, a: c }; }
      a = rnd(120, 899); b = rnd(100, 499);
      return Math.random() < 0.5 ? { q: a + ' + ' + b, a: a + b } : { q: (a + b) + ' − ' + b, a: a };
    }
    if (level === 2) {
      if (t === 1) { a = rnd(12, 99); b = rnd(3, 9); return { q: a + ' × ' + b, a: a * b }; }
      if (t === 2) { b = rnd(3, 9); c = rnd(12, 99); return { q: (b * c) + ' ÷ ' + b, a: c }; }
      if (t === 3) { var den = pick([2, 3, 4, 5, 8]); var num = rnd(1, den - 1); var amt = den * rnd(3, 12); return { q: num + '/' + den + ' of ' + amt, a: amt / den * num }; }
      if (t === 4) { var p = pick([10, 20, 25, 50]); var base = 20 * rnd(2, 15); return { q: p + '% of ' + base, a: base * p / 100 }; }
      x = rnd(11, 99); y = rnd(11, 99);
      if (t === 5) return { q: (x / 10).toFixed(1) + ' + ' + (y / 10).toFixed(1), a: (x + y) / 10 };
      if (x < y) { var tmp = x; x = y; y = tmp; }
      return { q: (x / 10).toFixed(1) + ' − ' + (y / 10).toFixed(1), a: (x - y) / 10 };
    }
    if (t === 1) { a = rnd(101, 499); b = rnd(11, 39); return { q: a + ' × ' + b, a: a * b }; }
    if (t === 2) { var ai = rnd(111, 999), m = pick([10, 100]); return { q: (ai / 100).toFixed(2) + ' × ' + m, a: ai * m / 100 }; }
    if (t === 3) { var p2 = pick([5, 15, 35, 45, 75]); var base2 = 40 * rnd(2, 25); return { q: p2 + '% of ' + base2, a: base2 * p2 / 100 }; }
    if (t === 4) { var d2 = pick([6, 7, 9, 11, 12]); var n2 = rnd(1, d2 - 1); var amt2 = d2 * rnd(3, 12); return { q: n2 + '/' + d2 + ' of ' + amt2, a: amt2 / d2 * n2 }; }
    if (t === 5) { a = rnd(1000, 9999); b = rnd(1000, a); return Math.random() < 0.5 ? { q: a + ' − ' + b, a: a - b } : { q: a + ' + ' + b, a: a + b }; }
    a = rnd(2, 30); b = rnd(2, 9); c = rnd(2, 9);
    return { q: a + ' + ' + b + ' × ' + c, a: a + b * c };
  }
  function speak(w) {
    try {
      if (!window.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(w); u.lang = 'en-GB'; u.rate = 0.8;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (e) { /* no speech available */ }
  }
  function startQuiz(kind, level) {
    var qs = [], i;
    if (kind === 'arith') { for (i = 0; i < 10; i++) qs.push(genArith(level)); }
    if (kind === 'spell') { qs = shuffle(SPELL).slice(0, 10).map(function (w) { return { w: w }; }); }
    if (kind === 'gps') { qs = shuffle(GPS).slice(0, 8); }
    ui.quiz = { kind: kind, level: level, qs: qs, i: 0, score: 0, fb: null, done: false };
    if (kind === 'spell') speak(qs[0].w);
  }
  var QUIZ_NAMES = { arith: 'Maths blitz', spell: 'Spelling spotter', gps: 'Grammar quickfire' };
  function lastScores(kind) {
    return state.study.scores.filter(function (s) { return s.kind === kind; }).slice(0, 5);
  }
  function renderQuiz(el, kind) {
    var q = ui.quiz, html = '';
    if (!q || q.kind !== kind) {
      html = '<div class="card"><h2>' + (kind === 'arith' ? '➕' : kind === 'spell' ? '🔊' : '📝') + ' ' + QUIZ_NAMES[kind] + '</h2>';
      if (kind === 'arith') {
        html += '<p>Ten questions, no calculator. Pick a level:</p><div class="chips">' + [[1, 'Level 1: Tables and number facts'], [2, 'Level 2: Skills'], [3, 'Level 3: Challenge']].map(function (l) { return '<button class="chip" data-act="qstart" data-kind="arith" data-level="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>';
      } else if (kind === 'spell') {
        html += '<p>Ten words from the Year 5 and 6 spelling list. Listen, then type the word.</p><button class="btn red block" data-act="qstart" data-kind="spell" data-level="1">Start listening</button><p class="muted" style="margin-top:8px">Turn the volume up. If you cannot hear anything, the word length will show as a hint.</p>';
      } else {
        html += '<p>Eight quick questions with a short explanation after each one.</p><button class="btn red block" data-act="qstart" data-kind="gps" data-level="1">Start</button>';
      }
      var ls = lastScores(kind);
      html += '</div>';
      if (ls.length) {
        html += '<div class="card"><h3>Recent scores</h3>' + ls.map(function (s) { return '<div class="item"><div class="top"><span>' + fmtDate(s.date) + (kind === 'arith' ? ' (level ' + s.level + ')' : '') + '</span><strong>' + s.score + ' out of ' + s.out + '</strong></div><div class="bar blue"><i style="width:' + Math.round(s.score / s.out * 100) + '%"></i></div></div>'; }).join('') + '</div>';
      }
      el.innerHTML = html; return;
    }
    if (q.done) {
      var out = q.qs.length, pct = Math.round(q.score / out * 100);
      html = '<div class="card qbox"><h2>Finished!</h2><div class="q">' + q.score + ' out of ' + out + '</div><div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<p>' + (pct >= 90 ? 'Brilliant! Top marks, Captain!' : pct >= 60 ? 'Great work. Keep going and it will get even better.' : 'Good effort. Mistakes are how you learn. Try again tomorrow.') + '</p>' +
        '<div class="row" style="justify-content:center"><button class="btn red" data-act="qstart" data-kind="' + q.kind + '" data-level="' + q.level + '">Play again</button><button class="btn ghost" data-act="qquit">Back</button></div></div>';
      el.innerHTML = html; return;
    }
    var cur = q.qs[q.i], head = '<div class="muted" style="text-align:center">Question ' + (q.i + 1) + ' of ' + q.qs.length + ' &nbsp; Score ' + q.score + '</div><div class="bar blue"><i style="width:' + Math.round(q.i / q.qs.length * 100) + '%"></i></div>';
    if (q.kind === 'arith') {
      html = '<div class="card qbox">' + head + '<div class="q">' + esc(cur.q) + ' =</div>' +
        '<input type="text" id="qAns" class="bigin" inputmode="decimal" autocomplete="off" ' + (q.fb ? 'disabled value="' + esc(q.fb.given) + '"' : '') + '>' +
        (q.fb ? '<div class="fb ' + (q.fb.ok ? 'ok' : 'no') + '">' + (q.fb.ok ? 'Correct!' : 'Not quite. The answer is ' + cur.a) + '</div><button class="btn red block" data-act="qnext">' + (q.i + 1 >= q.qs.length ? 'See my score' : 'Next question') + '</button>' : '<button class="btn red block" style="margin-top:10px" data-act="qcheck">Check</button>') + '</div>';
    } else if (q.kind === 'spell') {
      var hint = window.speechSynthesis ? '' : '<p class="muted">Hint: ' + cur.w.length + ' letters, starts with ' + esc(cur.w.charAt(0)) + '</p>';
      html = '<div class="card qbox">' + head + '<div class="q">🔊 Listen</div><button class="btn blue" data-act="qspeak">Hear it again</button>' + hint +
        '<input type="text" id="qAns" class="bigin" style="margin-top:12px" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" ' + (q.fb ? 'disabled value="' + esc(q.fb.given) + '"' : '') + '>' +
        (q.fb ? '<div class="fb ' + (q.fb.ok ? 'ok' : 'no') + '">' + (q.fb.ok ? 'Correct!' : 'Not quite. It is spelt: ' + esc(cur.w)) + '</div><button class="btn red block" data-act="qnext">' + (q.i + 1 >= q.qs.length ? 'See my score' : 'Next word') + '</button>' : '<button class="btn red block" style="margin-top:10px" data-act="qcheck">Check</button>') + '</div>';
    } else {
      html = '<div class="card">' + head + '<h3 style="margin:10px 0">' + esc(cur.q) + '</h3>' +
        cur.o.map(function (o, i) {
          var cls = '';
          if (q.fb) { if (i === cur.a) cls = ' right'; else if (i === q.fb.pick) cls = ' wrong'; }
          return '<button class="btn opt' + cls + '" data-act="qpick" data-i="' + i + '"' + (q.fb ? ' disabled' : '') + '>' + esc(o) + '</button>';
        }).join('') +
        (q.fb ? '<div class="fb ' + (q.fb.ok ? 'ok' : 'no') + '">' + (q.fb.ok ? 'Correct! ' : 'Not quite. ') + esc(cur.e) + '</div><button class="btn red block" data-act="qnext">' + (q.i + 1 >= q.qs.length ? 'See my score' : 'Next question') + '</button>' : '') + '</div>';
    }
    el.innerHTML = html;
    var inp = $('#qAns'); if (inp && !q.fb) inp.focus();
  }
  function finishQuiz() {
    var q = ui.quiz; q.done = true;
    state.study.scores.unshift({ date: isoDate(), kind: q.kind, level: q.level, score: q.score, out: q.qs.length });
    state.study.scores = state.study.scores.slice(0, 60);
    save();
    if (claim('quiz:' + q.kind, 3)) addXP(10 + q.score * 2, QUIZ_NAMES[q.kind]);
  }

  function studyRead(el) {
    var tot = 0, weekAgo = isoDate(new Date(Date.now() - 6 * 86400000));
    state.study.reading.forEach(function (r) { if (r.date >= weekAgo) tot += r.mins; });
    var html = '<div class="card"><h2>📖 Reading quest</h2><p>Read for about 15 minutes a day. Reading is half the battle for the English tests, and it is great downtime. Match reports, fishing magazines, manga and novels all count.</p>' +
      '<div class="bar"><i style="width:' + Math.min(100, Math.round(tot / 105 * 100)) + '%"></i></div><div class="muted">' + tot + ' of 105 minutes this week</div></div>' +
      '<div class="card"><h3>Log my reading</h3><label for="rBook">What did I read?</label><input type="text" id="rBook" placeholder="Book or magazine"><label for="rMins">Minutes</label><input type="number" id="rMins" inputmode="numeric" min="1" max="180" placeholder="15">' +
      '<button class="btn red block" style="margin-top:10px" data-act="readsave">Save reading +15 🪙</button></div>';
    html += '<div class="card"><h3>Answering reading questions: VIPERS</h3>' + VIPERS.map(function (v) { return '<div class="tile"><div class="badge">' + v[0] + '</div><div><div class="t">' + esc(v[1]) + '</div><div class="muted">' + esc(v[2]) + '</div></div></div>'; }).join('') + '<p class="muted">Always go back to the text for proof, and write answers in full sentences.</p></div>';
    html += '<div class="card"><h3>Recent reading</h3>';
    if (!state.study.reading.length) html += '<p class="muted">Nothing logged yet.</p>';
    state.study.reading.slice(0, 8).forEach(function (r, i) { html += '<div class="item"><div class="top"><span>' + fmtDate(r.date) + ': <strong>' + esc(r.book || 'Reading') + '</strong> (' + r.mins + ' min)</span><button class="btn small ghost" data-act="readdel" data-i="' + i + '" aria-label="Delete">🗑️</button></div></div>'; });
    html += '</div>';
    el.innerHTML = html;
  }

  function studyTools(el) {
    var html = '<div class="card"><h2>🧰 Study toolbox</h2><p class="muted">Start with what school gives you (Purple Mash and Times Tables Rock Stars logins), then add free extras. You do not need them all.</p></div>';
    TOOLS.forEach(function (t) {
      html += '<a class="linkcard" href="' + esc(t.url) + '" target="_blank" rel="noopener"><span class="ico">' + t.icon + '</span><span>' + esc(t.name) + '<span class="tag gold">' + esc(t.tag) + '</span><small>' + esc(t.note) + '</small></span></a>';
    });
    html += '<div class="card tight muted">Check prices and trials with a grown up before signing up to anything.</div>';
    el.innerHTML = html;
  }

  function studyPlan(el) {
    var dts = daysToSats();
    var html = '<div class="card"><h2>🗓️ The SATs plan</h2>' + (dts > 0 ? '<div class="bounty" style="text-align:center">' + dts + '<small>DAYS TO SATS WEEK</small></div>' : '') +
      '<p><strong>Tests:</strong> Monday 10 May to Thursday 13 May 2027.</p>' +
      '<ul><li>Monday: Grammar, punctuation and spelling (two papers)</li><li>Tuesday: Reading</li><li>Wednesday: Maths papers 1 and 2 (arithmetic and reasoning)</li><li>Thursday: Maths paper 3 (reasoning)</li></ul>' +
      '<p class="muted">Reading is 60 minutes. Arithmetic is 30 minutes. Each reasoning paper is 40 minutes. There is no writing test: your teacher judges your writing from the year. Scores run from 80 to 120 and 100 means working at the expected standard. There is no pass or fail. Results go to schools on 6 July 2027. Facts checked in November 2026 against GOV.UK and school guidance.</p></div>';
    html += '<div class="card"><h3>Four arcs to May</h3>' + ARCS.map(function (a) { return '<div class="tile mind"><div class="badge">📅</div><div><div class="t">' + esc(a.name) + ' <span class="tag">' + esc(a.when) + '</span></div><div class="muted">' + esc(a.todo) + '</div></div></div>'; }).join('') + '</div>';
    html += '<div class="card"><h3>What works best</h3><ul>' +
      '<li>Short and often: 10 to 20 minutes, not marathon sessions.</li>' +
      '<li>Test yourself with questions instead of just rereading.</li>' +
      '<li>Spread practice out over weeks. Mix maths, spelling and reading.</li>' +
      '<li>Spend more time on mistakes than on the questions you get right.</li>' +
      '<li>Keep football, fishing, friends and sleep going. They help your brain.</li></ul></div>';
    html += '<div class="card"><h3>For parents and carers</h3><ul>' +
      '<li>Ten minutes together beats an hour of nagging. Ask him to teach you a topic.</li>' +
      '<li>Praise effort and the way he fixes mistakes, not just scores.</li>' +
      '<li>Keep the tone calm. Children soak up the mood at home.</li>' +
      '<li>If worry grows, talk to his teacher. Purple Mash and his teacher will know exactly where to focus.</li></ul></div>';
    el.innerHTML = html;
  }

  /* ----- Chill: fishing, calm corner, media ----- */
  var CHILL_SUBS = [['fish', '🎣 Fishing'], ['calm', '🌊 Calm corner'], ['media', '📺 Media']];
  function renderChill() {
    var el = $('#view-chill');
    var header = ui.chillSub === 'fish' ? '<div class="card tight" style="text-align:center"><div class="kvfig solo">' + figure('fishing') + '</div></div>' : '';
    el.innerHTML = header + seg(CHILL_SUBS, ui.chillSub, 'chillsub') + '<div id="chillBody"></div>';
    var b = $('#chillBody');
    ({ fish: renderFish, calm: renderCalm, media: renderMedia })[ui.chillSub](b);
  }

  function renderFish(el) {
    var html = seg([['species', 'Species'], ['method', 'Method feeder'], ['knots', 'Knots'], ['where', 'My waters'], ['catches', 'Catch log']], ui.fishSub, 'fishsub', 'inner');

    if (ui.fishSub === 'species') {
      SPECIES.forEach(function (s) {
        html += '<div class="card"><h2>' + s.icon + ' ' + esc(s.name) + ' <span class="tag red">' + esc(s.tag) + '</span></h2>' +
          '<div class="diagram">📷 Picture placeholder: add a photo of a ' + esc(s.name.toLowerCase()) + '</div>' +
          s.facts.map(function (f) { return '<p><strong>' + esc(f[0]) + ':</strong> ' + esc(f[1]) + '</p>'; }).join('') +
          '<strong>Top tips</strong><ul>' + s.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
      });
      html += '<div class="card tight">🌊 ' + esc(FISH_CARE) + '</div>';
    }
    if (ui.fishSub === 'method') {
      html += '<div class="card"><h2>Method feeder</h2><h3>Setup</h3><ol>' + METHOD.setup.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
        '<div class="diagram"><img src="assets/method_rig.png" alt="Method feeder rig diagram" style="max-width:100%;height:auto;border-radius:8px"></div>' +
        '<h3>Bait</h3><ul>' + METHOD.bait.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        '<h3>Tips</h3><ul>' + METHOD.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    }
    if (ui.fishSub === 'knots') {
      KNOTS.forEach(function (k) {
        html += '<div class="card tight"><details><summary><span>' + esc(k.name) + '</span></summary><div class="inner"><p class="muted">' + esc(k.use) + '</p>' +
          '<div class="diagram">🖼️ Diagram placeholder: ' + esc(k.name) + '</div><ol>' + k.steps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
          '<p class="muted">Always wet the line, pull slowly, and test every knot before casting.</p></div></details></div>';
      });
    }
    if (ui.fishSub === 'where') {
      var fished = WATERS.filter(function (w) { return state.venues[w.id] && state.venues[w.id].fished; }).length;
      html += '<div class="card"><h2>🗺️ My five waters</h2><p class="muted">Collect them all! Tick each one when you have fished it. ' + fished + ' of 5 so far.</p><div class="bar"><i style="width:' + (fished * 20) + '%"></i></div></div>';
      WATERS.forEach(function (w) {
        var v = state.venues[w.id] || {};
        html += '<div class="card tight"><div class="top item" style="border:0;padding:0"><div><h3>' + esc(w.name) + '</h3><div class="muted">' + esc(w.place) + '</div></div><span style="font-size:1.6rem">' + (v.fished ? '🏆' : '🎣') + '</span></div>' +
          '<div class="row" style="margin:8px 0"><button class="btn small ' + (v.fished ? 'done' : 'red') + '" data-act="fished" data-id="' + w.id + '">' + (v.fished ? '✔ Fished here' : 'I fished here! +30') + '</button>' +
          '<a class="btn small blue" href="' + mapsUrl(w.q) + '" target="_blank" rel="noopener">Map</a></div>' +
          '<label for="vn-' + w.id + '">My notes</label><input type="text" id="vn-' + w.id + '" placeholder="Best swim, bait, who to ask" value="' + esc(v.note || '') + '">' +
          '<button class="btn small ghost" style="margin-top:6px" data-act="vnote" data-id="' + w.id + '">Save note</button>' +
          '<p class="muted" style="margin-top:6px">Check prices, rules and junior policy with the venue before you go.</p></div>';
      });
      var list = VENUES.filter(function (v) { return (ui.whereSpecies === 'all' || v.species.indexOf(ui.whereSpecies) > -1) && (ui.whereCost === 'all' || v.cost === ui.whereCost); });
      html += '<div class="card"><h3>Other places to try</h3><div class="chips">' + [['all', 'Any cost'], ['free', 'Free or low cost'], ['ticket', 'Day ticket'], ['member', 'Club']].map(function (c) { return '<button class="chip ' + (ui.whereCost === c[0] ? 'on' : '') + '" data-act="wherefilter" data-f="cost" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>';
      list.forEach(function (v) { html += '<div class="item"><strong>' + esc(v.name) + '</strong><div>' + esc(v.why) + '</div><div class="muted">⚠️ ' + esc(v.check) + '</div></div>'; });
      html += '</div>';
      html += '<div class="card"><h3>🔎 Search near you</h3>' +
        '<a class="linkcard" href="' + mapsUrl('day ticket fishery near me') + '" target="_blank" rel="noopener"><span class="ico">📍</span><span>Day ticket fisheries<small>Opens maps</small></span></a>' +
        '<a class="linkcard" href="' + mapsUrl('fishing tackle shop near me') + '" target="_blank" rel="noopener"><span class="ico">🛒</span><span>Tackle shops<small>Ask about junior sessions</small></span></a>' +
        '<a class="linkcard" href="https://anglingtrust.net/getfishing" target="_blank" rel="noopener"><span class="ico">🎖️</span><span>Get Fishing (Angling Trust)<small>Free events and the CAST skills awards</small></span></a></div>';
      html += '<div class="card tight">🌊 Always fish with a grown up near water and follow the venue rules. In England, anglers under 13 do not need a rod licence, but a grown up who takes hold of the rod to help needs one.</div>';
    }
    if (ui.fishSub === 'catches') {
      html += '<div class="card"><h3>🏆 Log a catch</h3>' +
        '<label for="cSpecies">Species</label><select id="cSpecies"><option>Carp</option><option>Tench</option><option>Other</option></select>' +
        '<label for="cWeight">Weight (optional)</label><input type="text" id="cWeight" placeholder="e.g. 6 lb 4 oz">' +
        '<label for="cBait">Bait and rig</label><input type="text" id="cBait" placeholder="e.g. 6 mm wafter, method feeder">' +
        '<label for="cWhere">Where</label><input type="text" id="cWhere" placeholder="Venue and swim">' +
        '<button class="btn red block" style="margin-top:12px" data-act="catchsave">Add to treasure chest +40 🪙</button></div>';
      html += '<div class="card"><h3>🧰 Treasure chest (' + state.catches.length + ')</h3>';
      if (!state.catches.length) html += '<p class="muted">Empty for now. Go and fill it!</p>';
      state.catches.slice(0, 30).forEach(function (c, i) {
        html += '<div class="item"><div class="top"><div><strong>' + esc(c.species) + '</strong> ' + (c.weight ? '<span class="tag gold">' + esc(c.weight) + '</span>' : '') + '<div class="muted">' + fmtDate(c.date) + (c.where ? ' at ' + esc(c.where) : '') + '</div>' + (c.bait ? '<div>' + esc(c.bait) + '</div>' : '') + '</div>' +
          '<button class="btn small ghost" data-act="catchdel" data-i="' + i + '" aria-label="Delete catch">🗑️</button></div></div>';
      });
      html += '</div>';
    }
    html += '<div class="card"><h3>▶️ Learn from the pros</h3>' + FISH_CHANNELS.map(function (c) { return '<a class="linkcard" href="' + yt(c.q) + '" target="_blank" rel="noopener"><span class="ico">▶️</span><span>' + esc(c.name) + '<small>Search on YouTube</small></span></a>'; }).join('') + '</div>';
    el.innerHTML = html;
  }

  var BREATH_PHASES = [['Breathe in', 'big'], ['Hold', 'big'], ['Breathe out', 'small'], ['Hold', 'small']];
  function renderCalm(el) {
    var html = '<div class="card timer"><h2>🌊 Calm corner</h2><p class="muted">Box breathing: in for 4, hold for 4, out for 4, hold for 4. Four rounds. Great before a test or a match.</p>' +
      '<div class="breath small" id="breathBall">Ready?</div><div id="breathBtn"><button class="btn red block" data-act="breathstart">Start breathing</button></div></div>';
    html += '<div class="card"><h3>⭐ Win of the day</h3><p class="muted">Write one good thing about today, big or small.</p><input type="text" id="winTxt" placeholder="e.g. I stayed calm after a mistake"><button class="btn block" style="margin-top:10px" data-act="winsave">Save my win +10 🪙</button>';
    state.wins.slice(0, 5).forEach(function (w, i) { html += '<div class="item"><div class="top"><span>' + fmtDate(w.date) + ': ' + esc(w.text) + '</span><button class="btn small ghost" data-act="windel" data-i="' + i + '" aria-label="Delete">🗑️</button></div></div>'; });
    html += '</div>';
    html += '<div class="card"><h3>🎲 Downtime picker</h3><p class="muted">Cannot decide what to do? Let the compass choose.</p><button class="btn blue block" data-act="pick">Pick for me</button>' + (ui.pick ? '<div class="banner" style="margin:12px 0 0">' + esc(ui.pick) + '</div>' : '') + '</div>';
    html += '<div class="card"><h3>😴 Sleep and recovery</h3><ul><li>Most children your age need about 9 to 12 hours of sleep.</li><li>Sleep is when muscles repair and your brain stores what you learned.</li><li>Screens off for the last hour before bed, and a regular bedtime, especially before match day.</li><li>On club nights, have a snack and wind down gently when you get home.</li></ul></div>';
    el.innerHTML = html;
  }
  var breathTimer = null;
  function stopBreath() { clearInterval(breathTimer); breathTimer = null; ui.breath = null; }
  function startBreath() {
    stopBreath();
    ui.breath = { step: 0 };
    var ball = $('#breathBall'), btn = $('#breathBtn');
    function paint() {
      var s = ui.breath; if (!s || !ball) return;
      var ph = BREATH_PHASES[s.step % 4];
      ball.className = 'breath ' + ph[1]; ball.textContent = ph[0];
    }
    if (btn) btn.innerHTML = '<button class="btn ghost block" data-act="breathstop">Stop</button>';
    paint();
    breathTimer = setInterval(function () {
      var s = ui.breath; if (!s) return;
      s.step++;
      if (s.step >= 16) {
        stopBreath();
        if (ball) { ball.className = 'breath small'; ball.textContent = 'Well done'; }
        if (btn) btn.innerHTML = '<button class="btn red block" data-act="breathstart">Go again</button>';
        if (claim('calm', 1)) addXP(10, 'Calm corner');
        return;
      }
      paint();
    }, 4000);
  }

  function renderMedia(el) {
    el.innerHTML =
      '<a class="linkcard hero-link" href="https://www.bbc.co.uk/iplayer/episodes/b08lvm1b/jamie-johnson" target="_blank" rel="noopener"><span class="ico">⚽</span><span>Jamie Johnson on BBC iPlayer<small>Watch the football drama. A UK TV licence may be needed.</small></span></a>' +
      '<div class="card"><h3>🧤 Goalkeeper videos</h3>' + GK_CHANNELS.map(function (c) { return '<a class="linkcard" href="' + yt(c.q) + '" target="_blank" rel="noopener"><span class="ico">▶️</span><span>' + esc(c.name) + '<small>YouTube</small></span></a>'; }).join('') + '</div>' +
      '<div class="card"><h3>🎣 Fishing videos</h3>' + FISH_CHANNELS.map(function (c) { return '<a class="linkcard" href="' + yt(c.q) + '" target="_blank" rel="noopener"><span class="ico">▶️</span><span>' + esc(c.name) + '<small>YouTube</small></span></a>'; }).join('') + '</div>' +
      '<div class="card"><h3>🏴‍☠️ Pirate adventure fun</h3>' +
        '<a class="linkcard" href="https://www.netflix.com/search?q=one%20piece" target="_blank" rel="noopener"><span class="ico">⚓</span><span>One Piece on Netflix<small>Search on Netflix, where available</small></span></a>' +
        '<a class="linkcard" href="https://www.disneyplus.com" target="_blank" rel="noopener"><span class="ico">🏰</span><span>Disney Plus<small>Pirate and adventure films</small></span></a></div>' +
      '<div class="card tight muted">Links open the real websites in your browser. Ask a grown up before watching or signing in anywhere.</div>';
  }

  /* ----- Ask the Coach ----- */
  function coachAnswer(q) {
    var text = q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    var scored = COACH.map(function (e) {
      var sc = 0;
      e.k.forEach(function (kw) {
        if (kw.indexOf(' ') > -1) { if (text.indexOf(kw) > -1) sc += 3; }
        else if (new RegExp('\\b' + kw + '\\b').test(text)) sc += 2;
        else if (kw.length > 4 && text.indexOf(kw) > -1) sc += 1;
      });
      return { e: e, s: sc };
    }).sort(function (a, b) { return b.s - a.s; });
    return scored[0].s > 0 ? scored[0].e : null;
  }
  function renderCoach() {
    var el = $('#view-coach');
    var chat = ui.chat.map(function (m) {
      if (m.me) return '<div class="bubble me">' + esc(m.text) + '</div>';
      var btns = (m.go || []).map(function (g) { return '<button class="btn small blue" ' + goAttrs(g) + '>' + esc(g.t) + '</button>'; }).join('');
      return '<div class="bubble coach"><p>🦜 ' + esc(m.text) + '</p>' + (btns ? '<div class="row">' + btns + '</div>' : '') + '</div>';
    }).join('');
    el.innerHTML = '<h2 class="on-sea">🦜 Ask the Coach</h2>' +
      '<div class="card tight"><p style="margin:0">Ask about goalkeeping, fishing, fitness or study. I will point you to the right drill, guide or game.</p></div>' +
      '<div class="chat" id="chat">' + chat + '</div>' +
      '<div class="card"><label for="coachQ">Your question</label><input type="text" id="coachQ" placeholder="e.g. How do I get quicker at distribution?" autocomplete="off">' +
      '<button class="btn red block" style="margin-top:10px" data-act="ask">Ask the coach</button>' +
      '<div class="chips" style="margin-top:12px">' + COACH_SUGGEST.map(function (s) { return '<button class="chip" data-act="chip" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div></div>';
    var c = $('#chat'); if (c && c.lastElementChild) c.lastElementChild.scrollIntoView({ block: 'nearest' });
  }
  function ask(q) {
    q = (q || '').trim(); if (!q) return;
    ui.chat.push({ me: true, text: q });
    var e = coachAnswer(q);
    ui.chat.push(e ? { text: e.a, go: e.go } : { text: 'Good question! I do not have a ready answer for that one yet. Try asking about distribution, angles, footwork, first step speed, SATs, spelling, a method feeder rig, knots, or fitness. Your coach, teacher or a grown up is also a great person to ask.', go: [] });
    ui.chat = ui.chat.slice(-8);
    renderCoach();
  }

  /* ---------- Navigation ---------- */
  var RENDER = { home: renderHome, train: renderTrain, study: renderStudy, chill: renderChill, coach: renderCoach };
  function show(view) {
    if (!(view === 'train' && ui.trainSub === 'fit')) stopStretch();
    if (view !== 'chill' || ui.chillSub !== 'calm') stopBreath();
    ui.view = view;
    $all('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
    $all('.tab').forEach(function (t) { t.classList.toggle('on', t.dataset.view === view); });
    RENDER[view]();
    window.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* ignore */ }
  }
  // Maps the many "go" targets (gk, speed, fish...) onto the five main tabs
  function navigate(d) {
    var v = d.view;
    if (v === 'gk' || v === 'speed' || v === 'fit' || v === 'match' || v === 'squad' || v === 'bounce') {
      ui.trainSub = v;
      if (v === 'gk' && d.sub) ui.gkSub = d.sub;
      if (v === 'fit') { if (d.sub) ui.fitSub = d.sub; if (d.type) ui.fitType = d.type; }
      v = 'train';
    } else if (v === 'fish' || v === 'calm' || v === 'media') {
      ui.chillSub = v;
      if (v === 'fish' && d.sub) ui.fishSub = d.sub;
      v = 'chill';
    } else if (v === 'study') {
      if (d.sub) ui.studySub = d.sub;
    }
    ui.openDrill = d.drill || null;
    if (d.drill) { ui.gkFilter = 'all'; ui.gkSub = 'drills'; ui.trainSub = 'gk'; }
    show(v);
    if (d.drill) { var el = $('#drill-' + d.drill); if (el) { el.open = true; el.scrollIntoView({ block: 'center' }); } }
  }

  /* ---------- 4. EVENTS (one listener for the whole app) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var act = t.dataset.act, d = t.dataset;

    if (act === 'music') {
      var box = $('#musicPlayer'), body = $('#musicBody');
      if (!box || !body) return;
      var url = state.spotify || '';
      var embed = '';
      if (url && url.indexOf('spotify.com') !== -1) {
        var id = url.split('/').pop().split('?')[0];
        var type = url.indexOf('/playlist/') !== -1 ? 'playlist' : url.indexOf('/album/') !== -1 ? 'album' : 'track';
        embed = '<iframe src="https://open.spotify.com/embed/' + type + '/' + id + '" width="100%" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>';
      }
      body.innerHTML = embed || '<p>Paste a Spotify playlist link in Captain settings, then open Tunes again.</p><button class="btn block" data-act="go" data-view="home">Open settings</button>';
      box.hidden = false;
      return;
    }
    if (act === 'musicclose') {
      var box2 = $('#musicPlayer'); if (box2) box2.hidden = true;
      return;
    }
    if (act === 'go') { navigate(d); return; }
    if (act === 'trainsub') { ui.trainSub = d.sub; if (d.sub !== 'fit') stopStretch(); renderTrain(); return; }
    if (act === 'chillsub') { ui.chillSub = d.sub; if (d.sub !== 'calm') stopBreath(); renderChill(); return; }
    if (act === 'studysub') { ui.studySub = d.sub; if (!ui.quiz || ui.quiz.kind !== d.sub) ui.quiz = null; renderStudy(); return; }

    // Deck
    if (act === 'tri') {
      var today = isoDate(); state.tri[today] = state.tri[today] || {};
      if (state.tri[today][d.k]) { toast('Already done today. Well played!'); return; }
      state.tri[today][d.k] = true; save();
      var all = state.tri[today].body && state.tri[today].mind && state.tri[today].chill;
      addXP(20, 'Quest done');
      if (all && claim('triple', 1)) { state.xp += 30; save(); updatePills(); setTimeout(function () { sfx('TRIPLE!'); toast('Triple threat bonus +30 🪙'); }, 900); }
      renderHome(); return;
    }
    if (act === 'savesettings') {
      if ($('#setName')) state.name = $('#setName').value.trim() || 'Ell'; if ($('#setDream')) state.dream = $('#setDream').value.trim(); if ($('#setGil')) state.gileroDay = $('#setGil').value; if ($('#setMute')) state.mute = $('#setMute').checked; if ($('#setKit')) state.kit = $('#setKit').value; state.spotify = ($('#setSpotify') || {}).value || ''; save(); toast('Saved'); renderHome(); return;
    }
    if (act === 'clearavatar') { state.avatar = ''; save(); renderHome(); return; }
    if (act === 'export') { $('#backupBox').value = JSON.stringify(state); toast('Copy the text and keep it safe'); return; }
    if (act === 'import') {
      try { var obj = JSON.parse($('#backupBox').value); if (typeof obj !== 'object' || obj === null || typeof obj.xp !== 'number') throw new Error('bad'); state = Object.assign(clone(DEFAULTS), obj); save(); updatePills(); toast('Restored'); renderHome(); } catch (err) { toast('That backup text did not work'); }
      return;
    }



    if (act === 'mood') { state.mood = { date: isoDate(), v: d.v }; save(); touchStreak(); save(); updatePills(); renderHome(); return; }
    if (act === 'gkqstart') { ui.gkq = { qs: shuffle(GKQ).slice(0, 8), i: 0, score: 0, fb: null, done: false }; renderTrain(); return; }
    if (act === 'gkqpick') {
      var g = ui.gkq; if (!g || g.fb) return; var gok = +d.i === g.qs[g.i].a; if (gok) g.score++; g.fb = { ok: gok, pick: +d.i }; renderTrain(); return;
    }
    if (act === 'gkqnext') {
      var g2 = ui.gkq; if (!g2) return; g2.fb = null; g2.i++;
      if (g2.i >= g2.qs.length) { g2.done = true; state.study.scores.unshift({ date: isoDate(), kind: 'gk', level: 1, score: g2.score, out: g2.qs.length }); state.study.scores = state.study.scores.slice(0, 60); save(); if (claim('gkquiz', 3)) addXP(10 + g2.score * 3, 'Keeper test'); }
      renderTrain(); return;
    }
    if (act === 'clipsave') {
      var cn = $('#clipNote').value.trim(); if (!cn) { toast('Write what you noticed'); return; }
      state.clipNotes.unshift({ date: isoDate(), title: $('#clipTitle').value.trim(), note: cn }); save();
      if (claim('clip', 3)) addXP(10, 'Clip notes'); else toast('Saved');
      renderTrain(); return;
    }
    if (act === 'clipdel') { state.clipNotes.splice(+d.i, 1); save(); renderTrain(); return; }

    if (act === 'callstart') { ui.callQ = { i: 0, score: 0, fb: null, done: false }; renderTrain(); return; }
    if (act === 'callpick') {
      var cq = ui.callQ; if (!cq || cq.fb) return;
      var okc = +d.i === CALL_SCENES[cq.i].a; if (okc) cq.score++; cq.fb = { ok: okc, pick: +d.i }; renderTrain(); return;
    }
    if (act === 'callnext') {
      var cq2 = ui.callQ; if (!cq2) return; cq2.fb = null; cq2.i++;
      if (cq2.i >= CALL_SCENES.length) { cq2.done = true; if (claim('calls', 2)) addXP(10 + cq2.score * 3, 'Calls practised'); }
      renderTrain(); return;
    }
    if (act === 'sbsave') {
      state.setbacks.unshift({ date: isoDate(), type: $('#sbType').value, feel: $('#sbFeel').value, next: $('#sbNext').value, learn: $('#sbLearn').value.trim(), back: false }); save();
      if (claim('setback', 2)) addXP(20, 'Brave to log it'); else toast('Saved');
      renderTrain(); return;
    }
    if (act === 'sbback') {
      var sb = state.setbacks[+d.i]; if (!sb || sb.back) return; sb.back = true; save();
      addXP(30, 'Comeback!'); renderTrain(); return;
    }
    if (act === 'sbdel') { state.setbacks.splice(+d.i, 1); save(); renderTrain(); return; }

    // Keeper
    if (act === 'gksub') { ui.gkSub = d.sub; renderTrain(); return; }
    if (act === 'gkfilter') { ui.gkSub = 'drills'; ui.gkFilter = d.f; renderTrain(); return; }
    if (act === 'skill') { state.skills[d.id] = +d.n; save(); renderTrain(); return; }
    if (act === 'drilldone') {
      if (!claim('drill:' + d.id, 1)) { toast('Already earned for this drill today'); return; }
      addXP(20, 'Drill done');
      t.classList.remove('red'); t.classList.add('done'); t.textContent = '✔ Done today'; return;
    }
    if (act === 'logsave') {
      var good = $('#logGood').value.trim(), better = $('#logBetter').value.trim();
      if (!good && !better) { toast('Write one thing first'); return; }
      state.sessions.unshift({ date: $('#logDate').value || isoDate(), focus: $('#logFocus').value, good: good, better: better }); save();
      if (claim('log', 2)) addXP(30, 'Session logged'); else toast('Saved');
      renderTrain(); return;
    }
    if (act === 'logdel') { state.sessions.splice(+d.i, 1); save(); renderTrain(); return; }
    if (act === 'cnsave') {
      var said = $('#cnSaid').value.trim(), focus = $('#cnFocus').value.trim(), home = $('#cnHome').value.trim();
      if (!said && !focus && !home) { toast('Write one thing first'); return; }
      state.coachNotes.unshift({ date: $('#cnDate').value || isoDate(), said: said, focus: focus, home: home }); save();
      if (claim('coachnote', 1)) addXP(30, 'Coach notes'); else toast('Saved');
      renderTrain(); return;
    }
    if (act === 'cndel') { state.coachNotes.splice(+d.i, 1); save(); renderTrain(); return; }
    if (act === 'linksave') {
      var v = $('#' + d.k).value.trim();
      if (v && !/^https?:\/\//i.test(v)) { toast('Link must start with https://'); return; }
      state.links[d.k] = v; save(); toast('Saved'); renderTrain(); return;
    }

    // Speed lab
    if (act === 'speedstart') { state.speed.start = isoDate(); save(); toast('Voyage started! Do your 5 metre test first.'); renderTrain(); return; }
    if (act === 'speeddone') {
      var key = isoDate() + d.s;
      if (state.speed.done[key]) { toast('Already done today'); return; }
      state.speed.done[key] = true; save();
      if (claim('speed', 2)) addXP(25, 'Speed session'); else toast('Saved');
      renderTrain(); return;
    }
    if (act === 'testsave') {
      var val = parseFloat(($('#spT').value || '').replace(',', '.'));
      if (!(val >= 0.5 && val <= 5)) { toast('Enter a time between 0.5 and 5 seconds'); return; }
      state.speed.tests.push({ date: isoDate(), t: Math.round(val * 100) / 100 }); save();
      if (claim('test', 2)) addXP(20, 'Test time saved'); else toast('Saved');
      renderTrain(); return;
    }
    if (act === 'testdel') {
      var idx = -1; state.speed.tests.forEach(function (x, i) { if (x.date === d.d && String(x.t) === d.t) idx = i; });
      if (idx > -1) { state.speed.tests.splice(idx, 1); save(); } renderTrain(); return;
    }

    // Fitness
    if (act === 'fitsub') { ui.fitSub = d.sub; if (d.sub !== 'stretch') stopStretch(); renderTrain(); return; }
    if (act === 'fittype') { ui.fitType = d.v; renderTrain(); return; }
    if (act === 'fitdur') { ui.fitDur = +d.v; renderTrain(); return; }
    if (act === 'fitgen') { ui.cur = buildSession(ui.fitType, ui.fitDur); renderTrain(); return; }
    if (act === 'fitsave') { if (ui.cur) { state.favs.unshift(ui.cur); state.favs = state.favs.slice(0, 20); save(); toast('Saved to favourites ⭐'); } return; }
    if (act === 'favdel') { state.favs.splice(+d.i, 1); save(); renderTrain(); return; }
    if (act === 'fitdone') { if (claim('fit', 2)) addXP(40, 'Fitness session'); else toast('Nice work, today\'s fitness doubloons are already in'); return; }
    if (act === 'stretchstart') { startStretch(); return; }
    if (act === 'stretchstop') { stopStretch(); paintStretch(); return; }

    // Match day
    if (act === 'mcheck') {
      var td = isoDate(); state.matchCheck[td] = state.matchCheck[td] || {};
      state.matchCheck[td][d.i] = !state.matchCheck[td][d.i]; save(); renderTrain(); return;
    }
    if (act === 'msave') {
      state.matches.unshift({ date: $('#mDate').value || isoDate(), opp: $('#mOpp').value.trim(), talk: $('#mTalk').value, rel: $('#mRel').value, res: $('#mRes').value, quick: $('#mQuick').value, best: $('#mBest').value.trim(), better: $('#mBetter').value.trim() }); save();
      if (claim('match', 1)) addXP(40, 'Match logged'); else toast('Saved');
      renderTrain(); return;
    }
    if (act === 'mdel') { state.matches.splice(+d.i, 1); save(); renderTrain(); return; }

    // Study
    if (act === 'mtick') {
      var tdy = isoDate(); state.study.mission[tdy] = state.study.mission[tdy] || {};
      if (state.study.mission[tdy][d.k]) { toast('Already ticked'); return; }
      state.study.mission[tdy][d.k] = true; save(); addXP(10, 'Study block done'); renderStudy(); return;
    }
    if (act === 'qstart') { startQuiz(d.kind, +d.level); renderStudy(); return; }
    if (act === 'qquit') { ui.quiz = null; renderStudy(); return; }
    if (act === 'qspeak') { if (ui.quiz && ui.quiz.kind === 'spell') speak(ui.quiz.qs[ui.quiz.i].w); return; }
    if (act === 'qcheck') {
      var q = ui.quiz; if (!q || q.fb) return;
      var cur = q.qs[q.i], given = ($('#qAns').value || '').trim(), ok = false;
      if (!given) { toast('Type your answer first'); return; }
      if (q.kind === 'arith') { var n = parseFloat(given.replace(',', '.')); ok = !isNaN(n) && Math.abs(n - cur.a) < 0.0001; }
      else { ok = given.toLowerCase() === cur.w; }
      if (ok) q.score++;
      q.fb = { ok: ok, given: given }; renderStudy(); return;
    }
    if (act === 'qpick') {
      var q2 = ui.quiz; if (!q2 || q2.fb) return;
      var c2 = q2.qs[q2.i], pickI = +d.i, ok2 = pickI === c2.a;
      if (ok2) q2.score++;
      q2.fb = { ok: ok2, pick: pickI }; renderStudy(); return;
    }
    if (act === 'qnext') {
      var q3 = ui.quiz; if (!q3) return;
      q3.fb = null; q3.i++;
      if (q3.i >= q3.qs.length) finishQuiz(); else if (q3.kind === 'spell') speak(q3.qs[q3.i].w);
      renderStudy(); return;
    }
    if (act === 'readsave') {
      var mins = parseInt($('#rMins').value, 10);
      if (!(mins > 0)) { toast('Add the minutes'); return; }
      state.study.reading.unshift({ date: isoDate(), book: $('#rBook').value.trim(), mins: mins }); save();
      if (claim('reading', 1)) addXP(15, 'Reading logged'); else toast('Saved');
      renderStudy(); return;
    }
    if (act === 'readdel') { state.study.reading.splice(+d.i, 1); save(); renderStudy(); return; }

    // Fishing and calm
    if (act === 'fishsub') { ui.fishSub = d.sub; renderChill(); return; }
    if (act === 'wherefilter') { if (d.f === 'species') ui.whereSpecies = d.v; else ui.whereCost = d.v; renderChill(); return; }
    if (act === 'fished') {
      state.venues[d.id] = state.venues[d.id] || {};
      if (state.venues[d.id].fished) { toast('Already collected!'); return; }
      state.venues[d.id].fished = true; save(); addXP(30, 'New water collected');
      var count = WATERS.filter(function (w) { return state.venues[w.id] && state.venues[w.id].fished; }).length;
      if (count === 5) setTimeout(function () { sfx('ALL FIVE!'); toast('You collected all five waters! 🏆'); }, 900);
      renderChill(); return;
    }
    if (act === 'vnote') { state.venues[d.id] = state.venues[d.id] || {}; state.venues[d.id].note = $('#vn-' + d.id).value.trim(); save(); toast('Saved'); return; }
    if (act === 'catchsave') {
      state.catches.unshift({ date: isoDate(), species: $('#cSpecies').value, weight: $('#cWeight').value.trim(), bait: $('#cBait').value.trim(), where: $('#cWhere').value.trim() }); save();
      if (claim('catch', 3)) addXP(40, 'Catch logged'); else toast('Saved');
      renderChill(); return;
    }
    if (act === 'catchdel') { state.catches.splice(+d.i, 1); save(); renderChill(); return; }
    if (act === 'breathstart') { startBreath(); return; }
    if (act === 'breathstop') { stopBreath(); renderChill(); return; }
    if (act === 'winsave') {
      var wt = $('#winTxt').value.trim(); if (!wt) { toast('Write one win first'); return; }
      state.wins.unshift({ date: isoDate(), text: wt }); save();
      if (claim('win', 1)) addXP(10, 'Win saved'); else toast('Saved');
      renderChill(); return;
    }
    if (act === 'windel') { state.wins.splice(+d.i, 1); save(); renderChill(); return; }
    if (act === 'pick') { ui.pick = pick(DOWNTIME); renderChill(); return; }

    // Coach
    if (act === 'ask') { ask($('#coachQ').value); return; }
    if (act === 'chip') { ask(d.q); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target) return;
    if (e.target.id === 'coachQ') ask(e.target.value);
    if (e.target.id === 'qAns' && ui.quiz) {
      var btn = $('[data-act="qcheck"]'); if (btn && !ui.quiz.fb) btn.click();
    }
  });

  // Crew picture: shrink to a small square so it fits in phone storage
  document.addEventListener('change', function (e) {
    if (!e.target || (e.target.id !== 'avatarFile' && !e.target.dataset.slot) || !e.target.files || !e.target.files[0]) return;
    var slot = e.target.dataset.slot || '';
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'), S = 240; c.width = S; c.height = S;
        var ctx = c.getContext('2d'), m = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
        var du = c.toDataURL('image/jpeg', 0.8); if (slot) state.photos[slot] = du; else state.avatar = du; save(); toast('Picture saved'); renderHome();
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(e.target.files[0]);
  });

  /* ---------- 5. START UP ---------- */
  // ---------- Opening splash ----------
  function initSplash() {
    var sp = $('#splash');
    if (!sp) return;
    var seen = false;
    try { seen = sessionStorage.getItem('kvSplash') === '1'; } catch (e) {}
    if (seen) { sp.classList.add('gone'); return; }
    var P = $('#spParticles'), cols = ['#00e5ff', '#ff2bd6', '#ffd23f', '#ffffff'], i, html = '';
    for (i = 0; i < 22; i++) {
      html += '<i style="--x:' + Math.round(Math.random() * 100) + '%;--s:' + (2 + Math.round(Math.random() * 3)) + 'px;--c:' + cols[i % cols.length] + ';--d:' + (1.6 + Math.random() * 2.4).toFixed(1) + 's;--dl:-' + (Math.random() * 4).toFixed(1) + 's"></i>';
    }
    if (P) P.innerHTML = html;
    var hero = $('#spHero'); if (hero) hero.innerHTML = '<img alt="" src="assets/ell_save.png">';
    var bar = $('#spBar'), st = $('#spStatus'), go = $('#spGo'), pct = $('#spPct');
    var cells = '';
    for (i = 0; i < 10; i++) cells += '<i></i>';
    if (bar) bar.innerHTML = cells;
    var msgs = ['Booting up...', 'Warming up the gloves...', 'Locking on target...', 'Keeper online. Ready!'];
    var n = 0;
    var timer = setInterval(function () {
      n++;
      var cs = bar ? bar.children : [];
      if (cs[n - 1]) cs[n - 1].className = 'on';
      if (pct) pct.textContent = (n * 10) + '%';
      if (st) st.textContent = msgs[Math.min(3, Math.floor((n - 1) / 3))];
      if (n % 3 === 0) playTone(300 + n * 60, 0.05);
      if (n >= 10) { clearInterval(timer); if (st) st.textContent = msgs[3]; if (go) { go.disabled = false; } }
    }, 200);
    if (go) go.addEventListener('click', function () {
      if (go.disabled) return;
      var f = $('#spFlash');
      sp.classList.add('cut');
      if (f) { f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
      sp.classList.remove('shake'); void sp.offsetWidth; sp.classList.add('shake');
      if (!state.mute) {
        try {
          var a = new Audio('assets/intro.mp3'); a.volume = 0.85; window.kvIntro = a;
          var pr = a.play(); if (pr && pr.catch) pr.catch(function () {});
        } catch (e) {}
      }
      try { if (navigator.vibrate && !state.mute) navigator.vibrate([40, 30, 60]); } catch (e) {}
      try { sessionStorage.setItem('kvSplash', '1'); } catch (e) {}
      setTimeout(function () { sp.classList.add('out'); }, 900);
      setTimeout(function () { sp.classList.add('gone'); }, 1300);
    });
  }

  function init() {
    initSplash();
    save();
    updatePills();
    var h = (location.hash || '').replace('#', '');
    show(RENDER[h] ? h : 'home');
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode just will not be available */ }); });
    }
  }
  init();
})();
