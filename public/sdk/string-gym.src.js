/*!
 * STRING GYM SDK — Web Components para conectar webs externas a la API pública.
 * Vanilla JS (sin dependencias). Funciona en cualquier web.
 * Uso: <script src="https://app.gym.stringwebs.com/sdk/string-gym.js"></script>
 */
(function () {
  "use strict";

  var SDK_VERSION = "1.0.0";
  var DEFAULT_API_BASE = "https://app.gym.stringwebs.com/api/v1";

  function apiBase() {
    return window.STRING_GYM_API_BASE || DEFAULT_API_BASE;
  }

  // ───────────────────────── utils ─────────────────────────

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  var MXN = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

  function hora12(t) {
    var p = String(t || "").split(":");
    var h = Number(p[0]);
    var m = p[1] || "00";
    var ampm = h < 12 ? "AM" : "PM";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + m + " " + ampm;
  }

  function fechaLarga(ymd) {
    var parts = String(ymd).split("-");
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    var dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    var meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return dias[d.getUTCDay()] + " " + d.getUTCDate() + " " + meses[d.getUTCMonth()];
  }

  function scrollToForm(id) {
    if (!id) return;
    var elFound = document.getElementById(id);
    if (elFound) elFound.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function SDKError(message, status) {
    this.message = message;
    this.status = status;
  }

  // Cache compartido de /info por gym (para auto-detectar el color).
  var _infoCache = {};
  function fetchGymInfo(gym) {
    if (!gym) return Promise.resolve(null);
    if (!_infoCache[gym]) {
      _infoCache[gym] = fetch(apiBase() + "/" + encodeURIComponent(gym) + "/info")
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (j) {
          return j ? j.data : null;
        })
        .catch(function () {
          return null;
        });
    }
    return _infoCache[gym];
  }

  // ───────────────────────── estilos ─────────────────────────

  var BASE_CSS = [
    ":host{display:block;color:var(--sg-color-text,#111827);font-family:var(--sg-font-family,inherit);font-size:14px;line-height:1.4}",
    ":host *{box-sizing:border-box}",
    ".sg-grid{display:grid;gap:var(--sg-spacing,1rem);grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}",
    ".sg-card{background:var(--sg-color-bg,#fff);border:1px solid rgba(0,0,0,.1);border-radius:var(--sg-border-radius,8px);padding:var(--sg-spacing,1rem);display:flex;flex-direction:column;gap:.5rem}",
    ".sg-title{font-weight:700;font-size:1rem;margin:0}",
    ".sg-muted{color:rgba(0,0,0,.55);font-size:.85rem}",
    ".sg-price{font-size:1.5rem;font-weight:800;color:var(--sg-color-primary,#10b981)}",
    ".sg-btn{background:var(--sg-color-primary,#10b981);color:#fff;border:none;border-radius:var(--sg-border-radius,8px);padding:.6rem 1rem;font-size:.9rem;font-weight:600;cursor:pointer;font-family:inherit}",
    ".sg-btn:hover{filter:brightness(.95)}",
    ".sg-btn:focus-visible{outline:2px solid var(--sg-color-primary,#10b981);outline-offset:2px}",
    ".sg-btn[disabled]{opacity:.6;cursor:not-allowed}",
    ".sg-btn-ghost{background:transparent;color:var(--sg-color-primary,#10b981);border:1px solid var(--sg-color-primary,#10b981)}",
    ".sg-input{width:100%;padding:.55rem .7rem;border:1px solid rgba(0,0,0,.2);border-radius:var(--sg-border-radius,8px);font-size:.9rem;font-family:inherit;background:#fff;color:inherit}",
    ".sg-input:focus{outline:none;border-color:var(--sg-color-primary,#10b981)}",
    ".sg-row{display:flex;flex-direction:column;gap:.35rem}",
    ".sg-cal{display:flex;gap:.75rem;overflow-x:auto;padding-bottom:.5rem}",
    ".sg-day{min-width:170px;flex:1 0 170px}",
    ".sg-day-h{font-weight:700;font-size:.85rem;margin-bottom:.5rem}",
    ".sg-ses{border:1px solid rgba(0,0,0,.1);border-left:4px solid var(--sg-color-primary,#10b981);border-radius:var(--sg-border-radius,8px);padding:.5rem .6rem;margin-bottom:.5rem;background:var(--sg-color-bg,#fff)}",
    ".sg-ses-n{font-weight:600;font-size:.9rem}",
    ".sg-badge{display:inline-block;font-size:.7rem;font-weight:600;padding:.1rem .4rem;border-radius:999px;background:rgba(0,0,0,.06)}",
    ".sg-full{color:#b45309}",
    ".sg-skel{background:linear-gradient(90deg,rgba(0,0,0,.06),rgba(0,0,0,.13),rgba(0,0,0,.06));background-size:200% 100%;animation:sg-shim 1.2s infinite;border-radius:var(--sg-border-radius,8px);height:14px}",
    "@keyframes sg-shim{0%{background-position:200% 0}100%{background-position:-200% 0}}",
    ".sg-error{color:#b91c1c;font-size:.85rem;background:rgba(185,28,28,.08);border:1px solid rgba(185,28,28,.25);border-radius:var(--sg-border-radius,8px);padding:.6rem .8rem}",
    ".sg-ok{color:#047857;font-size:.9rem;background:rgba(4,120,87,.08);border:1px solid rgba(4,120,87,.25);border-radius:var(--sg-border-radius,8px);padding:.8rem 1rem;text-align:center}",
    ".sg-form{display:flex;flex-direction:column;gap:.6rem;max-width:420px}",
    "@media(max-width:480px){.sg-day{min-width:150px;flex-basis:150px}}",
  ].join("");

  // ───────────────────────── base class ─────────────────────────

  function defineBase() {
    return class StringGymBase extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      get gym() {
        return this.getAttribute("gym");
      }
      get apiKey() {
        return this.getAttribute("api-key");
      }

      render(html) {
        this.shadowRoot.innerHTML = "<style>" + BASE_CSS + "</style>" + html;
      }

      renderSkeleton(n) {
        var rows = "";
        for (var i = 0; i < (n || 3); i++) {
          rows +=
            '<div class="sg-card"><div class="sg-skel" style="width:60%"></div>' +
            '<div class="sg-skel" style="width:90%;height:28px"></div>' +
            '<div class="sg-skel" style="width:40%"></div></div>';
        }
        this.render('<div class="sg-grid">' + rows + "</div>");
      }

      renderError(msg) {
        this.render('<div class="sg-error">⚠️ ' + esc(msg) + "</div>");
      }

      async fetchData(endpoint, options) {
        options = options || {};
        var gym = this.gym;
        if (!gym) throw new SDKError("Falta el atributo gym.", 0);
        var headers = Object.assign({}, options.headers || {});
        if (options.body) headers["Content-Type"] = "application/json";
        if (this.apiKey) headers["Authorization"] = "Bearer " + this.apiKey;

        var res;
        try {
          res = await fetch(
            apiBase() + "/" + encodeURIComponent(gym) + endpoint,
            Object.assign({}, options, { headers: headers })
          );
        } catch (e) {
          throw new SDKError("No se pudo conectar con el servidor.", 0);
        }
        var json = null;
        try {
          json = await res.json();
        } catch (e) {}
        if (!res.ok) {
          throw new SDKError(
            (json && json.error && json.error.message) || "Ocurrió un error.",
            res.status
          );
        }
        return json ? json.data : null;
      }

      // Aplica el color del gym como --sg-color-primary si la web no lo definió.
      async applyAccent() {
        try {
          var cur = getComputedStyle(this)
            .getPropertyValue("--sg-color-primary")
            .trim();
          if (cur) return;
          var info = await fetchGymInfo(this.gym);
          if (info && info.color_acento) {
            this.style.setProperty("--sg-color-primary", info.color_acento);
          }
        } catch (e) {}
      }
    };
  }

  var StringGymBase = defineBase();

  // ───────────────────────── <string-gym-info> ─────────────────────────

  class StringGymInfo extends StringGymBase {
    async connectedCallback() {
      this.render('<div class="sg-card"><div class="sg-skel" style="width:50%"></div></div>');
      try {
        var info = await this.fetchData("/info");
        var logo = info.logo_url
          ? '<img src="' + esc(info.logo_url) + '" alt="' + esc(info.nombre) +
            '" style="max-height:48px;object-fit:contain"/>'
          : "";
        this.render(
          '<div class="sg-card" style="flex-direction:row;align-items:center;gap:.75rem">' +
            logo +
            '<div><div class="sg-title">' + esc(info.nombre) + "</div>" +
            (info.telefono ? '<div class="sg-muted">' + esc(info.telefono) + "</div>" : "") +
            "</div></div>"
        );
      } catch (e) {
        this.renderError("No se pudo cargar la información del gym.");
      }
    }
  }

  // ───────────────────────── <string-gym-planes> ─────────────────────────

  class StringGymPlanes extends StringGymBase {
    async connectedCallback() {
      this.renderSkeleton(3);
      this.applyAccent();
      var ctaTexto = this.getAttribute("cta-texto") || "Me interesa";
      var ctaForm = this.getAttribute("cta-form") || "";
      try {
        var planes = await this.fetchData("/planes");
        if (!planes.length) {
          this.render('<div class="sg-muted">No hay planes disponibles.</div>');
          return;
        }
        var cards = planes
          .map(function (p) {
            return (
              '<div class="sg-card">' +
              '<div class="sg-title">' + esc(p.nombre) + "</div>" +
              '<div class="sg-price">' + MXN.format(p.precio) + "</div>" +
              '<div class="sg-muted">' + p.duracion_dias + " días</div>" +
              (p.descripcion ? '<div class="sg-muted">' + esc(p.descripcion) + "</div>" : "") +
              '<button class="sg-btn" data-cta>' + esc(ctaTexto) + "</button>" +
              "</div>"
            );
          })
          .join("");
        this.render('<div class="sg-grid">' + cards + "</div>");
        this.shadowRoot.querySelectorAll("[data-cta]").forEach(function (b) {
          b.addEventListener("click", function () {
            scrollToForm(ctaForm);
          });
        });
      } catch (e) {
        this.renderError("No se pudieron cargar los planes.");
      }
    }
  }

  // ───────────────────────── <string-gym-calendario> ─────────────────────────

  class StringGymCalendario extends StringGymBase {
    async connectedCallback() {
      this.renderSkeleton(2);
      this.applyAccent();
      await this.load();
    }

    async load() {
      var tipo = this.getAttribute("tipo");
      var q = tipo ? "?tipo=" + encodeURIComponent(tipo) : "";
      try {
        var sesiones = await this.fetchData("/clases" + q);
        this.sesiones = sesiones;
        this.renderCal();
      } catch (e) {
        this.renderError("No se pudo cargar el calendario de clases.");
      }
    }

    renderCal() {
      var self = this;
      var sesiones = this.sesiones || [];
      if (!sesiones.length) {
        this.render('<div class="sg-muted">No hay clases programadas.</div>');
        return;
      }
      var byDay = {};
      sesiones.forEach(function (s) {
        (byDay[s.fecha] = byDay[s.fecha] || []).push(s);
      });
      var dias = Object.keys(byDay).sort();
      var hasKey = !!this.apiKey;
      var ctaForm = this.getAttribute("cta-form") || "";

      var cols = dias
        .map(function (dia) {
          var ses = byDay[dia]
            .map(function (s) {
              var lleno = !s.disponible;
              var btn = lleno
                ? '<span class="sg-badge sg-full">Lleno</span>'
                : '<button class="sg-btn" style="padding:.35rem .7rem;font-size:.8rem" data-ses="' +
                  esc(s.sesion_id) + '">Reservar</button>';
              return (
                '<div class="sg-ses" style="border-left-color:' + esc(s.clase_color || "") + '">' +
                '<div class="sg-ses-n">' + esc(s.clase_nombre) + "</div>" +
                '<div class="sg-muted">' + hora12(s.hora_inicio) +
                (s.instructor ? " · " + esc(s.instructor) : "") + "</div>" +
                '<div class="sg-muted">' + (s.cupo_maximo - s.cupo_disponible) + "/" + s.cupo_maximo + " · </div>" +
                btn +
                "</div>"
              );
            })
            .join("");
          return (
            '<div class="sg-day"><div class="sg-day-h">' + fechaLarga(dia) + "</div>" + ses + "</div>"
          );
        })
        .join("");

      this.render('<div class="sg-cal">' + cols + "</div>");

      this.shadowRoot.querySelectorAll("[data-ses]").forEach(function (b) {
        b.addEventListener("click", function () {
          var sid = b.getAttribute("data-ses");
          if (hasKey) self.openReserva(sid);
          else scrollToForm(ctaForm);
        });
      });
    }

    openReserva(sesionId) {
      var self = this;
      this.render(
        '<div class="sg-form">' +
          '<div class="sg-title">Reservar tu lugar</div>' +
          '<div class="sg-row"><input class="sg-input" name="nombre" placeholder="Nombre"/></div>' +
          '<div class="sg-row"><input class="sg-input" name="telefono" placeholder="Teléfono"/></div>' +
          '<div class="sg-row"><input class="sg-input" name="email" placeholder="Email (opcional)"/></div>' +
          '<div class="sg-error" data-err style="display:none"></div>' +
          '<div style="display:flex;gap:.5rem">' +
          '<button class="sg-btn-ghost sg-btn" data-back>Volver</button>' +
          '<button class="sg-btn" data-send>Confirmar</button></div>' +
          "</div>"
      );
      var root = this.shadowRoot;
      root.querySelector("[data-back]").addEventListener("click", function () {
        self.renderCal();
      });
      root.querySelector("[data-send]").addEventListener("click", async function () {
        var nombre = root.querySelector('[name="nombre"]').value.trim();
        var telefono = root.querySelector('[name="telefono"]').value.trim();
        var email = root.querySelector('[name="email"]').value.trim();
        var errBox = root.querySelector("[data-err]");
        if (!nombre || !telefono) {
          errBox.textContent = "Nombre y teléfono son requeridos.";
          errBox.style.display = "block";
          return;
        }
        this.disabled = true;
        this.textContent = "Enviando…";
        try {
          var data = await self.fetchData("/reservas", {
            method: "POST",
            body: JSON.stringify({
              sesion_id: sesionId,
              nombre: nombre,
              telefono: telefono,
              email: email || undefined,
            }),
          });
          self.render('<div class="sg-ok">✓ ' + esc(data.mensaje || "Reserva realizada.") + "</div>");
          fetchGymInfo(self.gym); // no-op para mantener cache
        } catch (e) {
          errBox.textContent = e.message || "No se pudo reservar.";
          errBox.style.display = "block";
          this.disabled = false;
          this.textContent = "Confirmar";
        }
      });
    }
  }

  // ───────────────────────── <string-gym-form> ─────────────────────────

  class StringGymForm extends StringGymBase {
    connectedCallback() {
      this.applyAccent();
      this.state = "idle";
      this.renderForm();
    }

    renderForm() {
      var titulo = this.getAttribute("titulo") || "Déjanos tus datos";
      var boton = this.getAttribute("boton") || "Enviar";
      this.render(
        '<form class="sg-form" novalidate>' +
          '<div class="sg-title">' + esc(titulo) + "</div>" +
          '<div class="sg-row"><input class="sg-input" name="nombre" placeholder="Nombre" aria-label="Nombre"/></div>' +
          '<div class="sg-row"><input class="sg-input" name="telefono" placeholder="Teléfono" aria-label="Teléfono"/></div>' +
          '<div class="sg-row"><input class="sg-input" name="email" placeholder="Email (opcional)" aria-label="Email"/></div>' +
          '<div class="sg-row"><textarea class="sg-input" name="mensaje" rows="3" placeholder="Mensaje (opcional)" aria-label="Mensaje"></textarea></div>' +
          '<div class="sg-error" data-err style="display:none"></div>' +
          '<button class="sg-btn" type="submit">' + esc(boton) + "</button>" +
          "</form>"
      );
      var self = this;
      this.shadowRoot.querySelector("form").addEventListener("submit", function (ev) {
        ev.preventDefault();
        self.submit();
      });
    }

    async submit() {
      var root = this.shadowRoot;
      var nombre = root.querySelector('[name="nombre"]').value.trim();
      var telefono = root.querySelector('[name="telefono"]').value.trim();
      var email = root.querySelector('[name="email"]').value.trim();
      var mensaje = root.querySelector('[name="mensaje"]').value.trim();
      var errBox = root.querySelector("[data-err]");
      errBox.style.display = "none";

      if (!nombre || !telefono) {
        errBox.textContent = "Nombre y teléfono son requeridos.";
        errBox.style.display = "block";
        return;
      }

      var btn = root.querySelector('button[type="submit"]');
      btn.disabled = true;
      var btnText = btn.textContent;
      btn.textContent = "Enviando…";

      var tipo = this.getAttribute("tipo") || "contacto";
      try {
        var data;
        if (tipo === "reserva") {
          data = await this.fetchData("/reservas", {
            method: "POST",
            body: JSON.stringify({
              sesion_id: this.getAttribute("sesion-id"),
              nombre: nombre,
              telefono: telefono,
              email: email || undefined,
            }),
          });
        } else {
          data = await this.fetchData("/prospectos", {
            method: "POST",
            body: JSON.stringify({
              nombre: nombre,
              telefono: telefono,
              email: email || undefined,
              mensaje: mensaje || undefined,
              origen_detalle:
                tipo === "clase-gratis" ? "clase-gratis" : "formulario-contacto",
            }),
          });
        }
        var msg =
          this.getAttribute("exito-mensaje") ||
          (data && data.mensaje) ||
          "¡Gracias! Te contactaremos pronto.";
        this.render('<div class="sg-ok">✓ ' + esc(msg) + "</div>");
      } catch (e) {
        errBox.textContent = e.message || "No se pudo enviar. Inténtalo de nuevo.";
        errBox.style.display = "block";
        btn.disabled = false;
        btn.textContent = btnText;
      }
    }
  }

  // ───────────────────────── registro ─────────────────────────

  function define(name, cls) {
    if (!customElements.get(name)) customElements.define(name, cls);
  }
  define("string-gym-info", StringGymInfo);
  define("string-gym-planes", StringGymPlanes);
  define("string-gym-calendario", StringGymCalendario);
  define("string-gym-form", StringGymForm);

  window.StringGymSDK = { version: SDK_VERSION };
})();
