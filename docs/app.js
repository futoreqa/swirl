/* Swirl landing — shared script (ru + en). No dependencies. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* ---------- nav border on scroll ---------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- reveal / tilt / ring on scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal, .tilt, .ring');
  if (!hasIO || reduce) {
    for (var i = 0; i < revealEls.length; i++) revealEls[i].classList.add('in');
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    for (var j = 0; j < revealEls.length; j++) io.observe(revealEls[j]);
  }

  /* ---------- island state machine ---------- */
  var island = document.querySelector('.stage .island');
  var stage = document.querySelector('.stage');
  var stageVisible = true;

  if (island) {
    var hotBtn = island.querySelector('[data-hot]');
    if (reduce) {
      island.setAttribute('data-state', 'open');
    } else {
      var seq = [
        { s: 'pill', d: 1900 },
        { s: 'open', d: 4200 },
        { s: 'rec', d: 3200 },
        { s: 'color', d: 2800 }
      ];
      var idx = 0;
      var timer = null;
      var hotTimer = null;
      var step = function () {
        var cur = seq[idx];
        island.setAttribute('data-state', cur.s);
        if (hotBtn) {
          hotBtn.classList.remove('hot');
          clearTimeout(hotTimer);
          if (cur.s === 'open') hotTimer = setTimeout(function () { hotBtn.classList.add('hot'); }, 2600);
        }
        idx = (idx + 1) % seq.length;
        timer = setTimeout(tick, cur.d);
      };
      var tick = function () {
        if (!stageVisible || document.hidden) { timer = setTimeout(tick, 600); return; }
        step();
      };
      step();
    }
  }

  /* ---------- WebGL silk ---------- */
  var canvas = document.querySelector('.stage canvas');
  if (canvas) initSilk(canvas);

  function initSilk(cv) {
    var gl = null;
    try {
      var opts = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power' };
      gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
    } catch (err) { gl = null; }
    if (!gl) { cv.parentNode.removeChild(cv); return; }

    var vsrc = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
    var fsrc = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform vec2 r;',
      'uniform float t;',
      'float h(vec2 p){',
      '  vec2 q=p;',
      '  q.x+=0.42*sin(q.y*1.55+t*0.33);',
      '  q.y+=0.34*sin(q.x*1.25-t*0.26);',
      '  q.x+=0.16*sin(q.y*3.10-t*0.47);',
      '  q.y+=0.10*sin(q.x*4.30+t*0.21);',
      '  float v=sin(q.x*2.45+q.y*1.10+t*0.55);',
      '  v+=0.55*sin(-q.x*1.35+q.y*2.85-t*0.40);',
      '  v+=0.22*sin((q.x+q.y)*4.60+t*0.72);',
      '  v+=0.35*sin(length(q-vec2(-0.6,0.9))*2.2-t*0.30);',
      '  return v;',
      '}',
      'void main(){',
      '  vec2 uv=gl_FragCoord.xy/r;',
      '  vec2 p=(gl_FragCoord.xy-0.5*r)/max(r.y,1.0)*2.1;',
      '  float e=0.006;',
      '  float dx=(h(p+vec2(e,0.0))-h(p-vec2(e,0.0)))/(2.0*e);',
      '  float dy=(h(p+vec2(0.0,e))-h(p-vec2(0.0,e)))/(2.0*e);',
      '  vec3 n=normalize(vec3(-dx*0.22,-dy*0.22,1.0));',
      '  vec3 L=normalize(vec3(-0.45,0.55,0.75));',
      '  vec3 L2=normalize(vec3(0.7,-0.2,0.6));',
      '  vec3 V=vec3(0.0,0.0,1.0);',
      '  float nh=max(dot(n,normalize(L+V)),0.0);',
      '  float nh2=max(dot(n,normalize(L2+V)),0.0);',
      '  float diff=max(dot(n,L),0.0);',
      '  float c=0.015+0.30*pow(diff,3.0);',
      '  c+=0.22*pow(nh,10.0)+1.05*pow(nh,70.0);',
      '  c+=0.35*pow(nh2,40.0);',
      '  c+=0.10*pow(max(1.0-n.z,0.0),1.5);',
      '  c*=0.78+0.32*smoothstep(-0.2,1.1,uv.x*0.6+uv.y*0.7+0.08*sin(t*0.12));',
      '  vec2 d=uv-0.5;',
      '  c*=1.0-0.45*dot(d,d)*1.6;',
      '  c=c/(1.0+0.55*c)*1.18;',
      '  c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;',
      '  gl_FragColor=vec4(vec3(clamp(c,0.0,1.0)),1.0);',
      '}'
    ].join('\n');

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, vsrc);
    var fs = sh(gl.FRAGMENT_SHADER, fsrc);
    if (!vs || !fs) { cv.parentNode.removeChild(cv); return; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.parentNode.removeChild(cv); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(prog, 'r');
    var uT = gl.getUniformLocation(prog, 't');

    var lost = false;
    cv.addEventListener('webglcontextlost', function (ev) {
      ev.preventDefault();
      lost = true;
      cv.classList.remove('on');
    });

    var T0 = 14.0; /* nice starting frame (also the static frame for reduced motion) */
    var start = performance.now();
    var raf = 0;
    var running = false;

    function resize() {
      var scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.8;
      var w = Math.max(1, Math.round(cv.clientWidth * scale));
      var hh = Math.max(1, Math.round(cv.clientHeight * scale));
      if (cv.width !== w || cv.height !== hh) {
        cv.width = w;
        cv.height = hh;
        gl.viewport(0, 0, w, hh);
        return true;
      }
      return false;
    }

    function draw(time) {
      if (lost) return;
      gl.uniform2f(uR, cv.width, cv.height);
      gl.uniform1f(uT, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      resize();
      draw(T0 + (now - start) / 1000 * 0.55);
      raf = requestAnimationFrame(frame);
    }

    function play() {
      if (reduce || running || lost) return;
      running = true;
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function pause() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    resize();
    draw(T0);
    cv.classList.add('on');

    var onResize = function () { if (resize() && !running) draw(T0); };
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(cv);
    else window.addEventListener('resize', onResize);

    if (reduce) return;

    if (hasIO && stage) {
      new IntersectionObserver(function (entries) {
        stageVisible = entries[0].isIntersecting;
        if (stageVisible && !document.hidden) play(); else pause();
      }, { threshold: 0 }).observe(stage);
    } else {
      play();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause(); else if (stageVisible) play();
    });
  }
})();
