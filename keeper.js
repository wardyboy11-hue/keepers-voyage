/* Keeper's Voyage: original manga style character maker.
   Draws Ell (and his team mates) as inline SVG. No outside art, no logos, nothing leaves the phone. */
(function () {
  'use strict';
  var INK = '#14142b';
  var uid = 0;

  var KITS = {
    green:  { name: 'Green',  shirt: '#1aa075', accent: '#0f7a58', trim: '#f6ecd6', shorts: '#14875f', socks: '#1aa075', glove: '#ffffff', band: '#1aa075', boot: '#1c1c28' },
    pink:   { name: 'Pink',   shirt: '#f8a9cb', accent: '#ec80ae', trim: '#2b2b4d', shorts: '#f59cc3', socks: '#f8a9cb', glove: '#ffffff', band: '#ec80ae', boot: '#1c1c28' },
    yellow: { name: 'Yellow', shirt: '#f7e63a', accent: '#d9c81c', trim: '#2b2b2b', shorts: '#efdc2a', socks: '#f7e63a', glove: '#ffffff', band: '#2b2b2b', boot: '#1c1c28' },
    blue:   { name: 'Blue',   shirt: '#1f62cc', accent: '#16408f', trim: '#ffffff', shorts: '#1f62cc', socks: '#1f62cc', glove: '', band: '', boot: '#1c1c28' }
  };

  var SKINS = { ell: '#f0b98d', fair: '#f6cfae', tan: '#e2a273', deep: '#9c6a45' };
  var HAIRS = { ell: '#2a1b15', brown: '#5a3a24', blond: '#d9b45a', ginger: '#b8561f', black: '#16121a' };

  /* Poses: joints for Ls/Rs shoulders, Le/Re elbows, Lw/Rw wrists, Lk/Rk knees, La/Ra ankles. */
  var POSES = {
    ready: { mood: 'ready', tilt: 0, rot: 0, open: true,
      Le: [82, 226], Lw: [56, 280], Re: [218, 226], Rw: [244, 280],
      Lk: [108, 368], La: [96, 442], Rk: [192, 368], Ra: [204, 442] },
    save: { mood: 'shout', tilt: -6, rot: -24, open: true,
      Le: [96, 118], Lw: [92, 52], Re: [226, 200], Rw: [246, 244],
      Lk: [128, 372], La: [112, 444], Rk: [196, 352], Ra: [226, 408] },
    win: { mood: 'cheer', tilt: 4, rot: 0, open: false,
      Le: [74, 130], Lw: [62, 70], Re: [226, 130], Rw: [238, 70],
      Lk: [132, 372], La: [126, 446], Rk: [168, 372], Ra: [174, 446] },
    bounce: { mood: 'grit', tilt: 0, rot: 0, open: false,
      Le: [96, 230], Lw: [128, 214], Re: [230, 196], Rw: [224, 132],
      Lk: [118, 372], La: [108, 446], Rk: [182, 372], Ra: [194, 446] },
    fishing: { mood: 'smile', tilt: 6, rot: 0, open: false, rod: true,
      Le: [124, 238], Lw: [172, 262], Re: [196, 226], Rw: [198, 256],
      Lk: [128, 372], La: [120, 446], Rk: [176, 372], Ra: [184, 446] },
    study: { mood: 'read', tilt: 10, rot: 0, open: false, book: true,
      Le: [112, 236], Lw: [128, 256], Re: [188, 236], Rw: [172, 256],
      Lk: [132, 372], La: [126, 446], Rk: [168, 372], Ra: [174, 446] },
    calm: { mood: 'calm', tilt: 0, rot: 0, open: true, calm: true,
      Le: [92, 232], Lw: [78, 296], Re: [208, 232], Rw: [222, 296],
      Lk: [132, 372], La: [128, 446], Rk: [168, 372], Ra: [172, 446] }
  };

  function f(n) { return Math.round(n * 10) / 10; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function pts(arr) { return arr.map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join(' '); }
  function line(arr, w, col) {
    return '<polyline points="' + pts(arr) + '" fill="none" stroke="' + INK + '" stroke-width="' + (w + 7) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
           '<polyline points="' + pts(arr) + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function glove(w, e, kit, open) {
    var ang = Math.atan2(w[1] - e[1], w[0] - e[0]) * 180 / Math.PI + 90;
    var g = '<g transform="translate(' + f(w[0]) + ' ' + f(w[1]) + ') rotate(' + f(ang) + ')">';
    if (!kit.glove) {
      return g + '<circle r="11" fill="SKIN" stroke="' + INK + '" stroke-width="3.5"/></g>';
    }
    if (open) {
      g += '<rect x="-12" y="-22" width="6" height="17" rx="3" fill="' + kit.glove + '" stroke="' + INK + '" stroke-width="2.6"/>' +
           '<rect x="-5.5" y="-26" width="6" height="21" rx="3" fill="' + kit.glove + '" stroke="' + INK + '" stroke-width="2.6"/>' +
           '<rect x="1" y="-25" width="6" height="20" rx="3" fill="' + kit.glove + '" stroke="' + INK + '" stroke-width="2.6"/>' +
           '<rect x="7.5" y="-21" width="6" height="16" rx="3" fill="' + kit.glove + '" stroke="' + INK + '" stroke-width="2.6"/>';
    }
    g += '<ellipse cx="0" cy="0" rx="13" ry="12" fill="' + kit.glove + '" stroke="' + INK + '" stroke-width="3.5"/>' +
         '<path d="M-7 -3 L7 -3 M-7 3 L7 3" stroke="' + kit.band + '" stroke-width="3" stroke-linecap="round" opacity=".85"/>' +
         '<rect x="-10" y="9" width="20" height="9" rx="3" fill="' + kit.band + '" stroke="' + INK + '" stroke-width="3"/>';
    return g + '</g>';
  }

  function boot(a, dir, kit) {
    return '<g transform="translate(' + f(a[0]) + ' ' + f(a[1]) + ') scale(' + dir + ' 1)">' +
      '<path d="M-12 -8 Q-12 -16 0 -16 L14 -12 Q30 -8 32 2 L32 8 L-14 8 Z" fill="' + kit.boot + '" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M4 -12 L22 -3" stroke="#ffd23f" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M-14 8 L32 8" stroke="#ffffff" stroke-width="3" opacity=".7"/></g>';
  }

  function eyes(mood, hair) {
    var out = '';
    function eye(cx, flip) {
      var iy = 80, ry = 12.5;
      if (mood === 'cheer') return '<path d="M' + (cx - 10) + ' 82 Q' + cx + ' 66 ' + (cx + 10) + ' 82" fill="none" stroke="' + INK + '" stroke-width="4.5" stroke-linecap="round"/>';
      if (mood === 'calm') return '<path d="M' + (cx - 10) + ' 78 Q' + cx + ' 88 ' + (cx + 10) + ' 78" fill="none" stroke="' + INK + '" stroke-width="4.5" stroke-linecap="round"/>';
      if (mood === 'grit') ry = 10;
      var dy = mood === 'read' ? 4 : 0, dx = mood === 'smile' ? 2 * flip : 0;
      var s = '<ellipse cx="' + cx + '" cy="' + iy + '" rx="11" ry="' + ry + '" fill="#fff" stroke="' + INK + '" stroke-width="3"/>' +
        '<ellipse cx="' + (cx + dx) + '" cy="' + (iy + 1 + dy) + '" rx="7.5" ry="' + (ry - 1.5) + '" fill="#6b3f26"/>' +
        '<ellipse cx="' + (cx + dx) + '" cy="' + (iy + 2 + dy) + '" rx="4" ry="6" fill="' + INK + '"/>' +
        '<circle cx="' + (cx + dx - 3) + '" cy="' + (iy - 4 + dy) + '" r="3" fill="#fff"/><circle cx="' + (cx + dx + 3) + '" cy="' + (iy + 5 + dy) + '" r="1.5" fill="#fff"/>' +
        '<path d="M' + (cx - 12) + ' ' + (iy - 3) + ' Q' + cx + ' ' + (iy - ry - 4) + ' ' + (cx + 12) + ' ' + (iy - 3) + '" fill="none" stroke="' + INK + '" stroke-width="4.5" stroke-linecap="round"/>';
      if (mood === 'read') s += '<path d="M' + (cx - 11) + ' ' + (iy - 2) + ' Q' + cx + ' ' + (iy - 14) + ' ' + (cx + 11) + ' ' + (iy - 2) + ' L' + (cx + 11) + ' ' + (iy + 2) + ' Q' + cx + ' ' + (iy - 6) + ' ' + (cx - 11) + ' ' + (iy + 2) + ' Z" fill="SKIN"/>';
      return s;
    }
    out += eye(133, -1) + eye(167, 1);
    var b = { ready: [[121, 65, 145, 66], [179, 65, 155, 66]], shout: [[120, 60, 145, 66], [180, 60, 155, 66]], cheer: [[122, 56, 144, 56], [178, 56, 156, 56]],
      grit: [[120, 58, 146, 68], [180, 58, 154, 68]], smile: [[122, 62, 144, 61], [178, 62, 156, 61]], read: [[122, 63, 144, 65], [178, 63, 156, 65]], calm: [[122, 64, 144, 62], [178, 64, 156, 62]] }[mood] || [[121, 63, 145, 67], [179, 63, 155, 67]];
    b.forEach(function (q) { out += '<path d="M' + q[0] + ' ' + q[1] + ' L' + q[2] + ' ' + q[3] + '" stroke="' + hair + '" stroke-width="5" stroke-linecap="round"/>'; });
    return out;
  }

  function mouth(mood) {
    var teeth = '#fff', dark = '#6b1717';
    switch (mood) {
      case 'shout': return '<path d="M136 102 Q150 98 164 102 Q162 122 150 123 Q138 122 136 102 Z" fill="' + dark + '" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/><path d="M139 103 Q150 100 161 103 L160 108 Q150 106 140 108 Z" fill="' + teeth + '"/><ellipse cx="150" cy="117" rx="6" ry="3.5" fill="#e0707a"/>';
      case 'cheer': return '<path d="M131 100 Q150 98 169 100 Q166 124 150 125 Q134 124 131 100 Z" fill="' + teeth + '" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/><path d="M133 107 Q150 111 167 107" fill="none" stroke="' + INK + '" stroke-width="2"/><path d="M141 118 Q150 123 159 118 Q150 112 141 118Z" fill="#e0707a"/>';
      case 'grit': return '<path d="M136 103 Q150 100 164 103 L162 113 Q150 116 138 113 Z" fill="' + teeth + '" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/><path d="M143 102 V114 M150 101 V115 M157 102 V114" stroke="' + INK + '" stroke-width="1.8"/>';
      case 'ready': return '<path d="M133 101 Q150 123 167 101 Q150 106 133 101 Z" fill="' + teeth + '" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>';
      case 'smile': return '<path d="M137 103 Q150 116 163 103" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
      case 'read': return '<path d="M142 106 Q150 111 158 106" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
      default: return '<path d="M139 104 Q150 112 161 104" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
    }
  }

  function hairShape(style, h, hi) {
    var back = '', front = '';
    if (style === 'curly') {
      front = '<path d="M106 78 C96 52 104 24 130 18 C140 6 164 6 172 18 C198 24 206 52 194 78 C190 60 182 52 176 50 C170 60 130 60 124 50 C118 52 110 60 106 78 Z" fill="' + h + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>' +
        '<circle cx="118" cy="32" r="10" fill="' + h + '" stroke="' + INK + '" stroke-width="3.5"/><circle cx="150" cy="18" r="11" fill="' + h + '" stroke="' + INK + '" stroke-width="3.5"/><circle cx="182" cy="32" r="10" fill="' + h + '" stroke="' + INK + '" stroke-width="3.5"/>';
    } else if (style === 'buzz') {
      front = '<path d="M108 70 C106 40 124 20 150 20 C176 20 194 40 192 70 C186 56 176 48 150 48 C124 48 114 56 108 70 Z" fill="' + h + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>';
    } else { /* ell: short, swept up and forward, spiky fringe */
      front = '<path d="M106 78 C98 50 110 28 128 18 L122 -2 L140 10 L152 -10 L164 10 L182 -2 L176 18 C196 28 204 52 194 80 L187 60 L183 74 L173 50 L167 66 L153 46 L141 66 L129 50 L125 70 L114 56 Z" fill="' + h + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>';
    }
    return back + front + '<path d="M122 38 Q136 26 154 28" fill="none" stroke="' + hi + '" stroke-width="4" stroke-linecap="round" opacity=".55"/>';
  }

  function svg(o) {
    o = o || {};
    var id = 'kv' + (++uid);
    var pose = POSES[o.pose] || POSES.ready;
    var kit = KITS[o.kit] || KITS.green;
    var skin = SKINS[o.skin] || SKINS.ell;
    var hair = HAIRS[o.hair] || HAIRS.ell;
    var style = o.style || 'ell';
    var skinShade = '#d99b6f';
    var J = pose;
    var Ls = [112, 168], Rs = [188, 168], Lh = [128, 284], Rh = [172, 284];
    var s = '';

    s += '<defs><pattern id="' + id + 'p" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="14" height="14" fill="' + kit.shirt + '"/><path d="M0 7 H14" stroke="' + kit.accent + '" stroke-width="5"/></pattern></defs>';

    /* Calm ripples sit behind the figure */
    if (pose.calm) {
      s += '<g fill="none" stroke="#7fd3ff" stroke-width="3" opacity=".7"><ellipse cx="150" cy="458" rx="90" ry="14"/><ellipse cx="150" cy="458" rx="130" ry="20" opacity=".5"/></g>';
    }

    /* Legs: thigh skin, shorts, sock, boot */
    var legs = [[Lh, J.Lk, J.La, -1], [Rh, J.Rk, J.Ra, 1]];
    legs.forEach(function (L) {
      var hip = L[0], k = L[1], a = L[2];
      s += line([hip, k], 24, SKIN_PLACE);
      s += line([k, a], 21, kit.socks);
      s += '<path d="M' + f(lerp(k, a, .62)[0]) + ' ' + f(lerp(k, a, .62)[1]) + ' L' + f(a[0]) + ' ' + f(a[1]) + '" stroke="#fff" stroke-width="17" stroke-linecap="round" opacity="0"/>';
      s += line([hip, lerp(hip, k, .5)], 33, kit.shorts);
      s += boot(a, L[3], kit);
    });
    /* Hip block */
    s += '<path d="M122 268 L178 268 L184 304 L116 304 Z" fill="' + kit.shorts + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>';

    /* Torso: shirt with striped sides, cream collar, simple badge */
    s += '<path d="M110 160 C126 150 174 150 190 160 L188 214 C188 246 182 272 178 290 L122 290 C118 272 112 246 112 214 Z" fill="' + kit.shirt + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>';
    s += '<path d="M112 176 L124 176 L126 286 L120 286 C116 266 112 244 112 214 Z" fill="url(#' + id + 'p)" opacity=".9"/><path d="M188 176 L176 176 L174 286 L180 286 C184 266 188 244 188 214 Z" fill="url(#' + id + 'p)" opacity=".9"/>';
    s += '<path d="M130 154 L150 178 L170 154" fill="none" stroke="' + kit.trim + '" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/><path d="M130 154 L150 178 L170 154" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round" opacity=".6"/>';
    s += '<g transform="translate(168 204)"><circle r="10" fill="' + kit.trim + '" stroke="' + INK + '" stroke-width="3"/><path d="M0 -6 L2 -1 L7 -1 L3 2 L5 7 L0 4 L-5 7 L-3 2 L-7 -1 L-2 -1 Z" fill="' + kit.shirt + '"/></g>';
    s += '<path d="M132 238 H168" stroke="' + kit.trim + '" stroke-width="5" stroke-linecap="round" opacity=".55"/>';

    /* Neck (behind head, over torso) */
    s += '<path d="M138 120 L138 156 Q150 166 162 156 L162 120 Z" fill="' + skin + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/><path d="M138 130 Q150 142 162 130 L162 138 Q150 150 138 138 Z" fill="' + skinShade + '" opacity=".7"/>';

    /* Arms */
    [[Ls, J.Le, J.Lw], [Rs, J.Re, J.Rw]].forEach(function (A) {
      s += line([A[0], A[1]], 17, SKIN_PLACE);
      s += line([A[1], A[2]], 15, SKIN_PLACE);
      s += line([A[0], lerp(A[0], A[1], .42)], 24, kit.shirt);
      s += '<circle cx="' + f(lerp(A[0], A[1], .5)[0]) + '" cy="' + f(lerp(A[0], A[1], .5)[1]) + '" r="12.5" fill="' + kit.trim + '" opacity="0"/>';
      s += glove(A[2], A[1], kit, J.open);
    });

    /* Props */
    if (J.rod) {
      s += '<path d="M168 292 L282 36" stroke="' + INK + '" stroke-width="9" stroke-linecap="round"/><path d="M168 292 L282 36" stroke="#d9a441" stroke-width="5" stroke-linecap="round"/>';
      s += '<path d="M282 36 Q300 120 276 214" fill="none" stroke="#fff" stroke-width="1.6" opacity=".85"/><circle cx="276" cy="218" r="6" fill="#e63329" stroke="' + INK + '" stroke-width="2.5"/>';
      s += '<circle cx="186" cy="262" r="9" fill="#555" stroke="' + INK + '" stroke-width="3"/>';
    }
    if (J.book) {
      s += '<g transform="rotate(-6 150 262)"><rect x="104" y="238" width="92" height="64" rx="5" fill="#2a5fa8" stroke="' + INK + '" stroke-width="4"/><rect x="110" y="244" width="80" height="52" rx="3" fill="#fff6dc"/><path d="M150 244 V296" stroke="' + INK + '" stroke-width="3"/><path d="M118 258 H142 M118 268 H142 M118 278 H138 M158 258 H182 M158 268 H182 M158 278 H178" stroke="#9aa3b8" stroke-width="3" stroke-linecap="round"/></g>';
      /* hands over the book */
      s += glove(J.Lw, J.Le, { glove: '' }, false);
      s += glove(J.Rw, J.Re, { glove: '' }, false);
    }

    /* Head */
    s += '<g transform="translate(150 126) rotate(' + J.tilt + ') scale(1.22) translate(-150 -126)">';
    s += '<ellipse cx="109" cy="80" rx="9" ry="13" fill="' + skin + '" stroke="' + INK + '" stroke-width="3.5"/><ellipse cx="191" cy="80" rx="9" ry="13" fill="' + skin + '" stroke="' + INK + '" stroke-width="3.5"/>';
    s += '<path d="M110 72 C110 40 128 24 150 24 C172 24 190 40 190 72 C190 102 172 124 150 130 C128 124 110 102 110 72 Z" fill="' + skin + '" stroke="' + INK + '" stroke-width="4.5" stroke-linejoin="round"/>';
    s += '<path d="M178 52 C190 70 186 100 168 120 C176 104 180 84 178 52 Z" fill="' + skinShade + '" opacity=".55"/>';
    s += '<ellipse cx="124" cy="98" rx="9" ry="5" fill="#ff8a8a" opacity=".35"/><ellipse cx="176" cy="98" rx="9" ry="5" fill="#ff8a8a" opacity=".35"/>';
    s += eyes(pose.mood, hair);
    s += '<path d="M150 90 Q146 96 151 98" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>';
    s += mouth(pose.mood);
    s += hairShape(style, hair, '#ffffff');
    if (pose.mood === 'grit' || pose.mood === 'shout') s += '<path d="M196 50 q8 12 0 20 q-8 -8 0 -20 Z" fill="#9fe0ff" stroke="' + INK + '" stroke-width="2.5"/>';
    s += '</g>';
    if (pose.mood === 'cheer') s += '<g fill="#ffd23f" stroke="' + INK + '" stroke-width="2.5"><path d="M40 40 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5z"/><path d="M262 30 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z"/></g>';

    s = s.replace(/SKIN_PLACE/g, skin).replace(/SKIN/g, skin);

    var inner = s;
    if (pose.rot) inner = '<g transform="rotate(' + pose.rot + ' 150 270) translate(0 -20)">' + s.replace(/<defs>.*?<\/defs>/, '') + '</g>' + s.match(/<defs>.*?<\/defs>/)[0];
    return '<svg class="kvchar kv-' + (o.pose || 'ready') + (o.bust ? ' bust' : '') + '" viewBox="' + (o.bust ? '30 -34 240 236' : '-20 -36 340 522') + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (o.label || 'Manga style goalkeeper') + '">' + inner + '</svg>';
  }
  var SKIN_PLACE = 'SKIN_PLACE';

  var CREW = {
    'Archie': { hair: 'brown', style: 'buzz', skin: 'fair' }, 'Gino': { hair: 'black', style: 'curly', skin: 'tan' },
    'George': { hair: 'brown', style: 'buzz', skin: 'fair' }, 'Harvey': { hair: 'blond', style: 'curly', skin: 'fair' },
    'Logan': { hair: 'ginger', style: 'ell', skin: 'fair' }, 'Jacob': { hair: 'brown', style: 'ell', skin: 'fair' },
    'Alfie': { hair: 'blond', style: 'buzz', skin: 'fair' }, 'Theo': { hair: 'black', style: 'buzz', skin: 'tan' },
    'Isaac': { hair: 'brown', style: 'ell', skin: 'tan' }, 'Ellis': { hair: 'ginger', style: 'curly', skin: 'fair' },
    'Jax': { hair: 'black', style: 'ell', skin: 'fair', kit: 'yellow' }
  };
  function mate(name, pose, extra) {
    var c = CREW[(name || '').split(' ')[0]] || {};
    var o = { pose: pose || 'ready', kit: c.kit || 'blue', hair: c.hair, style: c.style, skin: c.skin, label: name };
    for (var x in extra) o[x] = extra[x];
    return svg(o);
  }
  window.KVChar = { svg: svg, mate: mate, CREW: CREW, KITS: KITS, SKINS: SKINS, HAIRS: HAIRS, POSES: POSES };
})();
