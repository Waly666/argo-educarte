/**
 * Puente ARGO Aula Virtual — inyectado automáticamente en cada HTML del curso.
 * Sincroniza puntajes por clase desde localStorage/sessionStorage hacia la API.
 */
(function () {
  'use strict';

  window.__argoCourseConfig = null;

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
  }

  function metaStoragePrefix() {
    try {
      var m = document.querySelector('meta[name="argo-storage-prefix"]');
      if (m && m.getAttribute('content')) return String(m.getAttribute('content')).trim();
    } catch (_e) {
      /* ignore */
    }
    if (typeof window.ARGO_STORAGE_PREFIX === 'string' && window.ARGO_STORAGE_PREFIX.trim()) {
      return window.ARGO_STORAGE_PREFIX.trim();
    }
    return null;
  }

  function setConfig(data) {
    if (!data || !data.apiUrl || !data.token || !data.idPrograma) return;
    var idPrograma = String(data.idPrograma);
    var fromInit = data.storagePrefix && String(data.storagePrefix).trim();
    var metaPrefix = metaStoragePrefix();
    var lockedPrefix = fromInit || metaPrefix || null;
    window.__argoCourseConfig = {
      apiUrl: String(data.apiUrl).replace(/\/+$/, ''),
      token: String(data.token),
      idPrograma: idPrograma,
      defaultPrefix: lockedPrefix,
      resolvedPrefix: lockedPrefix,
    };
    if (window.__argoAutoSync) {
      window.__argoAutoSync.resetCourse();
      window.__argoAutoSync.kick(true);
    }
  }

  function onPortalMessage(ev) {
    if (!ev.data) return;
    if (ev.data.type === 'ARGO_INIT') {
      setConfig(ev.data);
    }
    if (ev.data.type === 'ARGO_SYNC_REQUEST' && window.__argoAutoSync) {
      window.__argoAutoSync.kick(true);
    }
  }

  window.addEventListener('message', onPortalMessage);

  function notifyParent(data) {
    var config = window.__argoCourseConfig;
    if (!config) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'ARGO_PROGRESO_ACTUALIZADO',
            idPrograma: config.idPrograma,
            progreso: data.progreso,
            reglas: data.reglas,
            certificado: data.certificado,
            aviso: data.aviso,
          },
          '*',
        );
      }
    } catch (_e) {
      /* ignore */
    }
  }

  function reportProgress(body) {
    var config = window.__argoCourseConfig;
    if (!config) {
      return Promise.resolve({ ok: false, motivo: 'sin_config' });
    }
    var url =
      config.apiUrl +
      '/cursos/' +
      encodeURIComponent(config.idPrograma) +
      '/progreso';
    return fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + config.token,
      },
      body: JSON.stringify(body || {}),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error((data && data.message) || 'Error al reportar progreso');
          notifyParent(data);
          return data;
        });
      })
      .catch(function (e) {
        console.error('[ARGO] reportProgress:', e.message || e);
        throw e;
      });
  }

  window.ARGO = {
    ready: function () {
      return !!window.__argoCourseConfig;
    },
    reportProgress: reportProgress,
    reportCompletitud: function (pct) {
      return reportProgress({ pctCompletitud: num(pct) });
    },
    reportEvaluacion: function (nota, pctCompletitud) {
      var body = { notaEval: num(nota), evaluacionFinal: true };
      if (pctCompletitud != null) body.pctCompletitud = num(pctCompletitud);
      return reportProgress(body);
    },
  };
})();

(function () {
  'use strict';

  var CLASS_PASS = 70;
  var FINAL_MAX_PTS = 45;
  var SYNC_MS = 8000;
  var lastFingerprint = '';
  var syncing = false;

  function getConfig() {
    return window.__argoCourseConfig;
  }

  function prefixFromKey(key) {
    if (typeof key !== 'string') return null;
    if (key.slice(-8) === '-version') return key.slice(0, -8);
    if (key.slice(-6) === '-final') return key.slice(0, -6);
    var m = key.match(/^(.+)-(\d{1,3})$/);
    if (!m) return null;
    var n = Number(m[2]);
    if (!Number.isFinite(n) || n < 1 || n > 999) return null;
    return m[1];
  }

  function isProgressStorageKey(key) {
    if (typeof key !== 'string') return false;
    if (/-session/i.test(key)) return true;
    if (key.slice(-8) === '-version') return true;
    if (key.slice(-6) === '-final') return true;
    return prefixFromKey(key) != null;
  }

  function rememberPrefixFromKey(key) {
    var config = getConfig();
    var prefix = prefixFromKey(key);
    if (config && prefix) config.resolvedPrefix = prefix;
  }

  function readFromStore(store, prefix, slot) {
    try {
      return store.getItem(prefix + '-' + slot);
    } catch (_e) {
      return null;
    }
  }

  function readFinalFromStore(store, prefix) {
    try {
      return store.getItem(prefix + '-final');
    } catch (_e) {
      return null;
    }
  }

  function discoverPrefix() {
    var candidates = {};
    var stores = [localStorage, sessionStorage];
    var si;
    var store;
    var i;
    var key;
    var m;

    for (si = 0; si < stores.length; si++) {
      store = stores[si];
      try {
        for (i = 0; i < store.length; i++) {
          key = store.key(i);
          if (!key) continue;
          if (key.slice(-8) === '-version') {
            candidates[key.slice(0, -8)] = (candidates[key.slice(0, -8)] || 0) + 50;
            continue;
          }
          if (key.slice(-6) === '-final') {
            candidates[key.slice(0, -6)] = (candidates[key.slice(0, -6)] || 0) + 15;
            continue;
          }
          m = key.match(/^(.+)-(\d{1,3})$/);
          if (m) {
            var n = Number(m[2]);
            if (n >= 1 && n <= 999) candidates[m[1]] = (candidates[m[1]] || 0) + 1;
          }
        }
      } catch (_e2) {
        /* ignore */
      }
    }

    var config = getConfig();
    if (config && config.idPrograma) {
      var id = config.idPrograma;
      Object.keys(candidates).forEach(function (p) {
        if (p.indexOf(id) >= 0) candidates[p] += 100;
      });
    }

    var best = null;
    var bestScore = 0;
    Object.keys(candidates).forEach(function (p) {
      if (candidates[p] > bestScore) {
        best = p;
        bestScore = candidates[p];
      }
    });
    return bestScore >= 1 ? best : null;
  }

  function classNums(prefix) {
    var re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)$');
    var nums = [];
    var seen = {};
    var stores = [localStorage, sessionStorage];
    var si;
    var store;
    var i;
    var key;
    var m;

    for (si = 0; si < stores.length; si++) {
      store = stores[si];
      try {
        for (i = 0; i < store.length; i++) {
          key = store.key(i);
          m = key && key.match(re);
          if (m && !seen[m[1]]) {
            seen[m[1]] = true;
            nums.push(Number(m[1]));
          }
        }
      } catch (_e) {
        /* ignore */
      }
    }

    nums.sort(function (a, b) {
      return a - b;
    });
    return nums;
  }

  function scoreForSlot(prefix, slot) {
    var raw = readFromStore(localStorage, prefix, slot);
    if (raw == null || raw === '') raw = readFromStore(sessionStorage, prefix, slot);
    return Number(raw || 0);
  }

  function resolveActivePrefix() {
    var config = getConfig();
    if (config && config.resolvedPrefix) return config.resolvedPrefix;
    if (config && config.defaultPrefix) return config.defaultPrefix;
    var discovered = discoverPrefix();
    if (discovered) {
      if (config) config.resolvedPrefix = discovered;
      return discovered;
    }
    return null;
  }

  function totalClassSlots(prefix, nums) {
    var max = 0;
    var i;
    for (i = 0; i < nums.length; i++) max = Math.max(max, nums[i]);
    return Math.max(max, 7);
  }

  function readState() {
    var prefix = resolveActivePrefix();
    if (!prefix) return null;

    var nums = classNums(prefix);
    var finalRaw = readFinalFromStore(localStorage, prefix);
    if (finalRaw == null || finalRaw === '') finalRaw = readFinalFromStore(sessionStorage, prefix);
    var finalPts = finalRaw != null && finalRaw !== '' ? Number(finalRaw) : null;

    if (!nums.length && (finalPts == null || finalPts <= 0)) return null;

    var slots = nums.length ? totalClassSlots(prefix, nums) : 7;
    var totalPercent = 0;
    var approved = 0;
    var scores = [];
    var clases = [];
    var sumaConNota = 0;
    var countConNota = 0;
    var i;
    var v;

    for (i = 1; i <= slots; i++) {
      v = scoreForSlot(prefix, i);
      scores.push(v);
      totalPercent += v;
      if (v >= CLASS_PASS) approved++;
      clases.push({
        numero: i,
        pct: v,
        aprobada: v >= CLASS_PASS,
      });
      if (v > 0) {
        sumaConNota += v;
        countConNota++;
      }
    }

    var pctCompletitud = Math.round(totalPercent / slots);
    var notaEval =
      finalPts != null && finalPts > 0
        ? Math.min(100, Math.round((finalPts / FINAL_MAX_PTS) * 100))
        : null;

    return {
      prefix: prefix,
      pctCompletitud: pctCompletitud,
      approved: approved,
      totalClasses: slots,
      scores: scores,
      clases: clases,
      promedioClases: countConNota ? Math.round(sumaConNota / countConNota) : null,
      finalPts: finalPts,
      notaEval: notaEval,
      fingerprint: prefix + '|' + scores.join(',') + '|' + String(finalPts),
    };
  }

  function sync(force) {
    if (syncing || !window.ARGO || !window.ARGO.ready()) return;
    var st = readState();
    if (!st) return;
    if (!force && st.fingerprint === lastFingerprint) return;

    var body = {
      pctCompletitud: st.pctCompletitud,
      clases: st.clases,
      promedioClases: st.promedioClases,
    };
    if (st.finalPts != null && st.finalPts > 0) {
      body.notaEval = st.notaEval;
      body.evaluacionFinal = true;
    }

    syncing = true;
    window.ARGO.reportProgress(body)
      .then(function () {
        lastFingerprint = st.fingerprint;
      })
      .finally(function () {
        syncing = false;
      });
  }

  function kick(force) {
    setTimeout(function () {
      sync(!!force);
    }, 300);
  }

  function resetCourse() {
    lastFingerprint = '';
  }

  function hookStorage(store) {
    if (!store || typeof store.setItem !== 'function') return;
    try {
      var origSet = store.setItem.bind(store);
      store.setItem = function (key, value) {
        origSet(key, value);
        if (isProgressStorageKey(key)) {
          rememberPrefixFromKey(key);
          setTimeout(function () {
            kick(false);
          }, 0);
        }
      };
      if (typeof store.removeItem === 'function') {
        var origRemove = store.removeItem.bind(store);
        store.removeItem = function (key) {
          origRemove(key);
          if (isProgressStorageKey(key)) {
            setTimeout(function () {
              kick(false);
            }, 0);
          }
        };
      }
    } catch (_e) {
      /* ignore */
    }
  }

  hookStorage(localStorage);
  hookStorage(sessionStorage);

  window.addEventListener('storage', function () {
    kick(false);
  });

  var wait = 0;
  var boot = setInterval(function () {
    wait++;
    if (window.ARGO && window.ARGO.ready()) {
      clearInterval(boot);
      kick(true);
      setInterval(function () {
        kick(false);
      }, SYNC_MS);
    } else if (wait > 300) {
      clearInterval(boot);
      console.warn('[ARGO] Sin token del portal — el progreso no se guardará en el aula hasta iniciar sesión.');
    }
  }, 400);

  window.addEventListener('pagehide', function () {
    sync(true);
  });

  window.__argoAutoSync = {
    kick: kick,
    readState: readState,
    sync: sync,
    resetCourse: resetCourse,
    resolveActivePrefix: resolveActivePrefix,
  };
})();
