"use strict";
function alCargarDOM(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

// ========== VARIABLES GLOBALES ==========
    const asesoresSeleccionados = new Set();
    const supervisoresSeleccionados = new Set();
    const asesoresSeleccionadosPeriodo = new Set();
    let estadoGlobal = {
    mesActual: '',
    añoActual: '',
    periodoActual: ''
    };
    let mesesAMostrar = 6;
    let modoPromedioPeriodo = false;
    let datosMeses = window.__APP_DATA__.datosMeses;
    let datosSupervisores = window.__APP_DATA__.datosSupervisores;
    window.baseAsesoresAnalisis = window.__APP_DATA__.baseAsesoresAnalisis;
    let datosAsesoresInf = window.__APP_DATA__.datosAsesoresInf;
    const vigentesDimMesActual = Array.isArray(window.__APP_DATA__.vigentesDimMesActual)
      ? window.__APP_DATA__.vigentesDimMesActual
      : [];
    let chartTop10Modal = null;
    let chartInstance = null;
    let chartInstanceSupervisores = null;
    let chartAlcanceEquipos = null;
    let chartTendencia = null;
    let chartIncrementoTotal = null;
    let supervisorFiltroActual = 'TODOS';
    let vistaEvaluacion = '3M'; 
    let modoOtrosEvaluacion = false;
    let incluirMesSeleccionadoEval = false;
    let calidadOrdenActual = null;
    let calidadQuintilSeleccionado = 'calidad_pdp';
    let asesorSeleccionadoHistorico = '';
    let asesorRangoHistorico = 'ALL';
    let excluirMesActualHistorico = true;
    let topPercentilMetrica = 'general';
    let topPercentilSoloVigentes = false;
    const topPercentilSedes = new Set(['SURCO', 'LIMA']);
    let chartAsesorHistorico = null;
    let chartsMetricasAsesor = {};
    window.canalSeleccionadoGlobal = window.canalSeleccionadoGlobal || 'SURCO';

    function normalizarCanalDashboard(canal) {
      const texto = String(canal || '').trim().toUpperCase();
      if (!texto || texto === 'TODOS' || texto === 'TODOS LOS CANALES') return 'TODOS LOS CANALES';
      if (texto.includes('BPO')) return 'BPO';
      if (texto.includes('SURCO')) return 'SURCO';
      return texto;
    }

    function canalActivoDashboard() {
      return normalizarCanalDashboard(window.canalSeleccionadoGlobal || 'SURCO');
    }

    function _escaparHTMLExcepcion(valor) {
      return String(valor ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
      }[c]));
    }

    function obtenerExcepcionesPeriodoActual() {
      const mes = document.getElementById('selectorMes')?.value || '';
      const anio = document.getElementById('selectorAño')?.value || '';
      const periodo = mes && anio ? `${mes}_${anio}` : '';
      return filtrarAsesoresPorCanal(Array.isArray(datosMeses?.[periodo]) ? datosMeses[periodo] : [])
        .filter(asesor => asesor?.excepcion_alcance && asesor?.excepcion_aplicada);
    }

    function actualizarIndicadorExcepcionesPeriodo() {
      const boton = document.getElementById('btnExcepcionesPeriodo');
      if (!boton) return;
      const cantidad = obtenerExcepcionesPeriodoActual().length;
      boton.classList.toggle('visible', cantidad > 0);
      boton.setAttribute('aria-label', cantidad ? `${cantidad} excepciones aplicadas; ver detalle` : 'Sin excepciones aplicadas');
      boton.title = cantidad ? `${cantidad} excepciones aplicadas en el periodo y canal` : 'Sin excepciones aplicadas';
    }

    function abrirModalExcepciones() {
      const modal = document.getElementById('modalExcepcionesPeriodo');
      const contenido = document.getElementById('contenidoExcepcionesPeriodo');
      const subtitulo = document.getElementById('subtituloExcepcionesPeriodo');
      if (!modal || !contenido) return;
      const mes = document.getElementById('selectorMes')?.value || '';
      const anio = document.getElementById('selectorAño')?.value || '';
      const periodo = `${mes}_${anio}`;
      const canal = canalActivoDashboard() === 'BPO' ? 'LIMA' : canalActivoDashboard();
      const items = obtenerExcepcionesPeriodoActual();
      if (subtitulo) subtitulo.textContent = `${periodo.replace('_', ' ')} · ${canal} · ${items.length} modificación(es)`;
      contenido.innerHTML = items.length ? items.map(asesor => {
        const e = asesor.excepcion_aplicada || {};
        const pct = n => `${(Number(n || 0) * 100).toFixed(2)}%`;
        const moneda = n => Number(n || 0).toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2});
        return `<div class="excepcion-item">
          <strong>${_escaparHTMLExcepcion(asesor.nombre || e.asesor)}</strong>
          <div class="excepcion-grid">
            <div><b>${_escaparHTMLExcepcion(e.motivo1 || 'Motivo 1')}</b>: S/ ${moneda(e.recupero1)} / S/ ${moneda(e.meta1)} = ${pct(Number(e.meta1) > 0 ? Number(e.recupero1)/Number(e.meta1) : 0)}</div>
            <div><b>${_escaparHTMLExcepcion(e.motivo2 || 'Motivo 2')}</b>: S/ ${moneda(e.recupero2)} / S/ ${moneda(e.meta2)} = ${pct(Number(e.meta2) > 0 ? Number(e.recupero2)/Number(e.meta2) : 0)}</div>
          </div>
          <div class="excepcion-res">ALCANCE: ${Number(asesor.alcance_original || 0).toFixed(2)}% → ${Number(asesor.porcentaje || 0).toFixed(2)}%</div>
          <small>RES = PROMEDIO(RECUPERO1/META1; RECUPERO2/META2)</small>
        </div>`;
      }).join('') : '<p>No hay excepciones para el periodo y canal seleccionados.</p>';
      modal.classList.add('visible');
      modal.setAttribute('aria-hidden', 'false');
    }

    function cerrarModalExcepciones() {
      const modal = document.getElementById('modalExcepcionesPeriodo');
      if (!modal) return;
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
    }

    function etiquetaCanalAsesorHTML(asesor) {
      if (canalActivoDashboard() !== 'TODOS LOS CANALES') return '';
      const canalReal = normalizarCanalDashboard(asesor?.canal || '');
      if (canalReal === 'SURCO') {
        return '<small class="asesor-canal-etiqueta canal-surco">SURCO</small>';
      }
      if (canalReal === 'BPO' || canalReal === 'LIMA') {
        return '<small class="asesor-canal-etiqueta canal-lima">LIMA</small>';
      }
      return canalReal && canalReal !== 'TODOS LOS CANALES'
        ? `<small class="asesor-canal-etiqueta">${canalReal}</small>`
        : '';
    }

    function etiquetaCanalAsesorTexto(asesor) {
      if (canalActivoDashboard() !== 'TODOS LOS CANALES') return '';
      const canalReal = normalizarCanalDashboard(asesor?.canal || '');
      if (canalReal === 'SURCO') return ' (SURCO)';
      if (canalReal === 'BPO' || canalReal === 'LIMA') return ' (LIMA)';
      return canalReal && canalReal !== 'TODOS LOS CANALES' ? ` (${canalReal})` : '';
    }

    function sincronizarBotonesCanalAlcances() {
      const canalActivo = canalActivoDashboard();
      window.canalSeleccionadoGlobal = canalActivo;
      window.canalAlcancesSeleccionado = canalActivo;
      document.querySelectorAll('[data-canal-alcances]').forEach(btn => {
        const canalBoton = normalizarCanalDashboard(btn.getAttribute('data-canal-alcances'));
        btn.classList.toggle('activo', canalBoton === canalActivo);
        btn.setAttribute('aria-pressed', String(canalBoton === canalActivo));
      });
    }

    function asesorEnCanal(asesor) {
      const canalActivo = canalActivoDashboard();
      if (canalActivo === 'TODOS LOS CANALES') return true;
      return normalizarCanalDashboard(asesor?.canal || '') === canalActivo;
    }

    function filtrarAsesoresPorCanal(asesores) {
      return (Array.isArray(asesores) ? asesores : []).filter(asesorEnCanal);
    }

    function supervisorEnCanal(supervisor, periodoCompleto = '') {
      const canalActivo = canalActivoDashboard();
      if (canalActivo === 'TODOS LOS CANALES') return true;
      const canalSup = normalizarCanalDashboard(datosSupervisores?.[supervisor]?.[periodoCompleto]?.canal || '');
      if (canalSup && canalSup !== 'TODOS LOS CANALES') return canalSup === canalActivo;
      const asesoresPeriodo = filtrarAsesoresPorCanal(Array.isArray(datosMeses?.[periodoCompleto]) ? datosMeses[periodoCompleto] : []);
      return asesoresPeriodo.some(a => String(a.supervisor || '').trim() === supervisor && asesorEnCanal(a));
    }

    const calidadIndicadores = [
      { key: 'puntualidad', label: 'Puntualidad' },
      { key: 'alcance', label: 'Alcance' },
      { key: 'calidad_pdp', label: 'Calidad PDP' },
      { key: 'cierre', label: 'Cierre' },
      { key: 'condonacion', label: 'Condonación' },
      { key: 'ticket_pdp', label: 'Ticket PDP', independiente: true },
      { key: 'pdp', label: 'PDP', independiente: true }
    ];

    const indicadorDetalles = {
      puntualidad: ['hora_ingreso', 'falta', 'tardanza', 'tardanza_tiempo'],
      alcance: ['recupero', 'meta'],
      calidad_pdp: ['recupero', 'monto_pdp'],
      cierre: ['pdp', 'cef_unico'],
      condonacion: ['pago_condonado', 'dk']
    };

    const indicadorLabels = {
      puntualidad: 'Puntualidad',
      hora_ingreso: 'Hora Ingreso',
      falta: 'Falta',
      tardanza: 'Tardanza',
      tardanza_tiempo: 'Tardanza Tiempo',
      alcance: 'Alcance',
      meta: 'Meta',
      ticket_pdp: 'Ticket PDP',
      monto_pdp: 'Monto PDP',
      pdp: 'PDP',
      calidad_pdp: 'Calidad PDP',
      recupero: 'Recupero',
      cierre: 'Cierre',
      cef_unico: 'CEF Unico',
      condonacion: 'Condonación',
      pago_condonado: 'Pago Condonado',
      dk: 'DK'
    };

    const columnasCantidadIndicadores = new Set([
      'cef_unico', 'pdp', 'monto_pdp', 'dk', 'pago_condonado', 'recupero', 'meta', 'ticket_pdp'
    ]);

    const gruposDetalleAbiertos = new Set();

    function formatearPorcentajeCalidad(valor) {
      const num = Number(valor);
      if (!Number.isFinite(num)) return '&mdash;';
      return `${num.toFixed(1)}%`;
    }

    function formatearEstadoBinario(valor) {
      const num = Number(valor);
      if (Number.isFinite(num) && num > 0) return '<span class="estado-ind estado-x">&#10005;</span>';
      return '<span class="estado-ind estado-ok">&#10003;</span>';
    }

    function formatearHoraIndicador(valor, marcarRojo = false) {
      const num = Number(valor);
      if (!Number.isFinite(num) || num <= 0) return '<span class="hora-ind">0:00:00</span>';
      const total = Math.round(num * 24 * 60 * 60);
      const horas = Math.floor(total / 3600);
      const minutos = Math.floor((total % 3600) / 60);
      const segundos = total % 60;
      const texto = `${horas}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
      return `<span class="hora-ind ${marcarRojo ? 'hora-alerta' : ''}">${texto}</span>`;
    }

    function formatearDatoIndicador(valor, key = '', contexto = null) {
      if (key === 'hora_ingreso') {
        const texto = String(valor ?? '').trim();
        return texto || '&mdash;';
      }
      if (key === 'tardanza' || key === 'falta') return formatearEstadoBinario(valor);
      if (key === 'tardanza_tiempo') {
        const valorTiempo = Number(valor);
        return formatearHoraIndicador(valorTiempo, Number.isFinite(valorTiempo) && valorTiempo > 0);
      }
      const num = Number(valor);
      if (!Number.isFinite(num)) return '&mdash;';
      if (columnasCantidadIndicadores.has(key)) return num.toLocaleString('es-PE', { maximumFractionDigits: 2 });
      return formatearPorcentajeCalidad(num);
    }

    function obtenerDatoCalidad(asesor, key) {
      if (key === 'alcance') {
        const valor = Number(asesor?.porcentaje || 0);
        return { valor: Number.isFinite(valor) ? valor : 0, excepcion: Boolean(asesor?.excepcion_alcance) };
      }
      if (key === 'meta') return { valor: Number(asesor?.meta || 0) };
      const calidad = asesor.indicadores_calidad || {};
      return calidad.indicadores?.[key] || null;
    }

    function obtenerRegistrosCalidad(asesor) {
      const calidad = asesor.indicadores_calidad || {};
      const registros = calidadIndicadores
        .map(ind => Number(calidad.indicadores?.[ind.key]?.registros || 0))
        .filter(n => Number.isFinite(n));
      return registros.length ? Math.max(...registros) : Number(calidad.dias_registrados || 0);
    }

    const filasCalidadAbiertas = new Set();

    function obtenerColumnasCalidadVisibles() {
      const columnas = [];
      calidadIndicadores.forEach(ind => {
        columnas.push([ind.key, indicadorLabels[ind.key], 'principal']);
        if (gruposDetalleAbiertos.has(ind.key)) {
          (indicadorDetalles[ind.key] || []).forEach(key => columnas.push([key, indicadorLabels[key] || key, ind.key]));
        }
      });
      return columnas;
    }

    function actualizarColspansIndicadores() {
      calidadIndicadores.forEach(ind => {
        const abierto = gruposDetalleAbiertos.has(ind.key);
        const th = document.querySelector(`[data-grupo-head="${ind.key}"]`);
        if (th) {
          th.classList.toggle('expandido', abierto);
        }
      });
    }

    function claseDetalle(grupo) {
      return gruposDetalleAbiertos.has(grupo) ? 'detalle-col visible' : 'detalle-col';
    }

    function crearIdCalidad(asesor, index) {
      const base = `${asesor.nombre || asesor.alias_crr || 'asesor'}-${asesor.supervisor || ''}-${index}`;
      return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-');
    }

    function obtenerColspanCalidadVisible() {
      return 3 + obtenerColumnasCalidadVisibles().length;
    }

    function renderCeldasDiariasCalidad(dia, asesor) {
      const indicadoresDia = dia.indicadores || {};
      const metaMes = Number(asesor?.meta || 0);
      const recuperoDia = Number(indicadoresDia.recupero || 0);
      return obtenerColumnasCalidadVisibles()
        .map(([key, , grupo]) => {
          let valor = indicadoresDia[key];
          if (key === 'alcance') {
            valor = metaMes > 0 && Number.isFinite(recuperoDia) ? (recuperoDia / metaMes) * 100 : 0;
          } else if (grupo === 'alcance' && key === 'meta') {
            valor = Number.isFinite(metaMes) ? metaMes : 0;
          }
          return `<td class="col-num calidad-dia-valor ${grupo === 'principal' ? 'dia-principal' : 'dia-subcol dia-' + grupo}">${formatearDatoIndicador(valor, key, indicadoresDia)}</td>`;
        })
        .join('');
    }

    function renderDetalleDiarioCalidad(asesor, filaId, filaAbierta) {
      const detalle = asesor.indicadores_calidad?.detalle_diario || [];
      if (!detalle.length) {
        return `
          <tr class="calidad-dia-row ${filaAbierta ? 'abierta' : ''}" data-parent-calidad="${filaId}">
            <td colspan="${obtenerColspanCalidadVisible()}" class="calidad-dia-empty">Sin detalle diario para este asesor.</td>
          </tr>
        `;
      }
      return detalle.map((dia, diaIndex) => `
        <tr class="calidad-dia-row ${filaAbierta ? 'abierta' : ''}" data-parent-calidad="${filaId}" style="--delay:${Math.min(diaIndex, 10) * 18}ms">
          <td class="calidad-dia-fecha"><span>${dia.fecha || '&mdash;'}</span></td>
          <td class="calidad-dia-dimension">${asesor.supervisor || 'Sin Supervisor'}</td>
          <td class="calidad-dia-dimension">${asesor.cartera || asesor.segmento || 'No definida'}</td>
          ${renderCeldasDiariasCalidad(dia, asesor)}
        </tr>
      `).join('');
    }

    function toggleDetalleDiarioCalidad(filaId) {
      if (filasCalidadAbiertas.has(filaId)) filasCalidadAbiertas.delete(filaId);
      else filasCalidadAbiertas.add(filaId);
      document.querySelectorAll(`[data-calidad-id="${filaId}"], [data-parent-calidad="${filaId}"]`).forEach(el => {
        el.classList.toggle('abierta', filasCalidadAbiertas.has(filaId));
      });
    }

    function renderizarTablaCalidad(items, mensajeVacio = 'Sin indicadores para mostrar.') {
      const tbody = document.getElementById('tbodyCalidadIndicadores');
      if (!tbody) return;
      if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="${obtenerColspanCalidadVisible()}" class="calidad-tabla-vacia">${mensajeVacio}</td></tr>`;
        return;
      }

      const celdaBarra = (valorEntrada, tipo, excepcion = false) => {
        const valor = Number(valorEntrada);
        const ancho = Number.isFinite(valor) ? Math.max(0, Math.min(100, valor)) : 0;
        const clase = Number.isFinite(valor) ? tipo : 'neutral';
        return `<div class="barra-dato ${clase} ${excepcion ? 'alcance-excepcion' : ''}" style="--valor:${ancho.toFixed(2)}%;"><span>${formatearPorcentajeCalidad(valor)}</span></div>`;
      };

      const celdaDetalle = (asesor, key, grupo) => {
        const valorEspecial = grupo === 'alcance' && key === 'recupero'
          ? Number(asesor?.recupero || 0)
          : (grupo === 'alcance' && key === 'meta' ? Number(asesor?.meta || 0) : null);
        const dato = valorEspecial === null ? obtenerDatoCalidad(asesor, key) : { valor: valorEspecial };
        return `<td class="col-num ${claseDetalle(grupo)} detalle-${grupo}">${formatearDatoIndicador(dato?.valor, key)}</td>`;
      };

      window.asesoresCalidadRenderizados = items;
      tbody.innerHTML = items.map((asesor, index) => {
        const filaId = crearIdCalidad(asesor, index);
        const filaAbierta = filasCalidadAbiertas.has(filaId);
        const puntualidad = obtenerDatoCalidad(asesor, 'puntualidad');
        const alcance = obtenerDatoCalidad(asesor, 'alcance');
        const calidadPdp = obtenerDatoCalidad(asesor, 'calidad_pdp');
        const cierre = obtenerDatoCalidad(asesor, 'cierre');
        const condonacion = obtenerDatoCalidad(asesor, 'condonacion');
        const ticketPdp = obtenerDatoCalidad(asesor, 'ticket_pdp');
        const pdp = obtenerDatoCalidad(asesor, 'pdp');
        return `
          <tr class="calidad-main-row ${filaAbierta ? 'abierta' : ''}" data-calidad-id="${filaId}" data-asesor-index="${index}" onclick="toggleDetalleDiarioCalidad('${filaId}')">
            <td><button type="button" class="calidad-asesor-toggle"><span class="calidad-chevron">&rsaquo;</span><span class="asesor-nombre">${asesor.nombre || asesor.alias_crr || 'Sin nombre'} ${etiquetaCanalAsesorHTML(asesor)}</span></button></td>
            <td>${asesor.supervisor || 'Sin Supervisor'}</td>
            <td>${asesor.cartera || asesor.segmento || 'No definida'}</td>
            <td class="col-num calidad-bar-cell">${celdaBarra(puntualidad?.valor, 'puntualidad')}</td>
            ${celdaDetalle(asesor, 'hora_ingreso', 'puntualidad')}
            ${celdaDetalle(asesor, 'falta', 'puntualidad')}
            ${celdaDetalle(asesor, 'tardanza', 'puntualidad')}
            ${celdaDetalle(asesor, 'tardanza_tiempo', 'puntualidad')}
            <td class="col-num calidad-bar-cell">${celdaBarra(alcance?.valor, 'alcance', asesor.excepcion_alcance)}</td>
            ${celdaDetalle(asesor, 'recupero', 'alcance')}
            ${celdaDetalle(asesor, 'meta', 'alcance')}
            <td class="col-num calidad-bar-cell">${celdaBarra(calidadPdp?.valor, 'calidad-pdp')}</td>
            ${celdaDetalle(asesor, 'recupero', 'calidad_pdp')}
            ${celdaDetalle(asesor, 'monto_pdp', 'calidad_pdp')}
            <td class="col-num calidad-bar-cell">${celdaBarra(cierre?.valor, 'cierre')}</td>
            ${celdaDetalle(asesor, 'pdp', 'cierre')}
            ${celdaDetalle(asesor, 'cef_unico', 'cierre')}
            <td class="col-num calidad-bar-cell">${celdaBarra(condonacion?.valor, 'condonacion')}</td>
            ${celdaDetalle(asesor, 'pago_condonado', 'condonacion')}
            ${celdaDetalle(asesor, 'dk', 'condonacion')}
            <td class="col-num calidad-valor-independiente">${formatearDatoIndicador(ticketPdp?.valor, 'ticket_pdp')}</td>
            <td class="col-num calidad-valor-independiente">${formatearDatoIndicador(pdp?.valor, 'pdp')}</td>
          </tr>
          ${renderDetalleDiarioCalidad(asesor, filaId, filaAbierta)}
        `;
      }).join('');
      actualizarBotonesOrdenCalidad();
    }

    function sincronizarColumnasDetalle() {
      actualizarColspansIndicadores();
      document.querySelectorAll('.indicador-toggle').forEach(btn => {
        const grupo = btn.dataset.grupo;
        btn.classList.toggle('activo', gruposDetalleAbiertos.has(grupo));
        btn.textContent = gruposDetalleAbiertos.has(grupo) ? '-' : '+';
      });
      document.querySelectorAll('.detalle-col').forEach(cell => {
        const grupo = ['puntualidad', 'alcance', 'calidad_pdp', 'cierre', 'condonacion']
          .find(g => cell.classList.contains(`detalle-${g}`));
        cell.classList.toggle('visible', !!grupo && gruposDetalleAbiertos.has(grupo));
      });
    }

    function toggleIndicadorDetalle(grupo) {
      if (gruposDetalleAbiertos.has(grupo)) gruposDetalleAbiertos.delete(grupo);
      else gruposDetalleAbiertos.add(grupo);
      sincronizarColumnasDetalle();
      if (Array.isArray(window.asesoresCalidadRenderizados)) {
        renderizarTablaCalidad(window.asesoresCalidadRenderizados);
        sincronizarColumnasDetalle();
      }
    }

    function aplicarOrdenCalidad(items) {
      if (!calidadOrdenActual) return items;
      return items.slice().sort((a, b) => {
        const av = Number(obtenerDatoCalidad(a, calidadOrdenActual)?.valor);
        const bv = Number(obtenerDatoCalidad(b, calidadOrdenActual)?.valor);
        const an = Number.isFinite(av) ? av : -Infinity;
        const bn = Number.isFinite(bv) ? bv : -Infinity;
        return bn - an;
      });
    }

    function ordenarCalidadPor(key) {
      calidadOrdenActual = key;
      const base = Array.isArray(window.asesoresCalidadBaseRender) ? window.asesoresCalidadBaseRender : window.asesoresCalidadRenderizados;
      if (!Array.isArray(base)) return;
      renderizarTablaCalidad(aplicarOrdenCalidad(base));
      sincronizarColumnasDetalle();
    }

    function actualizarBotonesOrdenCalidad() {
      document.querySelectorAll('.indicador-sort').forEach(btn => {
        btn.classList.toggle('activo', btn.dataset.sortKey === calidadOrdenActual);
      });
    }

    function limpiarCalidad(mensaje = 'No hay indicadores para este periodo.') {
      renderizarTablaCalidad([], mensaje);
      const resumen = document.getElementById('calidadResumen');
      if (resumen) resumen.textContent = mensaje;
      const stats = document.getElementById('calidadStatsAlcances');
      if (stats) stats.innerHTML = '';
      const quintiles = document.getElementById('calidadQuintiles');
      if (quintiles) quintiles.innerHTML = '';
      sincronizarColumnasDetalle();
    }

    function obtenerSupervisoresParaResumen(periodoCompleto, supervisorFiltro = 'TODOS') {
      if (supervisorFiltro && supervisorFiltro !== 'TODOS') {
        const datos = datosSupervisores?.[supervisorFiltro]?.[periodoCompleto];
        return datos ? [{ nombre: supervisorFiltro, datos }] : [];
      }
      return Object.keys(datosSupervisores || {})
        .filter(nombre => supervisorEnCanal(nombre, periodoCompleto))
        .map(nombre => ({ nombre, datos: datosSupervisores?.[nombre]?.[periodoCompleto] }))
        .filter(item => item.datos);
    }

    function calcularResumenAlcanceIndicadores(periodoCompleto, supervisorFiltro = 'TODOS') {
      const supervisores = obtenerSupervisoresParaResumen(periodoCompleto, supervisorFiltro);
      if (!supervisores.length) return null;

      let metaTotalMes = 0;
      let recuperoTotalActual = 0;
      supervisores.forEach(item => {
        metaTotalMes += Number(item.datos.meta_super || 0);
        recuperoTotalActual += Number(item.datos.total_recupero || 0);
      });

      const fechas = new Set();
      supervisores.forEach(item => {
        Object.keys(item.datos.datos_diarios_supervisor || {}).forEach(fecha => fechas.add(fecha));
        if (!Object.keys(item.datos.datos_diarios_supervisor || {}).length) {
          Object.keys(item.datos.alcance_acumulado_diario || {}).forEach(fecha => fechas.add(fecha));
        }
      });

      const fechasOrdenadas = Array.from(fechas).sort((a, b) => convertirFechaDiaria(a) - convertirFechaDiaria(b));
      const diasLaborables = 0;
      let diasTrabajados = 0;

      fechasOrdenadas.forEach((fecha, index) => {
        let recuperoDiaTotal = 0;
        supervisores.forEach(item => {
          const diario = item.datos.datos_diarios_supervisor || {};
          if (diario[fecha] === undefined) return;
          const actual = Number(diario[fecha] || 0);
          const anterior = index > 0 ? Number(diario[fechasOrdenadas[index - 1]] || 0) : 0;
          recuperoDiaTotal += index > 0 ? actual - anterior : actual;
        });
        if (recuperoDiaTotal > 0) diasTrabajados++;
      });

      const alcanceActual = metaTotalMes > 0 ? (recuperoTotalActual / metaTotalMes) * 100 : 0;
      return {
        metaTotalMes,
        recuperoTotalActual,
        alcanceActual,
        diasLaborables,
        diasTrabajados
      };
    }

    function renderizarTarjetasIndicadores(periodoCompleto, supervisorFiltro = 'TODOS') {
      const cont = document.getElementById('calidadStatsAlcances');
      if (!cont) return;
      const datos = calcularResumenAlcanceIndicadores(periodoCompleto, supervisorFiltro);
      if (!datos) {
        cont.innerHTML = '';
        return;
      }

      const formatoMoneda = (valor) => 'S/ ' + Number(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 0 });
      const dl = Number(datos.diasLaborables || 0);
      const dt = Number(datos.diasTrabajados || 0);
      const dtCap = dl > 0 ? Math.min(dt, dl) : dt;
      const ratioTrabajados = dl > 0 ? `${dtCap}/${dl}` : '0/0';
      const porcentajeTiempo = dl > 0 ? ((dtCap / dl) * 100).toFixed(0) : 0;
      const colorAlcanceActual = datos.alcanceActual >= 100 ? '#27ae60' :
        datos.alcanceActual >= 70 ? '#f39c12' :
        datos.alcanceActual >= 40 ? '#e67e22' : '#e74c3c';
      const etiqueta = supervisorFiltro && supervisorFiltro !== 'TODOS' ? 'Supervisor seleccionado' : 'Todos los equipos';

      cont.innerHTML = `
        <div class="calidad-stats-grid">
          <div class="calidad-stat-card stat-dias">
            <div class="stat-label">DIAS TRABAJADOS</div>
            <div class="stat-value">${ratioTrabajados}</div>
            <div class="stat-note">${porcentajeTiempo}% del mes</div>
          </div>
          <div class="calidad-stat-card stat-meta">
            <div class="stat-label">META DEL MES</div>
            <div class="stat-value">${formatoMoneda(datos.metaTotalMes)}</div>
            <div class="stat-note">${etiqueta}</div>
          </div>
          <div class="calidad-stat-card stat-recupero">
            <div class="stat-label">RECUPERO ACTUAL</div>
            <div class="stat-value">${formatoMoneda(datos.recuperoTotalActual)}</div>
            <div class="stat-note">Total recuperado</div>
          </div>
          <div class="calidad-stat-card stat-alcance">
            <div class="stat-label">ALCANCE ACTUAL</div>
            <div class="stat-value" style="color:${colorAlcanceActual};">${datos.alcanceActual.toFixed(2)}%</div>
            <div class="stat-note">${formatoMoneda(datos.recuperoTotalActual)} / ${formatoMoneda(datos.metaTotalMes)}</div>
          </div>
        </div>
      `;
    }

    function obtenerQuintilesPorIndicador(asesores, key) {
      const items = (Array.isArray(asesores) ? asesores : [])
        .map(asesor => {
          const nombre = String(asesor.nombre || asesor.alias_crr || '').trim();
          const qAlc = key === 'alcance' ? _normalizarQuintil(asesor?.q_alc) : null;
          const valor = key === 'alcance'
            ? Number(asesor?.porcentaje)
            : Number(obtenerDatoCalidad(asesor, key)?.valor);
          return { nombre, valor, qAlc };
        })
        .filter(item => item.nombre && Number.isFinite(item.valor))
        .sort((a, b) => b.valor - a.valor);

      const total = items.length;
      const grupos = { 1: [], 2: [], 3: [], 4: [], 5: [] };
      items.forEach((item, index) => {
        const q = key === 'alcance' && item.qAlc
          ? item.qAlc
          : (total <= 1 ? 5 : Math.max(1, Math.min(5, 5 - Math.floor((index * 5) / total))));
        grupos[q].push(item);
      });
      return grupos;
    }

    function _setCalidadQuintilAbierto(key, q, abierto) {
      const lista = document.getElementById(`calidadQuintil_${key}_Q${q}`);
      const toggle = document.getElementById(`calidadQuintilToggle_${key}_Q${q}`);
      const tarjeta = lista?.closest('.eval-quintil-card');
      if (lista) {
        lista.classList.toggle('colapsada', !abierto);
        lista.setAttribute('aria-hidden', String(!abierto));
      }
      if (tarjeta) {
        tarjeta.classList.toggle('quintil-abierto', abierto);
        tarjeta.setAttribute('aria-expanded', String(abierto));
      }
      if (toggle) toggle.textContent = abierto ? '-' : '+';
    }

    function toggleCalidadQuintil(key, q) {
      const lista = document.getElementById(`calidadQuintil_${key}_Q${q}`);
      if (!lista) return;
      _setCalidadQuintilAbierto(key, q, lista.classList.contains('colapsada'));
    }

    function renderizarQuintilesIndicadores(asesores, periodoCompleto, supervisorFiltro = 'TODOS') {
      const cont = document.getElementById('calidadQuintiles');
      if (!cont) return;
      const indicadores = [
        { key: 'calidad_pdp', label: 'Calidad PDP' },
        { key: 'cierre', label: 'Cierre' },
        { key: 'condonacion', label: 'Condonación' },
        { key: 'puntualidad', label: 'Puntualidad' },
        { key: 'alcance', label: 'Alcance' }
      ];
      if (!indicadores.some(ind => ind.key === calidadQuintilSeleccionado)) {
        calidadQuintilSeleccionado = 'calidad_pdp';
      }

      const ind = indicadores.find(item => item.key === calidadQuintilSeleccionado) || indicadores[0];
      const grupos = obtenerQuintilesPorIndicador(asesores, ind.key);
      const total = Object.values(grupos).reduce((acc, arr) => acc + arr.length, 0);
      const cards = [5, 4, 3, 2, 1].map(q => {
        const items = grupos[q] || [];
        const valores = items.map(it => it.valor).filter(Number.isFinite);
        const promedio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
        return `
          <div class="eval-quintil-card eval-quintil-q${q}" data-quintil="${q}" onclick="toggleCalidadQuintil('${ind.key}', ${q})">
            <div class="eval-quintil-title"><span>Q${q}</span><span class="eval-quintil-toggle" id="calidadQuintilToggle_${ind.key}_Q${q}">+</span></div>
            <div class="eval-quintil-summary">
              <div class="eval-quintil-metric">
                <span class="eval-quintil-metric-label">Asesores</span>
                <span class="eval-quintil-metric-value">${items.length}</span>
              </div>
              <div class="eval-quintil-metric">
                <span class="eval-quintil-metric-label">Promedio</span>
                <span class="eval-quintil-metric-value">${promedio === null ? '-' : `${promedio.toFixed(2)}%`}</span>
              </div>
            </div>
            <div class="eval-quintil-list colapsada" id="calidadQuintil_${ind.key}_Q${q}" onclick="event.stopPropagation()">
              ${items.map((it, index) => `
                <div class="eval-quintil-row" style="--quintil-delay:${Math.min(index, 10) * 32}ms">
                  <div class="eval-quintil-asesor" title="${it.nombre}">${it.nombre}</div>
                  <div class="eval-quintil-alcance">${it.valor.toFixed(2)}%</div>
                </div>
              `).join('') || '<div style="padding:14px 8px; text-align:center; color:#666; font-size:0.85rem;">Sin registros</div>'}
            </div>
          </div>
        `;
      }).join('');

      const etiquetaSupervisor = supervisorFiltro && supervisorFiltro !== 'TODOS' ? supervisorFiltro : 'todos los equipos';
      const opciones = indicadores.map(item => `
        <option value="${item.key}" ${item.key === ind.key ? 'selected' : ''}>${item.label}</option>
      `).join('');
      cont.innerHTML = `
        <section class="calidad-quintil-bloque">
          <div class="eval-quintil-toolbar" style="justify-content:space-between; align-items:end; gap:12px; flex-wrap:wrap;">
            <h3 style="margin:0;">Quintiles de ${ind.label}</h3>
            <label style="display:flex; flex-direction:column; gap:5px; font-size:0.85rem; color:#5f6b7a; font-weight:700;">
              Ver quintil
              <select id="selectorCalidadQuintil" onchange="cambiarCalidadQuintil(this.value)" style="min-width:220px; padding:9px 12px; border:1px solid #d9e1ec; border-radius:8px; font-weight:700; color:#2c3e50; background:#fff;">
                ${opciones}
              </select>
            </label>
          </div>
          <div class="calidad-quintil-cards">${cards}</div>
          <div class="calidad-quintil-nota">${total} asesores evaluados · ${String(periodoCompleto || '').replace('_', ' ')} · ${etiquetaSupervisor}</div>
        </section>
      `;
    }

    function cambiarCalidadQuintil(key) {
      calidadQuintilSeleccionado = key || 'calidad_pdp';
      const base = Array.isArray(window.asesoresCalidadBaseRender) ? window.asesoresCalidadBaseRender : [];
      const mesSeleccionado = document.getElementById('selectorMes')?.value || '';
      const selectorAnioCalidad = document.getElementById('selectorAño') || document.querySelector('select[id^="selectorA"]');
      const anioSeleccionado = selectorAnioCalidad?.value || '';
      const periodoCompleto = `${mesSeleccionado}_${anioSeleccionado}`;
      renderizarQuintilesIndicadores(base, periodoCompleto, supervisorFiltroActual || 'TODOS');
    }

    function actualizarCalidad(supervisorParam = '') {
      const mesSeleccionado = document.getElementById('selectorMes')?.value;
      const selectorAnioCalidad = document.getElementById('selectorA\u00f1o') || document.querySelector('select[id^="selectorA"]');
      const anioSeleccionado = selectorAnioCalidad?.value;
      const periodoCompleto = `${mesSeleccionado}_${anioSeleccionado}`;
      const asesoresPeriodo = filtrarAsesoresPorCanal(Array.isArray(datosMeses?.[periodoCompleto]) ? datosMeses[periodoCompleto] : []);
      if (!asesoresPeriodo.length) {
        limpiarCalidad('No hay asesores para el periodo seleccionado.');
        return;
      }

      let supervisorFiltro = (supervisorParam || '').trim();
      if (!supervisorFiltro) supervisorFiltro = supervisorFiltroActual || 'TODOS';

      const asesoresFiltrados = supervisorFiltro && supervisorFiltro !== 'TODOS'
        ? asesoresPeriodo.filter(a => String(a.supervisor || '').trim() === supervisorFiltro)
        : asesoresPeriodo.slice();

      const asesoresConIndicadores = asesoresFiltrados
        .filter(asesor => calidadIndicadores.some(ind => Number.isFinite(Number(obtenerDatoCalidad(asesor, ind.key)?.valor))))
        .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));

      if (!asesoresConIndicadores.length) {
        limpiarCalidad(`No hay indicadores para ${supervisorFiltro || 'TODOS'} en ${periodoCompleto.replace('_', ' ')}.`);
        return;
      }

      window.asesoresCalidadBaseRender = asesoresConIndicadores;
      renderizarQuintilesIndicadores(asesoresConIndicadores, periodoCompleto, supervisorFiltro);
      renderizarTablaCalidad(aplicarOrdenCalidad(asesoresConIndicadores));
      sincronizarColumnasDetalle();

      const resumen = document.getElementById('calidadResumen');
      if (resumen) {
        const etiquetaSupervisor = supervisorFiltro && supervisorFiltro !== 'TODOS' ? supervisorFiltro : 'todos los equipos';
        resumen.textContent = `Periodo ${periodoCompleto.replace('_', ' ')} - ${etiquetaSupervisor} - ${asesoresConIndicadores.length} asesores con indicadores.`;
      }
    }

    function normalizarTextoAsesor(valor) {
      return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
        .replace(/\s+/g, ' ');
    }

    function ordenarPeriodosAsc(periodos) {
      const ordenMes = {
        ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
        JULIO: 7, AGOSTO: 8, SETIEMBRE: 9, SEPTIEMBRE: 9, OCTUBRE: 10,
        NOVIEMBRE: 11, DICIEMBRE: 12
      };
      return periodos.slice().sort((a, b) => {
        const [ma, aa] = String(a).split('_');
        const [mb, ab] = String(b).split('_');
        return (Number(aa) * 100 + (ordenMes[ma] || 0)) - (Number(ab) * 100 + (ordenMes[mb] || 0));
      });
    }

    function inicializarVistaAsesor() {
      const datalist = document.getElementById('asesorSearchDatalist');
      if (datalist && datalist.dataset.ready !== '1') {
        const aliases = Array.from(new Set((datosAsesoresInf || [])
          .map(r => String(r.alias || '').trim())
          .filter(Boolean)))
          .sort((a, b) => a.localeCompare(b, 'es'));
        datalist.innerHTML = aliases.map(alias => `<option value="${alias}"></option>`).join('');
        datalist.dataset.ready = '1';
      }

      const input = document.getElementById('asesorSearchInput');
      if (input && !asesorSeleccionadoHistorico) {
        input.value = '';
      }
      renderizarVistaAsesorHistorico();
    }

    function seleccionarAsesorHistoricoDesdeInput() {
      const input = document.getElementById('asesorSearchInput');
      const valor = String(input?.value || '').trim();
      if (!valor) return;
      const clave = normalizarTextoAsesor(valor);
      const match = (datosAsesoresInf || []).find(r => normalizarTextoAsesor(r.alias) === clave)
        || (datosAsesoresInf || []).find(r => normalizarTextoAsesor(r.alias).includes(clave))
        || (datosAsesoresInf || []).find(r => normalizarTextoAsesor(r.nombre_completo).includes(clave));
      asesorSeleccionadoHistorico = match?.alias || valor;
      if (input) input.value = asesorSeleccionadoHistorico;
      renderizarVistaAsesorHistorico();
    }

    function cambiarRangoAsesorHistorico(rango) {
      asesorRangoHistorico = rango;
      renderizarVistaAsesorHistorico();
      const modal = document.getElementById('modalTopPercentilHistorico');
      if (modal && modal.style.display !== 'none') renderizarTopPercentilHistorico();
    }

    function cambiarExclusionMesActualHistorico(excluir) {
      excluirMesActualHistorico = Boolean(excluir);
      renderizarVistaAsesorHistorico();
      const modal = document.getElementById('modalTopPercentilHistorico');
      if (modal && modal.style.display !== 'none') renderizarTopPercentilHistorico();
    }

    function obtenerRegistrosInfAsesor(alias) {
      const clave = normalizarTextoAsesor(alias);
      const registros = (datosAsesoresInf || [])
        .filter(r => normalizarTextoAsesor(r.alias) === clave);
      const unicos = new Map();
      registros.forEach(r => {
        const claveHistorica = [
          r.nombre_completo, r.alias, r.documento, r.fecha_ingreso,
          r.fecha_salida, r.fecha_nacimiento, r.vigencia, r.vigente, r.cesado
        ].map(valor => String(valor || '').trim().toUpperCase().replace(/\s+/g, ' ')).join('|');
        if (!unicos.has(claveHistorica)) unicos.set(claveHistorica, r);
      });
      return Array.from(unicos.values()).sort((a, b) => {
        const vigencia = (String(b.vigencia || b.vigente || '').toUpperCase() === 'SI') - (String(a.vigencia || a.vigente || '').toUpperCase() === 'SI');
        if (vigencia) return vigencia;
        return String(b.id_fecha_ingreso || '').localeCompare(String(a.id_fecha_ingreso || ''));
      });
    }

    function obtenerIndicadorAsesorPeriodo(asesor, key) {
      return Number(asesor?.indicadores_calidad?.indicadores?.[key]?.valor);
    }

    function obtenerHistoricoAsesor(alias) {
      const clave = normalizarTextoAsesor(alias);
      return ordenarPeriodosAsc(Object.keys(datosMeses || {})).map(periodo => {
        const asesor = (datosMeses[periodo] || []).find(a =>
          normalizarTextoAsesor(a.nombre) === clave ||
          normalizarTextoAsesor(a.alias_crr) === clave ||
          normalizarTextoAsesor(a.indicadores_calidad?.alias) === clave
        );
        if (!asesor) return null;
        return {
          periodo,
          supervisor: asesor.supervisor || '',
          segmento: asesor.cartera || asesor.segmento || '',
          alcance: Number(asesor.porcentaje),
          recupero: Number(asesor.recupero || 0),
          meta: Number(asesor.meta || 0),
          puntualidad: obtenerIndicadorAsesorPeriodo(asesor, 'puntualidad'),
          cierre: obtenerIndicadorAsesorPeriodo(asesor, 'cierre'),
          condonacion: obtenerIndicadorAsesorPeriodo(asesor, 'condonacion'),
          calidad: obtenerIndicadorAsesorPeriodo(asesor, 'calidad_pdp')
        };
      }).filter(Boolean);
    }

    function obtenerPeriodoCalendarioActualHistorico() {
      const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      const hoy = new Date();
      return `${meses[hoy.getMonth()]}_${hoy.getFullYear()}`;
    }

    function obtenerPeriodosRangoHistorico() {
      let periodos = ordenarPeriodosAsc(Object.keys(datosMeses || {}));
      if (excluirMesActualHistorico) {
        const actual = obtenerPeriodoCalendarioActualHistorico();
        periodos = periodos.filter(periodo => periodo !== actual);
      }
      if (asesorRangoHistorico !== 'ALL') {
        const n = Number(asesorRangoHistorico || 12);
        periodos = periodos.slice(Math.max(0, periodos.length - n));
      }
      return periodos;
    }

    function filtrarHistoricoAsesor(historico) {
      const permitidos = new Set(obtenerPeriodosRangoHistorico());
      return historico.filter(item => permitidos.has(item.periodo));
    }

    function promedioValores(items, key) {
      const vals = items.map(x => Number(x[key])).filter(Number.isFinite);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }

    function tendenciaTexto(items, key) {
      const vals = items.map(x => Number(x[key])).filter(Number.isFinite);
      if (vals.length < 2) return 'Sin data suficiente';
      const delta = vals[vals.length - 1] - vals[0];
      if (delta > 1) return `Mejora (+${delta.toFixed(1)} pts)`;
      if (delta < -1) return `Retroceso (${delta.toFixed(1)} pts)`;
      return 'Sin variación relevante';
    }

    function tendenciaClase(texto) {
      const t = String(texto || '').toLowerCase();
      if (t.includes('mejora')) return 'tendencia-mejora';
      if (t.includes('retroceso')) return 'tendencia-retroceso';
      return '';
    }

    function percentilColor(percentil) {
      const p = Math.max(0, Math.min(100, Number(percentil) || 0));
      const hue = Math.round((p / 100) * 120);
      return `hsl(${hue}, 62%, 42%)`;
    }

    function renderPercentilKpi(periodos, key, promedio) {
      const pct = percentilPromedioAsesor(periodos, key, promedio);
      if (!Number.isFinite(pct)) return '<div class="asesor-kpi-percentil"><span>P-</span><div class="asesor-kpi-percentil-bar" style="--pct:0%; opacity:.35;"></div></div>';
      const pctClamp = Math.max(0, Math.min(100, pct));
      return `
        <div class="asesor-kpi-percentil">
          <span style="color:${percentilColor(pctClamp)}">P${pctClamp.toFixed(0)}</span>
          <div class="asesor-kpi-percentil-bar" style="--pct:${pctClamp}%;"></div>
        </div>
      `;
    }

    function renderValorComparado(valor, promedio) {
      const val = Number(valor);
      const prom = Number(promedio);
      if (!Number.isFinite(val)) return formatearPctAsesor(valor);
      if (!Number.isFinite(prom)) return formatearPctAsesor(val);
      const clase = val >= prom ? 'arriba' : 'abajo';
      const titulo = val >= prom ? 'Sobre el promedio del rango' : 'Bajo el promedio del rango';
      return `<span class="tabla-valor-comparado" title="${titulo}"><span>${formatearPctAsesor(val)}</span><i class="tabla-triangulo ${clase}"></i></span>`;
    }

    function desviacionValores(vals) {
      const nums = vals.filter(Number.isFinite);
      if (!nums.length) return null;
      const prom = nums.reduce((a, b) => a + b, 0) / nums.length;
      const varianza = nums.reduce((acc, n) => acc + Math.pow(n - prom, 2), 0) / nums.length;
      return Math.sqrt(varianza);
    }

    function keyIndicadorMensualAsesor(key) {
      return key === 'calidad' ? 'calidad_pdp' : key;
    }

    function percentilPromedioAsesor(periodos, key, promedioAsesor) {
      if (!Number.isFinite(promedioAsesor) || !periodos.length) return null;
      const porAsesor = new Map();
      periodos.forEach(periodo => {
        (datosMeses?.[periodo] || []).forEach(a => {
          const nombre = String(a.nombre || a.alias_crr || a.indicadores_calidad?.alias || '').trim();
          if (!nombre) return;
          const valor = key === 'alcance' ? Number(a.porcentaje) : obtenerIndicadorAsesorPeriodo(a, keyIndicadorMensualAsesor(key));
          if (!Number.isFinite(valor)) return;
          if (!porAsesor.has(nombre)) porAsesor.set(nombre, []);
          porAsesor.get(nombre).push(valor);
        });
      });
      const promedios = Array.from(porAsesor.values())
        .map(vals => vals.reduce((a, b) => a + b, 0) / vals.length)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      if (!promedios.length) return null;
      const debajoOIgual = promedios.filter(v => v <= promedioAsesor).length;
      return (debajoOIgual / promedios.length) * 100;
    }

    function obtenerClavesVigentesTopPercentil() {
      const vigentes = new Set();
      vigentesDimMesActual.forEach(registro => {
        if (!topPercentilSedes.has(sedeTopPercentilAsesor(registro))) return;
        const clave = normalizarTextoAsesor(registro?.alias || '');
        if (clave) vigentes.add(clave);
      });
      return vigentes;
    }

    function sedeTopPercentilAsesor(asesor) {
      const canal = normalizarCanalDashboard(asesor?.canal || '');
      if (canal === 'BPO' || canal === 'LIMA') return 'LIMA';
      if (canal === 'SURCO') return 'SURCO';
      return '';
    }

    function obtenerAsesoresTopPercentilHistorico() {
      const periodos = obtenerPeriodosRangoHistorico();
      const metricas = [
        ['alcance', 'Alcance'],
        ['condonacion', 'Condonación'],
        ['calidad', 'Calidad'],
        ['cierre', 'Cierre'],
        ['puntualidad', 'Puntualidad']
      ];
      const acumulado = new Map();

      periodos.forEach(periodo => {
        (datosMeses?.[periodo] || []).forEach(asesor => {
          if (!topPercentilSedes.has(sedeTopPercentilAsesor(asesor))) return;
          const nombre = String(asesor.nombre || asesor.alias_crr || asesor.indicadores_calidad?.alias || '').trim();
          const clave = normalizarTextoAsesor(nombre);
          if (!clave) return;
          if (!acumulado.has(clave)) {
            acumulado.set(clave, { nombre, periodos: new Set(), valores: Object.fromEntries(metricas.map(([key]) => [key, []])) });
          }
          const item = acumulado.get(clave);
          item.periodos.add(periodo);
          const valoresMes = {
            alcance: Number(asesor.porcentaje),
            condonacion: obtenerIndicadorAsesorPeriodo(asesor, 'condonacion'),
            calidad: obtenerIndicadorAsesorPeriodo(asesor, 'calidad_pdp'),
            cierre: obtenerIndicadorAsesorPeriodo(asesor, 'cierre'),
            puntualidad: obtenerIndicadorAsesorPeriodo(asesor, 'puntualidad')
          };
          metricas.forEach(([key]) => {
            if (Number.isFinite(valoresMes[key])) item.valores[key].push(valoresMes[key]);
          });
        });
      });

      const clavesVigentes = topPercentilSoloVigentes ? obtenerClavesVigentesTopPercentil() : null;
      const asesores = Array.from(acumulado.entries())
        .filter(([clave]) => !clavesVigentes || clavesVigentes.has(clave))
        .map(([, item]) => {
        const promedios = {};
        metricas.forEach(([key]) => {
          const vals = item.valores[key];
          promedios[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        });
        return { nombre: item.nombre, meses: item.periodos.size, promedios, percentiles: {} };
      });

      metricas.forEach(([key]) => {
        const ordenados = asesores.map(item => item.promedios[key]).filter(Number.isFinite).sort((a, b) => a - b);
        asesores.forEach(item => {
          const valor = item.promedios[key];
          item.percentiles[key] = Number.isFinite(valor) && ordenados.length
            ? (ordenados.filter(v => v <= valor).length / ordenados.length) * 100
            : null;
        });
      });

      asesores.forEach(item => {
        const disponibles = metricas.map(([key]) => item.percentiles[key]).filter(Number.isFinite);
        item.percentilGeneral = disponibles.length
          ? disponibles.reduce((a, b) => a + b, 0) / disponibles.length
          : null;
      });

      const claveRanking = topPercentilMetrica === 'general' ? null : topPercentilMetrica;
      asesores.forEach(item => {
        item.percentilRanking = claveRanking ? item.percentiles[claveRanking] : item.percentilGeneral;
      });
      return {
        periodos,
        metricas,
        asesores: asesores
          .filter(item => Number.isFinite(item.percentilRanking))
          .sort((a, b) => b.percentilRanking - a.percentilRanking || a.nombre.localeCompare(b.nombre, 'es'))
      };
    }

    function toggleMenuTopPercentilMetrica() {
      document.getElementById('menuTopPercentilMetrica')?.classList.toggle('abierto');
    }

    function seleccionarMetricaTopPercentil(metrica) {
      const permitidas = ['general', 'alcance', 'condonacion', 'cierre', 'calidad', 'puntualidad'];
      topPercentilMetrica = permitidas.includes(metrica) ? metrica : 'general';
      document.getElementById('menuTopPercentilMetrica')?.classList.remove('abierto');
      renderizarTopPercentilHistorico();
    }

    function toggleVigentesTopPercentil() {
      topPercentilSoloVigentes = !topPercentilSoloVigentes;
      renderizarTopPercentilHistorico();
    }

    function toggleSedeTopPercentil(sede) {
      const sedeNormalizada = String(sede || '').trim().toUpperCase();
      if (!['SURCO', 'LIMA'].includes(sedeNormalizada)) return;
      if (topPercentilSedes.has(sedeNormalizada)) {
        if (topPercentilSedes.size === 1) return;
        topPercentilSedes.delete(sedeNormalizada);
      } else {
        topPercentilSedes.add(sedeNormalizada);
      }
      renderizarTopPercentilHistorico();
    }

    function abrirTopPercentilHistorico() {
      const modal = document.getElementById('modalTopPercentilHistorico');
      if (!modal) return;
      renderizarTopPercentilHistorico();
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }

    function cerrarTopPercentilHistorico() {
      const modal = document.getElementById('modalTopPercentilHistorico');
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = '';
    }

    function renderizarTopPercentilHistorico() {
      const body = document.getElementById('modalTopPercentilBody');
      const sub = document.getElementById('modalTopPercentilSubtitulo');
      if (!body || !sub) return;
      const etiquetasMetrica = {
        general: 'GENERAL', alcance: 'ALCANCE', condonacion: 'CONDONACIÓN',
        cierre: 'CIERRE', calidad: 'CALIDAD', puntualidad: 'PUNTUALIDAD'
      };
      const data = obtenerAsesoresTopPercentilHistorico();
      const etiquetaRanking = etiquetasMetrica[topPercentilMetrica] || 'GENERAL';
      const etiquetaRango = asesorRangoHistorico === 'ALL' ? 'Histórico' : `${asesorRangoHistorico} meses`;
      const etiquetaSedes = topPercentilSedes.size === 2 ? 'SURCO + LIMA' : Array.from(topPercentilSedes)[0];
      sub.textContent = `${etiquetaRango} · ${data.periodos.length} periodos analizados · ${etiquetaSedes} · ranking ${etiquetaRanking.toLowerCase()}${topPercentilSoloVigentes ? ' · Vigencia DIM mes actual' : ''}${excluirMesActualHistorico ? ' · mes actual excluido' : ''}`;
      const btnMetrica = document.getElementById('btnTopPercentilMetrica');
      if (btnMetrica) btnMetrica.textContent = `${etiquetaRanking} ▾`;
      const btnVigentes = document.getElementById('btnTopPercentilVigentes');
      if (btnVigentes) {
        btnVigentes.classList.toggle('activo', topPercentilSoloVigentes);
        btnVigentes.setAttribute('aria-pressed', String(topPercentilSoloVigentes));
      }
      [['SURCO', 'btnTopPercentilSurco'], ['LIMA', 'btnTopPercentilLima']].forEach(([sede, id]) => {
        const boton = document.getElementById(id);
        const activo = topPercentilSedes.has(sede);
        if (boton) {
          boton.classList.toggle('activo', activo);
          boton.setAttribute('aria-pressed', String(activo));
        }
      });
      document.querySelectorAll('[data-top-metrica]').forEach(btn => {
        btn.classList.toggle('activo', btn.dataset.topMetrica === topPercentilMetrica);
      });

      if (!data.asesores.length) {
        body.innerHTML = '<div class="asesor-empty">No hay asesores con indicadores para el rango seleccionado.</div>';
        return;
      }

      const bandas = [
        ['P90–P100', data.asesores.filter(a => a.percentilRanking >= 90).length],
        ['P75–P89', data.asesores.filter(a => a.percentilRanking >= 75 && a.percentilRanking < 90).length],
        ['P50–P74', data.asesores.filter(a => a.percentilRanking >= 50 && a.percentilRanking < 75).length],
        ['Menor a P50', data.asesores.filter(a => a.percentilRanking < 50).length]
      ];
      const celdaMetrica = (item, key) => {
        const valor = item.promedios[key];
        const pct = item.percentiles[key];
        return `<td><span class="percentil-valor">${formatearPctAsesor(valor)}</span><span class="percentil-posicion">${Number.isFinite(pct) ? `P${pct.toFixed(0)}` : 'P—'}</span></td>`;
      };

      body.innerHTML = `
        <div class="percentil-resumen">
          <div class="percentil-resumen-card"><span>Total asesores</span><strong>${data.asesores.length}</strong></div>
          ${bandas.map(([label, total]) => `<div class="percentil-resumen-card"><span>${label}</span><strong>${total}</strong></div>`).join('')}
        </div>
        <table class="tabla-top-percentil">
          <thead><tr><th>#</th><th>Asesor</th><th>Meses</th><th>Percentil ${etiquetaRanking.toLowerCase()}</th><th>Alcance</th><th>Condonación</th><th>Calidad</th><th>Cierre</th><th>Puntualidad</th></tr></thead>
          <tbody>
            ${data.asesores.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="percentil-asesor">${item.nombre}</td>
                <td>${item.meses}</td>
                <td><span class="percentil-general" style="background:${percentilColor(item.percentilRanking)}">P${item.percentilRanking.toFixed(0)}</span></td>
                ${celdaMetrica(item, 'alcance')}
                ${celdaMetrica(item, 'condonacion')}
                ${celdaMetrica(item, 'calidad')}
                ${celdaMetrica(item, 'cierre')}
                ${celdaMetrica(item, 'puntualidad')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    function promedioParesPeriodo(periodos, key) {
      const vals = [];
      periodos.forEach(periodo => {
        (datosMeses?.[periodo] || []).forEach(a => {
          const valor = key === 'alcance' ? Number(a.porcentaje) : obtenerIndicadorAsesorPeriodo(a, keyIndicadorMensualAsesor(key));
          if (Number.isFinite(valor)) vals.push(valor);
        });
      });
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }

    function analizarDesempenoAsesor(items) {
      const metricas = [
        ['Alcance', 'alcance', '#f1c40f'],
        ['Cierre', 'cierre', '#155bb5'],
        ['Condonacion', 'condonacion', '#8e44ad'],
        ['Puntualidad', 'puntualidad', '#219653'],
        ['Calidad', 'calidad', '#008c8c']
      ];
      const periodos = items.map(r => r.periodo);
      let puntaje = 0;
      let evaluadas = 0;
      let mejoras = 0;
      let retrocesos = 0;
      let sobrePares = 0;
      let volatilidadAlta = 0;

      const detalle = metricas.map(([label, key, color]) => {
        const vals = items.map(r => Number(r[key])).filter(Number.isFinite);
        if (!vals.length) return { label, color, estado: 'Sin data', resumen: 'Sin registros en el rango.' };
        const promedio = vals.reduce((a, b) => a + b, 0) / vals.length;
        const delta = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0;
        const desv = desviacionValores(vals) || 0;
        const promedioPares = promedioParesPeriodo(periodos, key);
        const percentil = percentilPromedioAsesor(periodos, key, promedio);
        let score = 0;

        if (delta > 1.5) { score += 1; mejoras++; }
        else if (delta < -1.5) { score -= 1; retrocesos++; }

        if (Number.isFinite(promedioPares)) {
          if (promedio >= promedioPares) { score += 1; sobrePares++; }
          else if (promedio < promedioPares - 5) score -= 1;
        }

        if (desv > 12) { score -= 0.5; volatilidadAlta++; }

        puntaje += score;
        evaluadas++;
        const estado = score >= 1 ? 'favorable' : score <= -1 ? 'débil' : 'mixta';
        const posicion = Number.isFinite(percentil) ? `P${percentil.toFixed(0)}` : 'sin percentil';
        const paresTxt = Number.isFinite(promedioPares) ? `pares ${promedioPares.toFixed(1)}%` : 'pares s/d';
        return {
          label,
          color,
          estado,
          resumen: `${formatearPctAsesor(promedio)} · ${posicion} · ${paresTxt} · Δ ${delta.toFixed(1)} pts`
        };
      });

      const promedioScore = evaluadas ? puntaje / evaluadas : 0;
      let diagnostico = 'INESTABLE';
      if (evaluadas >= 3 && promedioScore >= 0.45 && mejoras >= 2 && sobrePares >= 3 && volatilidadAlta <= 2) {
        diagnostico = 'PRODUCTIVO';
      } else if (evaluadas >= 3 && (promedioScore <= -0.35 || (retrocesos >= 3 && sobrePares <= 2))) {
        diagnostico = 'DECADENTE';
      }

      return {
        diagnostico,
        detalle,
        resumen: `${items.length} meses evaluados · mejoras ${mejoras} · retrocesos ${retrocesos} · sobre pares ${sobrePares}/${evaluadas}`
      };
    }

    function formatearPctAsesor(valor) {
      const num = Number(valor);
      return Number.isFinite(num) ? `${num.toFixed(1)}%` : '—';
    }

    function renderizarFichaAsesor(registros) {
      const cont = document.getElementById('asesorFicha');
      if (!cont) return;
      if (!registros.length) {
        cont.innerHTML = '<div class="asesor-empty">No se encontró el asesor en la hoja INF.</div>';
        return;
      }
      const actual = registros[0];
      const vigenciaActual = actual.vigencia || actual.vigente || '?';
      const cesadoActual = String(vigenciaActual || '').toUpperCase() === 'SI'
        ? 'NO'
        : (actual.fecha_salida || (String(actual.cesado || '').toUpperCase() === 'SI' ? 'SI' : (actual.cesado || '?')));
      cont.innerHTML = `
        <div class="asesor-ficha-grid">
          <div class="asesor-ficha-card"><span>Nombre completo</span><strong>${actual.nombre_completo || '—'}</strong></div>
          <div class="asesor-ficha-card"><span>Documento</span><strong>${actual.documento || '—'}</strong></div>
          <div class="asesor-ficha-card"><span>Fecha ingreso</span><strong>${actual.fecha_ingreso || '—'}</strong></div>
          <div class="asesor-ficha-card"><span>Fecha nacimiento</span><strong>${actual.fecha_nacimiento || '—'}</strong></div>
          <div class="asesor-ficha-card"><span>Vigencia</span><strong>${vigenciaActual}</strong></div>
          <div class="asesor-ficha-card"><span>Cesado</span><strong>${cesadoActual}</strong></div>
        </div>
        ${registros.length > 1 ? `
          <div class="asesor-tabla-wrap" style="margin-bottom:14px;">
            <table class="asesor-tabla">
              <thead><tr><th>Alias</th><th>Ingreso</th><th>Nacimiento</th><th>Vigencia</th><th>Cesado</th></tr></thead>
              <tbody>
                ${registros.map(r => `
                  <tr>
                    <td>${r.alias || '—'}</td>
                    <td>${r.fecha_ingreso || '—'}</td>
                    <td>${r.fecha_nacimiento || '—'}</td>
                    <td>${r.vigencia || r.vigente || '—'}</td>
                    <td>${String(r.vigencia || r.vigente || '').toUpperCase() === 'SI' ? 'NO' : (r.fecha_salida || (String(r.cesado || '').toUpperCase() === 'SI' ? 'SI' : (r.cesado || '?')))}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : ''}
      `;
    }

    function renderizarKpisAsesor(items) {
      const cont = document.getElementById('asesorKpis');
      if (!cont) return;
      const periodos = items.map(r => r.periodo);
      const kpis = [
        ['Alcance', 'alcance', promedioValores(items, 'alcance')],
        ['Cierre', 'cierre', promedioValores(items, 'cierre')],
        ['Condonacion', 'condonacion', promedioValores(items, 'condonacion')],
        ['Puntualidad', 'puntualidad', promedioValores(items, 'puntualidad')],
        ['Calidad', 'calidad', promedioValores(items, 'calidad')]
      ];
      cont.innerHTML = `
        <div class="asesor-kpi-grid">
          ${kpis.map(([label, key, value]) => `
            <div class="asesor-kpi-card">
              <div class="asesor-kpi-main">
                <span>${label} promedio</span>
                <strong>${formatearPctAsesor(value)}</strong>
              </div>
              ${renderPercentilKpi(periodos, key, value)}
            </div>
          `).join('')}
        </div>
      `;
    }

    function renderizarTendenciasAsesor(items) {
      const cont = document.getElementById('asesorTendencias');
      if (!cont) return;
      const rows = [
        ['Alcance', 'alcance', '#f1c40f'],
        ['Cierre', 'cierre', '#155bb5'],
        ['Condonacion', 'condonacion', '#8e44ad'],
        ['Puntualidad', 'puntualidad', '#219653'],
        ['Calidad', 'calidad', '#008c8c']
      ];
      const analisis = analizarDesempenoAsesor(items);
      cont.innerHTML = `
        <h3>Tendencia del rango</h3>
        <div class="asesor-tendencia-list">
          ${rows.map(([label, key, color]) => {
            const texto = tendenciaTexto(items, key);
            return `<div class="asesor-tendencia-item"><span class="asesor-tendencia-label"><span class="asesor-metrica-dot" style="background:${color}"></span>${label}</span><strong class="${tendenciaClase(texto)}">${texto}</strong></div>`;
          }).join('')}
        </div>
        <div class="asesor-analisis-final asesor-analisis-${analisis.diagnostico.toLowerCase()}" onclick="toggleAnalisisAsesor(this)">
          <div class="asesor-analisis-head">
            <div class="asesor-analisis-title">
              <span>Análisis final</span>
              <strong>${analisis.diagnostico}</strong>
            </div>
            <div class="asesor-analisis-toggle">+</div>
          </div>
          <div class="asesor-analisis-detalle" onclick="event.stopPropagation()">
            <small>${analisis.resumen}</small>
            <div class="asesor-analisis-list">
              ${analisis.detalle.map(item => `<div><b>${item.label}</b><em>${item.resumen}</em></div>`).join('')}
            </div>
          </div>
        </div>
      `;
    }

    function toggleAnalisisAsesor(card) {
      if (!card) return;
      card.classList.toggle('abierto');
      const toggle = card.querySelector('.asesor-analisis-toggle');
      if (toggle) toggle.textContent = card.classList.contains('abierto') ? '-' : '+';
      setTimeout(() => {
        if (chartAsesorHistorico) chartAsesorHistorico.update('none');
        Object.values(chartsMetricasAsesor || {}).forEach(chart => chart && chart.update('none'));
      }, 60);
    }

    function renderizarTablaHistoricoAsesor(items) {
      const cont = document.getElementById('asesorHistoricoTabla');
      if (!cont) return;
      if (!items.length) {
        cont.innerHTML = '<div class="asesor-empty">No hay histórico mensual para el asesor seleccionado.</div>';
        return;
      }
      const metricas = [
        { key: 'alcance', label: 'Alcance', color: '#f1c40f' },
        { key: 'condonacion', label: 'Condonación', color: '#8e44ad' },
        { key: 'cierre', label: 'Cierre', color: '#155bb5' },
        { key: 'calidad', label: 'Calidad', color: '#008c8c' },
        { key: 'puntualidad', label: 'Puntualidad', color: '#219653' }
      ];
      cont.innerHTML = `
        <div class="seccion-busqueda asesor-comparacion-historico">
          <div class="asesor-metricas-grid">
            ${metricas.map(metrica => {
              const promedioMetrica = promedioValores(items, metrica.key);
              return `
              <div class="asesor-metrica-card">
                <div class="asesor-metrica-head">
                  <h3>${metrica.label}</h3>
                  <strong>${formatearPctAsesor(promedioMetrica)}</strong>
                </div>
                <div class="asesor-metrica-layout">
                  <div class="asesor-tabla-wrap">
                    <table class="asesor-tabla">
                      <thead>
                        <tr><th>Periodo</th><th>${metrica.label}</th><th>Supervisor</th><th>Segmento</th></tr>
                      </thead>
                      <tbody>
                        ${items.slice().reverse().map(r => `
                          <tr>
                            <td>${r.periodo.replace('_', ' ')}</td>
                            <td>${renderValorComparado(r[metrica.key], promedioMetrica)}</td>
                            <td>${r.supervisor || '—'}</td>
                            <td>${r.segmento || '—'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                  <div class="asesor-metrica-chart">
                    <canvas id="asesorMetricaChart_${metrica.key}"></canvas>
                  </div>
                </div>
              </div>
            `}).join('')}
          </div>
        </div>
      `;
      renderizarGraficosMetricasAsesor(items, metricas);
    }

    function renderizarGraficosMetricasAsesor(items, metricas) {
      Object.values(chartsMetricasAsesor || {}).forEach(chart => {
        if (chart) chart.destroy();
      });
      chartsMetricasAsesor = {};
      if (typeof Chart === 'undefined') return;

      const labels = items.map(r => r.periodo.replace('_', ' '));
      metricas.forEach(metrica => {
        const canvas = document.getElementById(`asesorMetricaChart_${metrica.key}`);
        if (!canvas) return;
        chartsMetricasAsesor[metrica.key] = new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: metrica.label,
              data: items.map(r => Number.isFinite(r[metrica.key]) ? r[metrica.key] : null),
              borderColor: metrica.color,
              backgroundColor: `${metrica.color}22`,
              borderWidth: 3,
              fill: true,
              tension: 0.28,
              spanGaps: true,
              pointRadius: 4,
              pointHoverRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false, axis: 'x' },
            plugins: {
              legend: { display: false },
              tooltip: {
                position: 'nearest',
                backgroundColor: 'rgba(35, 49, 66, 0.96)',
                titleFont: { size: 15, weight: '900', lineHeight: 1.25 },
                bodyFont: { size: 15, weight: '800', lineHeight: 1.25 },
                padding: 14,
                caretPadding: 8,
                boxPadding: 6,
                boxWidth: 12,
                boxHeight: 12,
                cornerRadius: 8,
                multiKeyBackground: '#ffffff',
                displayColors: true,
                callbacks: {
                  label: context => `${metrica.label}: ${Number(context.parsed.y || 0).toFixed(2)}%`
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { callback: value => value + '%' }
              }
            }
          }
        });
      });
    }

    function renderizarGraficoAsesor(items) {
      const canvas = document.getElementById('asesorHistoricoChart');
      if (!canvas || typeof Chart === 'undefined') return;
      if (chartAsesorHistorico) {
        chartAsesorHistorico.destroy();
        chartAsesorHistorico = null;
      }
      const labels = items.map(r => r.periodo.replace('_', ' '));
      chartAsesorHistorico = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Alcance', data: items.map(r => Number.isFinite(r.alcance) ? r.alcance : null), borderColor: '#f1c40f', backgroundColor: 'rgba(241,196,15,0.12)', tension: 0.28, spanGaps: true },
            { label: 'Cierre', data: items.map(r => Number.isFinite(r.cierre) ? r.cierre : null), borderColor: '#155bb5', backgroundColor: 'rgba(21,91,181,0.10)', tension: 0.28, spanGaps: true },
            { label: 'Condonación', data: items.map(r => Number.isFinite(r.condonacion) ? r.condonacion : null), borderColor: '#8e44ad', backgroundColor: 'rgba(142,68,173,0.10)', tension: 0.28, spanGaps: true },
            { label: 'Puntualidad', data: items.map(r => Number.isFinite(r.puntualidad) ? r.puntualidad : null), borderColor: '#219653', backgroundColor: 'rgba(33,150,83,0.10)', tension: 0.28, spanGaps: true },
            { label: 'Calidad', data: items.map(r => Number.isFinite(r.calidad) ? r.calidad : null), borderColor: '#008c8c', backgroundColor: 'rgba(0,140,140,0.10)', tension: 0.28, spanGaps: true }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false, axis: 'x' },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font: { size: 14, weight: '800' },
                boxWidth: 18,
                padding: 16
              }
            },
            tooltip: {
              position: 'nearest',
              backgroundColor: 'rgba(35, 49, 66, 0.96)',
              titleFont: { size: 15, weight: '900', lineHeight: 1.25 },
              bodyFont: { size: 15, weight: '800', lineHeight: 1.25 },
              padding: 14,
              caretPadding: 8,
              boxPadding: 6,
              boxWidth: 12,
              boxHeight: 12,
              cornerRadius: 8,
              multiKeyBackground: '#ffffff',
              displayColors: true
            }
          },
          scales: { y: { beginAtZero: true, ticks: { callback: value => value + '%' } } }
        }
      });
    }

    function renderizarVistaAsesorHistorico() {
      const chkExcluir = document.getElementById('chkExcluirMesActualHistorico');
      if (chkExcluir) chkExcluir.checked = excluirMesActualHistorico;
      document.querySelectorAll('[data-rango-asesor]').forEach(btn => {
        btn.classList.toggle('activo', btn.dataset.rangoAsesor === asesorRangoHistorico);
      });
      if (!asesorSeleccionadoHistorico) {
        const ficha = document.getElementById('asesorFicha');
        ['asesorKpis', 'asesorTendencias', 'asesorHistoricoTabla'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = '';
        });
        if (chartAsesorHistorico) {
          chartAsesorHistorico.destroy();
          chartAsesorHistorico = null;
        }
        Object.values(chartsMetricasAsesor || {}).forEach(chart => chart && chart.destroy());
        chartsMetricasAsesor = {};
        if (ficha) ficha.innerHTML = '<div class="asesor-empty">Selecciona un asesor para ver su registro histórico.</div>';
        return;
      }
      const registrosInf = obtenerRegistrosInfAsesor(asesorSeleccionadoHistorico);
      renderizarFichaAsesor(registrosInf);
      const historicoCompleto = obtenerHistoricoAsesor(asesorSeleccionadoHistorico);
      const historico = filtrarHistoricoAsesor(historicoCompleto);
      renderizarKpisAsesor(historico);
      renderizarTendenciasAsesor(historico);
      renderizarTablaHistoricoAsesor(historico);
      renderizarGraficoAsesor(historico);
    }

    // ========== FUNCIÓN ÚNICA PARA ACTUALIZAR FILTROS ==========
    function actualizarFiltrosGlobales() {
      const mesSeleccionado = document.getElementById('selectorMes').value;
      const añoSeleccionado = document.getElementById('selectorAño').value;
      const periodoCompleto = `${mesSeleccionado}_${añoSeleccionado}`;
    
      if (!datosMeses[periodoCompleto]) return;
    
      const asesores = filtrarAsesoresPorCanal(datosMeses[periodoCompleto]);
      const supervisores = [...new Set(asesores.map(a => a.supervisor).filter(s => s))].sort();
      const supervisorActivoValido = (
        supervisorFiltroActual &&
        supervisorFiltroActual !== 'TODOS' &&
        supervisores.includes(supervisorFiltroActual)
      ) ? supervisorFiltroActual : 'TODOS';
      supervisorFiltroActual = supervisorActivoValido;
    
      let html = `
        <button class="filtro-supervisor ${supervisorActivoValido === 'TODOS' ? 'activo' : ''}" data-supervisor="TODOS">
          👥 TODOS LOS EQUIPOS
        </button>
      `;
    
      supervisores.forEach(supervisor => {
        html += `
          <button class="filtro-supervisor ${supervisor === supervisorActivoValido ? 'activo' : ''}" data-supervisor="${supervisor}">
            ${supervisor}
          </button>
        `;
      });
    
      html += `
    
        <button class="filtro-supervisor accion-global" type="button" onclick="mostrarTop10()">
          🏅 TOP 10
        </button>
      `;
    
      document.getElementById('barraFiltrosSupervisoresGlobal').innerHTML = html;
      actualizarSelectorSupervisorAsesores();
    
      // Event listeners únicos SOLO para filtros (los que tienen data-supervisor)
      document.querySelectorAll('.filtro-supervisor[data-supervisor]').forEach(btn => {
        btn.addEventListener('click', function() {
          supervisorFiltroActual = this.getAttribute('data-supervisor');
          aplicarFiltroSupervisor(supervisorFiltroActual);
        });
      });
    }
    
    function actualizarSelectorSupervisorAsesores() {
      const selector = document.getElementById('selectorSupervisorAsesores');
      if (!selector) return;

      const mesSeleccionado = document.getElementById('selectorMes')?.value || '';
      const anioSeleccionado = document.getElementById('selectorA\u00f1o')?.value || '';
      const periodoCompleto = (mesSeleccionado && anioSeleccionado) ? `${mesSeleccionado}_${anioSeleccionado}` : '';
      const asesoresPeriodo = filtrarAsesoresPorCanal(Array.isArray(datosMeses?.[periodoCompleto]) ? datosMeses[periodoCompleto] : []);
      const supervisoresPeriodo = [...new Set(
        asesoresPeriodo
          .map(a => String(a.supervisor || '').trim())
          .filter(s => s && s !== 'Sin Supervisor')
      )].sort((a, b) => a.localeCompare(b, 'es'));

      const valorActual = selector.value;
      selector.innerHTML = '<option value="">Seleccionar supervisor...</option>' +
        supervisoresPeriodo.map(supervisor => `<option value="${supervisor}">${supervisor}</option>`).join('');

      if (valorActual && supervisoresPeriodo.includes(valorActual)) {
        selector.value = valorActual;
      } else {
        selector.value = '';
      }
    }

    // ========== FUNCIÓN ÚNICA PARA APLICAR FILTRO ==========
    function aplicarFiltroSupervisor(supervisor) {
        supervisorFiltroActual = supervisor || 'TODOS';
        window.supervisorFiltroActual = supervisorFiltroActual;
        supervisor = supervisorFiltroActual;

        // Actualizar botón activo
        document.querySelectorAll('.filtro-supervisor').forEach(btn => {
            btn.classList.remove('activo');
            if (btn.getAttribute('data-supervisor') === supervisor) {
                btn.classList.add('activo');
            }
        });
        
        // Determinar sección activa
        const seccionActiva = document.querySelector('.seccion-contenido.activa');
        if (!seccionActiva) return;
        
        if (seccionActiva.id === 'seccion-ranking') {
            aplicarFiltroRanking(supervisor);
        } else if (seccionActiva.id === 'seccion-evaluacion') {
            actualizarTarjetasEvaluacionRapida(supervisor);
            calcularPeriodoPrueba();
        } else if (seccionActiva.id === 'seccion-calidad') {
            actualizarCalidad(supervisor);
        } else if (seccionActiva.id === 'seccion-gestiones') {
            inicializarVistaAsesor();
        }
    }
    
    // ========== FUNCIONES DE NAVEGACIÓN ==========
    function mostrarSeccion(seccion) {
      // Ocultar todas las secciones
      document.querySelectorAll('.seccion-contenido').forEach(sec => {
        sec.classList.remove('activa');
      });
      
      // Remover activo de todos los accesos
      document.querySelectorAll('.boton-modulo, .boton-acceso-secundario').forEach(boton => {
        boton.classList.remove('activo');
      });
      
      // Mostrar la seccion seleccionada
      const seccionObjetivo = document.getElementById(`seccion-${seccion}`);
      if (!seccionObjetivo) return;
      seccionObjetivo.classList.add('activa');
      const botonPrincipal = document.querySelector(`.boton-modulo.${seccion}`);
      const botonSecundario = document.querySelector(`.boton-acceso-secundario.${seccion}`);
      if (botonPrincipal) botonPrincipal.classList.add('activo');
      if (botonSecundario) botonSecundario.classList.add('activo');
      if (seccion === 'gestiones') {
        inicializarVistaAsesor();
      }
      
      // Aplicar filtro actual a la nueva sección
      setTimeout(() => {
        aplicarFiltroSupervisor(supervisorFiltroActual);
      }, 100);
    }

    function mostrarMensajeSinDatos(canvas, periodoCompleto, supervisor = null) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Configurar el canvas para mensaje
        canvas.width = 1300;
        canvas.height = 200;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
        
        // Dibujar mensaje
        ctx.fillStyle = '#95a5a6';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        
        let mensaje = '📊 No hay datos de recupero acumulado disponibles';
        if (supervisor) {
            mensaje = `📊 No hay datos de recupero para ${supervisor}`;
        }
        
        ctx.fillText(mensaje, canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '18px Arial';
        ctx.fillText(`Periodo: ${periodoCompleto.replace('_', ' ')}`, canvas.width / 2, canvas.height / 2 + 20);
    }
    
    function forzarActualizacionPeriodo(seccionDestino) {
        // Obtener valores actuales del header
        const mesSeleccionado = document.getElementById('selectorMes').value;
        const añoSeleccionado = document.getElementById('selectorAño').value;
        const periodoCompleto = `${mesSeleccionado}_${añoSeleccionado}`;
        
        console.log(`🔄 Forzando actualización para ${seccionDestino}: ${periodoCompleto}`);
        
        if (!datosMeses[periodoCompleto]) {
            console.warn(`⚠️ No hay datos para ${periodoCompleto}`);
            return;
        }
        
        const asesores = filtrarAsesoresPorCanal(datosMeses[periodoCompleto] || []);
        
        // Aplicar según la sección destino
        if (seccionDestino === 'ranking') {
            actualizarFiltrosGlobales();
            aplicarFiltroRanking(supervisorFiltroActual);
        }
        
    }

    function aplicarFiltroAlcances(supervisor) {
        const mesSeleccionado = document.getElementById('selectorMes').value;
        const añoSeleccionado = document.getElementById('selectorAño').value;
        const periodoCompleto = `${mesSeleccionado}_${añoSeleccionado}`;
    
        if (!supervisor || supervisor === 'TODOS') {
            window.supervisorSeleccionado = '';
        } else {
            window.supervisorSeleccionado = String(supervisor).trim();
        }
    
        if (supervisor === 'TODOS') {
            calcularEstadisticasRecuperos(periodoCompleto);
            generarGraficasRecuperos(periodoCompleto);
        } else {
            calcularEstadisticasRecuperosPorSupervisor(periodoCompleto, supervisor);
            generarGraficasRecuperosSupervisor(periodoCompleto, supervisor);
        }
    }

    // ===================== HELPERS GLOBALES =====================
    window.__chartsByCanvasId = window.__chartsByCanvasId || {};
    
    function _destroyChartByCanvasId(canvasId) {
      try {
        const prev = window.__chartsByCanvasId[canvasId];
        if (prev) {
          prev.destroy();
          window.__chartsByCanvasId[canvasId] = null;
        }
      } catch (e) {}
    }
    
    function _storeChart(canvasId, chartInstance) {
      window.__chartsByCanvasId[canvasId] = chartInstance;
    }
    
    function _applyCanvasSize(canvas, view = 'full') {
      if (!canvas) return;
    
      if (view === 'mini') {
        canvas.width = 340;
        canvas.height = 220;
      } else if (view === 'modal') {
        canvas.width = 1100;
        canvas.height = 520;
      } else {
        canvas.width = 1200;
        canvas.height = 700;
      }
    
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      canvas.style.maxWidth = '100%';
    }
    
    function _tuneOptionsForView(options, view = 'full') {
      const o = options || {};
    
      if (view === 'mini') {
        if (o.plugins && o.plugins.title) o.plugins.title.display = false;
        if (o.plugins && o.plugins.legend) o.plugins.legend.display = false;
        if (o.plugins && o.plugins.tooltip) o.plugins.tooltip.enabled = false;
    
        if (o.scales) {
          Object.keys(o.scales).forEach((k) => {
            const sc = o.scales[k];
            if (sc && sc.ticks) {
              sc.ticks.maxTicksLimit = 4;
              sc.ticks.font = sc.ticks.font || {};
              sc.ticks.font.size = 10;
            }
          });
        }
      }
    
      if (view === 'modal') {
        if (o.plugins && o.plugins.tooltip) o.plugins.tooltip.enabled = true;
      }
    
      return o;
    }

    function _buildDataLabelsPluginTotal(view = 'full') {
      return {
        id: 'dataLabelsTotal',
        afterDatasetsDraw(chart, args, options) {
          // ✅ En mini no dibujar etiquetas
          if (view === 'mini') return;
    
          const { ctx } = chart;
          const meta = chart.getDatasetMeta(0);
    
          meta.data.forEach((point, index) => {
            const value = chart.data.datasets[0].data[index];
            if (value === null || value === undefined) return;
    
            if (value > 0) {
              ctx.save();
    
              const x = point.x;
              const y = point.y - 20;
    
              const porcentajeAlcance = value;
              const formattedValue = porcentajeAlcance.toFixed(1) + '%';
    
              // ✅ En modal puedes subir un poco el tamaño si quieres
              const fontSize = (view === 'modal') ? 16 : 15;
              ctx.font = `bold ${fontSize}px Arial`;
    
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
    
              let textColor = '#2c3e50';
              if (porcentajeAlcance === 0) textColor = '#95a5a6';
              else if (porcentajeAlcance < 40) textColor = '#e74c3c';
              else if (porcentajeAlcance < 70) textColor = '#f39c12';
              else if (porcentajeAlcance < 100) textColor = '#27ae60';
              else textColor = '#2ecc71';
    
              ctx.fillStyle = textColor;
    
              ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
              ctx.shadowBlur = 8;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
    
              ctx.fillText(formattedValue, x, y);
              ctx.restore();
            }
          });
        }
      };
    }
    

    // ===================== TABLA COMPARATIVA 4M (ALCANCES) =====================
    function _mesTitulo(periodo) {
      const p = String(periodo || '').split('_');
      const mes = (p[0] || '').toLowerCase();
      return mes ? (mes.charAt(0).toUpperCase() + mes.slice(1)) : String(periodo || '');
    }
    
    function _anioDePeriodo(periodo) {
      const p = String(periodo || '').split('_');
      return p[1] || '';
    }
    
    function _mesIndex(mesUpper) {
      const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SETIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
      return Math.max(0, meses.indexOf(String(mesUpper || '').toUpperCase()));
    }
    
    function _sortPeriodosDesc(periodos) {
      return (periodos || []).slice().sort((a, b) => {
        const pa = String(a).split('_');
        const pb = String(b).split('_');
        const ya = Number(pa[1] || 0), yb = Number(pb[1] || 0);
        if (ya !== yb) return yb - ya;
        return _mesIndex(pb[0]) - _mesIndex(pa[0]);
      });
    }
    
    window.canalAlcancesSeleccionado = window.canalSeleccionadoGlobal || window.canalAlcancesSeleccionado || 'SURCO';

    function generarControlesCanalesAlcances() {
      const canalActivo = window.canalAlcancesSeleccionado || 'SURCO';
      const canales = ['TODOS LOS CANALES', 'SURCO', 'BPO', 'PANAMA'];
      return `
        <div class="canales-alcances" aria-label="Filtro de canal">
          ${canales.map(canal => `
            <button type="button"
                    class="btn-canal-alcances ${canal === canalActivo ? 'activo' : ''}"
                    data-canal-alcances="${canal}"
                    onclick="seleccionarCanalAlcances('${canal}')">
              ${canal === 'BPO' ? 'LIMA' : (canal === 'PANAMA' ? 'PANAMÁ' : canal)}
            </button>
          `).join('')}
        </div>
      `;
    }

    function seleccionarCanalAlcances(canal) {
      window.canalSeleccionadoGlobal = normalizarCanalDashboard(canal || 'SURCO');
      window.canalAlcancesSeleccionado = window.canalSeleccionadoGlobal;
      supervisorFiltroActual = 'TODOS';
      window.supervisorFiltroActual = 'TODOS';
      window.supervisorSeleccionado = '';
      sincronizarBotonesCanalAlcances();
      actualizarIndicadorExcepcionesPeriodo();
      actualizarFiltrosGlobales();
      aplicarFiltroSupervisor('TODOS');
    }

    function _getSupervisorActivo() {
      // Reutiliza tu lógica: barra de filtros global
      let sup = '';
      const barra = document.getElementById('barraFiltrosSupervisoresGlobal');
      if (barra) {
        const activo = barra.querySelector('.filtro-supervisor.activo[data-supervisor]');
        if (activo) sup = activo.getAttribute('data-supervisor') || '';
      }
      return (sup || '').trim();
    }
    
    function _getFuenteSupervisores() {
      return (typeof datosSupervisores !== 'undefined' && datosSupervisores) ? datosSupervisores :
             (typeof supervisoresData !== 'undefined' && supervisoresData) ? supervisoresData :
             (window && window.supervisoresData) ? window.supervisoresData :
             null;
    }
    
    function _toNumber(v) {
      if (v === null || v === undefined) return 0;
      if (typeof v === 'number') return isFinite(v) ? v : 0;
      const s = String(v).replace(/[%,$ ]/g, '').replace(/,/g, '').trim();
      const n = parseFloat(s);
      return isFinite(n) ? n : 0;
    }
    
    function _diaDeKey(key) {
      const d = Number(key);
      return Number.isInteger(d) && d >= 1 && d <= 31 ? d : null;
    }
    
    function _forwardFill31(mapDiaToValor, limiteDia = 31) {
      const out = new Array(32).fill(null);
    
      for (let d = 1; d <= limiteDia; d++) {
        const v = mapDiaToValor[d];
        if (v === undefined || v === null) {
          out[d] = (d === 1) ? null : out[d - 1];
        } else {
          out[d] = Number(v);
        }
      }
    
      // Forzar día 1 a 0 si quedó vacío
      if (out[1] === null) out[1] = 0;
    
      for (let d = limiteDia + 1; d <= 31; d++) out[d] = null;
    
      return out;
    }
    
    function _listarPeriodosDisponibles(fuenteSupervisores) {
      const set = new Set();
      Object.keys(fuenteSupervisores || {}).forEach((sup) => {
        const byPeriodo = fuenteSupervisores?.[sup] || {};
        Object.keys(byPeriodo).forEach((periodo) => {
          if (periodo && String(periodo).includes('_')) set.add(periodo);
        });
      });
      return _sortPeriodosDesc(Array.from(set));
    }
    
    function _periodoHoy() {
      const fechaHoy = new Date();
      const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SETIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
      return `${meses[fechaHoy.getMonth()]}_${fechaHoy.getFullYear()}`;
    }
    
    function _limiteHoy() {
      const fechaHoy = new Date();
      return Math.max(1, fechaHoy.getDate() - 1);
    }
    
    function _getPeriodoSeleccionadoUI() {
      const mesSeleccionado = document.getElementById('selectorMes')?.value;
      const añoSeleccionado = document.getElementById('selectorAño')?.value;
      if (!mesSeleccionado || !añoSeleccionado) return '';
      return `${mesSeleccionado}_${añoSeleccionado}`;
    }
    
    function _getPeriodosDefault4(mesAñoActual) {
      if (typeof _getPeriodosAtras === 'function') {
        const p = String(mesAñoActual || '').split('_');
        const mes = p[0], anio = p[1];
        const arr = _getPeriodosAtras(mes, anio, 4, true);
        return (arr && arr.length === 4) ? arr : [];
      }
      return [];
    }
    
    function _normalizarSupervisor4M(v) {
      return String(v || '').trim().toUpperCase().replace(/\s+/g, ' ');
    }

    function _getSupervisorKey4M(fuenteSupervisores, supervisor) {
      const objetivo = _normalizarSupervisor4M(supervisor);
      if (!objetivo || objetivo === 'TODOS') return supervisor || 'TODOS';
      const keys = Object.keys(fuenteSupervisores || {});
      return keys.find(k => _normalizarSupervisor4M(k) === objetivo) || supervisor;
    }

    function _listarSupervisoresActivos4M(fuenteSupervisores, periodo) {
      return Object.keys(fuenteSupervisores || {})
        .filter(sup => sup !== '__vista_orden_4m__')
        .filter(sup => !!fuenteSupervisores?.[sup]?.[periodo])
        .sort((a, b) => a.localeCompare(b, 'es'));
    }

    function _getMetaMesDesdeSupervisores(fuenteSupervisores, supervisorFiltro, periodo) {
      if (supervisorFiltro === 'TODOS') {
        let suma = 0;
        Object.keys(fuenteSupervisores || {}).forEach((sup) => {
          if (sup === '__vista_orden_4m__') return;
          suma += _toNumber(fuenteSupervisores?.[sup]?.[periodo]?.meta_super);
        });
        return suma;
      }
      const supKey = _getSupervisorKey4M(fuenteSupervisores, supervisorFiltro);
      return _toNumber(fuenteSupervisores?.[supKey]?.[periodo]?.meta_super);
    }
    
    function _fmtMontoTabla4M(v) {
      if (v === null || v === undefined || !isFinite(Number(v))) return '-';
      return 'S/ ' + Number(v).toLocaleString('es-PE', { maximumFractionDigits: 0 });
    }

    function _getCarteraTabla4M(fuenteSupervisores, supervisorFiltro, periodo) {
      if (supervisorFiltro === 'TODOS') return 'CONSOLIDADO';
      const supKey = _getSupervisorKey4M(fuenteSupervisores, supervisorFiltro);
      return String(fuenteSupervisores?.[supKey]?.[periodo]?.cartera || '-').trim() || '-';
    }

    function _bindClicksTabla4M(tbody) {
      if (!tbody) return;
      try {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((tr) => {
          tr.querySelectorAll('td').forEach(td => td.classList.add('is-clickable'));
          tr.addEventListener('click', () => {
            rows.forEach(r => r.classList.remove('is-selected'));
            tr.classList.add('is-selected');
          });
        });
      } catch (e) {
        console.warn('Tabla4M click init error:', e);
      }
    }

    function _setTabla4MEmpty(msg) {
      const pares = [
        [document.getElementById('theadTabla4MRecupero'), document.getElementById('tbodyTabla4MRecupero')],
        [document.getElementById('theadTabla4MAlcance'), document.getElementById('tbodyTabla4MAlcance')]
      ];
      pares.forEach(([thead, tbody]) => {
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = `<tr><td style="padding:14px; color:#666;" colspan="5">${msg}</td></tr>`;
      });
    }

    function _renderTabla4MDoble(cols, notaTexto) {
      const fuenteSupervisores = _getFuenteSupervisores();
      const theadRec = document.getElementById('theadTabla4MRecupero');
      const tbodyRec = document.getElementById('tbodyTabla4MRecupero');
      const theadPct = document.getElementById('theadTabla4MAlcance');
      const tbodyPct = document.getElementById('tbodyTabla4MAlcance');
      const nota = document.getElementById('notaTabla4M');
      if (!theadRec || !tbodyRec || !theadPct || !tbodyPct) return;
      if (!fuenteSupervisores) {
        _setTabla4MEmpty('No hay datos de supervisores disponibles.');
        if (nota) nota.textContent = '-';
        return;
      }

      cols = (Array.isArray(cols) ? cols : []).filter(c => c && c.periodo).slice(0, 4);
      if (cols.length < 2) {
        _setTabla4MEmpty('Selecciona 4 periodos para comparar.');
        if (nota) nota.textContent = '-';
        return;
      }

      const hoy = _periodoHoy();
      const limiteHoy = _limiteHoy();
      const seriesRec = {};
      const seriesPct = {};

      cols.forEach((c) => {
        const supervisorCol = (c.supervisor || 'TODOS');
        const periodo = c.periodo;
        const metaMes = _getMetaMesDesdeSupervisores(fuenteSupervisores, supervisorCol, periodo);
        const mapRec = _getRecuperoDiarioAcum(fuenteSupervisores, supervisorCol, periodo);
        const limite = (periodo === hoy) ? limiteHoy : 31;
        const recFF = _forwardFill31(mapRec, limite);
        const recSerie = new Array(32).fill(null);
        const pctSerie = new Array(32).fill(null);
        for (let d = 1; d <= 31; d++) {
          const rec = recFF[d];
          recSerie[d] = rec;
          pctSerie[d] = (rec === null || metaMes <= 0) ? null : (Number(rec) / Number(metaMes)) * 100;
        }
        seriesRec[c.idx] = recSerie;
        seriesPct[c.idx] = pctSerie;
      });

      let h1 = '<tr><th style="text-align:center;">D&Iacute;A</th>';
      cols.forEach((c) => { h1 += `<th>${_mesTitulo(c.periodo)} ${_anioDePeriodo(c.periodo)}</th>`; });
      h1 += '</tr>';

      let h2 = '<tr><th style="text-align:center;">Cartera</th>';
      cols.forEach((c) => { h2 += `<th>${_getCarteraTabla4M(fuenteSupervisores, c.supervisor || 'TODOS', c.periodo)}</th>`; });
      h2 += '</tr>';

      let h3 = '<tr><th style="text-align:center;">Supervisor</th>';
      cols.forEach((c) => {
        const sup = String(c.supervisor || 'TODOS').trim();
        h3 += `<th style="font-size:0.78rem; color:#ffffff;">${sup || '-'}</th>`;
      });
      h3 += '</tr>';

      const headHtml = h1 + h2 + h3;
      theadRec.innerHTML = headHtml;
      theadPct.innerHTML = headHtml;

      let bodyRec = '';
      let bodyPct = '';
      for (let d = 1; d <= 31; d++) {
        bodyRec += `<tr><td>${d}</td>`;
        bodyPct += `<tr><td>${d}</td>`;
        cols.forEach((c) => {
          const rec = seriesRec?.[c.idx]?.[d];
          const pct = seriesPct?.[c.idx]?.[d];
          const recEmpty = (rec === null || rec === undefined);
          const pctEmpty = (pct === null || pct === undefined);
          bodyRec += `<td class="${recEmpty ? 'valor-vacio' : ''}">${recEmpty ? '-' : _fmtMontoTabla4M(rec)}</td>`;
          const clsAlto = (!pctEmpty && Number(pct) >= 70) ? 'valor-alto' : '';
          const clsEmpty = pctEmpty ? 'valor-vacio' : '';
          bodyPct += `<td class="${clsAlto} ${clsEmpty}">${pctEmpty ? '-' : Number(pct).toFixed(2) + '%'}</td>`;
        });
        bodyRec += '</tr>';
        bodyPct += '</tr>';
      }
      tbodyRec.innerHTML = bodyRec;
      tbodyPct.innerHTML = bodyPct;
      _bindClicksTabla4M(tbodyRec);
      _bindClicksTabla4M(tbodyPct);
      if (nota) nota.textContent = notaTexto || 'Fuente: recupero acumulado y alcance acumulado por d&iacute;a (1..31). Mes actual se completa hasta ayer.';
    }

    function _buildComparativoSupervisoresMesHTML(supervisores, periodo) {
      const fuenteSupervisores = _getFuenteSupervisores();
      if (!fuenteSupervisores || !supervisores.length || !periodo) return '';

      const hoy = _periodoHoy();
      const limite = (periodo === hoy) ? _limiteHoy() : 31;
      const seriesRec = {};
      const seriesPct = {};

      supervisores.forEach((sup, idx) => {
        const metaMes = _getMetaMesDesdeSupervisores(fuenteSupervisores, sup, periodo);
        const mapRec = _getRecuperoDiarioAcum(fuenteSupervisores, sup, periodo);
        const recFF = _forwardFill31(mapRec, limite);
        const recSerie = new Array(32).fill(null);
        const pctSerie = new Array(32).fill(null);
        for (let d = 1; d <= 31; d++) {
          const rec = recFF[d];
          recSerie[d] = rec;
          pctSerie[d] = (rec === null || metaMes <= 0) ? null : (Number(rec) / Number(metaMes)) * 100;
        }
        seriesRec[idx] = recSerie;
        seriesPct[idx] = pctSerie;
      });

      let h1 = '<tr><th style="text-align:center;">D&Iacute;A</th>';
      supervisores.forEach(() => { h1 += `<th>${_mesTitulo(periodo)} ${_anioDePeriodo(periodo)}</th>`; });
      h1 += '</tr>';

      let h2 = '<tr><th style="text-align:center;">Cartera</th>';
      supervisores.forEach((sup) => { h2 += `<th>${_getCarteraTabla4M(fuenteSupervisores, sup, periodo)}</th>`; });
      h2 += '</tr>';

      let h3 = '<tr><th style="text-align:center;">Supervisor</th>';
      supervisores.forEach((sup) => { h3 += `<th style="font-size:0.78rem; color:#ffffff;">${sup}</th>`; });
      h3 += '</tr>';

      let bodyRec = '';
      let bodyPct = '';
      for (let d = 1; d <= 31; d++) {
        bodyRec += `<tr><td>${d}</td>`;
        bodyPct += `<tr><td>${d}</td>`;
        supervisores.forEach((sup, idx) => {
          const rec = seriesRec?.[idx]?.[d];
          const pct = seriesPct?.[idx]?.[d];
          const recEmpty = (rec === null || rec === undefined);
          const pctEmpty = (pct === null || pct === undefined);
          bodyRec += `<td class="${recEmpty ? 'valor-vacio' : ''}">${recEmpty ? '-' : _fmtMontoTabla4M(rec)}</td>`;
          const clsAlto = (!pctEmpty && Number(pct) >= 70) ? 'valor-alto' : '';
          const clsEmpty = pctEmpty ? 'valor-vacio' : '';
          bodyPct += `<td class="${clsAlto} ${clsEmpty}">${pctEmpty ? '-' : Number(pct).toFixed(2) + '%'}</td>`;
        });
        bodyRec += '</tr>';
        bodyPct += '</tr>';
      }

      const head = h1 + h2 + h3;
      return `
        <div class="tabla4m-doble">
          <div>
            <div class="tabla4m-titulo">RECUPERO POR SUPERVISOR - ${_mesTitulo(periodo)} ${_anioDePeriodo(periodo)}</div>
            <div class="tabla4m-wrap" style="justify-self:stretch; width:100%; max-width:100%;">
              <table class="tabla-comparativa-4m" style="width:100%;">
                <thead>${head}</thead>
                <tbody>${bodyRec}</tbody>
              </table>
            </div>
          </div>
          <div>
            <div class="tabla4m-titulo">ALCANCE POR SUPERVISOR - ${_mesTitulo(periodo)} ${_anioDePeriodo(periodo)}</div>
            <div class="tabla4m-wrap" style="justify-self:stretch; width:100%; max-width:100%;">
              <table class="tabla-comparativa-4m" style="width:100%;">
                <thead>${head}</thead>
                <tbody>${bodyPct}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    function _renderComparativoSupervisoresMes4M(periodoHeader) {
      const cont = document.getElementById('tablas4MComparativoSupervisores');
      const fuenteSupervisores = _getFuenteSupervisores();
      if (!cont || !fuenteSupervisores || !periodoHeader) return;
      const supervisores = _listarSupervisoresActivos4M(fuenteSupervisores, periodoHeader);
      if (!supervisores.length) {
        cont.innerHTML = '';
        return;
      }
      cont.innerHTML = _buildComparativoSupervisoresMesHTML(supervisores, periodoHeader);
      cont.querySelectorAll('tbody').forEach(tb => _bindClicksTabla4M(tb));
    }

    function _limpiarComparativoSupervisoresMes4M() {
      const cont = document.getElementById('tablas4MComparativoSupervisores');
      if (cont) cont.innerHTML = '';
    }

    function _buildTablaAlcance4MHTML(cols, titulo) {
      const fuenteSupervisores = _getFuenteSupervisores();
      if (!fuenteSupervisores || !Array.isArray(cols) || !cols.length) return '';

      const hoy = _periodoHoy();
      const limiteHoy = _limiteHoy();
      const seriesPct = {};

      cols.forEach((c) => {
        const supervisorCol = c.supervisor || 'TODOS';
        const periodo = c.periodo;
        const metaMes = _getMetaMesDesdeSupervisores(fuenteSupervisores, supervisorCol, periodo);
        const mapRec = _getRecuperoDiarioAcum(fuenteSupervisores, supervisorCol, periodo);
        const limite = (periodo === hoy) ? limiteHoy : 31;
        const recFF = _forwardFill31(mapRec, limite);
        const pctSerie = new Array(32).fill(null);
        for (let d = 1; d <= 31; d++) {
          const rec = recFF[d];
          pctSerie[d] = (rec === null || metaMes <= 0) ? null : (Number(rec) / Number(metaMes)) * 100;
        }
        seriesPct[c.idx] = pctSerie;
      });

      let h1 = '<tr><th style="text-align:center;">D&Iacute;A</th>';
      cols.forEach((c) => { h1 += `<th>${_mesTitulo(c.periodo)} ${_anioDePeriodo(c.periodo)}</th>`; });
      h1 += '</tr>';

      let h2 = '<tr><th style="text-align:center;">Cartera</th>';
      cols.forEach((c) => { h2 += `<th>${_getCarteraTabla4M(fuenteSupervisores, c.supervisor || 'TODOS', c.periodo)}</th>`; });
      h2 += '</tr>';

      let h3 = '<tr><th style="text-align:center;">Supervisor</th>';
      cols.forEach((c) => {
        const sup = String(c.supervisor || 'TODOS').trim();
        h3 += `<th style="font-size:0.78rem; color:#ffffff;">${sup || '-'}</th>`;
      });
      h3 += '</tr>';

      let body = '';
      for (let d = 1; d <= 31; d++) {
        body += `<tr><td>${d}</td>`;
        cols.forEach((c) => {
          const pct = seriesPct?.[c.idx]?.[d];
          const empty = (pct === null || pct === undefined);
          const clsAlto = (!empty && Number(pct) >= 70) ? 'valor-alto' : '';
          const clsEmpty = empty ? 'valor-vacio' : '';
          body += `<td class="${clsAlto} ${clsEmpty}">${empty ? '-' : Number(pct).toFixed(2) + '%'}</td>`;
        });
        body += '</tr>';
      }

      return `
        <div class="tabla4m-supervisor-card">
          <div class="tabla4m-titulo">${titulo}</div>
          <div class="tabla4m-wrap" style="justify-self:stretch; width:100%; max-width:100%;">
            <table class="tabla-comparativa-4m" style="width:100%;">
              <thead>${h1 + h2 + h3}</thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    function _renderTablasSupervisoresTodos4M(periodos) {
      const cont = document.getElementById('tablas4MSupervisoresTodos');
      const fuenteSupervisores = _getFuenteSupervisores();
      if (!cont || !fuenteSupervisores) return;

      const periodos4 = (periodos || []).filter(Boolean).slice(0, 4);
      const periodoHeader = periodos4[3] || _getPeriodoSeleccionadoUI();
      if (periodos4.length < 4 || !periodoHeader) {
        cont.innerHTML = '';
        return;
      }

      const supervisores = _listarSupervisoresActivos4M(fuenteSupervisores, periodoHeader);
      if (!supervisores.length) {
        cont.innerHTML = '';
        return;
      }

      cont.innerHTML = supervisores.map((sup) => {
        const cols = periodos4.map((periodo, i) => ({
          idx: i + 1,
          periodo,
          supervisor: _getSupervisorVista4M(i + 1, sup, periodoHeader)
        }));
        return _buildTablaAlcance4MHTML(cols, `ALCANCES - ${sup}`);
      }).join('');

      cont.querySelectorAll('tbody').forEach(tb => _bindClicksTabla4M(tb));
    }

    function _limpiarTablasSupervisoresTodos4M() {
      const cont = document.getElementById('tablas4MSupervisoresTodos');
      if (cont) cont.innerHTML = '';
    }

    function _getRecuperoDiarioAcum(fuenteSupervisores, supervisorFiltro, periodo) {
      const map = {};
    
      if (supervisorFiltro === 'TODOS') {
        Object.keys(fuenteSupervisores || {}).forEach((sup) => {
          if (sup === '__vista_orden_4m__') return;
          const diarios = fuenteSupervisores?.[sup]?.[periodo]?.datos_diarios_supervisor || {};
          Object.keys(diarios).forEach((k) => {
            const d = _diaDeKey(k);
            if (!d) return;
            map[d] = (Number(map[d]) || 0) + (Number(diarios[k]) || 0);
          });
        });
        return map;
      }
    
      const supKey = _getSupervisorKey4M(fuenteSupervisores, supervisorFiltro);
      const diarios = fuenteSupervisores?.[supKey]?.[periodo]?.datos_diarios_supervisor || {};
      Object.keys(diarios).forEach((k) => {
        const d = _diaDeKey(k);
        if (!d) return;
        map[d] = Number(diarios[k]) || 0;
      });
      return map;
    }
    
    function _renderTabla4M(periodosElegidos, supervisorFiltro) {
      const periodos = (periodosElegidos || []).filter(Boolean).slice(0, 4);
      const nota = document.getElementById('notaTabla4M');
      if (periodos.length < 2) {
        _setTabla4MEmpty('Selecciona 4 periodos para comparar.');
        if (nota) nota.textContent = '-';
        return;
      }

      const sup = supervisorFiltro || 'TODOS';
      const cols = periodos.map((periodo, i) => ({
        idx: i + 1,
        periodo,
        supervisor: sup
      }));

      const supTxt = (sup === 'TODOS') ? 'CONSOLIDADO (TODOS)' : sup;
      _renderTabla4MDoble(
        cols,
        `Vista: ${supTxt} | Fuente: recupero acumulado y alcance acumulado por d&iacute;a (1..31). Mes actual se completa hasta ayer.`
      );

      if (sup === 'TODOS') {
        const periodoHeader = periodos[3] || _getPeriodoSeleccionadoUI();
        _renderComparativoSupervisoresMes4M(periodoHeader);
        _renderTablasSupervisoresTodos4M(periodos);
      } else {
        _limpiarComparativoSupervisoresMes4M();
        _limpiarTablasSupervisoresTodos4M();
      }
    }

    function _renderTabla4MConSupervisores(conf) {
      const cols = (Array.isArray(conf) ? conf : [])
        .filter(c => c && c.periodo)
        .slice(0, 4);

      if (cols.length < 2) {
        _setTabla4MEmpty('Selecciona 4 periodos para comparar.');
        const nota = document.getElementById('notaTabla4M');
        if (nota) nota.textContent = '-';
        return;
      }

      const ordenTxt = cols.map(c => `${c.idx}:${c.supervisor || '-'}`).join(' | ');
      _renderTabla4MDoble(
        cols,
        `Vista por supervisor: ${ordenTxt} | Fuente: recupero acumulado y alcance acumulado por d&iacute;a (1..31). Mes actual se completa hasta ayer.`
      );
      _limpiarComparativoSupervisoresMes4M();
      _limpiarTablasSupervisoresTodos4M();
    }

    // HELPERS 4M

    function _listarSupervisoresDisponibles4M(fuenteSupervisores) {
      // fuenteSupervisores suele ser datosPorSupervisor o similar
      // Queremos los keys (nombres)
      try {
        const keys = Object.keys(fuenteSupervisores || {})
          .map(s => String(s || '').trim())
          .filter(Boolean);
        keys.sort((a,b) => a.localeCompare(b, 'es'));
        return keys;
      } catch (e) {
        return [];
      }
    }
    
    function _fillSelectSupervisores4M(sel, supervisores) {
      if (!sel) return;
      sel.innerHTML = '';
    
      // vacío = usar supervisor del header
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '(mismo del header)';
      sel.appendChild(opt0);
    
      supervisores.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        sel.appendChild(opt);
      });
    
      sel.value = '';
    }

    function _getSupervisorHeader4M() {
      // ✅ Prioridad máxima: variable global seteada por la vista supervisor
      if (window.supervisorSeleccionado && window.supervisorSeleccionado !== 'TODOS') {
        return String(window.supervisorSeleccionado).trim();
      }
    
      // fallback: select (si existe en alguna vista)
      const el = document.getElementById('selectorSupervisor');
      if (el && el.value && el.value !== 'TODOS') return String(el.value).trim();
    
      return '';
    }
    
    function _isVistaSupervisor4M() {
      const s = _getSupervisorHeader4M();
      return !!s;
    }
    
    function _valSupSelectOrHeader(i, supHeader) {
      if (i === 4) return supHeader; // P4 fijo
      const el = document.getElementById(`selTabla4M_Sup_${i}`);
      const v = (el && el.value) ? String(el.value).trim() : '';
      return v || supHeader;
    }

    function _getOrdenVista4M(supHeader, periodoHeader) {
      const fuenteSupervisores = _getFuenteSupervisores();
      const supKey = _getSupervisorKey4M(fuenteSupervisores, supHeader);
      const orden = fuenteSupervisores?.[supKey]?.[periodoHeader]?.vista_orden_4m;
      if (!Array.isArray(orden) || orden.length < 4) return null;
      const limpio = orden.slice(0, 4).map(s => String(s || '').trim());
      return limpio.some(Boolean) ? limpio : null;
    }

    function _getSupervisorVista4M(i, supHeader, periodoHeader) {
      const orden = _getOrdenVista4M(supHeader, periodoHeader);
      if (!orden) return supHeader;
      return orden[i - 1] || supHeader;
    }
    
    function initTablaComparativa4M() {
      const fuenteSupervisores = _getFuenteSupervisores();
      if (!fuenteSupervisores) return;
    
      const periodosDisponibles = _listarPeriodosDisponibles(fuenteSupervisores);
      const s1 = document.getElementById('selTabla4M_1');
      const s2 = document.getElementById('selTabla4M_2');
      const s3 = document.getElementById('selTabla4M_3');
      const s4 = document.getElementById('selTabla4M_4');
      const btn = document.getElementById('btnTabla4MRefrescar');
      const filaSup = document.getElementById('filaTabla4MSupervisores');
      const sup1 = document.getElementById('selTabla4M_Sup_1');
      const sup2 = document.getElementById('selTabla4M_Sup_2');
      const sup3 = document.getElementById('selTabla4M_Sup_3');
      const sup4Fixed = document.getElementById('selTabla4M_Sup_4_fixed');
    
      if (!s1 || !s2 || !s3 || !s4) return;
    
        const _fillSelect = (sel, permitirVacio) => {
          sel.innerHTML = '';
        
          if (permitirVacio) {
            const opt0 = document.createElement('option');
            opt0.value = '';
            opt0.textContent = '-';
            sel.appendChild(opt0);
          }
        
          periodosDisponibles.forEach((p) => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = `${_mesTitulo(p)} ${_anioDePeriodo(p)}`;
            sel.appendChild(opt);
          });
        };
    
      _fillSelect(s1, true); _fillSelect(s2, true); _fillSelect(s3, true); _fillSelect(s4, false);
    
      // Seteo de periodos
      const periodoUI = _getPeriodoSeleccionadoUI();
      let def = periodoUI ? _getPeriodosDefault4(periodoUI) : [];
      if (!def || def.length !== 4) {
        // fallback: top 4 más recientes disponibles
        def = periodosDisponibles.slice(0, 4);
      }
    
      if (def.length === 4) {
        s1.value = def[0];
        s2.value = def[1];
        s3.value = def[2];
        s4.value = def[3];
      }

      // Seteo de supervisores 4m
      const esVistaSup = _isVistaSupervisor4M();
      const supHeader = _getSupervisorHeader4M();
    
      if (filaSup) {
        filaSup.style.display = 'none';
      }
    
      if (esVistaSup) {
        if (sup4Fixed) sup4Fixed.value = supHeader || '—';
    
        const supervisoresDisponibles = _listarSupervisoresDisponibles4M(fuenteSupervisores);
        _fillSelectSupervisores4M(sup1, supervisoresDisponibles);
        _fillSelectSupervisores4M(sup2, supervisoresDisponibles);
        _fillSelectSupervisores4M(sup3, supervisoresDisponibles);
    
        // Por defecto: vacío => toma el del header
        if (sup1) sup1.value = '';
        if (sup2) sup2.value = '';
        if (sup3) sup3.value = '';
      }
    
        const _refrescar = () => {
          let supervisorFiltro = _getSupervisorActivo();
          if (!supervisorFiltro) supervisorFiltro = 'TODOS';
        
          const periodos = [s1.value, s2.value, s3.value, s4.value];
        
          // Vista general (TODOS) -> render normal
          if (!_isVistaSupervisor4M() || supervisorFiltro === 'TODOS') {
            _renderTabla4M(periodos, supervisorFiltro);
            return;
          }
        
          // Vista supervisor -> render con supervisor por columna (P4 fijo)
          const supHeader = _getSupervisorHeader4M() || supervisorFiltro;
        
          const periodoHeader = s4.value || _getPeriodoSeleccionadoUI();
          const conf = [
            { idx: 1, periodo: s1.value, supervisor: _getSupervisorVista4M(1, supHeader, periodoHeader) },
            { idx: 2, periodo: s2.value, supervisor: _getSupervisorVista4M(2, supHeader, periodoHeader) },
            { idx: 3, periodo: s3.value, supervisor: _getSupervisorVista4M(3, supHeader, periodoHeader) },
            { idx: 4, periodo: s4.value, supervisor: _getSupervisorVista4M(4, supHeader, periodoHeader) },
          ];
        
          _renderTabla4MConSupervisores(conf);
        };

        // Eventos
        s1.addEventListener('change', _refrescar);
        s2.addEventListener('change', _refrescar);
        s3.addEventListener('change', _refrescar);
        s4.addEventListener('change', _refrescar);
        if (btn) btn.addEventListener('click', _refrescar);
        
        // Nuevos eventos supervisores
        if (sup1) sup1.addEventListener('change', _refrescar);
        if (sup2) sup2.addEventListener('change', _refrescar);
        if (sup3) sup3.addEventListener('change', _refrescar);
        
        // Primer render
        _refrescar();
    }
    
    function generarGraficasRecuperosSupervisor(periodoCompleto, supervisor) {
        window.supervisorSeleccionado = (supervisor && supervisor !== 'TODOS') ? supervisor : '';
        const graficasContainer = document.getElementById('graficas-recuperos');
        if (!graficasContainer) return;
        
        let tituloGráfica = 'Recupero y Alcance';
        if (supervisor && supervisor !== 'TODOS') {
            tituloGráfica = `Recupero y Alcance - ${supervisor}`;
        }
        
            graficasContainer.innerHTML = `
                <div style="text-align: center; margin-bottom: 30px; display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                  <button
                    class="boton-exportar-excel"
                    onclick="exportarRecupero4MesesDiaSupervisor('${supervisor || ''}')">
                      Recuperos y Alcances Mensual ${supervisor && supervisor !== 'TODOS' ? `- ${supervisor}` : ''}
                  </button>





                </div>
                
                <!-- ===================== TABLA COMPARATIVA 4 MESES (ALCANCES) ===================== -->
                <div id="cardTablaComparativa4M" style="margin-top: 16px; background:#fff; border-radius:14px; box-shadow: 0 5px 15px rgba(0,0,0,0.08);">
                  <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap;">
                    <div>
                      <h3 style="margin:0; color:#2c3e50; font-size: 1.25rem; font-weight: 800;">Comparación diaria (4 periodos)</h3>
                      <div style="margin-top:6px; color:#666; font-size:0.92rem;">
                        Selecciona 4 periodos y compara el <b>alcance acumulado (%)</b> por día (1..31).
                      </div>
                    </div>
                
                    <button type="button" class="boton-busqueda" id="btnTabla4MRefrescar" style="padding:10px 14px;">
                      🔄 Actualizar
                    </button>
                      <button
                          type="button"
                          class="boton-busqueda"
                          onclick="copiarVistaAlcances4M()"
                          style="padding:10px 14px; background: linear-gradient(135deg, #34495e, #2c3e50);">
                          Copiar vista
                      </button>
                  </div>
                
                  <div class="tabla4m-selectores">
                    <div>
                      <label style="font-weight:700; color:#2c3e50;">Periodo 1</label>
                      <select id="selTabla4M_1" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                    </div>
                    <div>
                      <label style="font-weight:700; color:#2c3e50;">Periodo 2</label>
                      <select id="selTabla4M_2" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                    </div>
                    <div>
                      <label style="font-weight:700; color:#2c3e50;">Periodo 3</label>
                      <select id="selTabla4M_3" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                    </div>
                    <div>
                      <label style="font-weight:700; color:#2c3e50;">Periodo 4</label>
                      <select id="selTabla4M_4" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                    </div>
                  </div>
    
                  <div class="tabla4m-selectores" id="filaTabla4MSupervisores" style="margin-top:10px; display:none;">
                      <div>
                        <label style="font-weight:700; color:#2c3e50;">Supervisor P1</label>
                        <select id="selTabla4M_Sup_1" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                      </div>
                      <div>
                        <label style="font-weight:700; color:#2c3e50;">Supervisor P2</label>
                        <select id="selTabla4M_Sup_2" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                      </div>
                      <div>
                        <label style="font-weight:700; color:#2c3e50;">Supervisor P3</label>
                        <select id="selTabla4M_Sup_3" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                      </div>
                      <div>
                        <label style="font-weight:700; color:#2c3e50;">Supervisor P4 (fijo)</label>
                        <input id="selTabla4M_Sup_4_fixed" type="text" disabled
                               style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#f3f5f7;"
                               value="—" />
                      </div>
                  </div>
    
                  <!-- MINI GRÁFICAS -->
                  <div style="margin-top:12px; display:grid; grid-template-columns: 1fr; gap:12px; align-items:start;">
                      <div id="tablas4MComparativoSupervisores" class="tabla4m-comparativo"></div>
                  <div id="tablas4MSupervisoresTodos" class="tabla4m-supervisores-grid"></div>
                  <div id="tablas4MPrincipales" class="tabla4m-doble">
                    <div>
                      <div class="tabla4m-titulo">RECUPEROS</div>
                      <div class="tabla4m-wrap" style="justify-self:stretch; width:100%; max-width:100%;">
                        <table id="tablaComparativa4MRecupero" class="tabla-comparativa-4m" style="width:100%;">
                          <thead id="theadTabla4MRecupero"></thead>
                          <tbody id="tbodyTabla4MRecupero"></tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <div class="tabla4m-titulo">ALCANCES</div>
                      <div class="tabla4m-wrap" style="justify-self:stretch; width:100%; max-width:100%;">
                        <table id="tablaComparativa4MAlcance" class="tabla-comparativa-4m" style="width:100%;">
                          <thead id="theadTabla4MAlcance"></thead>
                          <tbody id="tbodyTabla4MAlcance"></tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                    
                      <div id="miniAlcancesRight" style="display:grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap:10px; align-content:start;">
                        <div class="mini-chart-card" data-mini="acumulado">
                          <div class="mini-title">ACUMULADO</div>
                          <canvas id="miniGraficaIncrementoTotal"></canvas>
                        </div>
                    
                        <div class="mini-chart-card" data-mini="diario">
                          <div class="mini-title">DIARIO</div>
                          <canvas id="miniGraficaRecuperoDiario"></canvas>
                        </div>
                    
                        <div class="mini-chart-card" data-mini="equipos">
                          <div class="mini-title">EQUIPOS</div>
                          <canvas id="miniGraficaAlcanceEquipos"></canvas>
                        </div>
                    
                        <div class="mini-chart-card" data-mini="anual">
                          <div class="mini-title">ANUAL</div>
                          <canvas id="miniGraficaEvolucionAnualRecuperos"></canvas>
                        </div>
                      </div>
                  </div>
                
                  <!-- MODAL ALCANCES -->
                  <div id="modalGraficaAlcances" style="display:none;">
                      <div id="modalGraficaAlcancesBackdrop"
                           style="position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:9999;"></div>
                    
                        <div id="modalGraficaAlcancesOverlay"
                             style="
                                position:fixed; inset:0; z-index:10000;
                                display:flex; align-items:center; justify-content:center;
                                padding:18px;">
                        <div style="
                            width:min(1200px, 96vw);
                            max-height:92vh;
                            background:#fff;
                            border-radius:16px;
                            box-shadow:0 18px 50px rgba(0,0,0,.25);
                            overflow:hidden;">
                          
                          <div style="display:flex; justify-content:space-between; align-items:center;
                                      padding:12px 14px; border-bottom:1px solid rgba(0,0,0,.08);">
                            <div id="modalGraficaAlcancesTitulo" style="font-weight:800; font-size:1.5rem; text-align:center; width:100%; color:#2c3e50;">
                              Gráfica de Alcances
                            </div>
                          </div>
                    
                          <div style="padding:12px;">
                            <canvas id="modalCanvasGraficaAlcances" style="display:block; margin:0 auto; width:100%; height: 70vh;"></canvas>
                          </div>
                        </div>
                      </div>
                  </div>
                
                  <div id="notaTabla4M" style="margin-top:10px; color:#666; font-size:0.9rem;">
                    —
                  </div>
                </div>
            `;

        const card4M = document.getElementById('cardTablaComparativa4M');
        const mini4M = document.getElementById('miniAlcancesRight');
        if (card4M && mini4M) {
          card4M.insertBefore(mini4M, card4M.firstElementChild);
          mini4M.style.marginBottom = '14px';
          mini4M.style.marginTop = '0';
        }

        try {
          initTablaComparativa4M();
        } catch (e) {
          console.warn('initTablaComparativa4M error:', e);
        }
        
        setTimeout(() => {
          if (supervisor && supervisor !== 'TODOS') {
            generarGraficaIncrementoTotalSupervisor(periodoCompleto, supervisor, 'miniGraficaIncrementoTotal', 'mini');
            generarGraficaRecuperoDiarioSupervisor(periodoCompleto, supervisor, 'miniGraficaRecuperoDiario', 'mini');
          } else {
            generarGraficaIncrementoTotal(periodoCompleto, 'miniGraficaIncrementoTotal', 'mini');
            generarGraficaRecuperoDiario(periodoCompleto, 'miniGraficaRecuperoDiario', 'mini');
          }
        
          generarGraficaAlcanceEquiposRecuperos(periodoCompleto, 'miniGraficaAlcanceEquipos', 'mini');
          actualizarGraficaEvolucionAnualRecuperos('miniGraficaEvolucionAnualRecuperos', 'mini');
        
          _bindMiniAlcancesClicks(periodoCompleto);
        }, 100);
    }

    function actualizarGraficaEvolucionAnualRecuperos(canvasId = 'graficaEvolucionAnualRecuperos', view = 'full') {
        const añoSeleccionado = document.getElementById('selectorAño').value;
        const contenedorGrafica = document.getElementById('graficaAnualContainer');
        const añoElement = document.getElementById('año-grafica-evolucion-recuperos');
        
        if (!añoSeleccionado) {
            // Mostrar mensaje si no hay año seleccionado
            const canvas = document.getElementById('graficaEvolucionAnualRecuperos');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                canvas.width = 1200;
                canvas.height = 200;
                canvas.style.display = 'block';
                canvas.style.margin = '0 auto';
                canvas.style.maxWidth = '100%';
                
                ctx.fillStyle = '#95a5a6';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('📊 Seleccione un año en los filtros superiores', canvas.width / 2, canvas.height / 2);
            }
            return;
        }

        if (añoElement) {
            añoElement.textContent = añoSeleccionado;
        }
        
        // Generar gráfica de tendencia
        generarGraficaEvolucionAnualTendenciaRecuperos(añoSeleccionado, canvasId, view);
    }

    function generarGraficaEvolucionAnualTendenciaRecuperos(año, canvasId = 'graficaEvolucionAnualRecuperos', view = 'full') {
        const mesesDelAño = obtenerMesesDelAño(año);
        if (mesesDelAño.length === 0) {
            mostrarMensajeSinDatosAnualRecuperos('graficaEvolucionAnualRecuperos', año);
            return;
        }
        
        // Metricas
        const alcancesPorMes = mesesDelAño.map(mes => {
            const periodoCompleto = `${mes}_${año}`;
            return calcularAlcanceTotalMes(periodoCompleto);
        });

        const metasPorMes = mesesDelAño.map(mes => {
          const periodoCompleto = `${mes}_${año}`;
          const lista = filtrarAsesoresPorCanal((datosMeses && datosMeses[periodoCompleto]) ? datosMeses[periodoCompleto] : []);
          return lista.reduce((acc, a) => acc + (Number(a.meta) || 0), 0);
        });
        
        const recuperosPorMes = mesesDelAño.map(mes => {
          const periodoCompleto = `${mes}_${año}`;
          const lista = filtrarAsesoresPorCanal((datosMeses && datosMeses[periodoCompleto]) ? datosMeses[periodoCompleto] : []);
          return lista.reduce((acc, a) => acc + (Number(a.recupero) || 0), 0);
        });
        
        const cantAsesoresPorMes = mesesDelAño.map(mes => {
          const periodoCompleto = `${mes}_${año}`;
          const lista = filtrarAsesoresPorCanal((datosMeses && datosMeses[periodoCompleto]) ? datosMeses[periodoCompleto] : []);
          return Array.isArray(lista) ? lista.length : 0;
        });
        
        const cantSupervisoresPorMes = mesesDelAño.map(mes => {
          const periodoCompleto = `${mes}_${año}`;
          const lista = filtrarAsesoresPorCanal((datosMeses && datosMeses[periodoCompleto]) ? datosMeses[periodoCompleto] : []);
          if (!Array.isArray(lista) || lista.length === 0) return 0;
          const set = new Set(lista.map(a => (a.supervisor || '').toString().trim()).filter(Boolean));
          return set.size;
        });
        
        const canvas = document.getElementById(canvasId)
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Destruir gráfica anterior si existe
        _destroyChartByCanvasId(canvasId);
        
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        _applyCanvasSize(canvas, view);
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
        
        // Abreviar nombres de meses
        const mesesAbreviados = mesesDelAño.map(mes => {
            return mes.substring(0, 3).toUpperCase();
        });
        
        // Calcular línea de tendencia (regresión lineal simple)
        const tendencia = calcularLineaTendencia(alcancesPorMes);

        let options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                  mode: 'index',
                  intersect: false,
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  titleFont: { size: 18, weight: 'bold' },
                  bodyFont: { size: 17 },
                  padding: 12,
                  cornerRadius: 8,
                  callbacks: {
                    label: function(context) {
                      const label = context.dataset.label || '';
                
                      // Ocultar solo Meta 100%
                      if (label === 'Meta 100%') {
                        return null;
                      }
                
                      // Línea de Tendencia
                      if (label === 'Línea de Tendencia') {
                        if (!context.parsed || context.parsed.y === null || !isFinite(context.parsed.y)) {
                          return null;
                        }
                        return `Línea de Tendencia: ${context.parsed.y.toFixed(2)}%`;
                      }
                
                      // tooltip en el dataset principal
                      if (label !== 'Alcance Real') {
                        return null;
                      }
                
                      const i = context.dataIndex;
                
                      const alcance = (context.parsed && context.parsed.y != null && isFinite(context.parsed.y))
                        ? context.parsed.y
                        : null;
                
                      const metaMes = Number(metasPorMes[i] || 0);
                      const recuperoMes = Number(recuperosPorMes[i] || 0);
                      const cantAse = Number(cantAsesoresPorMes[i] || 0);
                      const cantSup = Number(cantSupervisoresPorMes[i] || 0);
                
                      const fmtNum = (n) => {
                        try {
                          return Number(n || 0).toLocaleString('es-PE');
                        } catch (e) {
                          return String(n || 0);
                        }
                      };
                
                      const lineas = [];
                
                      if (alcance === null) {
                        lineas.push('Alcance Real: Sin datos');
                      } else {
                        lineas.push(`Alcance Real: ${alcance.toFixed(2)}%`);
                      }
                
                      lineas.push(`Meta del mes: ${fmtNum(metaMes)}`);
                      lineas.push(`Recupero del mes: ${fmtNum(recuperoMes)}`);
                      lineas.push(`Cantidad de asesores: ${fmtNum(cantAse)}`);
                      lineas.push(`Cantidad de supervisores: ${fmtNum(cantSup)}`);
                
                      return lineas;
                    }
                  }
                },
                legend: {
                    position: 'top',
                    labels: { font: { size: 12 } }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: 'Meses del Año',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: { 
                        font: { size: 13 }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: { 
                        display: true, 
                        text: 'Alcance Total (%)',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: {
                        callback: function(value) { return value + '%'; },
                        stepSize: 10,
                        font: { size: 13 }
                    },
                    min: 0,
                    suggestedMax: function() {
                        const valoresValidos = alcancesPorMes.filter(v => v !== null);
                        if (valoresValidos.length === 0) return 100;
                        const maxValor = Math.max(...valoresValidos);
                        return Math.max(100, Math.ceil(maxValor / 10) * 10);
                    }()
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        };
        
        options = _tuneOptionsForView(options, view);
        
        try {
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: mesesAbreviados,
                    datasets: [
                        {
                            label: 'Alcance Real',
                            data: alcancesPorMes,
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 6,
                            pointHoverRadius: 10,
                            pointBackgroundColor: '#3498db',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'Línea de Tendencia',
                            data: tendencia,
                            borderColor: '#e74c3c',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0,
                            pointRadius: 0
                        },
                        {
                            label: 'Meta 100%',
                            data: Array(mesesDelAño.length).fill(100),
                            borderColor: '#2ecc71',
                            backgroundColor: 'transparent',
                            borderWidth: 1,
                            borderDash: [3, 3],
                            fill: false,
                            tension: 0,
                            pointRadius: 0
                        }
                    ]
                },
                options,
            });
            _storeChart(canvasId, chart);
            
        } catch (error) {
            console.error("❌ Error al crear la gráfica de tendencia para recuperos:", error);
            mostrarMensajeSinDatosAnualRecuperos('graficaEvolucionAnualRecuperos', año);
        }
    }
    
    function generarGraficaRecuperoDiarioSupervisor(periodoCompleto, supervisor, canvasId = 'graficaRecuperoDiario', view = 'full') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const dataLabelsPluginTotal = _buildDataLabelsPluginTotal(view);
        const ctx = canvas.getContext('2d');
        
        _destroyChartByCanvasId(canvasId);
        _applyCanvasSize(canvas, view);
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const supervisorData = datosSupervisores?.[supervisor];
        const datosMes = supervisorData ? supervisorData[periodoCompleto] : null;
        const datosDiarios = datosMes?.datos_diarios_supervisor || {};
        const fechasConDatos = Object.keys(datosDiarios).sort((a, b) =>
            convertirFechaDiaria(a) - convertirFechaDiaria(b)
        );
        const fechasOrdenadas = obtenerFechasPeriodoCompleto(periodoCompleto);
        
        if (!datosMes || fechasConDatos.length === 0) {
            mostrarMensajeSinDatos(canvas, periodoCompleto, supervisor);
            return;
        }
        
        const metaSupervisor = Number(datosMes.meta_super || 0);
        const diasLaborables = fechasOrdenadas.length;
        const metaDiaria = diasLaborables > 0 ? metaSupervisor / diasLaborables : 0;
        
        const alcanceDiario = fechasOrdenadas.map(fecha => {
            const tieneDato = Object.prototype.hasOwnProperty.call(datosDiarios, fecha);
            const totalRecuperoDia = tieneDato ? Number(datosDiarios[fecha] || 0) : null;
            const porcentajeDiario = (totalRecuperoDia !== null && metaDiaria > 0) ? (totalRecuperoDia / metaDiaria) * 100 : null;
            return {
                fecha,
                recupero: totalRecuperoDia,
                porcentaje: porcentajeDiario
            };
        });
        
        const porcentajes = alcanceDiario.map(dia => dia.porcentaje);
        const coloresBarras = porcentajes.map(porcentaje => {
            if (porcentaje === null || porcentaje === undefined) return 'rgba(226, 232, 240, 0.45)';
            if (porcentaje === null || porcentaje === undefined) return 'rgba(226, 232, 240, 0.45)';
            if (porcentaje <= 0) return '#F3E5F5';
            if (porcentaje <= 20) return '#E1BEE7';
            if (porcentaje <= 40) return '#BA68C8';
            if (porcentaje <= 60) return '#8E24AA';
            if (porcentaje <= 80) return '#6A1B9A';
            if (porcentaje <= 100) return '#4A148C';
            return '#38006B';
        });
        
        let options = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: {
                    display: true,
                    text: ['            ', '            '],
                    font: { size: 24, weight: 'bold' }
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: { size: 18, weight: 'bold' },
                    bodyFont: { size: 17 },
                    padding: 15,
                    cornerRadius: 10,
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return `Día ${index + 1}: ${fechasOrdenadas[index]}`;
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const dia = alcanceDiario[index];
                            return [
                                dia.porcentaje === null ? 'Sin datos cargados' : `Alcance: ${dia.porcentaje.toFixed(2)}%`,
                                dia.recupero === null ? 'Recupero acumulado: sin data' : `Recupero acumulado: S/ ${dia.recupero.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                `Meta diaria referencial: S/ ${metaDiaria.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ];
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { font: { size: 16 }, maxRotation: 0, minRotation: 0 },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { return value + '%'; },
                        font: { size: 16 },
                        stepSize: 10
                    },
                    min: 0,
                    suggestedMax: Math.max(100, Math.ceil(Math.max(...porcentajes.filter(v => v !== null && v !== undefined), 0) / 10) * 10)
                }
            }
        };
        
        try {
            options = _tuneOptionsForView(options, view);
        } catch (e) {}
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: fechasOrdenadas.map(fecha => {
                    if (fecha.includes('-')) return fecha.split('-')[0];
                    return fecha;
                }),
                datasets: [{
                    label: `Alcance Diario - ${supervisor}`,
                    data: porcentajes,
                    backgroundColor: coloresBarras,
                    borderColor: coloresBarras.map(color => color + 'CC'),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options,
            plugins: [dataLabelsPluginTotal]
        });
        
        _storeChart(canvasId, chart);
    }

    function generarGraficaIncrementoTotalSupervisor(periodoCompleto, supervisor, canvasId = 'graficaIncrementoTotal', view = 'full') {
    
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const dataLabelsPluginTotal = _buildDataLabelsPluginTotal(view);
        const ctx = canvas.getContext('2d');
    
        // Destruir gráfica anterior si existe (mejor por canvasId)
        _destroyChartByCanvasId(canvasId);
    
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    
        // Obtener datos del supervisor
        const supervisorData = datosSupervisores[supervisor];
        if (!supervisorData || !supervisorData[periodoCompleto]) {
            mostrarMensajeSinDatos(canvas, periodoCompleto, supervisor);
            return;
        }
    
        const datosMes = supervisorData[periodoCompleto];
        const metaSupervisor = datosMes.meta_super || 0;
        const datosDiarios = datosMes.datos_diarios_supervisor || {};
    
        if (Object.keys(datosDiarios).length === 0) {
            mostrarMensajeSinDatos(canvas, periodoCompleto, supervisor);
            return;
        }
    
        // Ordenar fechas
        const todasFechas = Object.keys(datosDiarios).sort((a, b) =>
            convertirFechaDiaria(a) - convertirFechaDiaria(b)
        );
    
        const recuperoAcumuladoPorFecha = {};
        const datosValidosParaGrafica = [];
    
        todasFechas.forEach(fecha => {
            const recuperoAcumulado = datosDiarios[fecha] || 0;
            recuperoAcumuladoPorFecha[fecha] = recuperoAcumulado;
    
            const alcanceDia = metaSupervisor > 0 ? (recuperoAcumulado / metaSupervisor) * 100 : 0;
    
            if (recuperoAcumulado > 0) {
                datosValidosParaGrafica.push(alcanceDia);
            } else {
                datosValidosParaGrafica.push(null);
            }
        });
    
        // Último día con datos
        let ultimoDiaConDatos = -1;
        for (let i = todasFechas.length - 1; i >= 0; i--) {
            const fecha = todasFechas[i];
            const recuperoDia = recuperoAcumuladoPorFecha[fecha] || 0;
            if (recuperoDia > 0) {
                ultimoDiaConDatos = i;
                break;
            }
        }
        if (ultimoDiaConDatos === -1) ultimoDiaConDatos = todasFechas.length - 1;
    
        // 🔸 NO fuerces 1200x700 para mini/modal; deja que _tuneOptionsForView + CSS manejen
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
    
        const labelsParaGrafica = todasFechas.map(fecha => {
            if (fecha.includes('-')) return fecha.split('-')[0];
            return fecha;
        });
    
        const colorLinea = '#9b59b6';
        const colorArea = 'rgba(155, 89, 182, 0.2)';
    
        let options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: [`            `,`            `],
                    font: { size: 22, weight: 'bold' },
                    padding: { bottom: 25 }
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleFont: { size: 18, weight: 'bold' },
                    bodyFont: { size: 17 },
                    padding: 15,
                    cornerRadius: 10,
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return 'Día ' + (index + 1) + ': ' + todasFechas[index];
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const alcance = context.parsed.y;
                            const recuperoAcumulado = recuperoAcumuladoPorFecha[todasFechas[index]] || 0;
    
                            if (index > ultimoDiaConDatos || alcance === null) {
                                return '📭 Sin datos de recupero';
                            }
    
                            let incrementoDia = 0;
                            if (index > 0) {
                                const alcanceAnterior = context.chart.data.datasets[0].data[index - 1] || 0;
                                incrementoDia = (alcance - alcanceAnterior);
                            } else {
                                incrementoDia = alcance;
                            }
    
                            return [
                                '🎯 Alcance Acumulado: ' + alcance.toFixed(2) + '%',
                                '📈 Alcance del día: ' + incrementoDia.toFixed(2) + '%',
                                '💰 Recupero Acumulado: ' + recuperoAcumulado.toLocaleString('es-PE', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                })
                            ];
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        font: { size: 16 },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { return value + '%'; },
                        stepSize: 10,
                        font: { size: 16 }
                    },
                    min: 0,
                    suggestedMax: (function() {
                        const valoresValidos = datosValidosParaGrafica.filter(v => v !== null && v > 0);
                        if (valoresValidos.length === 0) return 100;
                        const maxValor = Math.max(...valoresValidos);
                        return Math.max(100, Math.ceil(maxValor / 10) * 10);
                    })(),
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            elements: {
                line: { tension: 0.4 }
            }
        };
    
        try {
          options = _tuneOptionsForView(options, view);
        } catch (e) {}
        
        
        try {
          const chart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: labelsParaGrafica,
              datasets: [{
                label: `Alcance Acumulado - ${supervisor}`,
                data: datosValidosParaGrafica,
                backgroundColor: colorArea,
                borderColor: colorLinea,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: function(context) {
                  const value = context.dataset.data[context.dataIndex];
                  return value === null || value === 0 ? 0 : 6;
                },
                pointHoverRadius: function(context) {
                  const value = context.dataset.data[context.dataIndex];
                  return value === null || value === 0 ? 0 : 8;
                },
                pointBackgroundColor: function(context) {
                  const value = context.dataset.data[context.dataIndex];
                  return value === null || value === 0 ? 'transparent' : colorLinea;
                },
                pointBorderColor: function(context) {
                  const value = context.dataset.data[context.dataIndex];
                  return value === null || value === 0 ? 'transparent' : '#ffffff';
                },
                pointBorderWidth: 2,
                spanGaps: false
              }]
            },
            options,
            plugins: [dataLabelsPluginTotal]
          });
        
          _storeChart(canvasId, chart);
        
        } catch (error) {
          console.error("Error al crear la gráfica:", error);
          ctx.fillStyle = '#e74c3c';
          ctx.font = 'bold 20px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Error al generar gráfica', canvas.width / 2, canvas.height / 2);
        }
    }
    
    function calcularEstadisticasRecuperosPorSupervisor(periodoCompleto, supervisor) {
        // 1. OBTENER DATOS DEL SUPERVISOR ESPECÍFICO
        const supervisorData = datosSupervisores[supervisor];
        
        if (!supervisorData || !supervisorData[periodoCompleto]) {
            console.log(`⚠️ No hay datos para el supervisor: ${supervisor} en ${periodoCompleto}`);
            mostrarEstadisticasVacias(periodoCompleto, supervisor);
            return;
        }
        
        const datosMes = supervisorData[periodoCompleto];
        
        // 2. DATOS BÁSICOS DEL SUPERVISOR
        const metaTotalMes = datosMes.meta_super || 0;
        const recuperoTotalActual = datosMes.total_recupero || 0;
        
        // 3. OBTENER DÍAS LABORABLES
        const datosDiarios = datosMes.datos_diarios_supervisor || {};
        let fechas = Object.keys(datosDiarios);
        
        if (fechas.length === 0) {

            const alcanceDiario = datosMes.alcance_acumulado_diario || {};
            fechas = Object.keys(alcanceDiario);
        }
        
        const fechasOrdenadas = fechas.sort((a, b) => 
            convertirFechaDiaria(a) - convertirFechaDiaria(b)
        );
        
        // Días registrados
        const diasRegistradosBD = fechasOrdenadas.length;
        
        // Días laborables
        const diasLaborables = 0;
        
        // 4. CALCULAR DÍAS TRABAJADOS
        let diasTrabajados = 0;
        let totalRecuperoDiasTrabajados = 0;
        
        if (fechasOrdenadas.length > 0) {
            for (let i = 0; i < fechasOrdenadas.length; i++) {
                const fecha = fechasOrdenadas[i];
                let recuperoDia = 0;
        
                if (datosDiarios[fecha] !== undefined) {
                    if (i === 0) {
                        recuperoDia = datosDiarios[fecha] || 0;
                    } else {
                        const fechaAnterior = fechasOrdenadas[i-1];
                        const recuperoAnterior = datosDiarios[fechaAnterior] || 0;
                        const recuperoActual = datosDiarios[fecha] || 0;
                        recuperoDia = recuperoActual - recuperoAnterior;
                    }
                }
        
                if (recuperoDia > 0) {
                    diasTrabajados++;
                    totalRecuperoDiasTrabajados += recuperoDia;
                }
            }
        }
        
        // 5. CALCULAR ALCANCE ACTUAL
        const alcanceActual = metaTotalMes > 0 ? 
            parseFloat(((recuperoTotalActual / metaTotalMes) * 100).toFixed(2)) : 0;
        
        // 6. CALCULAR META DIARIA (basada en días laborables)
        const metaDiaria = diasLaborables > 0 ? metaTotalMes / diasLaborables : 0;
        
        // 7. CALCULAR PROMEDIO DIARIO REAL
        const promedioDiarioReal = diasTrabajados > 0 ? totalRecuperoDiasTrabajados / diasTrabajados : 0;
        
        // 8. CALCULAR PROYECCIONES
        const diasRestantes = Math.max(0, diasLaborables - diasTrabajados);
        const recuperoProyectado = promedioDiarioReal * diasRestantes;
        const recuperoTotalProyectado = recuperoTotalActual + recuperoProyectado;
        const eficienciaDiaria = metaTotalMes > 0 ? (recuperoTotalProyectado / metaTotalMes) * 100 : 0;
        
        // 9. Calcular eficiencia vs meta diaria
        const eficienciaVsMetaDiaria = metaDiaria > 0 ? (promedioDiarioReal / metaDiaria) * 100 : 0;
        
        // 10. INTERFAZ
        mostrarEstadisticasUnificada(
          periodoCompleto,
          {
            metaTotalMes,
            recuperoTotalActual,
            alcanceActual,
            eficienciaDiaria,
            diasLaborables,
            diasRegistradosBD,
            diasTrabajados,
            metaDiaria,
            promedioDiarioReal,
            eficienciaVsMetaDiaria,
            recuperoProyectado,
            recuperoTotalProyectado,
            diasRestantes
          },
          'supervisor',
          supervisor
        );
    }

    function mostrarEstadisticasVacias(periodoCompleto, supervisor = null) {
        const statsElement = document.getElementById('estadisticas-recuperos');
        if (!statsElement) return;
        statsElement.innerHTML = '';
    }

    function mostrarEstadisticasUnificada(
        periodoCompleto,
        estadisticas,
        contexto = 'global',
        supervisorNombre = null
    ) {
        const {
          metaTotalMes,
          recuperoTotalActual,
          alcanceActual,
          eficienciaDiaria,
          diasLaborables,
          diasRegistradosBD,
          diasTrabajados,
          metaDiaria,
          promedioDiarioReal,
          eficienciaVsMetaDiaria,
          recuperoProyectado,
          recuperoTotalProyectado,
          diasRestantes
        } = estadisticas;

        const dl = Number(diasLaborables || 0);
        const dt = Number(diasTrabajados || 0);
        const dtCap = (dl > 0) ? Math.min(dt, dl) : dt;
        
        const ratioTrabajados = (dl > 0) ? `${dtCap}/${dl}` : '0/0';
        const porcentajeTiempo = (dl > 0) ? ((dtCap / dl) * 100).toFixed(0) : 0;
        const progresoTiempoPorcentaje = (dl > 0) ? (dtCap / dl) * 100 : 0;
        const formatoMoneda = (valor) => 'S/ ' + valor.toLocaleString('es-PE', { minimumFractionDigits: 0 });
        const [mes, año] = periodoCompleto.split('_');
        const colorAlcanceActual = alcanceActual >= 100 ? '#27ae60' : 
                                  alcanceActual >= 70 ? '#f39c12' : 
                                  alcanceActual >= 40 ? '#e67e22' : '#e74c3c';
        
        const colorEficiencia = eficienciaDiaria >= 100 ? '#27ae60' : 
                               eficienciaDiaria >= 70 ? '#f39c12' : 
                               eficienciaDiaria >= 40 ? '#e67e22' : '#e74c3c';
        
        const textoMeta = contexto === 'supervisor' ? 'Meta del supervisor' : 'Meta total del período';
        const textoRecupero = contexto === 'supervisor' ? 'Total recuperado' : 'Total recuperado por todos';
        const html = `
            <div style="display:grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap:15px; margin-bottom:18px;">
                <div style="text-align:center; padding:18px; background:#E8F4FD; border-radius:10px; border:2px solid #3498db;">
                    <div style="font-size:0.95rem; color:#3498db; margin-bottom:6px; font-weight:700;">DIAS TRABAJADOS</div>
                    <div style="font-size:2rem; font-weight:800; color:#3498db;">${ratioTrabajados}</div>
                    <div style="font-size:0.85rem; color:#666; margin-top:5px;">${porcentajeTiempo}% del mes</div>
                </div>

                <div style="text-align:center; padding:18px; background:#F4ECF7; border-radius:10px; border:2px solid #9b59b6;">
                    <div style="font-size:0.95rem; color:#9b59b6; margin-bottom:6px; font-weight:700;">META DEL MES</div>
                    <div style="font-size:1.55rem; font-weight:800; color:#9b59b6;">${formatoMoneda(metaTotalMes)}</div>
                    <div style="font-size:0.85rem; color:#666; margin-top:5px;">${textoMeta}</div>
                </div>

                <div style="text-align:center; padding:18px; background:#E8F6F3; border-radius:10px; border:2px solid #27ae60;">
                    <div style="font-size:0.95rem; color:#27ae60; margin-bottom:6px; font-weight:700;">RECUPERO ACTUAL</div>
                    <div style="font-size:1.55rem; font-weight:800; color:#27ae60;">${formatoMoneda(recuperoTotalActual)}</div>
                    <div style="font-size:0.85rem; color:#666; margin-top:5px;">${textoRecupero}</div>
                </div>

                <div style="text-align:center; padding:18px; background:#D1E9FB; border-radius:10px; border:2px solid #3498db;">
                    <div style="font-size:0.95rem; color:#3498db; margin-bottom:6px; font-weight:700;">?? ALCANCE ACTUAL</div>
                    <div style="font-size:2rem; font-weight:800; color:${colorAlcanceActual};">${alcanceActual.toFixed(2)}%</div>
                    <div style="font-size:0.85rem; color:#2c3e50; margin-top:5px;">${formatoMoneda(recuperoTotalActual)} / ${formatoMoneda(metaTotalMes)}</div>
                </div>
            </div>
        `;

        const statsElement = document.getElementById('estadisticas-recuperos');
        if (statsElement) {
            statsElement.innerHTML = '';
        }
    }

    window.__simAlcancesState = window.__simAlcancesState || {};
    
    // MODAL: SIMULACIÓN
    function _asegurarModalSimulacionAlcances() {
        if (document.getElementById('modalSimAlcancesOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'modalSimAlcancesOverlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.55);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 18px;
        `;

        overlay.innerHTML = `
            <style id="simRangeStyles">
              /* Solo afecta sliders dentro del modal */
              #modalSimAlcancesOverlay .sim-range {
                width: 100%;
                height: 14px;
                border-radius: 999px;
                cursor: pointer;
                -webkit-appearance: none;
                appearance: none;
                background: #e9e9ef;
                outline: none;
              }
            
              /* WebKit (Chrome/Edge) */
              #modalSimAlcancesOverlay .sim-range::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: #9b59b6;
                border: 3px solid #fff;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                margin-top: -4px; /* centra el thumb */
              }
            
              #modalSimAlcancesOverlay .sim-range::-webkit-slider-runnable-track {
                height: 14px;
                border-radius: 999px;
              }
            
              /* Firefox */
              #modalSimAlcancesOverlay .sim-range::-moz-range-track {
                height: 14px;
                border-radius: 999px;
                background: #e9e9ef;
              }
            
              #modalSimAlcancesOverlay .sim-range::-moz-range-thumb {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: #9b59b6;
                border: 3px solid #fff;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
              }
            </style>
            <div
              id="modalSimAlcancesCard"
              style="
                width: min(1320px, 98vw);
                max-height: 90vh;
                overflow: auto;
                background: #fff;
                border-radius: 16px;
                box-shadow: 0 18px 50px rgba(0,0,0,0.25);
                border: 1px solid rgba(0,0,0,0.08);
              "
            >

                <div style="padding: 16px 18px;">
                    <div id="simAlcancesPanelMes"></div>
                    <div id="simAlcancesTabla"></div>
                </div>
            </div>
        `;
        overlay.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'modalSimAlcancesOverlay') {
                cerrarModalSimulacionAlcances();
            }
        });

        document.body.appendChild(overlay);
    }

    function _keyMes(periodoCompleto) {
        return `MES__${periodoCompleto}`;
    }

    function _getTotalesMes(periodoCompleto) {
        const supervisores = _getSupervisoresDePeriodo(periodoCompleto);

        let metaMes = 0;
        let recMes = 0;

        supervisores.forEach((sup) => {
            const d = datosSupervisores[sup][periodoCompleto] || {};
            metaMes += Number(d.meta_super || 0);
            recMes  += Number(d.total_recupero || 0);
        });

        const alcanceMes = (metaMes > 0) ? (recMes / metaMes) * 100 : 0;
        return { metaMes, recMes, alcanceMes };
    }

    function _getSimMes(periodoCompleto) {
        const supervisores = _getSupervisoresDePeriodo(periodoCompleto);

        let metaMes = 0;
        let recActualMes = 0;
        let recSimMes = 0;

        supervisores.forEach((sup) => {
            const d = datosSupervisores[sup][periodoCompleto] || {};
            const meta = Number(d.meta_super || 0);
            const rec  = Number(d.total_recupero || 0);

            metaMes += meta;
            recActualMes += rec;

            const key = `${periodoCompleto}__${sup}`;
            const st = window.__simAlcancesState[key] || {};
            const add = Math.max(0, Number(st.montoAdd || 0));

            recSimMes += (rec + add);
        });

        const alcanceSimMes = (metaMes > 0) ? (recSimMes / metaMes) * 100 : 0;

        return {
            metaMes,
            recActualMes,
            recSimMes,
            alcanceSimMes
        };
    }

    function abrirModalSimulacionAlcances(periodoCompleto) {
        _asegurarModalSimulacionAlcances();

        const overlay = document.getElementById('modalSimAlcancesOverlay');
        overlay.style.display = 'flex';
        _renderModalSimulacionAlcances(periodoCompleto);
    }

    function cerrarModalSimulacionAlcances() {
        const overlay = document.getElementById('modalSimAlcancesOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    function _getSupervisoresDePeriodo(periodoCompleto) {
        const supervisoresData = datosSupervisores || {};
        return Object.keys(supervisoresData).filter(sup =>
            supervisoresData[sup] && supervisoresData[sup][periodoCompleto]
        );
    }

    function _fmtMoneda(valor) {
        const n = Number(valor || 0);
        return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 0 });
    }

    function _clamp(n, a, b) {
        n = Number(n);
        if (!isFinite(n)) n = 0;
        return Math.max(a, Math.min(b, n));
    }

    function _colorPorAlcance(pct) {
        const p = Number(pct || 0);
        return p >= 100 ? '#27ae60' : p >= 70 ? '#f39c12' : p >= 40 ? '#e67e22' : '#e74c3c';
    }

    function _montoParaAlcance(meta, recuperoActual, objetivoPct) {
        const m = Number(meta || 0);
        const r = Number(recuperoActual || 0);
        const obj = Number(objetivoPct || 0);

        if (m <= 0) return 0;
        const totalRequerido = (m * obj) / 100;
        return Math.max(0, totalRequerido - r);
    }

    function _renderModalSimulacionAlcances(periodoCompleto) {
        const supervisores = _getSupervisoresDePeriodo(periodoCompleto);

        const sub = document.getElementById('simAlcancesSubtitulo');
        if (sub) sub.textContent = `Periodo: ${String(periodoCompleto).replace('_', ' ')}`;

        const cont = document.getElementById('simAlcancesTabla');
        if (!cont) return;

        if (!supervisores.length) {
            cont.innerHTML = `
                <div style="padding: 14px; border: 2px dashed #cfd8dc; border-radius: 12px; text-align:center; color:#7f8c8d;">
                    No hay supervisores con data para este periodo.
                </div>
            `;
            return;
        }
        let html = `
          <div
            style="
              display:grid;
              grid-template-columns: repeat(2, minmax(520px, 1fr));
              gap: 12px;
              align-items: start;
            "
            id="simGridSupervisores"
          >
        `;
        const panelMes = document.getElementById('simAlcancesPanelMes');
        if (panelMes) {
            const t = _getTotalesMes(periodoCompleto);
            const kMes = _keyMes(periodoCompleto);
            if (!window.__simAlcancesState[kMes]) {
                window.__simAlcancesState[kMes] = { objetivoPctMes: 100 };
            }

            const objMes = _clamp(window.__simAlcancesState[kMes].objetivoPctMes, 0, 200);
            const sim = _getSimMes(periodoCompleto);

            const cAct = _colorPorAlcance(t.alcanceMes);
            const cSim = _colorPorAlcance(sim.alcanceSimMes);

            panelMes.innerHTML = `
                <div style="
                    border: 2px solid rgba(155,89,182,0.25);
                    background: linear-gradient(180deg, rgba(155,89,182,0.08), rgba(155,89,182,0.03));
                    border-radius: 16px;
                    padding: 14px;
                    margin-bottom: 12px;
                ">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                        <div>
                            <div style="font-weight: 1000; color:#2c3e50; font-size: 1.05rem;">
                                📌 Simulación de ${periodoCompleto.replace('_', ' ')}
                            </div>
                            <div style="margin-top:6px; font-size:0.92rem; color:#7f8c8d;">
                                Meta mes: <b style="color:#2c3e50;">${_fmtMoneda(t.metaMes)}</b>
                                · Recupero actual mes: <b style="color:#2c3e50;">${_fmtMoneda(t.recMes)}</b>
                                · Recupero simulado mes: <b id="simMesRec__${periodoCompleto}" style="color:#2c3e50;">${_fmtMoneda(sim.recSimMes)}</b>
                            </div>
                        </div>

                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <div style="padding:10px 12px; border-radius:12px; background:${cAct}14; border:1px solid ${cAct}55; min-width: 190px;">
                                <div style="font-size:0.82rem; color:#7f8c8d;">Alcance actual mes</div>
                                <div style="font-size:1.25rem; font-weight:1000; color:${cAct};">${t.alcanceMes.toFixed(2)}%</div>
                            </div>

                            <div style="padding:10px 12px; border-radius:12px; background:${cSim}14; border:1px solid ${cSim}55; min-width: 200px;">
                                <div style="font-size:0.82rem; color:#7f8c8d;">Alcance simulado mes</div>
                                <div id="simMesPct__${periodoCompleto}" style="font-size:1.25rem; font-weight:1000; color:${cSim};">
                                    ${sim.alcanceSimMes.toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 12px;">     
                        <div style="padding: 6px 0;">
                          <input
                            id="simMesSlider__${periodoCompleto}"
                            type="range"
                            min="0"
                            max="200"
                            value="${objMes}"
                            class="sim-range"
                            oninput="onSimMesObjetivoInput('${periodoCompleto}', this.value)"
                            style="width:100%;"
                          />
                        </div>
                    </div>
                </div>
            `;
        }

        window.__simSupIndexMap = window.__simSupIndexMap || {};
        window.__simSupIndexMap[periodoCompleto] = {};

        supervisores.forEach((sup, idx) => {
            window.__simSupIndexMap[periodoCompleto][sup] = idx;
            const d = datosSupervisores[sup][periodoCompleto] || {};
            const meta = Number(d.meta_super || 0);
            const rec = Number(d.total_recupero || 0);
            const alcanceActual = (meta > 0) ? (rec / meta) * 100 : 0;
            const key = `${periodoCompleto}__${sup}`;

            if (!window.__simAlcancesState[key]) {
                const objetivoInicial = 100;
                const addInicial = _montoParaAlcance(meta, rec, objetivoInicial);
                window.__simAlcancesState[key] = {
                    objetivoPct: objetivoInicial,
                    montoAdd: addInicial
                };
            }

            const st = window.__simAlcancesState[key];
            const objetivoPct = _clamp(st.objetivoPct, 0, 200);
            const montoAdd = Math.max(0, Number(st.montoAdd || 0));

            const recSim = rec + montoAdd;
            const alcanceSim = (meta > 0) ? (recSim / meta) * 100 : 0;

            const cAct = _colorPorAlcance(alcanceActual);
            const cSim = _colorPorAlcance(alcanceSim);

            html += `
                <div style="border:1px solid #eee; border-radius: 14px; padding: 10px; background:#fff;">
                    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                        <div style="min-width: 240px;">
                            <div style="font-weight: 900; color:#2c3e50; font-size: 1.02rem;">👤 ${sup}</div>
                            <div style="margin-top:6px; font-size:0.9rem; color:#7f8c8d;">
                              Meta: <b style="color:#2c3e50;">${_fmtMoneda(meta)}</b>
                              · Recupero actual: <b style="color:#2c3e50;">${_fmtMoneda(rec)}</b>
                              · Recupero simulado: <b id="simRec__${idx}" style="color:#2c3e50;">${_fmtMoneda(recSim)}</b>
                            </div>
                        </div>

                        <!-- FILA COMPACTA: Actual + Simulado + Monto adicional -->
                        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:stretch;">
                            <div style="padding:8px 10px; border-radius:12px; background:${cAct}14; border:1px solid ${cAct}55; min-width: 155px;">
                                <div style="font-size:0.8rem; color:#7f8c8d;">Alcance actual</div>
                                <div style="font-size:1.15rem; font-weight:900; color:${cAct};">${alcanceActual.toFixed(2)}%</div>
                            </div>

                            <div style="padding:8px 10px; border-radius:12px; background:${cSim}14; border:1px solid ${cSim}55; min-width: 165px;">
                                <div style="font-size:0.8rem; color:#7f8c8d;">Alcance simulado</div>
                                <div id="simPct__${idx}" style="font-size:1.15rem; font-weight:900; color:${cSim};">
                                    ${alcanceSim.toFixed(2)}%
                                </div>
                            </div>

                            <div style="padding:8px 10px; border-radius:12px; background:#f7f7fb; border:1px solid #e6e6f0; min-width: 220px;">
                                <div style="font-size:0.8rem; color:#7f8c8d;">Monto adicional</div>
                                <input
                                    id="simMonto__${idx}"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value="${Math.round(montoAdd)}"
                                    oninput="onSimAlcancesMontoInput('${periodoCompleto}','${sup}', ${idx}, this)"
                                    onblur="onSimAlcancesMontoCommit('${periodoCompleto}','${sup}', ${idx}, this)"
                                    style="
                                        width:100%;
                                        margin-top:6px;
                                        padding: 9px 10px;
                                        border-radius: 10px;
                                        border: 1px solid #ddd;
                                        font-weight:900;
                                        color:#2c3e50;
                                    "
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Slider abajo (más bajo, solo una fila) -->
                    <div style="margin-top: 10px;">
                        <input
                          id="simSlider__${idx}"
                          type="range"
                          min="0"
                          max="200"
                          value="${objetivoPct}"
                          class="sim-range"
                          oninput="onSimAlcancesSliderInput('${periodoCompleto}','${sup}', ${idx}, this.value)"
                          style="width:100%;"
                        />
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        cont.innerHTML = html;
        const grid = document.getElementById('simGridSupervisores');
        if (grid) {
            const w = window.innerWidth || 0;
            if (w < 1100) {
                grid.style.gridTemplateColumns = '1fr';
            }
        }
    }

    // HELPERS ALCANCES

    function _updatePanelMesUI(periodoCompleto) {
        const sim = _getSimMes(periodoCompleto);

        const elRec = document.getElementById(`simMesRec__${periodoCompleto}`);
        if (elRec) elRec.textContent = _fmtMoneda(sim.recSimMes);

        const elPct = document.getElementById(`simMesPct__${periodoCompleto}`);
        if (elPct) {
            elPct.textContent = `${sim.alcanceSimMes.toFixed(2)}%`;
            const c = _colorPorAlcance(sim.alcanceSimMes);
            elPct.style.color = c;
        }
    }

    function onSimMesObjetivoInput(periodoCompleto, objetivoPctMes) {
      const kMes = _keyMes(periodoCompleto);
      window.__simAlcancesState[kMes] = window.__simAlcancesState[kMes] || {};
    
      const obj = _clamp(objetivoPctMes, 0, 200);
      window.__simAlcancesState[kMes].objetivoPctMes = obj;
    
      const elObj = document.getElementById(`simMesObj__${periodoCompleto}`);
      if (elObj) elObj.textContent = `${obj.toFixed(0)}%`;
    
      const supervisores = _getSupervisoresDePeriodo(periodoCompleto);
      const mapIdx = (window.__simSupIndexMap && window.__simSupIndexMap[periodoCompleto]) ? window.__simSupIndexMap[periodoCompleto] : {};
    
      supervisores.forEach((sup) => {
        const d = datosSupervisores[sup][periodoCompleto] || {};
        const meta = Number(d.meta_super || 0);
        const rec  = Number(d.total_recupero || 0);
    
        const key = `${periodoCompleto}__${sup}`;
        window.__simAlcancesState[key] = window.__simAlcancesState[key] || {};
    
        const add = _montoParaAlcance(meta, rec, obj);
        window.__simAlcancesState[key].objetivoPct = obj;
        window.__simAlcancesState[key].montoAdd = add;
    
        const idx = mapIdx[sup];
        if (idx === undefined) return;
    
        const elSupObj = document.getElementById(`simObj__${idx}`);
        if (elSupObj) elSupObj.textContent = `${obj.toFixed(0)}%`;
    
        const elSlider = document.getElementById(`simSlider__${idx}`);
        if (elSlider && document.activeElement !== elSlider) elSlider.value = String(obj);
    
        const elMonto = document.getElementById(`simMonto__${idx}`);
        if (elMonto && document.activeElement !== elMonto) elMonto.value = String(Math.round(add));
    
        _updateSimCardUI(idx, meta, rec, add);
      });
    
      _updatePanelMesUI(periodoCompleto);
    }

    function _safeNum(v) {
        const n = Number(v);
        return (isFinite(n) ? n : 0);
    }

    function _updateSimCardUI(idx, meta, rec, add) {
        const recSim = rec + add;
        const pctSim = (meta > 0) ? (recSim / meta) * 100 : 0;

        const elRec = document.getElementById(`simRec__${idx}`);
        if (elRec) elRec.textContent = _fmtMoneda(recSim);

        const elPct = document.getElementById(`simPct__${idx}`);
        if (elPct) {
            elPct.textContent = `${pctSim.toFixed(2)}%`;
            const c = _colorPorAlcance(pctSim);
            elPct.style.color = c;
        }
    }

    // ===== Slider: recalcula monto adicional
    function onSimAlcancesSliderInput(periodoCompleto, supervisor, idx, objetivoPct) {
        const key = `${periodoCompleto}__${supervisor}`;
        window.__simAlcancesState[key] = window.__simAlcancesState[key] || {};

        const d = (datosSupervisores[supervisor] && datosSupervisores[supervisor][periodoCompleto])
            ? datosSupervisores[supervisor][periodoCompleto]
            : {};

        const meta = _safeNum(d.meta_super);
        const rec  = _safeNum(d.total_recupero);

        const obj = _clamp(objetivoPct, 0, 200);
        const add = _montoParaAlcance(meta, rec, obj);

        window.__simAlcancesState[key].objetivoPct = obj;
        window.__simAlcancesState[key].montoAdd = add;

        const elObj = document.getElementById(`simObj__${idx}`);
        if (elObj) elObj.textContent = `${obj.toFixed(0)}%`;

        const elMonto = document.getElementById(`simMonto__${idx}`);
        if (elMonto && document.activeElement !== elMonto) {
            elMonto.value = String(Math.round(add));
        }

        _updateSimCardUI(idx, meta, rec, add);
        _updatePanelMesUI(periodoCompleto);
    }

    // ===== Monto: mientras escribes, NO re-render; solo recalcula UI
    function onSimAlcancesMontoInput(periodoCompleto, supervisor, idx, inputEl) {
        const key = `${periodoCompleto}__${supervisor}`;
        window.__simAlcancesState[key] = window.__simAlcancesState[key] || {};

        const d = (datosSupervisores[supervisor] && datosSupervisores[supervisor][periodoCompleto])
            ? datosSupervisores[supervisor][periodoCompleto]
            : {};

        const meta = _safeNum(d.meta_super);
        const rec  = _safeNum(d.total_recupero);

        const add = Math.max(0, _safeNum(inputEl.value));
        const obj = (meta > 0) ? ((rec + add) / meta) * 100 : 0;

        window.__simAlcancesState[key].montoAdd = add;
        window.__simAlcancesState[key].objetivoPct = _clamp(obj, 0, 200);
        const elObj = document.getElementById(`simObj__${idx}`);
        if (elObj) elObj.textContent = `${window.__simAlcancesState[key].objetivoPct.toFixed(0)}%`;

        _updateSimCardUI(idx, meta, rec, add);
        _updatePanelMesUI(periodoCompleto);
    }

    // ===== Commit al salir del input
    function onSimAlcancesMontoCommit(periodoCompleto, supervisor, idx, inputEl) {
        const key = `${periodoCompleto}__${supervisor}`;
        const st = window.__simAlcancesState[key] || {};
        const add = Math.max(0, Math.round(_safeNum(st.montoAdd)));
        st.montoAdd = add;
        inputEl.value = String(add);
    }
    
    // FUNCIÓN PARA MOSTRAR ESTADÍSTICAS VACÍAS (CASO ESPECIAL)
    function mostrarEstadisticasVacias(periodoCompleto, supervisor = null) {
        const statsElement = document.getElementById('estadisticas-recuperos');
        if (!statsElement) return;
        statsElement.innerHTML = '';
    }

    function actualizarPeriodo() {
      if (window.actualizacionPeriodoEnCurso) return;
      window.actualizacionPeriodoEnCurso = true;

      try {
        const mesSeleccionado = document.getElementById('selectorMes')?.value || '';
        const añoSeleccionado = document.getElementById('selectorAño')?.value || '';
        const periodoCompleto = `${mesSeleccionado}_${añoSeleccionado}`;

        if (!mesSeleccionado || !añoSeleccionado || !datosMeses[periodoCompleto]) return;

        estadoGlobal.mesActual = mesSeleccionado;
        estadoGlobal.añoActual = añoSeleccionado;
        estadoGlobal.periodoActual = periodoCompleto;

        // Una sola ruta de actualización conserva canal y supervisor al cambiar MES_AÑO.
        sincronizarBotonesCanalAlcances();
        actualizarIndicadorExcepcionesPeriodo();
        actualizarFiltrosGlobales();
        aplicarFiltroSupervisor(supervisorFiltroActual || 'TODOS');

        const seccionRanking = document.getElementById('seccion-ranking');
        if (seccionRanking?.classList.contains('activa')) {
          if (asesoresSeleccionados.size > 0) {
            actualizarTablaComparacionAsesores();
            actualizarGraficaComparacionAsesores();
          }
          if (supervisoresSeleccionados.size > 0) {
            actualizarTablaComparacionSupervisores();
            actualizarGraficaComparacionSupervisores();
          }
        }
      } finally {
        window.actualizacionPeriodoEnCurso = false;
      }
    }

    function calcularStepSize(valorMaximo) {
        if (valorMaximo <= 10) return 1;
        if (valorMaximo <= 50) return 5;
        if (valorMaximo <= 100) return 10;
        if (valorMaximo <= 200) return 20;
        if (valorMaximo <= 500) return 50;
        return 100;
    }
    
    // ========== FUNCIONES PARA RANKING ==========


    // ========== FUNCIONES TOP 10 ==========
    function mostrarTop10() {
        const mesSeleccionado = document.getElementById('selectorMes').value;
        const añoSeleccionado = document.getElementById('selectorAño').value;
        const periodoCompleto = `${mesSeleccionado}_${añoSeleccionado}`;
        
        // Mostrar el modal directamente
        mostrarModalTop10(periodoCompleto);
    }
    
    function mostrarModalTop10(periodoCompleto) {
        // Cerrar modal existente si hay uno
        const modalExistente = document.getElementById('modalTop10');
        if (modalExistente) {
            cerrarModalTop10();
        }
        
        // Crear el modal
        const modal = document.createElement('div');
        modal.id = 'modalTop10';
        modal.className = 'modal-top10';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="cerrarModalTop10()"></div>
            <div class="modal-content">
                <canvas id="graficaTop10Modal" width="1120" height="850"></canvas>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';  // Bloquear scroll
        document.addEventListener('keydown', handleModalEscape);  // Listener ESC
        
        // Agregar estilos si no existen
        if (!document.getElementById('modal-styles-top10')) {
            agregarEstilosModalMinimalista();
        }
        
        // Bloquear scroll del body
        document.body.style.overflow = 'hidden';
        
        // Agregar event listener para ESC
        document.addEventListener('keydown', handleModalEscape);
        
        // Mostrar modal
        modal.style.display = 'block';
        
        // Generar la gráfica
        setTimeout(() => {
            generarGraficaTop10Modal(periodoCompleto);
        }, 50);
    }
    
    function agregarEstilosModalMinimalista() {
        const style = document.createElement('style');
        style.textContent = `
            /* MODAL MINIMALISTA */
            .modal-top10 {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.92);
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                cursor: pointer;
                animation: fadeIn 0.2s ease-out;
            }
            
            .modal-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: transparent;
                width: 95%;
                max-width: 1120px;
                max-height: 95vh;
                animation: slideIn 0.3s ease-out;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 0;
                border: none;
                box-shadow: none;
            }
            
            #graficaTop10Modal {
                max-width: 100%;
                max-height: 95vh;
                height: auto !important;
                background: white;
                border-radius: 12px;
                padding: 40px 30px 30px 30px; /* Más padding superior para título */
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
                cursor: default;
            }
            
            /* ANIMACIONES SUAVES */
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -55%) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            @keyframes slideOut {
                from {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translate(-50%, -45%) scale(0.95);
                }
            }
            
            /* EFECTO DE CIERRE */
            .modal-top10.closing .modal-overlay {
                animation: fadeOut 0.2s ease-in forwards;
            }
            
            .modal-top10.closing .modal-content {
                animation: slideOut 0.2s ease-in forwards;
            }
            
            /* RESPONSIVE */
            @media (max-width: 1600px) {
                #graficaTop10Modal {
                    width: 1300px !important;
                    height: 800px !important;
                    padding: 35px 25px 25px 25px;
                }
            }
            
            @media (max-width: 1400px) {
                #graficaTop10Modal {
                    width: 1200px !important;
                    height: 750px !important;
                    padding: 30px 20px 20px 20px;
                }
            }
            
            @media (max-width: 1200px) {
                #graficaTop10Modal {
                    width: 1100px !important;
                    height: 700px !important;
                    padding: 25px 15px 15px 15px;
                }
            }
            
            @media (max-width: 992px) {
                .modal-content {
                    width: 98%;
                }
                
                #graficaTop10Modal {
                    width: 1000px !important;
                    height: 650px !important;
                    padding: 20px 15px 15px 15px;
                }
            }
            
            @media (max-width: 768px) {
                #graficaTop10Modal {
                    width: 95% !important;
                    height: 550px !important;
                    padding: 15px 10px 10px 10px;
                    border-radius: 8px;
                }
            }
            
            @media (max-width: 576px) {
                #graficaTop10Modal {
                    width: 98% !important;
                    height: 500px !important;
                    padding: 12px 8px 8px 8px;
                    border-radius: 6px;
                }
            }
            
            /* MEJORAR TEXTO EN GRÁFICA */
            .chartjs-render-monitor text {
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    function cerrarModalTop10() {
        const modals = [document.getElementById('modalTop10')].filter(Boolean);
        
        if (modals.length === 0) return;
        
        // Destruir gráfica si existe
        if (chartTop10Modal) {
            try {
                chartTop10Modal.destroy();
                chartTop10Modal = null;
            } catch (e) {
                // Ignorar error
            }
        }

        document.body.style.overflow = 'auto';

        document.removeEventListener('keydown', handleModalEscape);

        modals.forEach(modal => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        });

        document.body.focus();
    }

    function handleModalEscape(event) {
        if (event.key === 'Escape' || event.keyCode === 27) {
            cerrarModalTop10();
        }
    }
    
    function generarGraficaTop10Modal(periodoCompleto) {
        if (!datosMeses[periodoCompleto]) {
            alert('No hay datos disponibles para este periodo.');
            cerrarModalTop10();
            return;
        }
        
        const asesores = filtrarAsesoresPorCanal(datosMeses[periodoCompleto] || []);
        const asesoresOrdenados = [...asesores].sort((a, b) => b.porcentaje - a.porcentaje);
        const top10 = asesoresOrdenados.slice(0, 10);
        
        if (top10.length === 0) {
            alert('No hay asesores para mostrar en el Top 10.');
            cerrarModalTop10();
            return;
        }
        
        // Nombres más cortos
        const nombres = top10.map((asesor, index) => {
            let nombre = asesor.nombre;
            if (nombre.length > 30) {
                nombre = nombre.substring(0, 28) + '...';
            }
            return nombre;
        });
        
        const porcentajes = top10.map(asesor => asesor.porcentaje);
        const clasificaciones = top10.map(asesor => asesor.clasificacion);
        
        const coloresPorClasificacion = {
            '>100%': '#27ae60',
            '>70%': '#f39c12',
            '>40%': '#e67e22',
            '>0%': '#e74c3c'
        };
        
        const coloresBarras = clasificaciones.map(clas => coloresPorClasificacion[clas] || '#95a5a6');
        const coloresNombres = top10.map((asesor, index) => {
            if (index === 0) return '#B8860B';
            if (index === 1) return '#696969';
            if (index === 2) return '#8B4513';
            return '#2c3e50';
        });
        
        const canvas = document.getElementById('graficaTop10Modal');
        const ctx = canvas.getContext('2d');
        
        // Destruir gráfica anterior
        if (chartTop10Modal) {
            chartTop10Modal.destroy();
            chartTop10Modal = null;
        }
        
        // Plugin para etiquetas de porcentaje (LOCAL)
        const dataLabelsPlugin = {
            id: 'dataLabelsModal',
            afterDatasetsDraw(chart, args, options) {
                const {ctx} = chart;
                const meta = chart.getDatasetMeta(0);
                
                meta.data.forEach((bar, index) => {
                    const value = chart.data.datasets[0].data[index];
                    if (value === null || value === undefined) return;
                    
                    ctx.save();
                    
                    const x = bar.x - 25;
                    const y = bar.y;
                    const formattedValue = value.toFixed(2) + '%';
                    
                    ctx.font = 'bold 22px Segoe UI';
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#ffffff';
                    
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                    ctx.shadowBlur = 5;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;
                    
                    ctx.fillText(formattedValue, x, y);
                    
                    ctx.restore();
                });
            }
        };
        
        // Canal al extremo derecho de cada barra, solo al combinar todos los canales.
        const channelLabelsPlugin = {
            id: 'channelLabelsModal',
            afterDatasetsDraw(chart) {
                if (canalActivoDashboard() !== 'TODOS LOS CANALES') return;
                const { ctx } = chart;
                const meta = chart.getDatasetMeta(0);
                meta.data.forEach((bar, index) => {
                    const asesor = top10[index] || {};
                    const canalReal = normalizarCanalDashboard(asesor.canal || '');
                    const texto = canalReal === 'SURCO' ? 'SURCO'
                        : (canalReal === 'BPO' || canalReal === 'LIMA' ? 'LIMA' : '');
                    if (!texto) return;
                    const color = texto === 'SURCO' ? '#e87500' : '#713b9c';
                    const x = Math.min(bar.x + 14, chart.width - 92);
                    const y = bar.y;
                    const ancho = texto === 'SURCO' ? 78 : 66;
                    const alto = 30;
                    const radio = 15;
                    ctx.save();
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.roundRect(x, y - alto / 2, ancho, alto, radio);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '800 15px Segoe UI';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(texto, x + ancho / 2, y);
                    ctx.restore();
                });
            }
        };

        // Plugin para números de posición (LOCAL)
        const positionNumbersPlugin = {
            id: 'positionNumbersModal',
            afterDatasetsDraw(chart, args, options) {
                const {ctx} = chart;
                const meta = chart.getDatasetMeta(0);
                
                meta.data.forEach((bar, index) => {
                    ctx.save();
                    
                    const x = 15;
                    const y = bar.y;
                    
                    let textColor;
                    if (index === 0) textColor = '#B8860B';
                    else if (index === 1) textColor = '#696969';
                    else if (index === 2) textColor = '#8B4513';
                    else textColor = '#2c3e50';
                    
                    ctx.font = `bold 20px Segoe UI`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = textColor;
                    
                    let positionText = (index + 1) + '.';
                    if (index === 0) positionText = '🥇 ' + positionText;
                    else if (index === 1) positionText = '🥈 ' + positionText;
                    else if (index === 2) positionText = '🥉 ' + positionText;
                    
                    ctx.fillText(positionText, x, y);
                    
                    ctx.restore();
                });
            }
        };
        
        chartTop10Modal = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: nombres,
                datasets: [{
                    label: 'Porcentaje de Alcance',
                    data: porcentajes,
                    backgroundColor: coloresBarras,
                    borderColor: coloresBarras.map(color => color + 'CC'),
                    borderWidth: 3,
                    borderRadius: 10,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: false,
                maintainAspectRatio: false,
                
                plugins: {
                    title: {
                        display: true,
                        text: `🏆 TOP 10 ASESORES - ${periodoCompleto.replace('_', ' ')}`,
                        font: {
                            size: 32,
                            weight: 'bold',
                            family: 'Segoe UI'
                        },
                        color: '#2c3e50',
                        padding: {
                            top: 10,
                            bottom: 30
                        }
                    },
                    
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleFont: {
                            size: 20,
                            weight: 'bold',
                            family: 'Segoe UI'
                        },
                        bodyFont: {
                            size: 18,
                            family: 'Segoe UI'
                        },
                        padding: 20,
                        cornerRadius: 10,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                const index = context[0].dataIndex;
                                const asesor = top10[index];
                                const icon = index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';
                                return icon + asesor.nombre;
                            },
                            label: function(context) {
                              const index = context.dataIndex;
                              const asesor = top10[index] || {};
                            
                              const pct = Number(context.parsed.x);
                              const porcentajeTxt = Number.isFinite(pct) ? pct.toFixed(2) : '0.00';
                            
                              const fmtMoneda = (v) => {
                                const n = Number(v);
                                const val = Number.isFinite(n) ? n : 0;
                                return 'S/ ' + val.toLocaleString('es-PE', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                });
                              };
                            
                              return [
                                `Porcentaje: ${porcentajeTxt}%`,
                                `Meta: ${fmtMoneda(asesor.meta)}`,
                                `Recupero: ${fmtMoneda(asesor.recupero)}`,
                                `Cartera: ${asesor.cartera || 'No definida'}`,
                                `Supervisor: ${asesor.supervisor || 'Sin Supervisor'}`
                              ];
                            }
                        }
                    },
                    legend: { display: false }
                },
                
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                size: 18,
                                family: 'Segoe UI',
                                weight: 'bold'
                            },
                            color: '#34495e'
                        },
                        // LIMITAR EJE X
                        min: 0,
                        max: Math.ceil((Math.max(...porcentajes) + 18) / 10) * 10,
                        suggestedMax: 118
                    },
                    y: {
                        afterFit: function(scale) {
                            scale.width = 330;
                            scale.left = 45;
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: function(context) {
                                return coloresNombres[context.index];
                            },
                            font: function(context) {
                                const index = context.index;
                                return { 
                                    weight: index <= 2 ? 'bold' : '600',
                                    size: index <= 2 ? 30 : 27,
                                    family: 'Segoe UI'
                                };
                            },
                            autoSkip: false,
                            maxRotation: 0,
                            padding: 15
                        }
                    }
                },
                
                animation: {
                    duration: 1200,
                    easing: 'easeOutQuart'
                }
            },
            // Pasar plugins directamente a esta instancia
            plugins: [dataLabelsPlugin, channelLabelsPlugin, positionNumbersPlugin]
        });
        
        chartTop10Modal.update();
    }

    function aplicarFiltroRanking(supervisor) {
        const mesSeleccionado = document.getElementById('selectorMes').value;
        const añoSeleccionado = document.getElementById('selectorAño').value;
        const periodoCompleto = `${mesSeleccionado}_${añoSeleccionado}`;
        
        if (!datosMeses[periodoCompleto]) return;
        
        let asesoresBase = filtrarAsesoresPorCanal(datosMeses[periodoCompleto] || []);
        
        if (supervisor !== 'TODOS') {
        asesoresBase = asesoresBase.filter(a => a.supervisor === supervisor);
        }
        
        // ✅ Ranking vuelve a su vista normal (mes seleccionado)
        actualizarLista(asesoresBase, '>100%', 'lista-100');
        actualizarLista(asesoresBase, '>70%', 'lista-70');
        actualizarLista(asesoresBase, '>40%', 'lista-40');
        actualizarLista(asesoresBase, '>0%', 'lista-0');
        actualizarEstadisticas(asesoresBase);
        actualizarRankingQuintil(asesoresBase, periodoCompleto, supervisor);
    }
    
    function actualizarLista(asesores, clasificacion, idLista) {
        const lista = document.getElementById(idLista);
        const asesoresFiltrados = asesores.filter(a => a.clasificacion === clasificacion);
        
        if (asesoresFiltrados.length === 0) {
            lista.innerHTML = '<div class="asesor-item">No hay asesores en esta categoría</div>';
            return;
        }
        
        // Ordenar por porcentaje (mayor a menor)
        asesoresFiltrados.sort((a, b) => b.porcentaje - a.porcentaje);
        
        let html = '';
        asesoresFiltrados.forEach(asesor => {
            const claseGradiente = `gradiente-${clasificacion.replace('%', '').replace('>', '')}`;
            const clasePorcentaje = `porcentaje-${clasificacion.replace('%', '').replace('>', '')}`;
            html += `<div class="asesor-item ${claseGradiente}">
                <div class="asesor-nombre">${asesor.nombre} ${etiquetaCanalAsesorHTML(asesor)}</div>
                <div class="asesor-porcentaje ${clasePorcentaje} ${asesor.excepcion_alcance ? 'alcance-excepcion' : ''}">${asesor.porcentaje}%</div>
            </div>`;
        });
        
        lista.innerHTML = html;
    }
    
    function actualizarEstadisticas(asesores) {
        const contadores = {
            ">100%": asesores.filter(a => a.clasificacion === ">100%").length,
            ">70%": asesores.filter(a => a.clasificacion === ">70%").length,
            ">40%": asesores.filter(a => a.clasificacion === ">40%").length,
            ">0%": asesores.filter(a => a.clasificacion === ">0%").length
        };
        
        // Actualizar estadísticas si los elementos existen
        const elem100 = document.getElementById('cantidad-100');
        const elem70 = document.getElementById('cantidad-70');
        const elem40 = document.getElementById('cantidad-40');
        const elem0 = document.getElementById('cantidad-0');
        
        if (elem100) elem100.textContent = contadores[">100%"];
        if (elem70) elem70.textContent = contadores[">70%"];
        if (elem40) elem40.textContent = contadores[">40%"];
        if (elem0) elem0.textContent = contadores[">0%"];
    }

    function _setRankingQuintilAbierto(q, abierto) {
        const lista = document.getElementById(`rankingQuintilQ${q}`);
        const toggle = document.getElementById(`rankingQuintilToggleQ${q}`);
        const tarjeta = lista?.closest('.eval-quintil-card');
        if (lista) {
            lista.classList.toggle('colapsada', !abierto);
            lista.setAttribute('aria-hidden', String(!abierto));
        }
        if (tarjeta) {
            tarjeta.classList.toggle('quintil-abierto', abierto);
            tarjeta.setAttribute('aria-expanded', String(abierto));
        }
        if (toggle) toggle.textContent = abierto ? '-' : '+';
    }

    function toggleRankingQuintil(q) {
        const lista = document.getElementById(`rankingQuintilQ${q}`);
        if (!lista) return;
        _setRankingQuintilAbierto(q, lista.classList.contains('colapsada'));
    }

    function actualizarRankingQuintil(asesores, periodoCompleto = '', supervisor = 'TODOS') {
        const grupos = { 1: [], 2: [], 3: [], 4: [], 5: [] };

        (Array.isArray(asesores) ? asesores : []).forEach(asesor => {
            const q = _normalizarQuintil(asesor?.q_alc);
            const nombre = String(asesor?.nombre || asesor?.alias_crr || '').trim();
            if (!q || !nombre) return;
            const porcentaje = Number(asesor?.porcentaje);
            grupos[q].push({
                alias: nombre,
                alcance: Number.isFinite(porcentaje) ? porcentaje : null,
                canal: asesor?.canal || ''
            });
        });

        [5, 4, 3, 2, 1].forEach(q => {
            const cont = document.getElementById(`rankingQuintilQ${q}`);
            const resumen = document.getElementById(`rankingQuintilResumenQ${q}`);
            const toggle = document.getElementById(`rankingQuintilToggleQ${q}`);
            if (!cont) return;

            const estabaAbierto = !cont.classList.contains('colapsada');
            const items = grupos[q].sort((a, b) => (b.alcance ?? -Infinity) - (a.alcance ?? -Infinity));
            const valores = items.map(it => it.alcance).filter(Number.isFinite);
            const promedio = valores.length ? valores.reduce((acc, valor) => acc + valor, 0) / valores.length : null;

            if (resumen) {
                resumen.innerHTML = `
                    <div class="eval-quintil-metric">
                        <span class="eval-quintil-metric-label">Asesores</span>
                        <span class="eval-quintil-metric-value">${items.length}</span>
                    </div>
                    <div class="eval-quintil-metric">
                        <span class="eval-quintil-metric-label">Promedio</span>
                        <span class="eval-quintil-metric-value">${promedio === null ? '-' : `${promedio.toFixed(2)}%`}</span>
                    </div>`;
            }

            cont.innerHTML = items.map((it, index) => `
                <div class="eval-quintil-row" style="--quintil-delay:${Math.min(index, 10) * 32}ms">
                    <div class="eval-quintil-asesor asesor-nombre" title="${it.alias}">${it.alias} ${etiquetaCanalAsesorHTML(it)}</div>
                    <div class="eval-quintil-alcance">${it.alcance === null ? '-' : `${it.alcance.toFixed(2)}%`}</div>
                </div>`).join('') || '<div style="padding:14px 8px; text-align:center; color:#666; font-size:0.85rem;">Sin registros</div>';

            _setRankingQuintilAbierto(q, estabaAbierto);
            if (toggle && !estabaAbierto) toggle.textContent = '+';
        });

        const nota = document.getElementById('rankingQuintilNota');
        if (nota) {
            const total = Object.values(grupos).reduce((acc, arr) => acc + arr.length, 0);
            const etiquetaSupervisor = supervisor && supervisor !== 'TODOS' ? ` · ${supervisor}` : ' · Todos los equipos';
            nota.textContent = total
                ? `Quintiles mensuales Q_ALC de ${String(periodoCompleto).replace('_', ' ')}${etiquetaSupervisor}.`
                : `No hay asesores con Q_ALC para ${String(periodoCompleto || 'este periodo').replace('_', ' ')}${etiquetaSupervisor}.`;
        }
    }

    // ========== FUNCIONES PARA BUSQUEDA Y COMPARACIÓN DE ASESORES ==========

    function ordenarTablaComparacionAsesores(colIndex, tipo) {
      const table = document.getElementById('tablaComparacionAsesoresTabla');
      if (!table) return;
    
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
    
      const keyDir = 'sortDir_' + colIndex;
      const asc = table.dataset[keyDir] !== 'asc';
      table.dataset[keyDir] = asc ? 'asc' : 'desc';
    
      const rows = Array.from(tbody.querySelectorAll('tr'));
    
      // 1) Agrupar en bloques: [fila principal] + [subfilas...]
      const bloques = [];
      for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
        if (tr.dataset.subfila === '1') continue;
    
        const bloque = [tr];
        let j = i + 1;
        while (j < rows.length && rows[j].dataset.subfila === '1') {
          bloque.push(rows[j]);
          j++;
        }
        bloques.push(bloque);
        i = j - 1;
      }
    
      function getVal(tr) {
        const td = tr.children[colIndex];
        if (!td) return (tipo === 'txt') ? '' : -Infinity;
    
        const raw = td.dataset.value;
        if ((tipo || 'num') === 'txt') {
          return String(raw || '').toUpperCase();
        }
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : -Infinity;
      }
    
      bloques.sort((A, B) => {
        const a = getVal(A[0]);
        const b = getVal(B[0]);
    
        if ((tipo || 'num') === 'txt') {
          return asc ? a.localeCompare(b) : b.localeCompare(a);
        }
    
        // asc=true => mayor a menor (más útil en KPIs)
        return asc ? (b - a) : (a - b);
      });
    
      const frag = document.createDocumentFragment();
      bloques.forEach(b => b.forEach(tr => frag.appendChild(tr)));
      tbody.appendChild(frag);
    }

    function _getAnchorDateFromHeader() {
      const mesSel = document.getElementById('selectorMes')?.value;
      const anioSel = document.getElementById('selectorAño')?.value;
    
      if (!mesSel || !anioSel) return null;
    
      // obtenerNumeroMes(mes) ya lo usas en tu sort; mantenemos el mismo criterio
      return new Date(parseInt(anioSel, 10), obtenerNumeroMes(mesSel));
    }
    
    function _filtrarHastaAncla(mesesOrdenadosDesc) {
      const anchor = _getAnchorDateFromHeader();
      if (!anchor) return mesesOrdenadosDesc;
    
      const filtrados = mesesOrdenadosDesc.filter(periodo => {
        const [mes, anio] = String(periodo).split('_');
        if (!mes || !anio) return false;
        const d = new Date(parseInt(anio, 10), obtenerNumeroMes(mes));
        return d <= anchor;
      });
    
      // Si por algún motivo quedó vacío (data incompleta / selector no calza), no rompemos nada:
      return (filtrados.length > 0) ? filtrados : mesesOrdenadosDesc;
    }
    
    function _filtrarMesesComparacionAsesores(mesesOrdenadosDesc) {
      const anchor = _getAnchorDateFromHeader();
      if (!anchor) return mesesOrdenadosDesc;

      const chkIncluir = document.getElementById('chkAsesIncluirMesSeleccionado');
      const incluirMesSeleccionado = !!(chkIncluir && chkIncluir.checked);

      const filtrados = mesesOrdenadosDesc.filter(periodo => {
        const [mes, anio] = String(periodo).split('_');
        if (!mes || !anio) return false;
        const d = new Date(parseInt(anio, 10), obtenerNumeroMes(mes));
        return incluirMesSeleccionado ? d <= anchor : d < anchor;
      });

      return filtrados;
    }
    
    function _filtrarMesesComparacionSupervisores(mesesOrdenadosDesc) {
      const anchor = _getAnchorDateFromHeader();
      if (!anchor) return mesesOrdenadosDesc;

      const chkIncluir = document.getElementById('chkSupIncluirMesSeleccionado');
      const incluirMesSeleccionado = !!(chkIncluir && chkIncluir.checked);

      const filtrados = mesesOrdenadosDesc.filter(periodo => {
        const [mes, anio] = String(periodo).split('_');
        if (!mes || !anio) return false;
        const d = new Date(parseInt(anio, 10), obtenerNumeroMes(mes));
        return incluirMesSeleccionado ? d <= anchor : d < anchor;
      });

      return filtrados;
    }
    
    function resolverNombreAsesorParaComparacion(valor) {
        const clave = normalizarTextoAsesor(valor);
        if (!clave) return '';

        const periodos = Object.keys(datosMeses || {}).sort((a, b) => {
            const [mesA, anioA] = a.split('_');
            const [mesB, anioB] = b.split('_');
            return new Date(anioB, obtenerNumeroMes(mesB)) - new Date(anioA, obtenerNumeroMes(mesA));
        });

        for (const periodo of periodos) {
            const match = (datosMeses[periodo] || []).find(a =>
                normalizarTextoAsesor(a.nombre) === clave ||
                normalizarTextoAsesor(a.alias_crr) === clave ||
                normalizarTextoAsesor(a.indicadores_calidad?.alias) === clave
            );
            if (match) return String(match.nombre || valor).trim();
        }
        return String(valor || '').trim();
    }

    function agregarAsesorComparacionHistorico(reemplazar = false, mostrarResultados = true) {
        const input = document.getElementById('asesorSearchInput');
        const valor = String(input?.value || asesorSeleccionadoHistorico || '').trim();
        if (!valor) return;

        const nombreAsesor = resolverNombreAsesorParaComparacion(valor);
        if (!nombreAsesor) return;

        if (reemplazar) asesoresSeleccionados.clear();
        asesoresSeleccionados.add(nombreAsesor);
        actualizarAsesoresSeleccionados();

        if (mostrarResultados) {
            compararAsesores();
        } else {
            const resultadosDiv = document.getElementById('resultadosComparacion');
            if (resultadosDiv && resultadosDiv.style.display !== 'none') {
                actualizarTablaComparacionAsesores();
                actualizarGraficaComparacionAsesores();
            }
        }
    }

    function agregarAsesor() {
        agregarAsesorComparacionHistorico(false);
    }
    
    function _getPeriodoSeleccionadoRanking() {
        const mesSeleccionado = document.getElementById('selectorMes')?.value || '';
        const anioSeleccionado = document.getElementById('selectorA\u00f1o')?.value || '';
        if (!mesSeleccionado || !anioSeleccionado) return '';
        return `${mesSeleccionado}_${anioSeleccionado}`;
    }

    function seleccionarAsesoresPorSupervisor() {
        const selector = document.getElementById('selectorSupervisorAsesores');
        if (!selector) return;

        const supervisor = String(selector.value || '').trim();
        if (!supervisor) return;

        const periodo = _getPeriodoSeleccionadoRanking();
        const asesoresPeriodo = filtrarAsesoresPorCanal(
            (periodo && Array.isArray(datosMeses[periodo]))
                ? datosMeses[periodo]
                : Object.values(datosMeses).flat()
        );

        const asesoresSupervisor = asesoresPeriodo
            .filter(a => String(a.supervisor || '').trim() === supervisor)
            .map(a => String(a.nombre || '').trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'es'));

        asesoresSeleccionados.clear();
        asesoresSupervisor.forEach(nombre => asesoresSeleccionados.add(nombre));
        actualizarAsesoresSeleccionados();

        const resultadosDiv = document.getElementById('resultadosComparacion');
        if (resultadosDiv && resultadosDiv.style.display !== 'none') {
            compararAsesores();
        }

        if (asesoresSupervisor.length === 0) {
            alert(`No se encontraron asesores para ${supervisor} en el periodo seleccionado.`);
        }
    }
    
    function eliminarAsesor(nombre) {
        asesoresSeleccionados.delete(nombre);
        actualizarAsesoresSeleccionados();
    }
    
    function actualizarAsesoresSeleccionados() {
        const container = document.getElementById('asesoresSeleccionados');
        if (!container) return;
        
        container.innerHTML = '';
        
        asesoresSeleccionados.forEach(asesor => {
            const tag = document.createElement('div');
            tag.className = 'tag-elemento';
            tag.innerHTML = `
                ${asesor}
                <button class="eliminar-elemento" onclick="eliminarAsesor('${asesor}')">×</button>
            `;
            container.appendChild(tag);
        });
    }
    
    function compararAsesores() {
        if (asesoresSeleccionados.size === 0) {
            alert('Por favor selecciona al menos un asesor para comparar.');
            return;
        }
        
        const resultadosDiv = document.getElementById('resultadosComparacion');
        const tablaDiv = document.getElementById('tablaComparacion');
        
        if (!resultadosDiv || !tablaDiv) return;
        
        // Mostrar los controles de meses
        const controlesHTML = `
            <div style="margin: 20px 0; text-align: center;">
                <div class="controles-grafica" style="display:flex; justify-content:center; align-items:center; gap:14px; flex-wrap:wrap;">
                    
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <button class="btn-comparacion" onclick="cambiarTipoGrafica(3)">
                            3 meses
                        </button>
                        <button class="btn-comparacion activo" onclick="cambiarTipoGrafica(6)">
                            6 meses
                        </button>
                        <button class="btn-comparacion" onclick="cambiarTipoGrafica(12)">
                            12 meses
                        </button>
                    </div>
        
                    <label style="display:flex; gap:8px; align-items:center; cursor:pointer; user-select:none; font-weight:700; color:#2c3e50;">
                        <input type="checkbox" id="chkAsesMostrarFilaSupervisor" onchange="actualizarTablaComparacionAsesores()" />
                        <span>Ver Supervisor</span>
                    </label>

                    <label style="display:flex; gap:8px; align-items:center; cursor:pointer; user-select:none; font-weight:700; color:#2c3e50; text-transform:uppercase;">
                        <input type="checkbox" id="chkAsesIncluirMesSeleccionado" onchange="actualizarTablaComparacionAsesores(); actualizarGraficaComparacionAsesores();" />
                        <span>Incluir mes seleccionado</span>
                    </label>
        
                </div>
            </div>
        `;
        
        // Insertar controles ANTES de la tabla
        resultadosDiv.innerHTML = controlesHTML;
        
        // Crear div para tabla
        const tablaContainer = document.createElement('div');
        tablaContainer.id = 'tablaComparacion';
        resultadosDiv.appendChild(tablaContainer);
        
        // Crear div para gráfica (se creará dinámicamente después)
        const graficaContainer = document.createElement('div');
        graficaContainer.id = 'graficaContainerAsesores';
        resultadosDiv.appendChild(graficaContainer);
        
        // Actualizar tabla y gráfica
        actualizarTablaComparacionAsesores();
        actualizarGraficaComparacionAsesores();
        
        resultadosDiv.style.display = 'block';
    }
    
    function generarGraficaComparacionAsesores(meses, asesores) {
        // Crear contenedor para el gráfico si no existe
        let graficaDiv = document.getElementById('graficaComparacion');
        if (!graficaDiv) {
            const resultadosDiv = document.getElementById('resultadosComparacion');
            if (resultadosDiv) {
                graficaDiv = document.createElement('div');
                graficaDiv.id = 'graficaComparacion';
                graficaDiv.className = 'grafica-container';
                graficaDiv.innerHTML = `
                    <h3>📈 Evolución de Desempeño</h3>
                    <canvas id="graficaDesempenio" width="1200" height="400"></canvas>
                `;
                resultadosDiv.appendChild(graficaDiv);
            }
        }
        
        const canvas = document.getElementById('graficaDesempenio');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        
        // LIMPIAR EL CANVAS COMPLETAMENTE
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const datasets = [];
        const colores = [
            '#FF6384', '#36A2EB', '#FFCE56', '#8AC926', 
            '#9966FF', '#FF9F40', '#4BC0C0', '#1982C4'
        ];
        
        let maxValor = 0;
        let minValor = 0;
        
        asesores.forEach((asesor, index) => {
            const datosAsesor = [];
            const borderColor = colores[index % colores.length];
            const backgroundColor = borderColor + '40'; // 40% de opacidad para área
            
            meses.forEach(mes => {
                const datosMes = datosMeses[mes];
                const asesorData = datosMes.find(a => a.nombre === asesor);
                const valor = asesorData ? asesorData.porcentaje : null;
                datosAsesor.push(valor);
                
                // Calcular máximo y mínimo
                if (valor !== null && valor !== undefined && !isNaN(valor)) {
                    maxValor = Math.max(maxValor, valor);
                    minValor = Math.min(minValor, valor);
                }
            });
            
            // GRÁFICA DE LÍNEAS CON ÁREA Y LÍNEAS DISCONTINUAS
            datasets.push({
                label: asesor,
                data: datosAsesor,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                type: 'line',
                spanGaps: true,
                // LÍNEAS DISCONTINUAS PARA DATOS FALTANTES
                segment: {
                    borderColor: ctx => {
                        const p0Null = ctx.p0.parsed.y === null;
                        const p1Null = ctx.p1.parsed.y === null;
                        return (p0Null || p1Null) ? borderColor + '60' : borderColor;
                    },
                    borderDash: ctx => {
                        const p0Null = ctx.p0.parsed.y === null;
                        const p1Null = ctx.p1.parsed.y === null;
                        return (p0Null || p1Null) ? [5, 3] : []; // Discontinuo para datos faltantes
                    }
                },
                // PUNTOS DIFERENCIADOS PARA DATOS VÁLIDOS VS NULOS
                pointBackgroundColor: datosAsesor.map(valor => 
                    valor === null ? '#95a5a6' : borderColor
                ),
                pointBorderColor: datosAsesor.map(valor => 
                    valor === null ? '#95a5a6' : '#ffffff'
                ),
                pointBorderWidth: 2
            });
        });
        
        // Calcular límites inteligentes para el eje Y
        let yMin = 0;
        let yMax = 100; // Por defecto 100%
        
        if (maxValor > 0) {
            // Redondear al múltiplo de 10 más cercano hacia arriba
            yMax = Math.max(100, Math.ceil(maxValor / 10) * 10);
        }
        
        // Si hay valores negativos (raro, pero por si acaso)
        if (minValor < 0) {
            yMin = Math.floor(minValor / 10) * 10;
        }
        
        // Formatear labels de meses para mejor visualización
        const labels = meses.map(mes => {
            const [mesNombre, año] = mes.split('_');
            return `${mesNombre.substring(0, 3)} ${año}`;
        });
        
        // Crear la gráfica SOLO DE LÍNEAS
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false,
                        text: 'Evolución del Porcentaje de Alcance - Asesores',
                        font: { size: 16 }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13, weight: 'normal' },
                        padding: 12,
                        cornerRadius: 8,
                        itemSort: function(a, b) {
                            const ay = Number(a.parsed?.y);
                            const by = Number(b.parsed?.y);
                            const aVal = Number.isFinite(ay) ? ay : -Infinity;
                            const bVal = Number.isFinite(by) ? by : -Infinity;
                            return bVal - aVal;
                        },
                        callbacks: {
                            label: function(context) {
                                const asesor = context.dataset.label;
                                const porcentaje = context.parsed.y;
                                
                                if (porcentaje === null) return `${asesor}: No participó`;
                                
                                const label = context.chart.data.labels[context.dataIndex];
                                const [mesAbrev, año] = label.split(' ');
                                
                                // Mapeo de meses en MAYÚSCULAS
                                const mesesMap = {
                                    'ENE':'ENERO','FEB':'FEBRERO','MAR':'MARZO','ABR':'ABRIL',
                                    'MAY':'MAYO','JUN':'JUNIO','JUL':'JULIO','AGO':'AGOSTO',
                                    'SEP':'SETIEMBRE','OCT':'OCTUBRE','NOV':'NOVIEMBRE','DIC':'DICIEMBRE'
                                };
                                
                                const mesKey = `${mesesMap[mesAbrev]}_${año}`;
                                const datos = datosMeses[mesKey]?.find(a => a.nombre === asesor);
                                
                                // Función para formatear con separador de miles
                                const formatoMiles = (valor) => {
                                    return 'S/ ' + valor.toLocaleString('es-PE', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    });
                                };
                                
                                return [
                                    `${asesor}: ${porcentaje.toFixed(2)}%`,
                                    `Meta: ${formatoMiles(datos?.meta || 0)}`,
                                    `Recupero: ${formatoMiles(datos?.recupero || 0)}`
                                ];
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: { font: { size: 14 } },
                        onClick: function (e, legendItem, legend) {
                            const index = legendItem.datasetIndex;
                            const ci = legend.chart;
                            if (ci.isDatasetVisible(index)) {
                                ci.hide(index);
                            } else {
                                ci.show(index);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: false,
                            text: 'Porcentaje de Alcance (%)'
                        },
                        ticks: {
                            font: { size: 16 },
                            callback: function(value) {
                                return value + '%';
                            },
                            stepSize: calcularStepSize(yMax)
                        },
                        // ¡LIMITES EXPLÍCITOS Y FIJO!
                        min: yMin,
                        max: yMax,
                        suggestedMin: yMin,
                        suggestedMax: yMax
                    },
                    x: {
                        title: {
                            display: false,
                            text: 'Meses'
                        },
                        ticks: {
                            font: { size: 15 }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    function cambiarTipoGrafica(cantidadMeses) {
        mesesAMostrar = cantidadMeses;
        
        // Actualizar botones activos
        document.querySelectorAll('#resultadosComparacion .btn-comparacion').forEach(btn => {
            btn.classList.remove('activo');
        });
        event.target.classList.add('activo');
        
        // Regenerar tabla Y gráfica si hay datos
        if (asesoresSeleccionados.size > 0) {
            // Primero regenerar tabla
            actualizarTablaComparacionAsesores();
            // Luego regenerar gráfica
            actualizarGraficaComparacionAsesores();
        }
    }

    function actualizarGraficaComparacionAsesores() {
        if (asesoresSeleccionados.size === 0) return;
        
        let mesesOrdenados = Object.keys(datosMeses).sort((a, b) => {
            const [mesA, añoA] = a.split('_');
            const [mesB, añoB] = b.split('_');
            const fechaA = new Date(añoA, obtenerNumeroMes(mesA));
            const fechaB = new Date(añoB, obtenerNumeroMes(mesB));
            return fechaB - fechaA;
        });
        mesesOrdenados = _filtrarMesesComparacionAsesores(mesesOrdenados);
        
        if (mesesAMostrar > 0 && mesesOrdenados.length > mesesAMostrar) {
          mesesOrdenados = mesesOrdenados.slice(0, mesesAMostrar);
        }
        
        const mesesParaGrafica = [...mesesOrdenados].reverse();
        generarGraficaComparacionAsesores(mesesParaGrafica, Array.from(asesoresSeleccionados));
    }

    // ========== FUNCION PARA ACTUALIZAR TABLA ASESORES ==========
    function actualizarTablaComparacionAsesores() {
        if (asesoresSeleccionados.size === 0) return;
    
        const tablaDiv = document.getElementById('tablaComparacion');
        if (!tablaDiv) return;
    
        // Obtener meses ordenados (MÁS RECIENTE PRIMERO)
        let mesesOrdenados = Object.keys(datosMeses).sort((a, b) => {
            const [mesA, añoA] = a.split('_');
            const [mesB, añoB] = b.split('_');
            const fechaA = new Date(añoA, obtenerNumeroMes(mesA));
            const fechaB = new Date(añoB, obtenerNumeroMes(mesB));
            return fechaB - fechaA;
        });
        mesesOrdenados = _filtrarMesesComparacionAsesores(mesesOrdenados);
        
        if (mesesAMostrar > 0 && mesesOrdenados.length > mesesAMostrar) {
          mesesOrdenados = mesesOrdenados.slice(0, mesesAMostrar);
        }
    
        // Invertir para mostrar de más antiguo a más reciente
        const mesesParaTabla = [...mesesOrdenados].reverse();
    
        // Checkbox mostrar/ocultar
        const chkSup = document.getElementById('chkAsesMostrarFilaSupervisor');
        const mostrarFilaSupervisor = chkSup ? chkSup.checked : false;
    
        // Crear tabla de comparación
        let html = '<div class="contenedor-tabla-scroll"><table id="tablaComparacionAsesoresTabla" class="tabla-comparacion">';
    
        // Encabezado (clickeable)
        html += '<thead><tr>';
        html += '<th style="cursor:pointer;" onclick="ordenarTablaComparacionAsesores(0, `txt`)">Asesor</th>';
        
        mesesParaTabla.forEach((mes, i) => {
          const col = i + 1;
          html += `<th style="cursor:pointer;" onclick="ordenarTablaComparacionAsesores(${col}, \`num\`)">${mes.replace('_',' ')}</th>`;
        });
        
        const colProm = mesesParaTabla.length + 1;
        html += `<th style="cursor:pointer;" onclick="ordenarTablaComparacionAsesores(${colProm}, \`num\`)">Promedio</th>`;
        html += '</tr></thead><tbody>';
    
        // Filas por cada asesor
        asesoresSeleccionados.forEach(asesor => {
            // Fila 1
            html += `<tr><td data-value="${asesor}"><strong>${asesor}</strong></td>`;
    
            let suma = 0;
            let mesesConData = 0;
            
            mesesParaTabla.forEach(mes => {
                const datosMes = datosMeses[mes];
                const asesorData = datosMes.find(a => a.nombre === asesor);
            
                if (asesorData) {
                    const val = Number(asesorData.porcentaje);
                    const v = (isFinite(val)) ? val : 0;
            
                    suma += v;
                    mesesConData += 1;
            
                    html += `<td data-value="${v}">${v.toFixed(2)}%</td>`;
                } else {
                    html += '<td data-value="-1" style="color:#999; font-style: italic;">No participó</td>';
                }
            });
            
            const promedio = (mesesConData > 0) ? (suma / mesesConData) : 0;
            const promTxt = (mesesConData > 0) ? `${promedio.toFixed(2)}%` : 'Sin datos';
            html += `<td data-value="${mesesConData > 0 ? promedio : -1}"><strong>${promTxt}</strong></td>`;
            html += '</tr>';
    
            // Fila 2
            if (mostrarFilaSupervisor) {
                html += `<tr data-subfila="1" class="fila-secundaria-asesor"><td class="label-secundario-asesor">Supervisor:</td>`;
    
                mesesParaTabla.forEach(mes => {
                    const datosMes = datosMeses[mes];
                    const asesorData = datosMes.find(a => a.nombre === asesor);
    
                    if (asesorData) {
                        const supervisor = asesorData.supervisor || 'Sin Supervisor';
    
                        // Mantener color/clases de supervisor
                        let supervisorClass = 'supervisor-normal';
                        if (supervisor === 'Sin Supervisor') supervisorClass = 'supervisor-sin';
                        else if (supervisor.toUpperCase().includes('SUPER') || supervisor.toUpperCase().includes('JEFE')) {
                            supervisorClass = 'supervisor-jefe';
                        }
    
                        html += `<td class="dato-secundario-asesor"><span class="${supervisorClass}">${supervisor}</span></td>`;
                    } else {
                        html += '<td class="dato-secundario-asesor supervisor-vacio">-</td>';
                    }
                });
    
                // Columna extra para Promedio
                html += '<td class="dato-secundario-asesor supervisor-vacio">-</td>';
                html += '</tr>';
            }
        });
    
        html += '</tbody></table></div>';
        tablaDiv.innerHTML = html;
    }
    
    function limpiarBusqueda() {
        asesoresSeleccionados.clear();
        actualizarAsesoresSeleccionados();

        const selectorSupervisor = document.getElementById('selectorSupervisorAsesores');
        if (selectorSupervisor) selectorSupervisor.value = '';
        
        // Destruir gráfica
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        
        const resultadosDiv = document.getElementById('resultadosComparacion');
        if (resultadosDiv) resultadosDiv.style.display = 'none';
    }
    
    // ========== FUNCIONES PARA BUSQUEDA Y COMPARACIÓN DE SUPERVISORES ==========

    function ordenarTablaComparacionSupervisores(colIndex, tipo) {
      const table = document.getElementById('tablaComparacionSupervisoresTabla');
      if (!table) return;
    
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
    
      // Toggle asc/desc por columna
      const keyDir = 'sortDir_' + colIndex;
      const asc = table.dataset[keyDir] !== 'asc';
      table.dataset[keyDir] = asc ? 'asc' : 'desc';
    
      const rows = Array.from(tbody.querySelectorAll('tr'));
    
      // ===== 1) Agrupar en bloques: [fila principal] + [subfilas...]
      const bloques = [];
      for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
    
        // Saltar subfilas sueltas por seguridad
        if (tr.dataset.subfila === '1') continue;
    
        const bloque = [tr];
        let j = i + 1;
        while (j < rows.length && rows[j].dataset.subfila === '1') {
          bloque.push(rows[j]);
          j++;
        }
        bloques.push(bloque);
        i = j - 1;
      }
    
      // ===== 2) Función para leer valor de orden
      function getVal(tr) {
        const td = tr.children[colIndex];
        if (!td) return (tipo === 'txt') ? '' : -Infinity;
    
        const raw = td.dataset.value;
        if ((tipo || 'num') === 'txt') {
          return String(raw || '').toUpperCase();
        }
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : -Infinity;
      }
    
      // ===== 3) Ordenar bloques por la fila principal del bloque
      bloques.sort((A, B) => {
        const a = getVal(A[0]);
        const b = getVal(B[0]);
    
        if ((tipo || 'num') === 'txt') {
          return asc ? a.localeCompare(b) : b.localeCompare(a);
        }
    
        // asc=true => mayor a menor (más útil)
        return asc ? (b - a) : (a - b);
      });
    
      // ===== 4) Volcar orden al DOM
      const frag = document.createDocumentFragment();
      bloques.forEach(b => b.forEach(tr => frag.appendChild(tr)));
      tbody.appendChild(frag);
    }

    function agregarSupervisor() {
        const input = document.getElementById('inputBusquedaSupervisor');
        const nombreSupervisor = input.value.trim();
        
        if (nombreSupervisor && !supervisoresSeleccionados.has(nombreSupervisor)) {
            supervisoresSeleccionados.add(nombreSupervisor);
            actualizarSupervisoresSeleccionados();
            input.value = '';
        }
    }

    function _getPeriodoSeleccionadoSupervisores() {
        const mesSeleccionado = document.getElementById('selectorMes')?.value || '';
        const anioSeleccionado = document.getElementById('selectorA\u00f1o')?.value || '';
        if (!mesSeleccionado || !anioSeleccionado) return '';
        return `${mesSeleccionado}_${anioSeleccionado}`;
    }

    function seleccionarSupervisoresPorSegmento() {
        const selector = document.getElementById('selectorSegmentoSupervisores');
        if (!selector) return;

        const segmento = String(selector.value || '').trim();
        if (!segmento) return;

        const periodo = _getPeriodoSeleccionadoSupervisores();
        const supervisoresSegmento = Object.keys(datosSupervisores || {})
            .filter(supervisor => {
                const datosPeriodo = periodo ? datosSupervisores?.[supervisor]?.[periodo] : null;
                if (datosPeriodo) {
                    return String(datosPeriodo.cartera || 'No definida').trim() === segmento;
                }

                return Object.values(datosSupervisores?.[supervisor] || {}).some(datosMes =>
                    String(datosMes?.cartera || 'No definida').trim() === segmento
                );
            })
            .sort((a, b) => a.localeCompare(b, 'es'));

        supervisoresSeleccionados.clear();
        supervisoresSegmento.forEach(supervisor => supervisoresSeleccionados.add(supervisor));
        actualizarSupervisoresSeleccionados();

        const resultadosDiv = document.getElementById('resultadosComparacionSupervisores');
        if (resultadosDiv && resultadosDiv.style.display !== 'none') {
            compararSupervisores();
        }

        if (supervisoresSegmento.length === 0) {
            alert(`No se encontraron supervisores para el segmento ${segmento} en el periodo seleccionado.`);
        }
    }
    
    function eliminarSupervisor(nombre) {
        supervisoresSeleccionados.delete(nombre);
        actualizarSupervisoresSeleccionados();
    }
    
    function actualizarSupervisoresSeleccionados() {
        const container = document.getElementById('supervisoresSeleccionados');
        if (!container) return;
        
        container.innerHTML = '';
        
        supervisoresSeleccionados.forEach(supervisor => {
            const tag = document.createElement('div');
            tag.className = 'tag-elemento';
            tag.innerHTML = `
                ${supervisor}
                <button class="eliminar-elemento" onclick="eliminarSupervisor('${supervisor}')">×</button>
            `;
            container.appendChild(tag);
        });
    }
    
    function compararSupervisores() {
        if (supervisoresSeleccionados.size === 0) {
            alert('Por favor selecciona al menos un supervisor para comparar.');
            return;
        }
        
        const resultadosDiv = document.getElementById('resultadosComparacionSupervisores');
        
        if (!resultadosDiv) return;

        // Mostrar los controles de meses
        const controlesHTML = `
          <div style="margin: 20px 0; text-align: center;">
            <div class="controles-grafica" style="display:flex; justify-content:center; align-items:center; gap:14px; flex-wrap:wrap;">
        
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <button class="btn-comparacion" onclick="cambiarTipoGraficaSupervisores(3)">
                  3 meses
                </button>
                <button class="btn-comparacion activo" onclick="cambiarTipoGraficaSupervisores(6)">
                  6 meses
                </button>
                <button class="btn-comparacion" onclick="cambiarTipoGraficaSupervisores(12)">
                  12 meses
                </button>
              </div>
        
              <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                <label style="display:flex; gap:8px; align-items:center; cursor:pointer; user-select:none; font-weight:700; color:#2c3e50;">
                  <input type="checkbox" id="chkSupMostrarFilaAsesores" onchange="actualizarTablaComparacionSupervisores()" />
                  <span>Ver Asesores</span>
                </label>
        
                <label style="display:flex; gap:8px; align-items:center; cursor:pointer; user-select:none; font-weight:700; color:#2c3e50;">
                  <input type="checkbox" id="chkSupMostrarFilaCartera" onchange="actualizarTablaComparacionSupervisores()" />
                  <span>Ver Cartera</span>
                </label>

                <label style="display:flex; gap:8px; align-items:center; cursor:pointer; user-select:none; font-weight:700; color:#2c3e50; text-transform:uppercase;">
                  <input type="checkbox" id="chkSupIncluirMesSeleccionado" onchange="actualizarTablaComparacionSupervisores(); actualizarGraficaComparacionSupervisores();" />
                  <span>Incluir mes seleccionado</span>
                </label>
              </div>
        
            </div>
          </div>
        `;
        
        // Insertar controles ANTES de la tabla
        resultadosDiv.innerHTML = controlesHTML;
        
        // Crear div para tabla
        const tablaContainer = document.createElement('div');
        tablaContainer.id = 'tablaComparacionSupervisores';
        resultadosDiv.appendChild(tablaContainer);
        
        // Crear div para gráfica
        const graficaContainer = document.createElement('div');
        graficaContainer.id = 'graficaContainerSupervisores';
        resultadosDiv.appendChild(graficaContainer);
        
        // Actualizar tabla y gráfica
        actualizarTablaComparacionSupervisores();
        actualizarGraficaComparacionSupervisores();
        
        resultadosDiv.style.display = 'block';
    }
    
    function generarGraficaComparacionSupervisores(meses, supervisores) {
        let graficaDiv = document.getElementById('graficaComparacionSupervisores');
        if (!graficaDiv) {
            const resultadosDiv = document.getElementById('resultadosComparacionSupervisores');
            if (resultadosDiv) {
                graficaDiv = document.createElement('div');
                graficaDiv.id = 'graficaComparacionSupervisores';
                graficaDiv.className = 'grafica-container';
                graficaDiv.innerHTML = `
                    <h3>📈 Evolución de Desempeño</h3>
                    <canvas id="graficaDesempenioSupervisores" width="1200" height="400"></canvas>
                `;
                resultadosDiv.appendChild(graficaDiv);
            }
        }
        
        const canvas = document.getElementById('graficaDesempenioSupervisores');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');

        if (chartInstanceSupervisores) {
            chartInstanceSupervisores.destroy();
            chartInstanceSupervisores = null;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const datasets = [];
        const colores = [
            '#FF6384', '#36A2EB', '#FFCE56', '#8AC926', 
            '#9966FF', '#FF9F40', '#4BC0C0', '#1982C4'
        ];
        
        let maxValor = 0;
        let minValor = 0;
        
        supervisores.forEach((supervisor, index) => {
            const datosSupervisor = [];
            const borderColor = colores[index % colores.length];
            const backgroundColor = borderColor + '40'; // 40% de opacidad para área
            
            meses.forEach(mes => {
                const datosSupervisorMes = datosSupervisores[supervisor];
                if (datosSupervisorMes && datosSupervisorMes[mes]) {
                    const valor = datosSupervisorMes[mes].porcentaje_vs_meta_super;
                    const valorNum = (valor !== null && valor !== undefined && !isNaN(valor)) 
                        ? parseFloat(valor) 
                        : null;
                    datosSupervisor.push(valorNum);
                    
                    // Calcular máximo y mínimo
                    if (valorNum !== null && !isNaN(valorNum)) {
                        maxValor = Math.max(maxValor, valorNum);
                        minValor = Math.min(minValor, valorNum);
                    }
                } else {
                    datosSupervisor.push(null);
                }
            });
            
            // GRÁFICA DE LÍNEAS CON ÁREA Y LÍNEAS DISCONTINUAS
            datasets.push({
                label: supervisor,
                data: datosSupervisor,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                borderWidth: 3,
                fill: true, // ¡ÁREA COLOREA!
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                type: 'line',
                spanGaps: true,
                // LÍNEAS DISCONTINUAS PARA DATOS FALTANTES
                segment: {
                    borderColor: ctx => {
                        const p0Null = ctx.p0.parsed.y === null;
                        const p1Null = ctx.p1.parsed.y === null;
                        return (p0Null || p1Null) ? borderColor + '60' : borderColor;
                    },
                    borderDash: ctx => {
                        const p0Null = ctx.p0.parsed.y === null;
                        const p1Null = ctx.p1.parsed.y === null;
                        return (p0Null || p1Null) ? [5, 3] : [];
                    }
                },
                // PUNTOS DIFERENCIADOS
                pointBackgroundColor: datosSupervisor.map(valor => 
                    valor === null ? '#95a5a6' : borderColor
                ),
                pointBorderColor: datosSupervisor.map(valor => 
                    valor === null ? '#95a5a6' : '#ffffff'
                ),
                pointBorderWidth: 2
            });
        });
        
        // Agregar línea de meta (100%)
        datasets.push({
            label: 'Meta (100%)',
            data: Array(meses.length).fill(100),
            borderColor: '#2ecc71',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0
        });

        maxValor = Math.max(maxValor, 100);

        let yMin = 0;
        let yMax = 100; // Por defecto 100%
        
        if (maxValor > 0) {
            yMax = Math.max(100, Math.ceil(maxValor / 10) * 10);
        }

        if (minValor < 0) {
            yMin = Math.floor(minValor / 10) * 10;
        }

        const labels = meses.map(mes => {
            const [mesNombre, año] = mes.split('_');
            return `${mesNombre.substring(0, 3)} ${año}`;
        });

        chartInstanceSupervisores = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false,
                        text: 'Evolución del Porcentaje vs Meta Supervisor - Equipos',
                        font: { size: 16 }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13,
                            weight: 'normal'
                        },
                        padding: 12,
                        cornerRadius: 8,
                        filter: function(item) {
                            return item.dataset?.label !== 'Meta (100%)';
                        },
                        itemSort: function(a, b) {
                            const ay = Number(a.parsed?.y);
                            const by = Number(b.parsed?.y);
                            const aVal = Number.isFinite(ay) ? ay : -Infinity;
                            const bVal = Number.isFinite(by) ? by : -Infinity;
                            return bVal - aVal;
                        },
                        callbacks: {
                            label: function(context) {
                                const supervisor = context.dataset.label;
                                const valor = context.parsed.y;

                                if (supervisor === 'Meta (100%)') return null;
                                if (valor === null) return `${supervisor}: Sin datos`;
                                
                                const [mesAbrev, año] = context.chart.data.labels[context.dataIndex].split(' ');
                                const meses = {'ENE':'ENERO','FEB':'FEBRERO','MAR':'MARZO','ABR':'ABRIL','MAY':'MAYO','JUN':'JUNIO','JUL':'JULIO','AGO':'AGOSTO','SEP':'SETIEMBRE','OCT':'OCTUBRE','NOV':'NOVIEMBRE','DIC':'DICIEMBRE'};
                                const mesKey = `${meses[mesAbrev]}_${año}`;
                                const datos = datosSupervisores[supervisor]?.[mesKey];
                                
                                const formato = (v) => 'S/ ' + (v||0).toLocaleString('es-PE',{minimumFractionDigits:2});
                                
                                return [
                                    `${supervisor}: ${valor.toFixed(2)}%`,
                                    `Meta: ${formato(datos?.meta_super)}`,
                                    `Recupero: ${formato(datos?.total_recupero)}`
                                ];
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: { font: { size: 14 } },
                        onClick: function (e, legendItem, legend) {
                            const index = legendItem.datasetIndex;
                            const ci = legend.chart;
                            if (ci.isDatasetVisible(index)) {
                                ci.hide(index);
                            } else {
                                ci.show(index);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: false,
                            text: 'Porcentaje vs Meta Supervisor (%)'
                        },
                        ticks: {
                            font: { size: 16 },
                            callback: function(value) {
                                return value + '%';
                            },
                            stepSize: calcularStepSize(yMax)
                        },
                        min: yMin,
                        max: yMax,
                        suggestedMin: yMin,
                        suggestedMax: yMax
                    },
                    x: {
                        title: {
                            display: false,
                            text: 'Meses'
                        },
                        ticks: {
                            font: { size: 15 }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    function cambiarTipoGraficaSupervisores(cantidadMeses) {
        mesesAMostrar = cantidadMeses;

        document.querySelectorAll('#resultadosComparacionSupervisores .btn-comparacion').forEach(btn => {
            btn.classList.remove('activo');
        });
        event.target.classList.add('activo');

        if (supervisoresSeleccionados.size > 0) {
            actualizarTablaComparacionSupervisores();
            actualizarGraficaComparacionSupervisores();
        }
    }

    function actualizarGraficaComparacionSupervisores() {
        if (supervisoresSeleccionados.size === 0) return;
        
        // Obtener meses ordenados
        let mesesOrdenados = Object.keys(datosMeses).sort((a, b) => {
            const [mesA, añoA] = a.split('_');
            const [mesB, añoB] = b.split('_');
            const fechaA = new Date(añoA, obtenerNumeroMes(mesA));
            const fechaB = new Date(añoB, obtenerNumeroMes(mesB));
            return fechaB - fechaA;
        });
        
        mesesOrdenados = _filtrarMesesComparacionSupervisores(mesesOrdenados);
        
        if (mesesAMostrar > 0 && mesesOrdenados.length > mesesAMostrar) {
          mesesOrdenados = mesesOrdenados.slice(0, mesesAMostrar);
        }
        
        const mesesParaGrafica = [...mesesOrdenados].reverse();
        generarGraficaComparacionSupervisores(mesesParaGrafica, Array.from(supervisoresSeleccionados));
    }

    // ========== FUNCIONES PARA ACTUALIZAR TABLAS ==========
    function actualizarTablaComparacionSupervisores() {
        if (supervisoresSeleccionados.size === 0) return;
    
        const tablaDiv = document.getElementById('tablaComparacionSupervisores');
        if (!tablaDiv) return;
    
        // Obtener meses ordenados (más reciente primero)
        let mesesOrdenados = Object.keys(datosMeses).sort((a, b) => {
            const [mesA, añoA] = a.split('_');
            const [mesB, añoB] = b.split('_');
            const fechaA = new Date(añoA, obtenerNumeroMes(mesA));
            const fechaB = new Date(añoB, obtenerNumeroMes(mesB));
            return fechaB - fechaA;
        });
        mesesOrdenados = _filtrarMesesComparacionSupervisores(mesesOrdenados);
        
        if (mesesAMostrar > 0 && mesesOrdenados.length > mesesAMostrar) {
          mesesOrdenados = mesesOrdenados.slice(0, mesesAMostrar);
        }
    
        // Mostrar de más antiguo a más reciente
        const mesesParaTabla = [...mesesOrdenados].reverse();
        const denom = (mesesParaTabla.length > 0) ? mesesParaTabla.length : 1;
    
        // Checkbox
        const chkAses = document.getElementById('chkSupMostrarFilaAsesores');
        const chkCart = document.getElementById('chkSupMostrarFilaCartera');
        const mostrarFilaAsesores = chkAses ? chkAses.checked : false;
        const mostrarFilaCartera  = chkCart ? chkCart.checked : false;
    
        let html = '<div class="contenedor-tabla-scroll"><table id="tablaComparacionSupervisoresTabla" class="tabla-comparacion">';
    
        // Header (clickeable)
        html += '<thead><tr>';
        html += '<th style="cursor:pointer;" onclick="ordenarTablaComparacionSupervisores(0, `txt`)">Supervisor</th>';
        
        mesesParaTabla.forEach((mes, i) => {
          const col = i + 1;
          html += `<th style="cursor:pointer;" onclick="ordenarTablaComparacionSupervisores(${col}, \`num\`)">${mes.replace('_',' ')}</th>`;
        });
        
        const colProm = mesesParaTabla.length + 1;
        html += `<th style="cursor:pointer;" onclick="ordenarTablaComparacionSupervisores(${colProm}, \`num\`)">Promedio</th>`;
        html += '</tr></thead><tbody>';
    
        // Filas por supervisor seleccionado
        supervisoresSeleccionados.forEach(supervisor => {
            // ===== FILA 1: % vs Meta Supervisor (SIN COLORES) + Promedio =====
            html += `<tr data-grupo="sup"><td data-value="${supervisor}"><strong>${supervisor}</strong></td>`;
    
            let suma = 0;
            let mesesConData = 0;
            
            mesesParaTabla.forEach(mes => {
                const datosSupervisor = datosSupervisores[supervisor];
                const datosMes = (datosSupervisor && datosSupervisor[mes]) ? datosSupervisor[mes] : null;
            
                if (datosMes) {
                    const val = Number(datosMes.porcentaje_vs_meta_super);
                    const v = (isFinite(val)) ? val : 0;
            
                    suma += v;
                    mesesConData += 1;
            
                    html += `<td data-value="${v}">${v.toFixed(2)}%</td>`;
                } else {
                    html += '<td style="color: #999; font-style: italic;">Sin datos</td>';
                }
            });
            
            const promedio = (mesesConData > 0) ? (suma / mesesConData) : 0;
            const promTxt = (mesesConData > 0) ? `${promedio.toFixed(2)}%` : 'Sin datos';
            html += `<td data-value="${mesesConData > 0 ? promedio : -1}"><strong>${promTxt}</strong></td>`;
            html += '</tr>';
    
            // ===== FILA 2: Total de Asesores + celda extra Promedio =====
            if (mostrarFilaAsesores) {
                html += `<tr data-subfila="1" class="fila-equipo fila-asesores"><td class="equipo-label">Asesores:</td>`;
                mesesParaTabla.forEach(mes => {
                    const datosSupervisor = datosSupervisores[supervisor];
                    const datosMes = (datosSupervisor && datosSupervisor[mes]) ? datosSupervisor[mes] : null;
    
                    if (datosMes) {
                        const cantidad = Number(datosMes.cantidad_asesores) || 0;
                        html += `<td class="equipo-supervisor">${cantidad}</td>`;
                    } else {
                        html += '<td class="sin-equipo">-</td>';
                    }
                });
                html += '<td class="sin-equipo">-</td>';
                html += '</tr>';
            }
    
            // ===== FILA 3: Cartera + celda extra Promedio =====
            if (mostrarFilaCartera) {
                html += `<tr data-subfila="1" class="fila-equipo fila-cartera"><td class="equipo-label">Cartera:</td>`;
                mesesParaTabla.forEach(mes => {
                    const datosSupervisor = datosSupervisores[supervisor];
                    const datosMes = (datosSupervisor && datosSupervisor[mes]) ? datosSupervisor[mes] : null;
    
                    if (datosMes) {
                        const cartera = datosMes.cartera || 'No definida';
    
                        let segmentoClass = '';
                        if (cartera.includes('PREMIER') || cartera.includes('PRIME') || cartera.includes('PREMIUM')) {
                            segmentoClass = 'segmento-premier';
                        } else if (cartera.includes('EMPRESARIAL') || cartera.includes('BUSINESS')) {
                            segmentoClass = 'segmento-empresarial';
                        } else if (cartera.includes('MASIVO') || cartera.includes('MASS')) {
                            segmentoClass = 'segmento-masivo';
                        } else if (cartera.includes('PYME') || cartera.includes('SME')) {
                            segmentoClass = 'segmento-pyme';
                        }
    
                        html += `<td class="equipo-supervisor ${segmentoClass}">${cartera}</td>`;
                    } else {
                        html += '<td class="sin-equipo">-</td>';
                    }
                });
                html += '<td class="sin-equipo">-</td>';
                html += '</tr>';
            }
        });
    
        html += '</table></div>';
        tablaDiv.innerHTML = html;
    }

    function limpiarBusquedaSupervisores() {
        supervisoresSeleccionados.clear();
        actualizarSupervisoresSeleccionados();

        const selectorSegmento = document.getElementById('selectorSegmentoSupervisores');
        if (selectorSegmento) selectorSegmento.value = '';
        
        // Destruir gráfica si existe
        if (chartInstanceSupervisores) {
            chartInstanceSupervisores.destroy();
            chartInstanceSupervisores = null;
        }
        
        // Ocultar resultados
        const resultadosDiv = document.getElementById('resultadosComparacionSupervisores');
        if (resultadosDiv) resultadosDiv.style.display = 'none';
    }
    


    function generarGraficaIncrementoTotal(periodoCompleto, canvasId = 'graficaIncrementoTotal', view = 'full') {
        const canvas = document.getElementById(canvasId);
        const dataLabelsPluginTotal = _buildDataLabelsPluginTotal(view);
        if (!canvas) {
            console.log('Canvas no encontrado');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Destruir gráfica anterior si existe
        _destroyChartByCanvasId(canvasId);
        
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // ========== 1. CALCULAR META TOTAL DEL MES ==========
        let metaTotalMes = 0;
        const supervisoresUnicos = new Set();
        
        Object.keys(datosSupervisores).forEach(supervisor => {
            const datosMes = datosSupervisores[supervisor][periodoCompleto];
            if (datosMes && datosMes.meta_super !== undefined && !supervisoresUnicos.has(supervisor)) {
                const metaSupervisor = parseFloat(datosMes.meta_super) || 0;
                metaTotalMes += metaSupervisor;
                supervisoresUnicos.add(supervisor);
            }
        });
        
        // Si no hay meta total, no hay datos para graficar
        if (metaTotalMes === 0) {
            console.log('No hay meta total para el periodo:', periodoCompleto);
            mostrarMensajeSinDatos(canvas, periodoCompleto);
            return;
        }
        
        // ========== 2. RECOPILAR TODAS LAS FECHAS ÚNICAS ==========
        const todasFechas = new Set();
        const recuperoAcumuladoPorFecha = {};
        
        Object.keys(datosSupervisores).forEach(supervisor => {
            const datosMes = datosSupervisores[supervisor][periodoCompleto];
            if (!datosMes) return;
            
            const datosDiarios = datosMes.datos_diarios_supervisor || {};
            
            Object.keys(datosDiarios).forEach(fecha => {
                todasFechas.add(fecha);
                
                const recuperoSupervisor = parseFloat(datosDiarios[fecha]) || 0;
                
                if (!recuperoAcumuladoPorFecha[fecha]) {
                    recuperoAcumuladoPorFecha[fecha] = 0;
                }
                
                recuperoAcumuladoPorFecha[fecha] += recuperoSupervisor;
            });
        });
        
        // Si no hay fechas con datos, no hay nada que graficar
        if (todasFechas.size === 0) {
            console.log('No hay datos diarios para el periodo:', periodoCompleto);
            mostrarMensajeSinDatos(canvas, periodoCompleto);
            return;
        }
        
        // ========== 3. ORDENAR FECHAS CRONOLÓGICAMENTE ==========
        const fechasOrdenadas = Array.from(todasFechas).sort((a, b) => 
            convertirFechaDiaria(a) - convertirFechaDiaria(b)
        );
        
        console.log(`📊 Total fechas disponibles: ${fechasOrdenadas.length}`);
        
        // ========== 4. CALCULAR ALCANCE ACUMULADO ==========
        const datosValidosParaGrafica = [];  // Datos para la línea
        const alcancesPorcentaje = [];
        
        // Inicializar todas las fechas
        fechasOrdenadas.forEach(fecha => {
            const recuperoAcumulado = recuperoAcumuladoPorFecha[fecha] || 0;
            
            const alcanceDia = metaTotalMes > 0 ? (recuperoAcumulado / metaTotalMes) * 100 : 0;
            
            // SOLO agregar a datos válidos si hay datos reales (recupero > 0)
            if (recuperoAcumulado > 0) {
                datosValidosParaGrafica.push(alcanceDia);
                alcancesPorcentaje.push(alcanceDia);
            } else {
                // Para días sin datos, poner null (la línea no se dibujará aquí)
                datosValidosParaGrafica.push(null);
                alcancesPorcentaje.push(0);
            }
        });
        
        // ========== 5. ENCONTRAR EL ÚLTIMO DÍA CON DATOS REALES ==========
        let ultimoDiaConDatos = -1;
        for (let i = fechasOrdenadas.length - 1; i >= 0; i--) {
            const fecha = fechasOrdenadas[i];
            const recuperoDia = recuperoAcumuladoPorFecha[fecha] || 0;
            if (recuperoDia > 0) {
                ultimoDiaConDatos = i;
                break;
            }
        }
        
        if (ultimoDiaConDatos === -1) {
            ultimoDiaConDatos = fechasOrdenadas.length - 1;
        }
        
        console.log(`📊 Fechas con datos > 0: hasta día ${ultimoDiaConDatos + 1}`);
        
        // ========== 6. CREAR LA GRÁFICA DE LÍNEA CON ÁREA ==========
        _applyCanvasSize(canvas, view);
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
        
        // USAR TODAS LAS FECHAS para las etiquetas (CAMBIO PRINCIPAL)
        const labelsParaGrafica = fechasOrdenadas.map(fecha => {
            if (fecha.includes('-')) {
                return fecha.split('-')[0];
            }
            return fecha;
        });
        
        // COLORES PARA GRÁFICA DE LÍNEA (MORADO)
        const colorLinea = '#9b59b6';
        const colorArea = 'rgba(155, 89, 182, 0.2)';

        let options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `            `,
                    font: { size: 22, weight: 'bold' },
                    padding: { bottom: 25 }
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleFont: { size: 18, weight: 'bold' },
                    bodyFont: { size: 17 },
                    padding: 15,
                    cornerRadius: 10,
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return 'Día ' + (index + 1) + ': ' + fechasOrdenadas[index];
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const alcance = context.parsed.y;
                            const recuperoAcumulado = recuperoAcumuladoPorFecha[fechasOrdenadas[index]] || 0;
                            
                            // Si no hay datos para este día
                            if (index > ultimoDiaConDatos || alcance === null) {
                                return '📭 Sin datos de recupero';
                            }
                            
                            // Calcular incremento del día
                            let incrementoDia = 0;
                            if (index > 0) {
                                const alcanceAnterior = context.chart.data.datasets[0].data[index - 1] || 0;
                                incrementoDia = (alcance - alcanceAnterior);
                            } else {
                                incrementoDia = alcance;
                            }
                            
                            return [
                                '🎯 Alcance Acumulado: ' + alcance.toFixed(2) + '%',
                                '📈 Alcance del día: ' + incrementoDia.toFixed(2) + '%',
                                '💰 Recupero Acumulado: ' + recuperoAcumulado.toLocaleString('es-PE', { 
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0 
                                })
                            ];
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    title: { 
                        display: false, 
                        text: 'Días del Mes',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: { 
                        font: { size: 16 },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        callback: function(value, index, values) {
                            // Colores diferentes para días con/sin datos
                            const tieneDatos = datosValidosParaGrafica[index] !== null && 
                                              datosValidosParaGrafica[index] > 0;
                            this.fontColor = tieneDatos ? '#2c3e50' : '#bdc3c7';
                            return this.getLabelForValue(value);
                        }
                    },
                    grid: { 
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: { 
                        display: false, 
                        text: 'Alcance Acumulado (%)',
                        font: { size: 16, weight: 'bold' }
                    },
                    ticks: {
                        callback: function(value) { return value + '%'; },
                        stepSize: 10,
                        font: { size: 16 }
                    },
                    min: 0,
                    suggestedMax: function() {
                        // Calcular máximo solo de los datos válidos
                        const valoresValidos = datosValidosParaGrafica.filter(v => v !== null && v > 0);
                        if (valoresValidos.length === 0) return 100;
                        const maxValor = Math.max(...valoresValidos);
                        return Math.max(100, Math.ceil(maxValor / 10) * 10);
                    }(),
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            elements: {
                line: {
                    tension: 0.4  // Suavizado de la línea
                },
                point: {
                    hoverBackgroundColor: function(context) {
                        const value = context.dataset.data[context.dataIndex];
                        return value === null || value === 0 ? 'transparent' : colorLinea;
                    }
                }
            }
        };

        options = _tuneOptionsForView(options, view);

        try {
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labelsParaGrafica,  // TODAS las fechas
                    datasets: [{
                        label: 'Alcance Acumulado (%)',
                        data: datosValidosParaGrafica,  // Datos: válidos donde hay > 0, null donde no
                        backgroundColor: colorArea,
                        borderColor: colorLinea,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: function(context) {
                            // Puntos más grandes para datos válidos, invisibles para nulos
                            const value = context.dataset.data[context.dataIndex];
                            return value === null || value === 0 ? 0 : 6;
                        },
                        pointHoverRadius: function(context) {
                            const value = context.dataset.data[context.dataIndex];
                            return value === null || value === 0 ? 0 : 10;
                        },
                        pointBackgroundColor: function(context) {
                            const value = context.dataset.data[context.dataIndex];
                            return value === null || value === 0 ? 'transparent' : colorLinea;
                        },
                        pointBorderColor: function(context) {
                            const value = context.dataset.data[context.dataIndex];
                            return value === null || value === 0 ? 'transparent' : '#ffffff';
                        },
                        pointBorderWidth: 2,
                        spanGaps: false
                    }]
                },
                options,
                plugins: [dataLabelsPluginTotal]
            });
            _storeChart(canvasId, chart);
            
        } catch (error) {
            console.error("Error al crear la gráfica:", error);
            // Mostrar mensaje de error en el canvas
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Error al generar gráfica', canvas.width / 2, canvas.height / 2);
        }
    }
    
    // Función auxiliar para mostrar mensaje cuando no hay datos
    function mostrarMensajeSinDatos(canvas, periodoCompleto) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Configurar el canvas para mensaje
        canvas.width = 1300;
        canvas.height = 200;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
        
        // Dibujar mensaje
        ctx.fillStyle = '#95a5a6';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📊 No hay datos de recupero acumulado disponibles', canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '18px Arial';
        ctx.fillText(`Periodo: ${periodoCompleto.replace('_', ' ')}`, canvas.width / 2, canvas.height / 2 + 20);
    }

    function actualizarVistaRecuperos() {
        const mesSeleccionado = document.getElementById('selectorMes').value;
        const añoSeleccionado = document.getElementById('selectorAño').value;
        const periodoCompleto = `${mesSeleccionado}_${añoSeleccionado}`;
        
        if (!datosMeses[periodoCompleto]) {
            document.getElementById('graficas-recuperos').innerHTML = 
                '<div class="seccion-vacia"><h3>No hay datos disponibles para este periodo</h3></div>';
            return;
        }
        
        // Calcular y mostrar estadísticas
        calcularEstadisticasRecuperos(periodoCompleto);
        
        // Generar gráficos
        generarGraficasRecuperos(periodoCompleto);
    }

    // CALCULO DE DATA ESTADÍSTICA PARA ALCANCES
    function calcularEstadisticasRecuperos(periodoCompleto) {
        // 1. OBTENER DATOS DE SUPERVISORES
        const supervisoresData = datosSupervisores;
        
        // Filtrar supervisores que tienen datos para este periodo
        const supervisoresConDatos = Object.keys(supervisoresData).filter(supervisor => 
            supervisorEnCanal(supervisor, periodoCompleto) && supervisoresData[supervisor] && supervisoresData[supervisor][periodoCompleto]
        );
        
        if (supervisoresConDatos.length === 0) {
            console.log(`⚠️ No hay datos de supervisores para: ${periodoCompleto}`);
            const statsElement = document.getElementById('estadisticas-recuperos');
            if (!statsElement) return;
            statsElement.innerHTML = '';
            return;
        }
        
        // 2. CALCULAR META TOTAL DEL MES (SUMA DE METAS DE SUPERVISORES)
        let metaTotalMes = 0;
        let recuperoTotalActual = 0;
        
        supervisoresConDatos.forEach(supervisor => {
            const datosSupervisor = supervisoresData[supervisor][periodoCompleto];
            if (datosSupervisor) {
                metaTotalMes += datosSupervisor.meta_super || 0;
                recuperoTotalActual += datosSupervisor.total_recupero || 0;
            }
        });
        
        // 3. OBTENER DÍAS LABORABLES (de los datos diarios de SUPERVISORES)
        const todasFechas = new Set();
        
        // Recorrer todos los supervisores para obtener fechas únicas
        supervisoresConDatos.forEach(supervisor => {
            const datosSupervisor = supervisoresData[supervisor][periodoCompleto];
            if (datosSupervisor && datosSupervisor.datos_diarios_supervisor) {
                Object.keys(datosSupervisor.datos_diarios_supervisor).forEach(fecha => {
                    // Solo agregar fechas que tengan valor > 0 o que sean relevantes
                    const valor = datosSupervisor.datos_diarios_supervisor[fecha];
                    if (valor !== null && valor !== undefined) {
                        todasFechas.add(fecha);
                    }
                });
            }
        });
        
        // Si no hay fechas en datos diarios, intentar con alcance acumulado
        if (todasFechas.size === 0) {
            supervisoresConDatos.forEach(supervisor => {
                const datosSupervisor = supervisoresData[supervisor][periodoCompleto];
                if (datosSupervisor && datosSupervisor.alcance_acumulado_diario) {
                    Object.keys(datosSupervisor.alcance_acumulado_diario).forEach(fecha => {
                        todasFechas.add(fecha);
                    });
                }
            });
        }
        
        const fechasOrdenadas = Array.from(todasFechas).sort((a, b) => 
            convertirFechaDiaria(a) - convertirFechaDiaria(b)
        );
        
        const diasRegistradosBD = fechasOrdenadas.length;
        const diasLaborables = 0;
        
        // 4. CALCULAR DÍAS TRABAJADOS (con recupero > 0 en datos diarios de supervisores)
        let diasTrabajados = 0;
        
        if (diasLaborables > 0) {
            // Para cada fecha, verificar si hubo recupero en algún supervisor
            fechasOrdenadas.forEach(fecha => {
                let totalRecuperoDia = 0;
                
                // Sumar recupero de todos los supervisores para esta fecha
                supervisoresConDatos.forEach(supervisor => {
                    const datosSupervisor = supervisoresData[supervisor][periodoCompleto];
                    if (datosSupervisor && datosSupervisor.datos_diarios_supervisor) {
                        // Obtener el INCREMENTO del día, no el acumulado
                        // Para esto necesitamos calcular la diferencia
                        const recuperoDia = datosSupervisor.datos_diarios_supervisor[fecha] || 0;
                        
                        // Si es acumulado, calcular diferencia con el día anterior
                        if (fechasOrdenadas.indexOf(fecha) > 0) {
                            const fechaAnterior = fechasOrdenadas[fechasOrdenadas.indexOf(fecha) - 1];
                            const recuperoAnterior = datosSupervisor.datos_diarios_supervisor[fechaAnterior] || 0;
                            totalRecuperoDia += (recuperoDia - recuperoAnterior);
                        } else {
                            // Primer día
                            totalRecuperoDia += recuperoDia;
                        }
                    }
                });
                
                // Si hubo recupero en algún supervisor, contar como día trabajado
                if (totalRecuperoDia > 0) {
                    diasTrabajados++;
                }
            });
        }
        
        // 5. CALCULAR ALCANCE ACTUAL
        const alcanceActual = metaTotalMes > 0 ? 
            parseFloat(((recuperoTotalActual / metaTotalMes) * 100).toFixed(2)) : 0;
        
        // 6. CALCULAR META DIARIA
        const metaDiaria = diasLaborables > 0 ? metaTotalMes / diasLaborables : 0;
        
        // 7. CALCULAR PROMEDIO DIARIO REAL
        const promedioDiarioReal = diasTrabajados > 0 ? recuperoTotalActual / diasTrabajados : 0;
        
        // 8. CALCULAR PROYECCIONES
        const diasRestantes = Math.max(0, diasLaborables - diasTrabajados);
        const recuperoProyectado = promedioDiarioReal * diasRestantes;
        const recuperoTotalProyectado = recuperoTotalActual + recuperoProyectado;
        const eficienciaDiaria = metaTotalMes > 0 ? (recuperoTotalProyectado / metaTotalMes) * 100 : 0;
        
        // 9. Calcular eficiencia vs meta diaria
        const eficienciaVsMetaDiaria = metaDiaria > 0 ? (promedioDiarioReal / metaDiaria) * 100 : 0;
        
        // 10. MOSTRAR EN INTERFAZ
        mostrarEstadisticasUnificada(
            periodoCompleto,
            {
                metaTotalMes,
                recuperoTotalActual,
                alcanceActual,
                eficienciaDiaria,
                diasLaborables,
                diasRegistradosBD,
                diasTrabajados,
                metaDiaria,
                promedioDiarioReal,
                eficienciaVsMetaDiaria,
                recuperoProyectado,
                recuperoTotalProyectado,
                diasRestantes
            },
            'global'
        );
    }

    function generarGraficasRecuperos(periodoCompleto) {
        const graficasContainer = document.getElementById('graficas-recuperos');
        if (!graficasContainer) return;
        
            graficasContainer.innerHTML = `
              <div style="text-align: center; margin-bottom: 30px; display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                  <button class="boton-exportar-excel" onclick="exportarRecupero4MesesDiaSupervisor('TODOS')">
                      📈 Exportar Recupero 4M
                  </button>
              </div>

            <!-- ===================== TABLA COMPARATIVA 4 MESES (ALCANCES) ===================== -->
            <div id="cardTablaComparativa4M" style="margin-top: 16px; background:#fff; border-radius:14px; padding:16px; box-shadow: 0 5px 15px rgba(0,0,0,0.08);">
              <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap;">
                  <div>
                    <h3 style="margin:0; color:#2c3e50; font-size: 1.25rem; font-weight: 800;">ANALISIS DE ALCANCES</h3>
                  </div>

                  <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">

                      <button
                          type="button"
                          class="boton-busqueda"
                          onclick="abrirModalSimulacionAlcances('${periodoCompleto}')"
                          style="padding:10px 14px;">
                          Simular
                      </button>

                      <button
                          type="button"
                          class="boton-busqueda"
                          id="btnTabla4MRefrescar"
                          style="padding:10px 14px;">
                          🔄 Actualizar
                      </button>

                      <button
                          type="button"
                          class="boton-busqueda"
                          onclick="copiarVistaAlcances4M()"
                          style="padding:10px 14px; background: linear-gradient(135deg, #34495e, #2c3e50);">
                          Copiar vista
                      </button>
                  </div>
              </div>
            
              <div class="tabla4m-selectores">
                <div>
                  <label style="font-weight:700; color:#2c3e50;">Periodo 1</label>
                  <select id="selTabla4M_1" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                </div>
                <div>
                  <label style="font-weight:700; color:#2c3e50;">Periodo 2</label>
                  <select id="selTabla4M_2" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                </div>
                <div>
                  <label style="font-weight:700; color:#2c3e50;">Periodo 3</label>
                  <select id="selTabla4M_3" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                </div>
                <div>
                  <label style="font-weight:700; color:#2c3e50;">Periodo 4</label>
                  <select id="selTabla4M_4" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                </div>
              </div>

              <div class="tabla4m-selectores" id="filaTabla4MSupervisores" style="margin-top:10px; display:none;">
                  <div>
                    <label style="font-weight:700; color:#2c3e50;">Supervisor P1</label>
                    <select id="selTabla4M_Sup_1" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                  </div>
                  <div>
                    <label style="font-weight:700; color:#2c3e50;">Supervisor P2</label>
                    <select id="selTabla4M_Sup_2" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                  </div>
                  <div>
                    <label style="font-weight:700; color:#2c3e50;">Supervisor P3</label>
                    <select id="selTabla4M_Sup_3" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd;"></select>
                  </div>
                  <div>
                    <label style="font-weight:700; color:#2c3e50;">Supervisor P4 (fijo)</label>
                    <input id="selTabla4M_Sup_4_fixed" type="text" disabled
                           style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#f3f5f7;"
                           value="—" />
                  </div>
              </div>

              <!-- MINI GRÁFICAS -->
              <div style="margin-top:12px; display:grid; grid-template-columns: 1fr; gap:12px; align-items:start;">
                  <div id="tablas4MComparativoSupervisores" class="tabla4m-comparativo"></div>
                  <div id="tablas4MSupervisoresTodos" class="tabla4m-supervisores-grid"></div>
                  <div id="tablas4MPrincipales" class="tabla4m-doble">
                    <div>
                      <div class="tabla4m-titulo">RECUPEROS</div>
                      <div class="tabla4m-wrap" style="justify-self:stretch; width:100%; max-width:100%;">
                        <table id="tablaComparativa4MRecupero" class="tabla-comparativa-4m" style="width:100%;">
                          <thead id="theadTabla4MRecupero"></thead>
                          <tbody id="tbodyTabla4MRecupero"></tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <div class="tabla4m-titulo">ALCANCES</div>
                      <div class="tabla4m-wrap" style="justify-self:stretch; width:100%; max-width:100%;">
                        <table id="tablaComparativa4MAlcance" class="tabla-comparativa-4m" style="width:100%;">
                          <thead id="theadTabla4MAlcance"></thead>
                          <tbody id="tbodyTabla4MAlcance"></tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                
                  <div id="miniAlcancesRight" style="display:grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap:10px; align-content:start;">
                    <div class="mini-chart-card" data-mini="acumulado">
                      <div class="mini-title">ACUMULADO</div>
                      <canvas id="miniGraficaIncrementoTotal"></canvas>
                    </div>
                
                    <div class="mini-chart-card" data-mini="diario">
                      <div class="mini-title">DIARIO</div>
                      <canvas id="miniGraficaRecuperoDiario"></canvas>
                    </div>
                
                    <div class="mini-chart-card" data-mini="equipos">
                      <div class="mini-title">EQUIPOS</div>
                      <canvas id="miniGraficaAlcanceEquipos"></canvas>
                    </div>
                
                    <div class="mini-chart-card" data-mini="anual">
                      <div class="mini-title">ANUAL</div>
                      <canvas id="miniGraficaEvolucionAnualRecuperos"></canvas>
                    </div>
                  </div>
              </div>
                
              <!-- MODAL ALCANCES -->
              <div id="modalGraficaAlcances" style="display:none;">
                  <div id="modalGraficaAlcancesBackdrop"
                       style="position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:9999;"></div>
                
                    <div id="modalGraficaAlcancesOverlay"
                         style="
                            position:fixed; inset:0; z-index:10000;
                            display:flex; align-items:center; justify-content:center;
                            padding:18px;">
                    <div style="
                        width:min(1200px, 96vw);
                        max-height:92vh;
                        background:#fff;
                        border-radius:16px;
                        box-shadow:0 18px 50px rgba(0,0,0,.25);
                        overflow:hidden;">
                      
                      <div style="display:flex; justify-content:space-between; align-items:center;
                                  padding:12px 14px; border-bottom:1px solid rgba(0,0,0,.08);">
                        <div id="modalGraficaAlcancesTitulo" style="font-weight:800; font-size:1.5rem; text-align:center; width:100%; color:#2c3e50;">
                          Gráfica de Alcances
                        </div>
                      </div>
                
                      <div style="padding:12px;">
                        <canvas id="modalCanvasGraficaAlcances" style="display:block; margin:0 auto; width:100%; height: 70vh;"></canvas>
                      </div>
                    </div>
                  </div>
              </div>
            
              <div id="notaTabla4M" style="margin-top:10px; color:#666; font-size:0.9rem;">
                —
              </div>
            </div>
        `;

        const card4M = document.getElementById('cardTablaComparativa4M');
        const mini4M = document.getElementById('miniAlcancesRight');
        if (card4M && mini4M) {
          card4M.insertBefore(mini4M, card4M.firstElementChild);
          mini4M.style.marginBottom = '14px';
          mini4M.style.marginTop = '0';
        }

        try {
          initTablaComparativa4M();
        } catch (e) {
          console.warn('initTablaComparativa4M error:', e);
        }
        
        // Generar gráficos después de un breve delay
        setTimeout(() => {
          generarGraficaIncrementoTotal(periodoCompleto, 'miniGraficaIncrementoTotal', 'mini');
          generarGraficaRecuperoDiario(periodoCompleto, 'miniGraficaRecuperoDiario', 'mini');
          generarGraficaAlcanceEquiposRecuperos(periodoCompleto, 'miniGraficaAlcanceEquipos', 'mini');
          actualizarGraficaEvolucionAnualRecuperos('miniGraficaEvolucionAnualRecuperos', 'mini');

          _bindMiniAlcancesClicks(periodoCompleto);
        }, 100);
    }

    function _cloneHtmlClipboard4M(node) {
      if (!node) return '';
      const clone = node.cloneNode(true);
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      clone.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
      clone.querySelectorAll('.is-clickable').forEach(el => el.classList.remove('is-clickable'));
      clone.querySelectorAll('.tabla4m-wrap').forEach(el => {
        el.style.overflow = 'visible';
        el.style.maxHeight = 'none';
        el.style.maxWidth = 'none';
        el.style.width = 'auto';
      });
      clone.querySelectorAll('table').forEach(tb => {
        tb.style.borderCollapse = 'collapse';
        tb.style.width = '100%';
      });
      return clone.outerHTML;
    }

    function _tdClipboard4M(html) {
      return `<td style="vertical-align:top; padding:8px; border:1px solid #d9e2ec;">${html}</td>`;
    }

    function _filaClipboard4M(htmls) {
      const celdas = (htmls || []).filter(Boolean).map(_tdClipboard4M).join('');
      return celdas ? `<tr>${celdas}</tr>` : '';
    }

    async function copiarVistaAlcances4M() {
      const comparativo = document.getElementById('tablas4MComparativoSupervisores');
      const individuales = document.getElementById('tablas4MSupervisoresTodos');
      const principales = document.getElementById('tablas4MPrincipales');

      const row1Base = comparativo?.querySelector('.tabla4m-doble');
      const row1 = Array.from(row1Base?.children || []).map(_cloneHtmlClipboard4M);
      const row2 = Array.from(individuales?.children || []).map(_cloneHtmlClipboard4M);
      const row3 = Array.from(principales?.children || []).map(_cloneHtmlClipboard4M);

      const filas = [
        _filaClipboard4M(row1),
        _filaClipboard4M(row2),
        _filaClipboard4M(row3)
      ].filter(Boolean).join('');

      if (!filas) {
        alert('No hay tablas de ALCANCES para copiar.');
        return;
      }

      const estilos = `
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
          th { background:#0d47a1; color:#fff; font-weight:700; border:1px solid #d9e2ec; padding:3px 5px; text-align:center; }
          td { border:1px solid #d9e2ec; padding:3px 5px; text-align:center; white-space:nowrap; }
          .tabla4m-titulo { font-weight:800; color:#2c3e50; margin-bottom:5px; text-align:center; }
          .valor-vacio { color:#9aa4b2; }
          .valor-alto { font-weight:800; }
        </style>
      `;
      const html = `${estilos}<table>${filas}</table>`;
      const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([texto], { type: 'text/plain' })
            })
          ]);
        } else {
          const tmp = document.createElement('div');
          tmp.style.position = 'fixed';
          tmp.style.left = '-9999px';
          tmp.innerHTML = html;
          document.body.appendChild(tmp);
          const range = document.createRange();
          range.selectNodeContents(tmp);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('copy');
          sel.removeAllRanges();
          tmp.remove();
        }
        alert('Vista copiada. Puedes pegarla en Excel o correo.');
      } catch (err) {
        console.error('No se pudo copiar la vista:', err);
        alert('No se pudo copiar la vista. Intenta nuevamente desde el navegador.');
      }
    }

    function _bindMiniAlcancesClicks(periodoCompleto) {
      const wrap = document.getElementById('miniAlcancesRight');
      if (!wrap) return;
    
      const cards = wrap.querySelectorAll('.mini-chart-card[data-mini]');
      cards.forEach((card) => {
        card.style.cursor = 'pointer';
    
        // Evitar doble bindeo (si se re-renderiza la sección)
        if (card.dataset.bound === '1') return;
        card.dataset.bound = '1';
    
        card.addEventListener('click', () => {
          const tipo = (card.getAttribute('data-mini') || '').trim();
    
          const titulo = document.getElementById('modalGraficaAlcancesTitulo');
          if (titulo) {
            const map = {
              acumulado: 'Gráfica Acumulada',
              diario: 'Gráfica Diaria',
              equipos: 'Gráfica por Equipos',
              anual: 'Evolución Anual'
            };
            titulo.textContent = map[tipo] || 'Gráfica de Alcances';
          }
    
          abrirModalGraficaAlcances(tipo, periodoCompleto);
        });
      });
    }

    // ========== FUNCIÓN PARA CAMBIAR ENTRE GRÁFICAS ==========
    function cambiarGrafica(tipo) {
        const btnAcumulado = document.getElementById('btnRecuperoAcumulado');
        const btnDiario = document.getElementById('btnRecuperoDiario');
        const btnEquipos = document.getElementById('btnRecuperoEquipos');
        const btnAnual = document.getElementById('btnRecuperoAnual');
        const containerAcumulado = document.getElementById('graficaAcumuladoContainer');
        const containerDiario = document.getElementById('graficaDiarioContainer');
        const containerEquipos = document.getElementById('graficaEquiposContainer');
        const containerAnual = document.getElementById('graficaAnualContainer');
        
        if (!btnAcumulado || !btnDiario || !btnEquipos || !btnAnual || 
            !containerAcumulado || !containerDiario || !containerEquipos || !containerAnual) return;
        
        // Remover clase activa de todos los botones
        btnAcumulado.classList.remove('activo');
        btnDiario.classList.remove('activo');
        btnEquipos.classList.remove('activo');
        btnAnual.classList.remove('activo');
        
        // Ocultar todos los contenedores
        containerAcumulado.style.display = 'none';
        containerDiario.style.display = 'none';
        containerEquipos.style.display = 'none';
        containerAnual.style.display = 'none';
        
        // Restaurar estilos de todos los botones
        const estilosInactivo = `
            background: linear-gradient(135deg, #9b59b6, #8e44ad);
            box-shadow: 0 4px 10px rgba(155, 89, 182, 0.3);
        `;
        
        btnAcumulado.style.cssText = btnAcumulado.style.cssText.replace(/background[^;]+;/, '').replace(/box-shadow[^;]+;/, '') + estilosInactivo;
        btnDiario.style.cssText = btnDiario.style.cssText.replace(/background[^;]+;/, '').replace(/box-shadow[^;]+;/, '') + estilosInactivo;
        btnEquipos.style.cssText = btnEquipos.style.cssText.replace(/background[^;]+;/, '').replace(/box-shadow[^;]+;/, '') + estilosInactivo;
        btnAnual.style.cssText = btnAnual.style.cssText.replace(/background[^;]+;/, '').replace(/box-shadow[^;]+;/, '') + estilosInactivo;
        
        // Mostrar la gráfica seleccionada y activar su botón
        const estilosActivo = `
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            box-shadow: 0 0 0 3px white, 0 0 0 6px #2ecc71;
        `;
        
        if (tipo === 'acumulado') {
            btnAcumulado.classList.add('activo');
            containerAcumulado.style.display = 'block';
            btnAcumulado.style.cssText = btnAcumulado.style.cssText.replace(/background[^;]+;/, '').replace(/box-shadow[^;]+;/, '') + estilosActivo;
        } 
        else if (tipo === 'diario') {
            btnDiario.classList.add('activo');
            containerDiario.style.display = 'block';
            btnDiario.style.cssText = btnDiario.style.cssText.replace(/background[^;]+;/, '').replace(/box-shadow[^;]+;/, '') + estilosActivo;
        }
        else if (tipo === 'equipos') {
            btnEquipos.classList.add('activo');
            containerEquipos.style.display = 'block';
            btnEquipos.style.cssText = btnEquipos.style.cssText.replace(/background[^;]+;/, '').replace(/box-shadow[^;]+;/, '') + estilosActivo;
        }
        
        else if (tipo === 'anual') {
            btnAnual.classList.add('activo');
            containerAnual.style.display = 'block';
            btnAnual.style.cssText = btnAnual.style.cssText
              .replace(/background[^;]+;/, '')
              .replace(/box-shadow[^;]+;/, '') + estilosActivo;
            if (typeof actualizarGraficaEvolucionAnualRecuperos === 'function') {
                actualizarGraficaEvolucionAnualRecuperos();
            } else {
                console.warn('⚠️ actualizarGraficaEvolucionAnualRecuperos no existe');
            }
        }
    }

    // Función para convertir fecha diaria (ej: "3-Nov") a número para ordenar
    function convertirFechaDiaria(fecha) {
      const n = Number(fecha);
      return Number.isFinite(n) ? n : 0;
    }

    function obtenerDiasDelPeriodo(periodoCompleto) {
      const partes = String(periodoCompleto || '').split('_');
      if (partes.length < 2) return 31;
      const meses = {
        ENERO: 0, FEBRERO: 1, MARZO: 2, ABRIL: 3, MAYO: 4, JUNIO: 5,
        JULIO: 6, AGOSTO: 7, SETIEMBRE: 8, SEPTIEMBRE: 8,
        OCTUBRE: 9, NOVIEMBRE: 10, DICIEMBRE: 11
      };
      const mesIdx = meses[String(partes[0] || '').toUpperCase()];
      const anio = Number(partes[1]);
      if (mesIdx === undefined || !Number.isFinite(anio)) return 31;
      return new Date(anio, mesIdx + 1, 0).getDate();
    }

    function obtenerFechasPeriodoCompleto(periodoCompleto) {
      const totalDias = obtenerDiasDelPeriodo(periodoCompleto);
      return Array.from({ length: totalDias }, (_, idx) => String(idx + 1));
    }

    function obtenerUltimoDiaConDato(datosDiarios) {
      return Object.keys(datosDiarios || {}).reduce((maxDia, fecha) => {
        const dia = convertirFechaDiaria(fecha);
        const valor = Number(datosDiarios[fecha] || 0);
        return (dia > maxDia && valor > 0) ? dia : maxDia;
      }, 0);
    }
    
    function abrirModalGraficaAlcances(tipo, periodoCompleto) {
        const modal = document.getElementById('modalGraficaAlcances');
        const modalCanvasId = 'modalCanvasGraficaAlcances';
        if (modal) {
        modal.style.display = 'block';
        }
        document.addEventListener('keydown', handleModalGraficaAlcancesEscape);
        const overlay = document.getElementById('modalGraficaAlcancesOverlay');
        if (overlay && overlay.dataset.bound !== '1') {
        overlay.dataset.bound = '1';
        overlay.addEventListener('click', function(e) {
          if (e.target === overlay) {
            cerrarModalGraficaAlcances();
          }
        });
        }
        const supUI = document.getElementById('selectorSupervisor');
        let supervisor = (window.supervisorSeleccionado || '').trim();
        
        // fallback al selector actual si el global está vacío
        if (!supervisor && supUI && supUI.value) {
            supervisor = String(supUI.value).trim();
        }
        
        // normalizar TODOS
        if (supervisor === 'TODOS') supervisor = '';
        requestAnimationFrame(() => {
            if (supervisor && supervisor !== 'TODOS') {
              if (tipo === 'acumulado') {
                generarGraficaIncrementoTotalSupervisor(periodoCompleto, supervisor, modalCanvasId, 'modal');
              } else if (tipo === 'diario') {
                generarGraficaRecuperoDiarioSupervisor(periodoCompleto, supervisor, modalCanvasId, 'modal');
              } else if (tipo === 'equipos') {
                generarGraficaAlcanceEquiposRecuperos(periodoCompleto, modalCanvasId, 'modal');
              } else if (tipo === 'anual') {
                actualizarGraficaEvolucionAnualRecuperos(modalCanvasId, 'modal');
              }
        
            } else {
        
              if (tipo === 'acumulado') {
                generarGraficaIncrementoTotal(periodoCompleto, modalCanvasId, 'modal');
              } else if (tipo === 'diario') {
                generarGraficaRecuperoDiario(periodoCompleto, modalCanvasId, 'modal');
              } else if (tipo === 'equipos') {
                generarGraficaAlcanceEquiposRecuperos(periodoCompleto, modalCanvasId, 'modal');
              } else if (tipo === 'anual') {
                actualizarGraficaEvolucionAnualRecuperos(modalCanvasId, 'modal');
              }
            }
        });
    }
    
    function handleModalGraficaAlcancesEscape(event) {
        if (event.key === 'Escape' || event.keyCode === 27) {
            cerrarModalGraficaAlcances();
        }
    }

    function cerrarModalGraficaAlcances() {
        const modal = document.getElementById('modalGraficaAlcances');
        if (modal) modal.style.display = 'none';
    
        document.removeEventListener('keydown', handleModalGraficaAlcancesEscape);
    }

    // ========== EXPORTAR EXCEL DIARIO POR ASESOR (DESHABILITADO) ==========
    async function exportarTablaDetalleExcelAvanzado(supervisorFiltro = null) {
        alert('La exportación diaria por asesor fue deshabilitada: la Vista de Asesor por Día ya no se usa como fuente.');
        return;
    }

    async function exportarRecupero4MesesDiaSupervisor(supervisorParam = '') {
      const wb = new ExcelJS.Workbook();
      const mesSeleccionado = document.getElementById('selectorMes')?.value;
      const añoSeleccionado = document.getElementById('selectorAño')?.value;
      const periodoActual = `${mesSeleccionado}_${añoSeleccionado}`;
      const fechaHoy = new Date();
      const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SETIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
      const periodoHoy = `${meses[fechaHoy.getMonth()]}_${fechaHoy.getFullYear()}`;
      const limiteHoy = Math.max(1, fechaHoy.getDate() - 1);
    
      if (!mesSeleccionado || !añoSeleccionado) {
        alert('Selecciona mes y año');
        return;
      }

      const fuenteSupervisores =
        (typeof datosSupervisores !== 'undefined' && datosSupervisores) ? datosSupervisores :
        (typeof supervisoresData !== 'undefined' && supervisoresData) ? supervisoresData :
        (window && window.supervisoresData) ? window.supervisoresData :
        null;
    
      if (!fuenteSupervisores || typeof fuenteSupervisores !== 'object') {
        alert('No hay datos de supervisores disponibles (datosSupervisores)');
        return;
      }
    
      let supervisorFiltro = (supervisorParam || '').trim();
    
      if (!supervisorFiltro) {
        const barraFiltrosGlobal = document.getElementById('barraFiltrosSupervisoresGlobal');
        if (barraFiltrosGlobal) {
          const botonActivoGlobal = barraFiltrosGlobal.querySelector('.filtro-supervisor.activo[data-supervisor]');
          if (botonActivoGlobal) {
            supervisorFiltro = botonActivoGlobal.getAttribute('data-supervisor') || '';
          }
        }
      }
    
      if (!supervisorFiltro) supervisorFiltro = 'TODOS';
    
      const periodos = _getPeriodosAtras(mesSeleccionado, añoSeleccionado, 4, true);
      if (!periodos.length) {
        alert('No se pudieron calcular los 4 periodos');
        return;
      }
    
      const _tituloMes = (periodo) => {
        const p = String(periodo).split('_');
        const mes = (p[0] || '').toLowerCase();
        return mes ? (mes.charAt(0).toUpperCase() + mes.slice(1)) : periodo;
      };
    
      const _anioPeriodo = (periodo) => {
        const p = String(periodo).split('_');
        return p[1] || '';
      };

      const _diaDeKey = (key) => {
          const d = Number(key);
          return Number.isInteger(d) && d >= 1 && d <= 31 ? d : null;
      };
    
        const _forwardFill31 = (mapDiaToValor, limiteDia = 31) => {
          const out = new Array(32).fill(null);
        
          for (let d = 1; d <= limiteDia; d++) {
            const v = mapDiaToValor[d];
        
            if (v === undefined || v === null) {
              out[d] = (d === 1) ? null : out[d - 1];
            } else {
              out[d] = Number(v);
            }
          }
        
          for (let d = limiteDia + 1; d <= 31; d++) {
            out[d] = null;
          }
        
          return out;
        };
    
      // =====================
      // Helpers numéricos
      // (si ya existe _toNumber arriba en tu archivo, puedes borrar este y usar el tuyo)
      // =====================
      const _toNumber = (v) => {
        if (v === null || v === undefined) return 0;
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        const s = String(v).replace(/[%,$ ]/g, '').replace(/,/g, '').trim();
        const n = parseFloat(s);
        return isFinite(n) ? n : 0;
      };
    
      // =====================
      // META/RECUPERO desde SUPERVISORES (CORRECTO)
      // =====================
      const _getMetaMesDesdeSupervisores = (periodo) => {
        if (supervisorFiltro === 'TODOS') {
          let suma = 0;
          Object.keys(fuenteSupervisores || {}).forEach((sup) => {
            suma += _toNumber(fuenteSupervisores?.[sup]?.[periodo]?.meta_super);
          });
          return suma;
        }
        return _toNumber(fuenteSupervisores?.[supervisorFiltro]?.[periodo]?.meta_super);
      };
    
      const _getRecuperoMesDesdeSupervisores = (periodo) => {
        if (supervisorFiltro === 'TODOS') {
          let suma = 0;
          Object.keys(fuenteSupervisores || {}).forEach((sup) => {
            // en tu estructura de supervisores: total_recupero por mes
            suma += _toNumber(fuenteSupervisores?.[sup]?.[periodo]?.total_recupero);
          });
          return suma;
        }
        return _toNumber(fuenteSupervisores?.[supervisorFiltro]?.[periodo]?.total_recupero);
      };
    
      // ====== helpers de hoja (para reusar en consolidado y supervisores) ======
      const _estilizarHojaDoble = (ws) => {
        // Colores header
        const fillRow1 = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0D47A1' }
        };
        const fillRow2 = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2C3E50' }
        };
    
        // 1) Estilos fila 1 (A..E y G..K)
        const r1 = ws.getRow(1);
        r1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        r1.alignment = { horizontal: 'center', vertical: 'middle' };
    
        // Tabla 1 (A..E) => col 1..(1+periodos.length)
        for (let c = 1; c <= (1 + periodos.length); c++) {
          ws.getCell(1, c).fill = fillRow1;
        }
        // Tabla 2 (G..K) => start 7
        for (let c = 7; c <= (7 + periodos.length); c++) {
          ws.getCell(1, c).fill = fillRow1;
        }
    
        // 2) Estilos fila 2 (A..E y G..K)
        const r2 = ws.getRow(2);
        r2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        r2.alignment = { horizontal: 'center', vertical: 'middle' };
    
        for (let c = 1; c <= (1 + periodos.length); c++) {
          ws.getCell(2, c).fill = fillRow2;
        }
        for (let c = 7; c <= (7 + periodos.length); c++) {
          ws.getCell(2, c).fill = fillRow2;
        }
    
        // Congelar
        ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 1 }];
    
        // Formato numérico
        // Tabla 1 (RECUPERO): columnas B..E
        for (let c = 2; c <= (1 + periodos.length); c++) {
          ws.getColumn(c).numFmt = '#,##0';
        }
    
        // Tabla 2 (ALCANCE %): columnas H..K => start 8
        // (Guardaremos valor en % ya multiplicado *100, así que formateamos con % literal)
        for (let c = 8; c <= (7 + periodos.length); c++) {
          ws.getColumn(c).numFmt = '0.00"%"';
        }
    
        // Anchos
        ws.getColumn(1).width = 6; // A (Dia)
        for (let c = 2; c <= (1 + periodos.length); c++) ws.getColumn(c).width = 16;
    
        ws.getColumn(6).width = 3; // F (espacio)
        ws.getColumn(7).width = 6; // G (Dia)
        for (let c = 8; c <= (7 + periodos.length); c++) ws.getColumn(c).width = 16;
      };
    
      // Escribe 2 tablas: Recupero (A..E) y Alcance% (G..K)
      const _poblarHojaRecuperoYAlcance = (ws, colRecuperoPorPeriodo, metaPorPeriodo) => {
        // Headers tabla 1 (RECUPERO)
        ws.getCell(1, 1).value = '';
        ws.getCell(2, 1).value = 'Dia';
    
        // Headers tabla 2 (ALCANCE)
        ws.getCell(1, 7).value = '';
        ws.getCell(2, 7).value = 'Dia';
    
        // Titulos de meses/años (ambas tablas)
        for (let i = 0; i < periodos.length; i++) {
          const periodo = periodos[i];
    
          // Tabla 1: B..E (col = 2+i)
          ws.getCell(1, 2 + i).value = _anioPeriodo(periodo);
          ws.getCell(2, 2 + i).value = _tituloMes(periodo);
    
          // Tabla 2: H..K (col = 8+i)
          ws.getCell(1, 8 + i).value = _anioPeriodo(periodo);
          ws.getCell(2, 8 + i).value = _tituloMes(periodo);
        }
    
        // Datos días 1..31
        for (let d = 1; d <= 31; d++) {
          const rowIdx = 2 + d; // fila 3..33
    
          // Dia tabla 1 y 2
          ws.getCell(rowIdx, 1).value = d; // A
          ws.getCell(rowIdx, 7).value = d; // G
    
          for (let i = 0; i < periodos.length; i++) {
            const periodo = periodos[i];
    
            const rec = colRecuperoPorPeriodo?.[periodo]?.[d] ?? null;
            
            // TABLA 1 (RECUPERO)
            ws.getCell(rowIdx, 2 + i).value = (rec === null ? null : Number(rec));
            
            // TABLA 2 (ALCANCE %)
            const metaMes = Number(metaPorPeriodo?.[periodo] ?? 0);
            
            if (rec !== null && metaMes > 0) {
              const alcancePct = (Number(rec) / metaMes) * 100;
              ws.getCell(rowIdx, 8 + i).value = alcancePct;
            } else {
              ws.getCell(rowIdx, 8 + i).value = null;
            }
          }
        }
    
        _estilizarHojaDoble(ws);
      };
    
      // ===================== CASO 1: FILTRADO POR UN SUPERVISOR =====================
      if (supervisorFiltro !== 'TODOS') {
        const sup = supervisorFiltro;
        const sheetName = String(sup || 'SUPERVISOR').substring(0, 31);
        const ws = wb.addWorksheet(sheetName);
    
        const colValoresPorPeriodo = {};
        const metaPorPeriodo = {};
    
        for (const periodo of periodos) {
          const dataPeriodo = fuenteSupervisores?.[sup]?.[periodo];
    
          // Recupero diario
          const diarios = dataPeriodo?.datos_diarios_supervisor || {};
          const mapDia = {};
          Object.keys(diarios).forEach((k) => {
            const d = _diaDeKey(k);
            if (!d || d < 1 || d > 31) return;
            mapDia[d] = Number(diarios[k]) || 0;
          });
          const limite = (periodo === periodoHoy) ? limiteHoy : 31;
          colValoresPorPeriodo[periodo] = _forwardFill31(mapDia, limite);
    
          // ✅ Meta del supervisor en ese mes (DESDE SUPERVISORES)
          metaPorPeriodo[periodo] = _getMetaMesDesdeSupervisores(periodo);
        }
    
        _poblarHojaRecuperoYAlcance(ws, colValoresPorPeriodo, metaPorPeriodo);
      }
      // ===================== CASO 2: TODOS (CONSOLIDADO + HOJA POR SUPERVISOR) =====================
      else {
        const supervisoresTodos = Object.keys(fuenteSupervisores || {});
    
        if (!supervisoresTodos.length) {
          alert('No hay supervisores para exportar');
          return;
        }
    
        //supervisores actuales
        const supervisoresMesActual = supervisoresTodos.filter((sup) => {
          const dataMes = fuenteSupervisores?.[sup]?.[periodoActual];
          const diarios = dataMes?.datos_diarios_supervisor || {};
          return Object.keys(diarios).length > 0;
        });
    
        // (A) CONSOLIDADO TOTAL (usa TODOS)
        {
          const wsCons = wb.addWorksheet('CONSOLIDADO');
    
          const colValoresPorPeriodo = {};
          const metaPorPeriodo = {};
    
          for (const periodo of periodos) {
            const mapDiaConsolidado = {};
    
            // Consolidar recupero diario sumando supervisores
            for (const sup of supervisoresTodos) {
              const dataPeriodo = fuenteSupervisores?.[sup]?.[periodo];
    
              const diarios = dataPeriodo?.datos_diarios_supervisor || {};
              Object.keys(diarios).forEach((k) => {
                const d = _diaDeKey(k);
                if (!d || d < 1 || d > 31) return;
    
                const val = Number(diarios[k]) || 0;
                mapDiaConsolidado[d] = (Number(mapDiaConsolidado[d]) || 0) + val;
              });
            }
    
            const limite = (periodo === periodoHoy) ? limiteHoy : 31;
            colValoresPorPeriodo[periodo] = _forwardFill31(mapDiaConsolidado, limite);
    
            // ✅ Meta total del mes (SUMA metas de todos los sup) DESDE SUPERVISORES
            metaPorPeriodo[periodo] = _getMetaMesDesdeSupervisores(periodo);
          }
    
          _poblarHojaRecuperoYAlcance(wsCons, colValoresPorPeriodo, metaPorPeriodo);
        }
    
        // (B) HOJAS INDIVIDUALES (solo supervisores del mes filtrado)
        if (!supervisoresMesActual.length) {
          console.warn('No hay supervisores con data en el periodo actual:', periodoActual);
        } else {
          for (const sup of supervisoresMesActual) {
            const sheetName = String(sup || 'SUP').substring(0, 31);
            const ws = wb.addWorksheet(sheetName);
    
            const colValoresPorPeriodo = {};
            const metaPorPeriodo = {};
    
            for (const periodo of periodos) {
              const dataPeriodo = fuenteSupervisores?.[sup]?.[periodo];
    
              // Recupero diario
              const diarios = dataPeriodo?.datos_diarios_supervisor || {};
              const mapDia = {};
              Object.keys(diarios).forEach((k) => {
                const d = _diaDeKey(k);
                if (!d || d < 1 || d > 31) return;
                mapDia[d] = Number(diarios[k]) || 0;
              });
              const limite = (periodo === periodoHoy) ? limiteHoy : 31;
              colValoresPorPeriodo[periodo] = _forwardFill31(mapDia, limite);
    
              // Meta mensual del supervisor
              metaPorPeriodo[periodo] = _toNumber(fuenteSupervisores?.[sup]?.[periodo]?.meta_super);
            }
    
            _poblarHojaRecuperoYAlcance(ws, colValoresPorPeriodo, metaPorPeriodo);
          }
        }
      }
    
      // Guardar
      const yy = fechaHoy.getFullYear();
      const mm = String(fechaHoy.getMonth() + 1).padStart(2, '0');
      const dd = String(fechaHoy.getDate()).padStart(2, '0');
      const stamp = `${yy}${mm}${dd}`;
    
      const nombreArchivo = `Recupero_4M_Dia_x_Mes_${supervisorFiltro}_${periodoActual}_${stamp}.xlsx`;
      const buffer = await wb.xlsx.writeBuffer();
    
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }),
        nombreArchivo
      );
    }
    
    function generarGraficaAlcanceEquiposRecuperos(periodoCompleto, canvasId = 'graficaAlcanceEquipos', view = 'full') {
        const supervisores = Object.keys(datosSupervisores).filter(supervisor => 
            supervisorEnCanal(supervisor, periodoCompleto) && datosSupervisores[supervisor] && datosSupervisores[supervisor][periodoCompleto]
        );
        
        if (supervisores.length === 0) return;
        
        // ========== OBTENER TODOS LOS DÍAS DEL MES ==========
        const todasFechasArray = obtenerFechasPeriodoCompleto(periodoCompleto);
        
        console.log(`📊 Gráfica equipos - Total días del mes: ${todasFechasArray.length}`);
        
        // ========== PREPARAR DATOS CON TODAS LAS FECHAS ==========
        const datasets = [];
        const colores = ['#FF6384', '#36A2EB', '#FFCE56', '#8AC926', '#9966FF', '#FF9F40'];
        
        supervisores.forEach((supervisor, index) => {
            const datosMes = datosSupervisores[supervisor][periodoCompleto];
            const alcanceDiario = datosMes.alcance_acumulado_diario || {};
            const datosDiarios = datosMes.datos_diarios_supervisor || {};
            
            // USAR TODOS LOS DÍAS DEL MES; días futuros/sin carga quedan vacíos
            const datosAlcance = todasFechasArray.map(fecha => {
                let valor = alcanceDiario[fecha];
                if ((valor === undefined || valor === null) && Object.prototype.hasOwnProperty.call(datosDiarios, fecha)) {
                    const recupero = Number(datosDiarios[fecha] || 0);
                    const meta = Number(datosMes.meta_super || 0);
                    valor = meta > 0 ? (recupero / meta) * 100 : null;
                }
                return (valor !== undefined && valor !== null && valor > 0) ? valor : null;
            });
            
            // Verificar que haya datos válidos (no todos null)
            const tieneDatos = datosAlcance.some(valor => valor !== null);
            
            if (tieneDatos) {
                const color = colores[index % colores.length];
                
                datasets.push({
                    label: supervisor,
                    data: datosAlcance,
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointRadius: function(context) {
                        // Puntos solo para datos válidos
                        const value = context.dataset.data[context.dataIndex];
                        return value === null ? 0 : 6;
                    },
                    pointHoverRadius: function(context) {
                        const value = context.dataset.data[context.dataIndex];
                        return value === null ? 0 : 10;
                    },
                    pointBackgroundColor: function(context) {
                        const value = context.dataset.data[context.dataIndex];
                        return value === null ? 'transparent' : color;
                    },
                    pointBorderColor: function(context) {
                        const value = context.dataset.data[context.dataIndex];
                        return value === null ? 'transparent' : '#ffffff';
                    },
                    pointBorderWidth: 2,
                    spanGaps: false  // IMPORTANTE: No conectar puntos nulos
                });
            }
        });
        
        // ========== VERIFICAR QUE HAYA DATASETS VÁLIDOS ==========
        if (datasets.length === 0) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            _applyCanvasSize(canvas, view);
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            canvas.style.maxWidth = '100%';
            
            ctx.fillStyle = '#95a5a6';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('📊 No hay datos de equipos disponibles', canvas.width / 2, canvas.height / 2 - 20);
            
            ctx.fillStyle = '#7f8c8d';
            ctx.font = '18px Arial';
            ctx.fillText(`Periodo: ${periodoCompleto.replace('_', ' ')}`, canvas.width / 2, canvas.height / 2 + 20);
            
            return;
        }
        
        // ========== AGREGAR LÍNEA DE META ==========
        datasets.push({
            label: 'Meta 100%',
            data: Array(todasFechasArray.length).fill(100),
            borderColor: '#2ecc71',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0,
            pointRadius: 0,
            order: 999
        });
        
        // ========== CONFIGURAR CANVAS ==========
        const canvas = document.getElementById(canvasId || 'graficaAlcanceEquipos');
        if (!canvas) {
          console.warn(`Canvas no encontrado: ${canvasId || 'graficaAlcanceEquipos'}`);
          return;
        }
        _applyCanvasSize(canvas, view);
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
        
        const ctx = canvas.getContext('2d');
        
        // ========== DESTRUIR GRÁFICA ANTERIOR ==========
        _destroyChartByCanvasId(canvasId);
        
        // ========== OBTENER TÍTULO ==========
        const [mes, año] = periodoCompleto.split('_');
        const tituloGrafica = [`        `,`        `];

        let options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { 
                        font: { 
                            size: 18, 
                            weight: 'bold' 
                        } 
                    }
                },
                tooltip: {
                  enabled: true,
                  mode: 'nearest',
                  intersect: false,
                  padding: 15,
                  cornerRadius: 10,
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  titleFont: { size: 18, weight: 'bold' },
                  bodyFont: { size: 18 },
                
                  filter: function(tooltipItem) {
                    const labelDataset = tooltipItem?.dataset?.label || '';
                    return labelDataset !== 'Meta 100%';
                  },
                
                  itemSort: function(a, b) {
                    const ay = (a && a.parsed && a.parsed.y != null) ? a.parsed.y : -Infinity;
                    const by = (b && b.parsed && b.parsed.y != null) ? b.parsed.y : -Infinity;
                    return by - ay; // DESC
                  },
                
                  callbacks: {
                    title: function(tooltipItems) {
                      if (!tooltipItems || tooltipItems.length === 0) return '';
                      const index = tooltipItems[0].dataIndex;
                      return todasFechasArray[index] || '';
                    },
                    label: function(context) {
                      if (!context || !context.dataset) return null;
                    
                      const labelDataset = context.dataset.label || '';
                    
                      // Ocultar "Meta 100%"
                      if (labelDataset === 'Meta 100%') {
                        return null;
                      }
                    
                      if (!context.parsed || context.parsed.y === null || !isFinite(context.parsed.y)) {
                        return null; // mejor que "Sin datos" para evitar tooltips vacíos con basura
                      }
                    
                      return `${labelDataset}: ${context.parsed.y.toFixed(2)}%`;
                    }
                  }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                x: {
                    title: {
                        display: false,
                        text: 'Días del Mes',
                        font: { size: 12, weight: 'bold' }
                    },
                    ticks: {
                        font: { size: 16 },
                        callback: function(value, index, values) {
                            // Colores diferentes para días con/sin datos en al menos un supervisor
                            const tieneDatosEnAlguno = datasets.some(dataset => 
                                dataset.data[index] !== null && 
                                dataset.label !== 'Meta 100%'
                            );
                            this.fontColor = tieneDatosEnAlguno ? '#2c3e50' : '#bdc3c7';
                            return this.getLabelForValue(value);
                        }
                    },
                    grid: {
                        drawOnChartArea: true
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: false,
                        text: '% Alcance Acumulado',
                        font: { size: 12, weight: 'bold' }
                    },
                    ticks: {
                        stepSize: 10,
                        callback: function(value) {
                            return value + '%';
                        },
                        font: { size: 16 }
                    },
                    min: 0,
                    suggestedMax: 100
                }
            }
        };
        
        options = _tuneOptionsForView(options, view);
        
        // ========== CREAR GRÁFICA CON TODAS LAS FECHAS ==========
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: todasFechasArray.map(fecha => {
                    // Mostrar solo el número del día
                    if (fecha.includes('-')) {
                        return fecha.split('-')[0];
                    }
                    return fecha;
                }),
                datasets: datasets
            },
            options
        });
        _storeChart(canvasId, chart);
    }
    
    function generarGraficaRecuperoDiario(periodoCompleto, canvasId = 'graficaRecuperoDiario', view = 'full') {
        const supervisoresPeriodo = obtenerSupervisoresParaResumen(periodoCompleto, 'TODOS');
        const dataLabelsPluginTotal = _buildDataLabelsPluginTotal(view);
        const fechasConDatos = new Set();
        supervisoresPeriodo.forEach(item => {
            Object.keys(item.datos?.datos_diarios_supervisor || {}).forEach(fecha => fechasConDatos.add(fecha));
        });
        const fechasOrdenadas = obtenerFechasPeriodoCompleto(periodoCompleto);

        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        _applyCanvasSize(canvas, view);
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
        const ctx = canvas.getContext('2d');
        _destroyChartByCanvasId(canvasId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (fechasConDatos.size === 0) {
            mostrarMensajeSinDatos(canvas, periodoCompleto);
            return;
        }
        
        let metaTotalMes = 0;
        supervisoresPeriodo.forEach(item => {
            metaTotalMes += Number(item.datos?.meta_super || 0);
        });
        
        const diasLaborables = fechasOrdenadas.length;
        const metaDiaria = diasLaborables > 0 ? metaTotalMes / diasLaborables : 0;
        
        const alcanceDiario = fechasOrdenadas.map(fecha => {
            let totalRecuperoDia = 0;
            let tieneDato = false;
            supervisoresPeriodo.forEach(item => {
                const diarios = item.datos?.datos_diarios_supervisor || {};
                if (Object.prototype.hasOwnProperty.call(diarios, fecha)) {
                    tieneDato = true;
                    totalRecuperoDia += Number(diarios[fecha] || 0);
                }
            });
            
            const porcentajeDiario = (tieneDato && metaDiaria > 0) ? (totalRecuperoDia / metaDiaria) * 100 : null;
            if (!tieneDato) totalRecuperoDia = null;
            return {
                fecha: fecha,
                recupero: totalRecuperoDia,
                porcentaje: porcentajeDiario
            };
        });
        
        const porcentajes = alcanceDiario.map(dia => dia.porcentaje);
        const coloresBarras = porcentajes.map(porcentaje => {
            if (porcentaje <= 0) return '#F3E5F5';
            if (porcentaje <= 20) return '#E1BEE7';
            if (porcentaje <= 40) return '#BA68C8';
            if (porcentaje <= 60) return '#8E24AA';
            if (porcentaje <= 80) return '#6A1B9A';
            if (porcentaje <= 100) return '#4A148C';
            return '#38006B';
        });

        let options = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: {
                    display: true,
                    text: `            `,
                    font: { size: 24, weight: 'bold' }
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: { size: 18, weight: 'bold' },
                    bodyFont: { size: 17 },
                    padding: 15,
                    cornerRadius: 10,
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return `Día ${index + 1}: ${fechasOrdenadas[index]}`;
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const dia = alcanceDiario[index];
                            return [
                                dia.porcentaje === null ? 'Sin datos cargados' : `Alcance: ${dia.porcentaje.toFixed(2)}%`,
                                dia.recupero === null ? 'Recupero acumulado: sin data' : `Recupero acumulado: S/ ${dia.recupero.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                `Meta diaria referencial: S/ ${metaDiaria.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ];
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    title: { display: false, text: 'Días del Mes', font: { size: 14, weight: 'bold' } },
                    ticks: { font: { size: 16 }, maxRotation: 0, minRotation: 0 },
                    grid: { display: false }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: false, text: 'Alcance Diario (%)', font: { size: 14, weight: 'bold' } },
                    ticks: { callback: function(value) { return value + '%'; }, font: { size: 16 }, stepSize: 10 },
                    min: 0,
                    suggestedMax: Math.max(100, Math.ceil(Math.max(...porcentajes.filter(v => v !== null && v !== undefined), 0) / 10) * 10)
                }
            },
            elements: { line: { borderWidth: 0 } }
        };
        
        options = _tuneOptionsForView(options, view);

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: fechasOrdenadas.map(fecha => {
                    if (fecha.includes('-')) {
                        return fecha.split('-')[0];
                    }
                    return fecha;
                }),
                datasets: [{
                    label: 'Alcance Diario (%)',
                    data: porcentajes,
                    backgroundColor: coloresBarras,
                    borderColor: coloresBarras.map(color => color + 'CC'),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options,
            plugins: [dataLabelsPluginTotal]
        });
        _storeChart(canvasId, chart);
    }

    // FUNCIONES AUXILIARES

    function sincronizarSelectoresGlobal() {
        // Obtener valores actuales de los selectores del header
        const mesSeleccionado = document.getElementById('selectorMes').value;
        const añoSeleccionado = document.getElementById('selectorAño').value;
        
        // Actualizar estado global
        estadoGlobal.mesActual = mesSeleccionado;
        estadoGlobal.añoActual = añoSeleccionado;
        estadoGlobal.periodoActual = `${mesSeleccionado}_${añoSeleccionado}`;
        
        console.log(`🔄 Estado global actualizado: ${estadoGlobal.periodoActual}`);
    }
    
    function obtenerNumeroMes(mes) {
        const meses = {
            'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
            'JULIO': 6, 'AGOSTO': 7, 'SETIEMBRE': 8, 'SEPTIEMBRE': 8, 
            'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
        };
        return meses[mes.toUpperCase()] || 0;
    }
    
    // Event listeners para slider e input (sin llamadas a funciones inexistentes)
    alCargarDOM(function () {
        const slider = document.getElementById('alcanceObjetivoSlider');
        const input = document.getElementById('alcanceObjetivoInput');
    
        if (slider && input) {
            slider.addEventListener('input', function () {
                input.value = this.value;
            });
    
            input.addEventListener('change', function () {
                let valor = parseInt(this.value);
                if (isNaN(valor)) valor = 0;
                if (valor < 0) valor = 0;
                if (valor > 200) valor = 200;
                this.value = valor;
                slider.value = valor;
            });
        }
    });

    function obtenerMesesDelAño(año) {
        // Versión mejorada que maneja variaciones en nombres de meses
        const mesesDisponibles = Object.keys(datosMeses || {});
        
        console.log(`🔍 Buscando meses para año ${año}`);
        console.log(`📊 Meses disponibles:`, mesesDisponibles);
        
        // Filtrar meses que corresponden al año seleccionado
        const mesesDelAño = mesesDisponibles
            .filter(periodo => {
                // Extraer año del periodo (última parte después del _)
                const partes = periodo.split('_');
                if (partes.length < 2) return false;
                
                const añoPeriodo = String(partes[partes.length - 1] || '').trim();
                return añoPeriodo === String(año || '').trim();
            })
            .map(periodo => {
                // Extraer nombre del mes (todo antes del último _)
                const partes = periodo.split('_');
                partes.pop(); // Remover el año
                return partes.join('_'); // Unir en caso de que haya más de un _
            })
            .filter(mes => mes && mes !== '');
        
        console.log(`📈 Meses encontrados para ${año}:`, mesesDelAño);
        
        // Ordenar meses cronológicamente
        const ordenMeses = {
            'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 
            'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8, 
            'SETIEMBRE': 9, 'OCTUBRE': 10, 
            'NOVIEMBRE': 11, 'DICIEMBRE': 12
        };
        
        return mesesDelAño.sort((a, b) => {
            const mesA = a.toUpperCase();
            const mesB = b.toUpperCase();
            
            // Manejar sinónimos (SETIEMBRE/SEPTIEMBRE)
            const numA = ordenMeses[mesA] || (mesA.includes('SETIEMBRE') ? 9 : 0);
            const numB = ordenMeses[mesB] || (mesB.includes('SEPTIEMBRE') ? 9 : 0);
            
            return numA - numB;
        });
    }

    function actualizarSelectorMesSegunAñoHeader() {
      const selectorMes = document.getElementById('selectorMes');
      const selectorAño = document.getElementById('selectorAño');
      if (!selectorMes || !selectorAño) return;
    
      const año = String(selectorAño.value || '').trim();
      if (!año) return;
    
      const meses = obtenerMesesDelAño(año) || [];
    
      // Si no hay meses, dejamos el selector vacío para evitar “meses fantasmas”
      if (!Array.isArray(meses) || meses.length === 0) {
        selectorMes.innerHTML = '';
        return;
      }
    
      const mesActual = String(selectorMes.value || '').trim().toUpperCase();
    
      let html = '';
      meses.forEach(m => {
        const mesUp = String(m || '').trim().toUpperCase();
        if (!mesUp) return;
    
        const selected = (mesUp === mesActual) ? 'selected' : '';
        const label = mesUp.charAt(0) + mesUp.slice(1).toLowerCase();
        html += `<option value="${mesUp}" ${selected}>${label}</option>\n`;
      });
    
      selectorMes.innerHTML = html;
    
      // Si el mes actual ya no existe en el año nuevo, usar el primero disponible
      const setMeses = new Set(meses.map(x => String(x).trim().toUpperCase()));
      if (!setMeses.has(mesActual)) {
        selectorMes.value = String(meses[0]).trim().toUpperCase();
      }
    }
    
    function calcularAlcanceTotalMes(periodoCompleto) {
        console.log(`📊 Calculando alcance TOTAL para: ${periodoCompleto}`);
        
        if (!datosMeses || !datosMeses[periodoCompleto]) {
            console.warn(`⚠️ No hay datos para: ${periodoCompleto}`);
            return null;
        }
        
        const asesores = filtrarAsesoresPorCanal(datosMeses[periodoCompleto] || []);
        console.log(`👥 ${asesores.length} asesores encontrados`);
        
        // USAR SOLO DATOS DE SUPERVISORES (sin duplicados)
        const supervisoresUnicos = new Map(); // Usar Map para evitar duplicados
        
        // 1. RECOLECTAR DATOS ÚNICOS DE SUPERVISORES
        asesores.forEach(asesor => {
            const supervisor = asesor.supervisor;
            
            if (supervisor && supervisor !== 'Sin Supervisor') {
                // Solo guardar una vez por supervisor
                if (!supervisoresUnicos.has(supervisor)) {
                    supervisoresUnicos.set(supervisor, {
                        meta_super: asesor.meta_super || 0,
                        recupero_supervisor: asesor.recupero_supervisor || 0
                    });
                }
            }
        });
        
        // 2. SUMAR METAS Y RECUPEROS DE SUPERVISORES
        let metaTotal = 0;
        let recuperoTotal = 0;
        
        supervisoresUnicos.forEach((datos, supervisor) => {
            metaTotal += datos.meta_super;
            recuperoTotal += datos.recupero_supervisor;
            console.log(`👨‍💼 ${supervisor}: Meta S/ ${datos.meta_super.toLocaleString()}, Recupero S/ ${datos.recupero_supervisor.toLocaleString()}`);
        });
        
        console.log(`💰 Meta total (supervisores únicos): S/ ${metaTotal.toLocaleString()}`);
        console.log(`💰 Recupero total (supervisores): S/ ${recuperoTotal.toLocaleString()}`);
        
        // 3. CALCULAR ALCANCE
        if (metaTotal > 0) {
            const alcance = (recuperoTotal / metaTotal) * 100;
            console.log(`🎯 Alcance calculado: ${alcance.toFixed(2)}%`);
            return alcance;
        }
        
        console.warn(`❌ Meta total es 0 para ${periodoCompleto}`);
        return 0;
    }
    
    function calcularLineaTendencia(datos) {
        // Regresión lineal simple: y = mx + b
        const n = datos.length;
        const indices = datos.map((_, i) => i);
        
        // Filtrar datos nulos
        const datosValidos = datos.filter((d, i) => d !== null);
        const indicesValidos = indices.filter((_, i) => datos[i] !== null);
        
        if (datosValidos.length < 2) return datos;
        
        // Calcular promedios
        const sumX = indicesValidos.reduce((a, b) => a + b, 0);
        const sumY = datosValidos.reduce((a, b) => a + b, 0);
        const sumXY = indicesValidos.reduce((sum, x, i) => sum + x * datosValidos[i], 0);
        const sumX2 = indicesValidos.reduce((sum, x) => sum + x * x, 0);
        
        const m = (datosValidos.length * sumXY - sumX * sumY) / (datosValidos.length * sumX2 - sumX * sumX);
        const b = (sumY - m * sumX) / datosValidos.length;
        
        // Calcular valores de la línea de tendencia
        return indices.map(x => m * x + b);
    }
    
    function mostrarMensajeSinDatosAnual(canvasId, año) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        canvas.width = 1200;
        canvas.height = 200;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.maxWidth = '100%';
        
        ctx.fillStyle = '#95a5a6';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📊 No hay datos disponibles para este año', canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '16px Arial';
        ctx.fillText(`Año: ${año}`, canvas.width / 2, canvas.height / 2 + 20);
    }

    // ========== FUNCIONES PARA SECCION EVALUACION ========== 
    function setVistaEvaluacion(tipo) {
      if (tipo === '3M' || tipo === '6M' || tipo === '12M') {
        vistaEvaluacion = tipo;
      }

      // Activo visual: 3/6/12 definen rango; OTROS es un modo independiente.
      const btn3  = document.getElementById('btnEval3Meses');
      const btn6  = document.getElementById('btnEval6Meses');
      const btn12 = document.getElementById('btnEval12Meses');
      const btnOtros = document.getElementById('btnEvalOtros');

      btn3?.classList.toggle('activo', vistaEvaluacion === '3M');
      btn6?.classList.toggle('activo', vistaEvaluacion === '6M');
      btn12?.classList.toggle('activo', vistaEvaluacion === '12M');
      btnOtros?.classList.toggle('activo', modoOtrosEvaluacion);

      actualizarTarjetasEvaluacionRapida();
    }

    function setModoOtrosEvaluacion(activo) {
      modoOtrosEvaluacion = !!activo;
      document.getElementById('btnEvalOtros')?.classList.toggle('activo', modoOtrosEvaluacion);
      actualizarTarjetasEvaluacionRapida();
    }

    // ===================== FUNCIONES DE TARJETAS RAPIDAS (EVALUACIÓN) =====================
    
    // Normaliza porcentaje para trabajar SIEMPRE en fracción (0.70 = 70%)
    function _normPctToFrac(v) {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return isFinite(n) ? n : null;
    }
    
    function _fmtPct(vFrac) {
      if (vFrac === null || vFrac === undefined) return 'No participó';
      const n = Number(vFrac);
      if (!isFinite(n)) return 'No participó';
      return `${(n * 100).toFixed(2)}%`;
    }
    


    function _normalizarQuintil(valor) {
      const raw = String(valor ?? '').trim().toUpperCase();
      if (!raw) return null;
      const limpio = raw.replace(/^Q\s*/, '').replace(/,/, '.');
      const n = Number(limpio);
      if (Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 5) return n;
      const exacto = raw.match(/^Q?\s*([1-5])\s*$/);
      return exacto ? Number(exacto[1]) : null;
    }

    function _colorQuintil(q) {
      return {
        1: '#c62828',
        2: '#ef6c00',
        3: '#f9a825',
        4: '#26a69a',
        5: '#29b6f6'
      }[q] || '#95a5a6';
    }

    function _renderBarraQuintil(valor) {
      const q = _normalizarQuintil(valor);
      if (!q) return '<span style="color:#95a5a6; font-weight:700;">-</span>';
      const width = Math.max(20, q * 20);
      return `
        <div class="quintil-barra" title="Quintil ${q}">
          <div class="quintil-barra-track">
            <div class="quintil-barra-fill" style="width:${width}%; background:${_colorQuintil(q)}; color:${q >= 3 && q <= 4 ? '#2c3e50' : '#fff'};">${q}</div>
          </div>
        </div>
      `;
    }
    function _renderBarraQuintilGris(valor) {
      const q = _normalizarQuintil(valor);
      if (!q) return '<span style="color:#95a5a6; font-weight:700;">-</span>';
      const width = Math.max(20, q * 20);
      return `
        <div class="quintil-barra" title="Quintil ${q}">
          <div class="quintil-barra-track">
            <div class="quintil-barra-fill gris" style="width:${width}%;">${q}</div>
          </div>
        </div>
      `;
    }

    function _quintilIndicadorEvaluacion(periodo, alias, key) {
      const clave = normalizarTextoAsesor(alias);
      const items = (datosMeses?.[periodo] || [])
        .map(a => {
          const nombre = String(a.nombre || a.alias_crr || a.indicadores_calidad?.alias || '').trim();
          const valor = obtenerIndicadorAsesorPeriodo(a, key);
          return { nombre, clave: normalizarTextoAsesor(nombre), valor };
        })
        .filter(it => it.nombre && Number.isFinite(it.valor))
        .sort((a, b) => b.valor - a.valor);
      const index = items.findIndex(it => it.clave === clave);
      if (index < 0 || !items.length) return null;
      return items.length <= 1 ? 5 : Math.max(1, Math.min(5, 5 - Math.floor((index * 5) / items.length)));
    }

    function _quintilesExtraEvaluacion(periodo, alias) {
      return {
        condonacion: _quintilIndicadorEvaluacion(periodo, alias, 'condonacion'),
        cierre: _quintilIndicadorEvaluacion(periodo, alias, 'cierre'),
        calidad_pdp: _quintilIndicadorEvaluacion(periodo, alias, 'calidad_pdp'),
        puntualidad: _quintilIndicadorEvaluacion(periodo, alias, 'puntualidad')
      };
    }

    window.evalQuintilesExtraAbiertos = window.evalQuintilesExtraAbiertos || false;

    function toggleEvalQuintilesExtra() {
      window.evalQuintilesExtraAbiertos = !window.evalQuintilesExtraAbiertos;
      document.querySelectorAll('.eval-quintil-extra-col').forEach(col => col.classList.toggle('oculta', !window.evalQuintilesExtraAbiertos));
      const btn = document.getElementById('btnEvalQuintilesExtra');
      if (btn) btn.textContent = window.evalQuintilesExtraAbiertos ? '-' : '+';
    }

    function _renderQuintilesExtraEvaluacion(extras) {
      const datos = [
        ['Condonacion', extras?.condonacion],
        ['Cierre', extras?.cierre],
        ['Calidad', extras?.calidad_pdp],
        ['Puntualidad', extras?.puntualidad]
      ];
      return `<div class="eval-quintiles-extra-box">${datos.map(([label, q]) => `
        <div class="eval-quintil-extra-item">
          <span class="eval-quintil-extra-label">${label}</span>
          ${_renderBarraQuintilGris(q)}
        </div>`).join('')}</div>`;
    }

    function _calcularPromedioAlcance(alias, fechaIngreso, periodosProm, mapsPorPeriodo) {
      const nums = [];
    
      for (const periodo of periodosProm) {
        // Respeta fecha de inicio de gestion (misma regla que usas en export)
        if (!_mesEsValidoParaIngreso(periodo, fechaIngreso)) {
          continue;
        }
    
        const reg = mapsPorPeriodo?.[periodo]?.get(alias);
        const v = _normPctToFrac(reg?.alcance);
    
        if (v !== null) nums.push(v);
      }
    
      if (!nums.length) return null;
      return _avg(nums);
    }
    
    function _renderListaEvaluacion(listaId, items, modo) {
      const cont = document.getElementById(listaId);
      if (!cont) return;
    
      let html = '';
    
      items.forEach(it => {
        const alias = it.alias || '';
        const dni = it.dni || '';
        const sup = it.supervisor || '';
        const pctTxt = _fmtPct(it.pct);
        const pctClass = (modo === 'ok') ? 'porcentaje-100' : 'porcentaje-0';
        const gradClass = (modo === 'ok') ? 'gradiente-100' : 'gradiente-0';
        const det = window.evalDetallePorAlias?.[alias];
        const estadoActual = it.estadoActual || det?.estadoActual || '';
        const estadoTxt = estadoActual ? ` | Estado: ${estadoActual}` : '';
        
        html += `
          <div class="asesor-item ${gradClass}" style="gap:12px;">
            <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
              <div class="asesor-nombre">${alias}</div>
              <div style="font-size:0.85rem; color:#666;">
                Inicio de Gestión: ${_fmtFechaIngresoUI(det.fechaIngreso)} · SUP: ${sup}${estadoTxt}
              </div>
            </div>
    
            <button
              type="button"
              class="btn-eval-detalle"
              data-alias="${alias}"
              title="Ver detalle del cálculo"
              style="
                border:none; cursor:pointer;
                padding:8px 10px; border-radius:10px;
                background:#eef2f7; color:#2c3e50; font-weight:800;
              "
            >ℹ️</button>
    
            <div class="asesor-porcentaje ${pctClass}">${pctTxt}</div>
          </div>
        `;
      });
    
      cont.innerHTML = html || `
        <div style="padding:18px; text-align:center; color:#666;">
          Sin registros
        </div>
      `;
    }

    function _getNDesdeVistaEvaluacion() {
      if (vistaEvaluacion === '12M') return 12;
      if (vistaEvaluacion === '6M') return 6;
      return 3; // default 3M
    }

    function actualizarTarjetasEvaluacionRapida(supervisorParam = '') {
      const mesSeleccionado = document.getElementById('selectorMes')?.value;
      const añoSeleccionado = document.getElementById('selectorAño')?.value;
    
      const periodoFiltrado = `${mesSeleccionado}_${añoSeleccionado}`;
    
      // Si no hay datos del periodo, limpiamos UI
      if (!mesSeleccionado || !añoSeleccionado || !datosMeses?.[periodoFiltrado]) {
        document.getElementById('lista-eval-ok')?.replaceChildren();
        document.getElementById('lista-eval-bad')?.replaceChildren();
        const ok = document.getElementById('cantidad-eval-ok');
        const bad = document.getElementById('cantidad-eval-bad');
        if (ok) ok.textContent = '0';
        if (bad) bad.textContent = '0';
        const nota = document.getElementById('evalResumenNota');
        if (nota) nota.textContent = 'Selecciona un mes/año con data.';
        actualizarEvaluacionQuintil([], { periodoFiltrado });
        return;
      }
    
      // 3M / 6M / 12M según Evaluación
      const modoOtros = !!modoOtrosEvaluacion;
      const n = _getNDesdeVistaEvaluacion();
    
      // OTROS ignora los checkbox: siempre usa meses cerrados y muestra asesores en vacaciones/licencia.
      const incluirActual = modoOtros ? false : !!document.getElementById('chkIncluirMesSeleccionadoEval')?.checked;
      const mostrarNuevos = modoOtros ? true : !!document.getElementById('chkMostrarAsesoresNuevosEval')?.checked;
    
      // Filtro por supervisor (header)
      let supervisorFiltro = (supervisorParam || '').trim();
    
      // Si no viene por parámetro, tomar el activo del header
      if (!supervisorFiltro) {
        const barra = document.getElementById('barraFiltrosSupervisoresGlobal');
        const btnActivo = barra?.querySelector('.filtro-supervisor.activo[data-supervisor]');
        supervisorFiltro = btnActivo?.getAttribute('data-supervisor') || '';
      }
    
      // Fallback al estado global
      if (!supervisorFiltro) supervisorFiltro = (window.supervisorFiltroActual || 'TODOS');
    
      // Base desde el periodo filtrado
      let baseAsesores = filtrarAsesoresPorCanal((window.baseAsesoresAnalisis?.[periodoFiltrado] || []).slice());
    
      // Aplicar filtro solo para Evaluación
      if (supervisorFiltro && supervisorFiltro !== 'TODOS') {
        baseAsesores = baseAsesores.filter(p => String(p.supervisor || '').trim() === supervisorFiltro);
      }

      baseAsesores = baseAsesores.filter(p => {
        const estado = String(p.estado || '').toUpperCase().trim();
        const esOtros = estado === 'VACACIONES' || estado === 'LICENCIA';
        return modoOtros ? esOtros : !esOtros;
      });
    
      if (!baseAsesores.length) {
        _renderListaEvaluacion('lista-eval-ok', [], 'ok');
        _renderListaEvaluacion('lista-eval-bad', [], 'bad');
        const nota = document.getElementById('evalResumenNota');
        if (nota) nota.textContent = 'No hay base de asesores para este periodo.';
        actualizarEvaluacionQuintil([], { periodoFiltrado, n, incluirActual, modoOtros, supervisorFiltro });
        return;
      }
    
      const okList = [];
      const badList = [];
    
      // detalle para el modal
      window.evalDetallePorAlias = window.evalDetallePorAlias || {};
    
      baseAsesores.forEach(p => {
        const alias = (p.alias_crr || '').trim();
        if (!alias) return;
    
        const dni = (p.dni || '').toString();
        const supervisor = (p.supervisor || '').toString();
        const fechaIngreso = (p.fecha_inicio || '').toString();
        const estadoActual = String(p.estado || '').toUpperCase().trim();
    
        // N meses efectivos
        const det = _calcDetallePromedioEfectivo(
          alias,
          fechaIngreso,
          mesSeleccionado,
          añoSeleccionado,
          n,
          incluirActual
        );
    
        // no completó N meses efectivos
        const mesesUsados = Number(det?.mesesUsados ?? 0);
        const esNuevo = (mesesUsados >= 0 && mesesUsados < n);
    
        if (!mostrarNuevos && esNuevo) return;
    
        // Guardar para modal (incluimos dni/supervisor por comodidad)
        window.evalDetallePorAlias[alias] = {
          ...det,
          dni,
          supervisor,
          estadoActual,
          modoOtros
        };
    
        const prom = det.pct; // fracción 0..1 o null
        const item = { alias, dni, supervisor, pct: prom, estadoActual };
    
        // Regla: >=70% verde, <70% rojo
        if (prom !== null && prom >= 0.70) okList.push(item);
        else badList.push(item);
      });
    
      okList.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
      badList.sort((a, b) => (a.pct ?? 9) - (b.pct ?? 9));
    
      _renderListaEvaluacion('lista-eval-ok', okList, 'ok');
      _renderListaEvaluacion('lista-eval-bad', badList, 'bad');
      actualizarEvaluacionQuintil([...okList, ...badList], {
        periodoFiltrado,
        n,
        incluirActual,
        modoOtros,
        supervisorFiltro
      });
    
      const ok = document.getElementById('cantidad-eval-ok');
      const bad = document.getElementById('cantidad-eval-bad');
      if (ok) ok.textContent = String(okList.length);
      if (bad) bad.textContent = String(badList.length);
    
      const nota = document.getElementById('evalResumenNota');
      if (nota) {
        const modo = incluirActual ? 'ACTUAL' : 'CERRADO';
        if (modoOtros) {
          nota.textContent =
            `OTROS: VACACIONES / LICENCIA del mes seleccionado. ` +
            `Promedio calculado con ALCANCE_${n}M_CERRADO hasta el ultimo mes con datos.`;
        } else {
          nota.textContent =
            `Mostrando ALCANCE_${n}M_${modo} | ` +
            `Clic en detalle para ver el calculo.`;
        }
      }
    }

    function _setEvalQuintilAbierto(q, abierto) {
      const lista = document.getElementById(`evalQuintilQ${q}`);
      const toggle = document.getElementById(`evalQuintilToggleQ${q}`);
      const tarjeta = lista?.closest('.eval-quintil-card');
      if (lista) {
        lista.classList.toggle('colapsada', !abierto);
        lista.setAttribute('aria-hidden', String(!abierto));
      }
      if (tarjeta) {
        tarjeta.classList.toggle('quintil-abierto', abierto);
        tarjeta.setAttribute('aria-expanded', String(abierto));
      }
      if (toggle) toggle.textContent = abierto ? '-' : '+';
    }

    function toggleEvalQuintil(q) {
      const lista = document.getElementById(`evalQuintilQ${q}`);
      if (!lista) return;
      _setEvalQuintilAbierto(q, lista.classList.contains('colapsada'));
    }

    function actualizarEvaluacionQuintil(itemsEvaluacion = [], contexto = {}) {
      const grupos = { 1: [], 2: [], 3: [], 4: [], 5: [] };
      const nota = document.getElementById('evalQuintilNota');

      // La lista ya viene de Evaluacion por Promedios y, por tanto, ya respeta
      // 3/6/12 meses, incluir mes, nuevos, OTROS y supervisor.
      const ordenados = (Array.isArray(itemsEvaluacion) ? itemsEvaluacion : [])
        .map(item => {
          const rawPct = item?.pct;
          const numeroPct = (rawPct === null || rawPct === undefined || rawPct === '') ? null : Number(rawPct);
          return {
            alias: String(item?.alias || '').trim(),
            alcance: Number.isFinite(numeroPct) ? numeroPct : null
          };
        })
        .filter(item => item.alias)
        .sort((a, b) => {
          if (a.alcance === null && b.alcance === null) return a.alias.localeCompare(b.alias, 'es');
          if (a.alcance === null) return 1;
          if (b.alcance === null) return -1;
          return (b.alcance - a.alcance) || a.alias.localeCompare(b.alias, 'es');
        });

      const total = ordenados.length;
      ordenados.forEach((item, indice) => {
        // Q5 = 20% superior; Q1 = 20% inferior. La formula reparte toda
        // la lista incluso cuando el total no es multiplo de cinco.
        const q = Math.max(1, 5 - Math.floor((indice * 5) / Math.max(total, 1)));
        grupos[q].push(item);
      });

      window.__evalQuintilExportRows = [5, 4, 3, 2, 1].flatMap(q =>
        grupos[q].map(it => ({
          asesor: it.alias,
          promedio: it.alcance,
          quintil: `Q${q}`
        }))
      );

      [5, 4, 3, 2, 1].forEach(q => {
        const cont = document.getElementById(`evalQuintilQ${q}`);
        const resumen = document.getElementById(`evalQuintilResumenQ${q}`);
        const toggle = document.getElementById(`evalQuintilToggleQ${q}`);
        if (!cont) return;

        const estabaAbierto = !cont.classList.contains('colapsada');
        const items = grupos[q];
        const valores = items.map(it => it.alcance).filter(Number.isFinite);
        const promedio = valores.length ? valores.reduce((acc, valor) => acc + valor, 0) / valores.length : null;

        if (resumen) {
          resumen.innerHTML = `
            <div class="eval-quintil-metric">
              <span class="eval-quintil-metric-label">Asesores</span>
              <span class="eval-quintil-metric-value">${items.length}</span>
            </div>
            <div class="eval-quintil-metric">
              <span class="eval-quintil-metric-label">Promedio</span>
              <span class="eval-quintil-metric-value">${promedio === null ? '-' : _fmtPct(promedio)}</span>
            </div>`;
        }

        cont.innerHTML = items.map((it, index) => `
          <div class="eval-quintil-row" style="--quintil-delay:${Math.min(index, 10) * 32}ms">
            <div class="eval-quintil-asesor" title="${it.alias}">${it.alias}</div>
            <div class="eval-quintil-alcance">${_fmtPct(it.alcance)}</div>
          </div>`).join('') || '<div style="padding:14px 8px; text-align:center; color:#666; font-size:0.85rem;">Sin registros</div>';

        _setEvalQuintilAbierto(q, estabaAbierto);
        if (toggle && !estabaAbierto) toggle.textContent = '+';
      });

      if (nota) {
        const periodo = String(contexto.periodoFiltrado || 'este periodo').replace('_', ' ');
        const n = Number(contexto.n || _getNDesdeVistaEvaluacion());
        const modo = contexto.modoOtros ? 'CERRADO · OTROS' : (contexto.incluirActual ? 'ACTUAL' : 'CERRADO');
        const supervisor = contexto.supervisorFiltro && contexto.supervisorFiltro !== 'TODOS'
          ? ` · ${contexto.supervisorFiltro}`
          : ' · Todos los equipos';
        nota.textContent = total
          ? `Quintiles de ALCANCE_${n}M_${modo} · ${periodo}${supervisor}. Q5 es el 20% superior y Q1 el inferior.`
          : `No hay promedios para formar quintiles en ${periodo}${supervisor}.`;
      }
    }

    function _getSupervisorFiltroEvaluacion() {
      let supervisorFiltro = '';
    
      const barra = document.getElementById('barraFiltrosSupervisoresGlobal');
      const btnActivo = barra?.querySelector('.filtro-supervisor.activo[data-supervisor]');
      supervisorFiltro = btnActivo?.getAttribute('data-supervisor') || '';
    
      if (!supervisorFiltro) {
        supervisorFiltro = window.supervisorFiltroActual || '';
      }
    
      if (!supervisorFiltro && window.supervisorSeleccionado) {
        supervisorFiltro = window.supervisorSeleccionado;
      }
    
      supervisorFiltro = String(supervisorFiltro || '').trim();
    
      if (!supervisorFiltro || supervisorFiltro === 'TODOS') return '';
      return supervisorFiltro;
    }

    // ===================== HELPERS DE FECHAS / PERIODOS =====================
    
    // MES (nombre) -> número
    function _mesToNum(mesNombre) {
      const m = String(mesNombre || '').toUpperCase();
      const map = {
        'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
        'JULIO': 7, 'AGOSTO': 8, 'SETIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
      };
      return map[m] || 0;
    }
    
    // número -> MES (nombre)
    function _numToMes(n) {
      const arr = ['', 'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                   'JULIO','AGOSTO','SETIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
      return arr[n] || '';
    }
    
    // Retroceder un mes
    function _retroMes(m, y) {
      let mm = m - 1;
      let yy = y;
      if (mm <= 0) { mm = 12; yy = y - 1; }
      return { m: mm, y: yy };
    }
    
    // "MES_AÑO" -> { y, m }
    function _periodoToYM(periodo) {
      const p = String(periodo || '').split('_');
      if (p.length !== 2) return { y: 0, m: 0 };
      const m = _mesToNum(p[0]);
      const y = parseInt(p[1], 10);
      return { y: y || 0, m: m || 0 };
    }
    
    // y,m -> YYYYMM
    function _ymToNum(y, m) {
      return (y * 100) + m;
    }

    function _periodoFromYM(y, m) {
      return `${_numToMes(m)}_${String(y)}`;
    }
    

    function _esPeriodoExcluidoWeb(periodo) {
      const { y, m } = _periodoToYM(periodo);
      return y === 2025 && m === 9;
    }

    function _iterPeriodosAtras(mesNombre, añoStr, incluirActual, limite = 36) {
      const y0 = parseInt(añoStr, 10);
      const m0 = _mesToNum(mesNombre);
      if (!y0 || !m0) return [];
    
      // si NO incluirActual, empezamos en el mes anterior al seleccionado
      let cur = incluirActual ? { m: m0, y: y0 } : _retroMes(m0, y0);
    
      const out = [];
      for (let k = 0; k < limite; k++) {
        const periodo = _periodoFromYM(cur.y, cur.m);
        if (!_esPeriodoExcluidoWeb(periodo)) out.push(periodo);
        cur = _retroMes(cur.m, cur.y);
      }
      return out;
    }

    // ===================== CACHE DE MAPAS POR PERIODO =====================
    window._evalMapsCache = window._evalMapsCache || {};
    
    function _getMapPeriodoCached(periodo) {
      if (!periodo) return new Map();
      if (!window._evalMapsCache[periodo]) {
        window._evalMapsCache[periodo] = _mapBasePeriodoPorAlias(periodo) || new Map();
      }
      return window._evalMapsCache[periodo];
    }
    
    // ===================== FECHA CON HORA A SOLO FECHA=====================

    function _fmtFechaIngresoUI(fechaIngresoStr) {
      const s = String(fechaIngresoStr || '').trim();
      if (!s) return '—';
    
      // yyyy-mm-dd
      const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m1) {
        return `${m1[3]}/${m1[2]}/${m1[1]}`;
      }
    
      // dd/mm/yyyy (ya viene bien)
      const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (m2) {
        return s;
      }
    
      return s; // fallback
    }
    
    // ===================== FECHA DE INICIO =====================
    
    // "dd/mm/yyyy" o "yyyy-mm-dd" -> YYYYMM
    function _fechaIngresoToYMNum(fechaIngresoStr) {
      const s = String(fechaIngresoStr || '').trim();
      if (!s) return 0;
    
      // yyyy-mm-dd
      const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m1) {
        const y = parseInt(m1[1], 10);
        const m = parseInt(m1[2], 10);
        return _ymToNum(y, m);
      }
    
      // dd/mm/yyyy
      const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (m2) {
        const y = parseInt(m2[3], 10);
        const m = parseInt(m2[2], 10);
        return _ymToNum(y, m);
      }
    
      return 0;
    }

    // ===================== NUEVOS ASESORES =====================

    function _getAnclaYMNum(mesSel, añoSel, incluirActual) {
      const y = parseInt(añoSel, 10);
      const m = _mesToNum(mesSel);
      if (!y || !m) return null;
    
      if (incluirActual) return _ymToNum(y, m);
    
      const prev = _retroMes(m, y);
      return _ymToNum(prev.y, prev.m);
    }

    function _esAsesorNuevo(fechaIngreso, anclaYMNum, umbralMeses) {
      const ingresoYMNum = _fechaIngresoToYMNum(fechaIngreso);
      if (!ingresoYMNum || !anclaYMNum) return false;
    
      const mesesAntiguedad = anclaYMNum - ingresoYMNum;
      return mesesAntiguedad < umbralMeses;
    }
        
    // ===================== PERIODOS HACIA ATRÁS =====================
    
    // Devuelve N periodos hacia atrás
    // incluirActual = true  -> incluye mes seleccionado
    // incluirActual = false -> empieza desde el mes anterior
    function _getPeriodosAtras(mesNombre, anioStr, cantidad, incluirActual) {
      const m0 = _mesToNum(mesNombre);
      const y0 = parseInt(anioStr, 10);
      if (!m0 || !y0) return [];
    
      let m = m0;
      let y = y0;
    
      if (!incluirActual) {
        const r = _retroMes(m, y);
        m = r.m;
        y = r.y;
      }
    
      const out = [];
      while (out.length < cantidad) {
        const periodo = `${_numToMes(m)}_${y}`;
        if (!_esPeriodoExcluidoWeb(periodo)) {
          out.push(periodo);
        }
        const r2 = _retroMes(m, y);
        m = r2.m;
        y = r2.y;
      }
    
      return out.reverse(); // antiguo -> reciente
    }
    
    // ===================== MAPAS POR ALIAS =====================
    
    // Mapea datosMeses[periodo] por alias_crr
    function _mapPeriodoPorAlias(periodo) {
      const arr = datosMeses?.[periodo] || [];
      const map = new Map();
      arr.forEach(a => {
        const alias = (a.alias_crr || '').trim();
        if (alias) map.set(alias, a);
      });
      return map;
    }
    
    // Mapea baseAsesoresAnalisis[periodo] por alias_crr
    function _mapBasePeriodoPorAlias(periodo) {
      const arr = window.baseAsesoresAnalisis?.[periodo] || [];
      const map = new Map();
      arr.forEach(p => {
        const alias = (p.alias_crr || '').trim();
        if (alias) map.set(alias, p);
      });
      return map;
    }
    
    // ===================== CÁLCULOS =====================
    
    // Promedio seguro
    function _avg(nums) {
      if (!nums || !nums.length) return null;
      const s = nums.reduce((acc, x) => acc + x, 0);
      return s / nums.length;
    }
    
    // Clasificación por porcentaje
    function _clasificarPorcentaje(pct) {
      const v = Number(pct || 0);
      if (v > 100) return '>100%';
      if (v > 70) return '>70%';
      if (v > 40) return '>40%';
      return '>0%';
    }









    // ===================== MODAL DE DETALLE EVALUACIÓN =====================
    function _calcDetallePromedioEfectivo(alias, fechaIngreso, mesSel, añoSel, n, incluirActual) {
      const ingresoYM = _fechaIngresoToYMNum(fechaIngreso);
    
      const candidatos = _iterPeriodosAtras(mesSel, añoSel, incluirActual, 48);
    
      const incluidos = [];
      const filas = [];
    
      // ✅ ahora acumulamos alcances mensuales (fracción), no sumas
      const fracsMensuales = [];
    
      for (const periodo of candidatos) {
        if (incluidos.length >= n) break;
    
        const { y, m } = _periodoToYM(periodo);
        const ymNum = _ymToNum(y, m);
    
        // 1) Respeta fecha ingreso
        if (ingresoYM && ymNum < ingresoYM) {
          filas.push({
            periodo,
            estado: '—',
            meta: null,
            recupero: null,
            alcanceFrac: null,
            incluido: false,
            motivo: 'Anterior a fecha de inicio',
            q_alc: '',
            q_extra: {}
          });
          break;
        }
    
        // 2) Debe existir registro en base del periodo
        const mp = _getMapPeriodoCached(periodo);
        const reg = mp.get(alias);
    
        if (!reg) {
          filas.push({
            periodo,
            estado: '—',
            meta: null,
            recupero: null,
            alcanceFrac: null,
            incluido: false,
            motivo: 'Sin registro en base del periodo',
            q_alc: '',
            q_extra: {}
          });
          continue;
        }
    
        const estado = String(reg.estado || 'CALL').toUpperCase().trim();
        const meta = Number(reg.meta ?? 0);
        const recupero = Number(reg.recupero ?? 0);
    
        // 3) Solo CALL
        if (estado !== 'CALL') {
          filas.push({
            periodo,
            estado,
            meta,
            recupero,
            alcanceFrac: null,
            incluido: false,
            motivo: 'No activo (estado distinto a CALL)',
            q_alc: reg.q_alc || '',
            q_extra: _quintilesExtraEvaluacion(periodo, alias)
          });
          continue;
        }
    
        // 4) Meta > 0
        if (!(meta > 0)) {
          filas.push({
            periodo,
            estado,
            meta,
            recupero,
            alcanceFrac: null,
            incluido: false,
            motivo: 'Meta = 0 (no evaluable)',
            q_alc: reg.q_alc || '',
            q_extra: _quintilesExtraEvaluacion(periodo, alias)
          });
          continue;
        }
    
        // El alcance mensual final ya incorpora CSTC. Recupero y meta se conservan informativos.
        const alcanceFinal = _normPctToFrac(reg.alcance);
        const fracMes = alcanceFinal !== null ? alcanceFinal : (recupero / meta);
    
        incluidos.push(periodo);
        fracsMensuales.push(fracMes);
    
        filas.push({
          periodo,
          estado,
          meta,
          recupero,
          alcanceFrac: fracMes,
          incluido: true,
          motivo: 'Mes efectivo (CALL + meta>0)',
          q_alc: reg.q_alc || '',
          excepcion_alcance: Boolean(reg.excepcion_alcance),
          alcance_original: reg.alcance_original,
          q_extra: _quintilesExtraEvaluacion(periodo, alias)
        });
      }
    
      const mesesUsados = incluidos.length;
    
      // ✅ PROMEDIO SIMPLE de alcances mensuales
      let pct = null;
      if (fracsMensuales.length > 0) {
        const sum = fracsMensuales.reduce((a, b) => a + b, 0);
        pct = sum / fracsMensuales.length; // fracción 0..1
      }
    
      return {
        alias,
        fechaIngreso,
        nObjetivo: n,
        incluirActual,
        mesesUsados,
        incluidos,
        filas,
        pct
      };
    }

    // ===================== EXPORTAR ANALISIS (EVALUACIÓN) =====================
    async function exportarAnalisisEvaluacion() {
        const mesSeleccionado = document.getElementById('selectorMes')?.value;
        const añoSeleccionado = document.getElementById('selectorAño')?.value;
        const periodoFiltrado = `${mesSeleccionado}_${añoSeleccionado}`;
        
        if (!datosMeses?.[periodoFiltrado]) {
        alert('No hay datos para exportar');
        return;
        }
        
        // Vista Evaluación
        const n = _getNDesdeVistaEvaluacion();
        
        const periodosCols = _getPeriodosAtras(mesSeleccionado, añoSeleccionado, n + 1, true);
        
        const periodosCerrado = _getPeriodosAtras(mesSeleccionado, añoSeleccionado, n, false);
        
        const periodosActual = _getPeriodosAtras(mesSeleccionado, añoSeleccionado, n, true);
        
        const mapsPorPeriodo = {};
        [...new Set([...periodosCols, ...periodosCerrado, ...periodosActual])].forEach(p => {
        mapsPorPeriodo[p] = _mapBasePeriodoPorAlias(p);
        });
        
        const supervisorFiltro = _getSupervisorFiltroEvaluacion();
        
        let baseAsesores = (window.baseAsesoresAnalisis?.[periodoFiltrado] || []).slice();
        
        if (supervisorFiltro) {
          baseAsesores = baseAsesores.filter(p =>
            String(p.supervisor || '').trim() === supervisorFiltro
          );
        }
        
        const COLOR1 = 'FF0D47A1'; // azul oscuro
        const COLOR2 = 'FFFCCF10'; // amarillo
        const COLOR3 = 'FFFFB300'; // ambar
    
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('ANALISIS');
        
        // Encabezados
        const headersFijos = ['DNI', 'ALIAS', 'Fecha de Inicio', 'Estado'];
        const headersMeses = periodosCols;
        
        const headersCalc = [
          `ALCANCE_${n}M_CERRADO`,
          `ALCANCE_${n}M_ACTUAL`
        ];
        
        const headersFinal = ['CARTERA', 'EQUIPO'];
        const encabezados = [...headersFijos, ...headersMeses, ...headersCalc, ...headersFinal];
        
        ws.addRow(encabezados);
        
        const headerRow = ws.getRow(1);
        headerRow.height = 40;
        
        headerRow.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        };
        
        headerRow.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' }
        };
        
        // Fondo 
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0D47A1' }
          };
        });
        
        // Estilo encabezados por grupo
        headerRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        };
        
        const idxMesInicio = 5;
        const idxMesFin = 4 + headersMeses.length;
        const idxCalcInicio = idxMesFin + 1;
        const idxCalcFin = idxMesFin + headersCalc.length;
        const idxFinalInicio = idxCalcFin + 1;
        
        let fillColor = COLOR1;
        if (colNumber >= idxMesInicio && colNumber <= idxMesFin) fillColor = COLOR2;
        else if (colNumber >= idxCalcInicio && colNumber <= idxCalcFin) fillColor = COLOR3;
        else if (colNumber >= idxFinalInicio) fillColor = COLOR1;
        
        const textoNegro = (fillColor === COLOR2);
        cell.font = { bold: true, color: { argb: textoNegro ? 'FF000000' : 'FFFFFFFF' } };
        
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor }
        };
        });
        
        // Filas
        baseAsesores.forEach(asesorBase => {
        const alias = String(asesorBase.alias_crr || '').trim();
        const dni = String(asesorBase.dni || '').trim();
        const estado = String(asesorBase.estado || 'CALL').toUpperCase().trim();
        
        let fechaIngreso = String(asesorBase.fecha_inicio || '').trim();
        if (fechaIngreso.includes(' ')) fechaIngreso = fechaIngreso.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) {
          const [y, m, d] = fechaIngreso.split('-');
          fechaIngreso = `${d}/${m}/${y}`;
        }
        
        const supervisor = String(asesorBase.supervisor || '').trim();
        
        let cartera = '';
        try {
          cartera = String(
            datosSupervisores?.[supervisor]?.[periodoFiltrado]?.cartera || ''
          ).trim();
        } catch (e) {
          cartera = '';
        }
        
        const ingresoYM = _fechaIngresoToYMNum(fechaIngreso);
        
        // Valores por mes
        const alcances = [];
        periodosCols.forEach(p => {
          const { y, m } = _periodoToYM(p);
          const ymNum = _ymToNum(y, m);
        
          if (ingresoYM && ymNum < ingresoYM) {
            alcances.push("No participó");
            return;
          }
        
          const reg = mapsPorPeriodo[p]?.get(alias);
          if (!reg) {
            alcances.push("No participó");
            return;
          }
        
          const estadoReg = String(reg.estado || '').toUpperCase().trim();
        
          if (estadoReg === 'VACACIONES') {
            alcances.push("Vacaciones");
            return;
          }
        
          const val = reg.alcance;
          alcances.push((val === null || val === undefined) ? "No participó" : Number(val));
        });
        
        // Promedio cerrado
        const detCerrado = _calcDetallePromedioEfectivo(
          alias,
          fechaIngreso,
          mesSeleccionado,
          añoSeleccionado,
          n,
          false
        );
        
        // Promedio actual
        const detActual = _calcDetallePromedioEfectivo(
          alias,
          fechaIngreso,
          mesSeleccionado,
          añoSeleccionado,
          n,
          true
        );

        const promCerrado = detCerrado?.pct ?? null;
        const promActual  = detActual?.pct ?? null;
        
        const row = [
          dni,
          alias,
          fechaIngreso,
          estado,
          ...alcances,
          promCerrado,
          promActual,
          cartera,
          supervisor
        ];
        
        ws.addRow(row);
        });
        
        // Formatos de columnas
        ws.getColumn(1).numFmt = '@'; // DNI como texto
        
        const colMesInicio = 5;
        const colMesFin = 4 + periodosCols.length;
        for (let c = colMesInicio; c <= colMesFin; c++) {
        ws.getColumn(c).numFmt = '0.00%';
        }
        ws.getColumn(colMesFin + 1).numFmt = '0.00%';
        ws.getColumn(colMesFin + 2).numFmt = '0.00%';
        
        // Auto ancho simple
        ws.columns.forEach(col => {
        col.width = 18;
        });
        ws.getColumn(2).width = 28; // alias
        ws.getColumn(3).width = 16; // fecha
        ws.getColumn(9 + periodosCols.length).width = 22;
        
        // Guardar
        const fechaHoy = new Date();
        const yy = fechaHoy.getFullYear();
        const mm = String(fechaHoy.getMonth() + 1).padStart(2, '0');
        const dd = String(fechaHoy.getDate()).padStart(2, '0');
        const stamp = `${yy}${mm}${dd}`;
        
        const sufSupervisor = supervisorFiltro
          ? `_${supervisorFiltro.replace(/[\\/:*?"<>|]/g, '_')}`
          : '_TODOS';
        
        const nombreArchivo = `Analisis_Evaluacion${sufSupervisor}_${periodoFiltrado}_${stamp}.xlsx`;
        
        const buffer = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }), nombreArchivo);
    }

    // ===================== EXPORTAR QUINTILES (EVALUACION) =====================
    async function exportarQuintilesEvaluacionPromedios() {
      const rows = Array.isArray(window.__evalQuintilExportRows)
        ? window.__evalQuintilExportRows.filter(row => row?.asesor)
        : [];

      if (!rows.length) {
        alert('No hay quintiles de evaluacion para exportar');
        return;
      }

      const mesSeleccionado = document.getElementById('selectorMes')?.value || '';
      const anioSeleccionado = document.getElementById('selectorAño')?.value || '';
      const periodoFiltrado = mesSeleccionado && anioSeleccionado ? `${mesSeleccionado}_${anioSeleccionado}` : 'PERIODO';
      const supervisorFiltro = _getSupervisorFiltroEvaluacion();

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Ranking Evaluacion';
      wb.created = new Date();
      const ws = wb.addWorksheet('QUINTILES');

      ws.addRow(['Asesor', 'Promedio', 'Quintil']);
      const header = ws.getRow(1);
      header.height = 28;
      header.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9E2EC' } },
          left: { style: 'thin', color: { argb: 'FFD9E2EC' } },
          bottom: { style: 'thin', color: { argb: 'FFD9E2EC' } },
          right: { style: 'thin', color: { argb: 'FFD9E2EC' } }
        };
      });

      const colorPorQuintil = {
        Q5: 'FFD6F1FF',
        Q4: 'FFDDF7F3',
        Q3: 'FFFFF4C2',
        Q2: 'FFFFE2C2',
        Q1: 'FFFFD6D6'
      };

      rows.forEach(row => {
        const promedioNum = Number(row.promedio);
        const excelRow = ws.addRow([
          row.asesor,
          Number.isFinite(promedioNum) ? promedioNum : null,
          row.quintil
        ]);
        excelRow.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE8EEF5' } },
            left: { style: 'thin', color: { argb: 'FFE8EEF5' } },
            bottom: { style: 'thin', color: { argb: 'FFE8EEF5' } },
            right: { style: 'thin', color: { argb: 'FFE8EEF5' } }
          };
          cell.alignment = { vertical: 'middle' };
        });
        excelRow.getCell(2).numFmt = '0.00%';
        excelRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
        excelRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        excelRow.getCell(3).font = { bold: true };
        excelRow.eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorPorQuintil[row.quintil] || 'FFFFFFFF' }
          };
        });
      });

      ws.columns = [
        { key: 'asesor', width: 34 },
        { key: 'promedio', width: 14 },
        { key: 'quintil', width: 12 }
      ];
      ws.autoFilter = { from: 'A1', to: `C${Math.max(rows.length + 1, 1)}` };
      ws.views = [{ state: 'frozen', ySplit: 1 }];

      const fechaHoy = new Date();
      const yy = fechaHoy.getFullYear();
      const mm = String(fechaHoy.getMonth() + 1).padStart(2, '0');
      const dd = String(fechaHoy.getDate()).padStart(2, '0');
      const stamp = `${yy}${mm}${dd}`;
      const sufSupervisor = supervisorFiltro
        ? `_${supervisorFiltro.replace(/[\\/:*?"<>|]/g, '_')}`
        : '_TODOS';
      const nombreArchivo = `Quintiles_Evaluacion${sufSupervisor}_${periodoFiltrado}_${stamp}.xlsx`;

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }), nombreArchivo);
    }

    // ===================== EXPORTAR RyM =====================

    async function exportarRecuperoYMetasEvaluacion() {
      const mesSeleccionado = document.getElementById('selectorMes')?.value;
      const añoSeleccionado = document.getElementById('selectorAño')?.value;
      const periodoFiltrado = `${mesSeleccionado}_${añoSeleccionado}`;
    
      if (!datosMeses?.[periodoFiltrado]) {
        alert('No hay datos para exportar');
        return;
      }
    
      const n = _getNDesdeVistaEvaluacion();
      const incluirMesSeleccionado = !!document.getElementById('chkIncluirMesSeleccionadoEval')?.checked;
      const cantidad = incluirMesSeleccionado ? (n + 1) : n;
      const incluirMesFlag = incluirMesSeleccionado ? true : false;
      const periodos = _getPeriodosAtras(mesSeleccionado, añoSeleccionado, cantidad, incluirMesFlag);
    
      if (!periodos?.length) {
        alert('No se pudieron calcular los periodos');
        return;
      }
    
      // Mapas por periodo para encontrar rápido por alias_crr
      const mapsBase = {};
      periodos.forEach(p => {
        mapsBase[p] = _mapBasePeriodoPorAlias(p);
      });
    
      // Base (misma lista que EXPORTAR ANALISIS)
        const supervisorFiltro = _getSupervisorFiltroEvaluacion();
        
        let baseAsesores = (window.baseAsesoresAnalisis?.[periodoFiltrado] || []).slice();
        
        if (supervisorFiltro) {
          baseAsesores = baseAsesores.filter(p =>
            String(p.supervisor || '').trim() === supervisorFiltro
          );
        }
        
      if (!baseAsesores.length) {
        alert('No hay base de asesores para este periodo');
        return;
      }
    
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('RECUPERO_METAS');
    
      // Encabezados
      const headersFijos = ['DNI', 'ALIAS', 'Fecha de Inicio'];
      const headersMeses = [];
    
      periodos.forEach(p => {
        headersMeses.push(`RECUPERO\n${p}`); // doble línea
        headersMeses.push(`META\n${p}`);     // doble línea
      });
    
      const headersFinal = ['SUPERVISOR'];
    
      const COLOR_RECUPERO = 'FFFF9800'; // naranja
      const COLOR_META     = 'FFD32F2F'; // rojo
      const COLOR_FIJO     = 'FF0D47A1'; // azul (para fijos + supervisor)
    
      ws.addRow([ ...headersFijos, ...headersMeses, ...headersFinal ]);
    
      const headerRow = ws.getRow(1);
    
      headerRow.height = 40;
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
      // encabezados
      headerRow.eachCell((cell) => {
        const text = String(cell.value || '').toUpperCase();
    
        if (text.startsWith('RECUPERO')) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLOR_RECUPERO }
          };
          return;
        }
    
        if (text.startsWith('META')) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLOR_META }
          };
          return;
        }
    
        // Fijos (DNI/ALIAS/Fecha) + SUPERVISOR
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR_FIJO }
        };
      });
    
      // Filas
      baseAsesores.forEach(p => {
        const alias = (p.alias_crr || '').trim();
        if (!alias) return;
    
        const dni = (p.dni || '').toString();
        const fechaIngreso = (p.fecha_inicio || '').toString();
        const supervisorBase = (p.supervisor || '').toString();
    
        const valoresMeses = [];
        let supervisor = supervisorBase;
    
        periodos.forEach(periodo => {
          const regBase = mapsBase[periodo]?.get(alias);
    
          // Respeta ingreso
          if (!_mesEsValidoParaIngreso(periodo, fechaIngreso)) {
            valoresMeses.push('');
            valoresMeses.push('');
            return;
          }
    
          const rec = regBase ? Number(regBase.recupero || 0) : 0;
          const met = regBase ? Number(regBase.meta || 0) : 0;
    
          valoresMeses.push(rec);
          valoresMeses.push(met);
        });
    
        const row = [
          dni,
          alias,
          fechaIngreso,
          ...valoresMeses,
          supervisor || ''
        ];
    
        ws.addRow(row);
      });
    
      // Formatos
      ws.getColumn(1).numFmt = '@'; // DNI texto
      ws.getColumn(2).width = 28;
      ws.getColumn(3).width = 16;
    
      // Columnas numéricas (recupero/meta)
      const colNumInicio = 4;
      const colNumFin = 3 + headersMeses.length;
      for (let c = colNumInicio; c <= colNumFin; c++) {
        ws.getColumn(c).numFmt = '#,##0.00';
        ws.getColumn(c).width = 16;
      }
    
      // Supervisor
      ws.getColumn(colNumFin + 1).width = 22;
    
      // Guardar
      const fechaHoy = new Date();
      const yy = fechaHoy.getFullYear();
      const mm = String(fechaHoy.getMonth() + 1).padStart(2, '0');
      const dd = String(fechaHoy.getDate()).padStart(2, '0');
      const stamp = `${yy}${mm}${dd}`;
      const suf = incluirMesSeleccionado ? 'INCLUYE_MES' : 'SOLO_ANTERIORES';
      const sufSupervisor = supervisorFiltro
          ? `_${supervisorFiltro.replace(/[\\/:*?"<>|]/g, '_')}`
          : '_TODOS';
        
      const nombreArchivo = `Recupero_Metas${sufSupervisor}_${n}M_${suf}_${periodoFiltrado}_${stamp}.xlsx`;
    
      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }), nombreArchivo);
    }

    function _parseFechaIngreso(fechaStr) {
    if (!fechaStr) return null;
    const s = String(fechaStr).trim();
    
    // Caso: "2023-12-21 00:00:00" o "2023-12-21"
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
    const y = Number(iso[1]), m = Number(iso[2]), d = Number(iso[3]);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
    }
    
    // Caso: "dd/mm/yyyy"
    const latam = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (latam) {
    const d = Number(latam[1]), m = Number(latam[2]), y = Number(latam[3]);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
    }
    
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
    }
    
    function _finDeMes(periodo) {
    // periodo: "DICIEMBRE_2025"
    const [mesTxt, anioTxt] = String(periodo || '').split('_');
    const y = Number(anioTxt);
    
    const meses = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
    'JULIO': 6, 'AGOSTO': 7, 'SETIEMBRE': 8, 'SEPTIEMBRE': 8, 'OCTUBRE': 9,
    'NOVIEMBRE': 10, 'DICIEMBRE': 11
    };
    
    const m = meses[String(mesTxt || '').toUpperCase()];
    if (m === undefined || isNaN(y)) return null;
    
    // último día del mes: (mes+1, día 0)
    return new Date(y, m + 1, 0, 23, 59, 59);
    }
    
    function _mesEsValidoParaIngreso(periodo, fechaIngresoStr) {
    const ingreso = _parseFechaIngreso(fechaIngresoStr);
    if (!ingreso) return true; // si no hay fecha, no bloqueamos
    
    const finMes = _finDeMes(periodo);
    if (!finMes) return true;
    
    // “mostrar info si el asesor ya estaba contratado en ese mes”
    return ingreso <= finMes;
    }
    
    // Hooks (EVALUACIÓN)
    
    document.getElementById('btnEval3Meses')
      ?.addEventListener('click', () => setVistaEvaluacion('3M'));
    
    document.getElementById('btnEval6Meses')
      ?.addEventListener('click', () => setVistaEvaluacion('6M'));

    document.getElementById('btnEval12Meses')
      ?.addEventListener('click', () => setVistaEvaluacion('12M'));

    document.getElementById('btnEvalOtros')
      ?.addEventListener('click', () => setModoOtrosEvaluacion(!modoOtrosEvaluacion));
    
    document.getElementById('chkIncluirMesSeleccionadoEval')
      ?.addEventListener('change', (e) => {
        incluirMesSeleccionadoEval = !!e.target.checked;
        actualizarTarjetasEvaluacionRapida();
      });
    
    document.getElementById('chkMostrarAsesoresNuevosEval')
      ?.addEventListener('change', () => {
        actualizarTarjetasEvaluacionRapida();
      });
    
    document.getElementById('btnEvalExportarAnalisis')
      ?.addEventListener('click', async () => {
        await exportarAnalisisEvaluacion();
      });

    document.getElementById('btnEvalExportarRecuperoMetas')
      ?.addEventListener('click', async () => {
        await exportarRecuperoYMetasEvaluacion();
      });

    document.getElementById('btnEvalExportarQuintiles')
      ?.addEventListener('click', async () => {
        await exportarQuintilesEvaluacionPromedios();
      });


    // Estado inicial
    setVistaEvaluacion('3M');
    calcularPeriodoPrueba();

    // ====================== FUNCIONES PARA PERIODO DE PRUEBA ======================
    function agregarAsesorPeriodo() {
        const input = document.getElementById('inputBusquedaPeriodo');
        const nombreAsesor = input.value.trim();
        
        if (nombreAsesor && !asesoresSeleccionadosPeriodo.has(nombreAsesor)) {
            asesoresSeleccionadosPeriodo.add(nombreAsesor);
            actualizarAsesoresSeleccionadosPeriodo();
            input.value = '';
        }
    }

    // SELECCIÓN POR FECHA DE INICIO
    
    function _parseFechaFlexible(s) {
      if (!s) return null;
      const str = String(s).trim();
      if (!str) return null;
    
      // yyyy-mm-dd (input type="date")
      let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
        const dt = new Date(y, mo, d);
        return isNaN(dt.getTime()) ? null : dt;
      }
    
      // dd/mm/yyyy o d/m/yyyy
      m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3]);
        const dt = new Date(y, mo, d);
        return isNaN(dt.getTime()) ? null : dt;
      }
    
      const dt = new Date(str);
      return isNaN(dt.getTime()) ? null : dt;
    }
    
    function _getPeriodoHeader() {
      const mesSeleccionado = document.getElementById('selectorMes')?.value;
      const añoSeleccionado = document.getElementById('selectorAño')?.value;
      if (!mesSeleccionado || !añoSeleccionado) return null;
      return { mes: mesSeleccionado, año: añoSeleccionado, periodo: `${mesSeleccionado}_${añoSeleccionado}` };
    }

    function _getFechaIngresoDesdeHeaderBase_GLOBAL(alias) {
      const al = String(alias || '').trim();
      if (!al) return '';
    
      const headMes = document.getElementById('selectorMes')?.value;
      const headAño = document.getElementById('selectorAño')?.value;
      const periodoHead = (headMes && headAño) ? `${headMes}_${headAño}` : '';
      if (!periodoHead) return '';
    
      const base = window.baseAsesoresAnalisis?.[periodoHead];
      if (!Array.isArray(base)) return '';
    
      const r = base.find(b => String(b.alias_crr || '').trim() === al);
      if (!r) return '';
    
      // Normalización igual a tu lógica
      let fi = String(r.fecha_inicio || '').trim();
      if (!fi) return '';
      if (fi.includes(' ')) fi = fi.split(' ')[0];
    
      if (/^\d{4}-\d{2}-\d{2}$/.test(fi)) {
        const [y, m, d] = fi.split('-');
        fi = `${d}/${m}/${y}`;
      }
      return fi;
    }
    
    function _getBasePeriodo(periodo) {
      const base = window.baseAsesoresAnalisis ? window.baseAsesoresAnalisis[periodo] : null;
      return Array.isArray(base) ? base : [];
    }
    
    function aplicarAutoSeleccionIngresoRango() {
      calcularPeriodoPrueba();
    }
    
    function eliminarAsesorPeriodo(nombre) {
        asesoresSeleccionadosPeriodo.delete(nombre);
        actualizarAsesoresSeleccionadosPeriodo();
    }
    
    function actualizarAsesoresSeleccionadosPeriodo() {
        const container = document.getElementById('asesoresSeleccionadosPeriodo');
        if (!container) return;
        
        container.innerHTML = '';
        
        asesoresSeleccionadosPeriodo.forEach(asesor => {
            const tag = document.createElement('div');
            tag.className = 'tag-elemento';
            tag.innerHTML = `
                ${asesor}
                <button class="eliminar-elemento" onclick="eliminarAsesorPeriodo('${asesor}')">×</button>
            `;
            container.appendChild(tag);
        });
    }
    
    function limpiarPeriodoPrueba() {
        // Limpiar selects
        const selects = ['mes1', 'año1', 'mes2', 'año2', 'mes3', 'año3'];
        selects.forEach(id => {
            const select = document.getElementById(id);
            if (select) select.value = '';
        });
        
        // Limpiar porcentaje mínimo
        const porcentajeInput = document.getElementById('porcentajeMinimo');
        if (porcentajeInput) porcentajeInput.value = '70';
        
        // Limpiar input de búsqueda
        const inputBusqueda = document.getElementById('inputBusquedaPeriodo');
        if (inputBusqueda) inputBusqueda.value = '';
        
        // Limpiar asesores seleccionados
        asesoresSeleccionadosPeriodo.clear();
        actualizarAsesoresSeleccionadosPeriodo();

        // Limpiar selectores de nuevos asesores
        const inpF = document.getElementById('selectorFechaIngresoDesde');
        if (inpF) inpF.value = '';
        
        const inpH = document.getElementById('selectorFechaIngresoHasta');
        if (inpH) inpH.value = '';
        
        // Ocultar resultados
        const resultadosDiv = document.getElementById('resultadosPeriodo');
        if (resultadosDiv) resultadosDiv.style.display = 'none';
    }

    function activarOrdenamientoTablaPeriodoPonderado() {
      const tabla = document.getElementById('tablaPeriodoPonderado');
      if (!tabla) return;
    
      const thead = tabla.querySelector('thead');
      const tbody = tabla.querySelector('tbody');
      if (!thead || !tbody) return;
    
      const headers = Array.from(thead.querySelectorAll('th.sortable'));
    
      const _parseNum = (txt) => {
        const t = String(txt || '').replace(/\s+/g, ' ').trim();
        const cleaned = t
          .replace(/S\/\s*/gi, '')
          .replace(/%/g, '')
          .replace(/,/g, '');
        const m = cleaned.match(/-?\d+(\.\d+)?/);
        return m ? Number(m[0]) : 0;
      };
    
      const _parseDate = (txt) => {
        const t = String(txt || '').trim();
        if (!t || t === '—') return null;
    
        // yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
          const d = new Date(t + 'T00:00:00');
          return isNaN(d.getTime()) ? null : d;
        }
    
        // dd/mm/yyyy
        const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) {
          const dd = Number(m[1]);
          const mm = Number(m[2]) - 1;
          const yy = Number(m[3]);
          const d = new Date(yy, mm, dd);
          return isNaN(d.getTime()) ? null : d;
        }
    
        const d = new Date(t);
        return isNaN(d.getTime()) ? null : d;
      };
    
      headers.forEach((th, colIndex) => {
        th.style.cursor = 'pointer';
    
        th.addEventListener('click', () => {
          const sortType = String(th.dataset.sort || 'text').toLowerCase();
          const isDate = sortType === 'date';
    
          // FECHA: siempre asc (menor -> mayor)
          // NO-FECHA: toggle desc/asc (por defecto desc)
          const prev = th.dataset.order || (isDate ? 'asc' : 'desc');
          const next = isDate ? 'asc' : (prev === 'desc' ? 'asc' : 'desc');
    
          // limpiar estado de otros headers
          headers.forEach(h => { if (h !== th) h.dataset.order = ''; });
          th.dataset.order = next;
    
          const rows = Array.from(tbody.querySelectorAll('tr'));
    
          rows.sort((ra, rb) => {
            const aCell = ra.children[colIndex];
            const bCell = rb.children[colIndex];
            const aTxt = aCell ? aCell.textContent : '';
            const bTxt = bCell ? bCell.textContent : '';
    
            if (isDate) {
              const da = _parseDate(aTxt);
              const db = _parseDate(bTxt);
              // nulos al final
              if (!da && !db) return 0;
              if (!da) return 1;
              if (!db) return -1;
              return da - db; // asc fijo
            }
    
            if (sortType === 'num') {
              const na = _parseNum(aTxt);
              const nb = _parseNum(bTxt);
              return next === 'desc' ? (nb - na) : (na - nb);
            }
    
            // text
            const ta = String(aTxt || '').trim().toUpperCase();
            const tb = String(bTxt || '').trim().toUpperCase();
            return next === 'desc' ? tb.localeCompare(ta) : ta.localeCompare(tb);
          });
    
          rows.forEach(r => tbody.appendChild(r));
        });
      });
    }
    
    function calcularPeriodoPrueba() {
      const mesSeleccionado = document.getElementById('selectorMes')?.value || '';
      const anioSeleccionado = document.getElementById('selectorA\u00f1o')?.value || '';
      const periodoFiltrado = (mesSeleccionado && anioSeleccionado) ? `${mesSeleccionado}_${anioSeleccionado}` : '';

      const resultadosDiv = document.getElementById('resultadosPeriodo');
      const tablaDiv = document.getElementById('tablaPeriodo');
      if (!resultadosDiv || !tablaDiv) return;

      if (!periodoFiltrado || !Array.isArray(window.baseAsesoresAnalisis?.[periodoFiltrado])) {
        tablaDiv.innerHTML = '<div style="padding:18px; text-align:center; color:#666;">Selecciona un mes/anio con base disponible.</div>';
        resultadosDiv.style.display = 'block';
        return;
      }

      const porcentajeMinimo = Number(document.getElementById('porcentajeMinimo')?.value || 70);
      const omitirPrimerMes = !!document.getElementById('chkOmitirPrimerMesPeriodo')?.checked;
      const filtrarPeriodoCumplido = !!document.getElementById('chkFiltrarPeriodoCumplido')?.checked;

      const periodosBase = _getPeriodosAtras(mesSeleccionado, anioSeleccionado, 3, true);
      const periodos = omitirPrimerMes ? periodosBase.slice(1) : periodosBase.slice();

      if (!periodos.length) {
        tablaDiv.innerHTML = '<div style="padding:18px; text-align:center; color:#666;">No hay periodos disponibles para evaluar.</div>';
        resultadosDiv.style.display = 'block';
        return;
      }

      const periodoInicio = periodosBase[0];
      const { y: yInicio, m: mInicio } = _periodoToYM(periodoInicio);
      const { y: yFin, m: mFin } = _periodoToYM(periodosBase[periodosBase.length - 1]);
      const inicioVentana = new Date(yInicio, mInicio - 1, 1);
      const finVentana = new Date(yFin, mFin, 0, 23, 59, 59, 999);

      const fechaDesdeUI = document.getElementById('selectorFechaIngresoDesde')?.value;
      const fechaHastaUI = document.getElementById('selectorFechaIngresoHasta')?.value;
      let desde = fechaDesdeUI ? _parseFechaFlexible(fechaDesdeUI) : inicioVentana;
      let hasta = fechaHastaUI ? _parseFechaFlexible(fechaHastaUI) : finVentana;
      if (desde) desde.setHours(0,0,0,0);
      if (hasta) hasta.setHours(23,59,59,999);
      if (desde && hasta && desde > hasta) {
        const tmp = desde; desde = hasta; hasta = tmp;
      }

      const supervisorFiltro = _getSupervisorFiltroEvaluacion();
      let baseActual = filtrarAsesoresPorCanal(
        (window.baseAsesoresAnalisis?.[periodoFiltrado] || []).slice()
      );
      if (supervisorFiltro) {
        baseActual = baseActual.filter(p => String(p.supervisor || '').trim() === supervisorFiltro);
      }

      const indexPorPeriodo = {};
      periodos.forEach(p => {
        const idx = {};
        const baseP = filtrarAsesoresPorCanal(window.baseAsesoresAnalisis?.[p] || []);
        baseP.forEach(r => {
          const al = String(r.alias_crr || '').trim().toUpperCase();
          if (!al) return;
          if (!idx[al]) {
            idx[al] = {
              alias_crr: al,
              recupero: Number(r.recupero) || 0,
              meta: Number(r.meta) || 0,
              alcance_suma: Number(r.alcance) || 0,
              alcance_count: 1
            };
          } else {
            idx[al].recupero += Number(r.recupero) || 0;
            idx[al].meta += Number(r.meta) || 0;
            idx[al].alcance_suma += Number(r.alcance) || 0;
            idx[al].alcance_count += 1;
          }
        });
        Object.values(idx).forEach(d => {
          d.alcance = d.alcance_count > 0 ? (d.alcance_suma / d.alcance_count) : 0;
        });
        indexPorPeriodo[p] = idx;
      });

      const formatoNumero = (numero) => Number(numero || 0).toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      const _normAliasLocal = (v) => String(v || '').trim().toUpperCase();
      const _getNombreMostrarNuevo = (r) => String(r.nombre || r.staff || r.asesor || r.alias_crr || '').trim() || '?';
      const _getFechaIngresoNormalizada = (r) => {
        let fi = String(r.fecha_inicio || '').trim();
        if (fi.includes(' ')) fi = fi.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(fi)) {
          const [y, m, d] = fi.split('-');
          fi = `${d}/${m}/${y}`;
        }
        return fi;
      };

      const _renderPeriodoInfo = (p, alias) => {
        const d = indexPorPeriodo[p]?.[_normAliasLocal(alias)];
        if (!d) return '&mdash;';
        const rec = Number(d.recupero) || 0;
        const meta = Number(d.meta) || 0;
        const alcance = Number(d.alcance) || 0;
        return `
          <div style="text-align:right;">
            <div><strong>S/ ${formatoNumero(rec)}</strong></div>
            <div style="color:#666; font-size:0.9em;">Meta: S/ ${formatoNumero(meta)}</div>
            <div style="color:#2980b9; font-size:0.9em; font-weight:700;">Alcance: ${(alcance * 100).toFixed(2)}%</div>
          </div>
        `;
      };

      const vistos = new Set();
      const nuevos = [];

      baseActual.forEach(r => {
        const alias = String(r.alias_crr || '').trim();
        const aliasKey = _normAliasLocal(alias);
        if (!alias || vistos.has(aliasKey)) return;
        vistos.add(aliasKey);

        const estado = String(r.estado || 'CALL').toUpperCase().trim();
        if (estado !== 'CALL') return;

        const fechaIngresoTxt = _getFechaIngresoNormalizada(r);
        const fechaIngreso = _parseFechaFlexible(fechaIngresoTxt);
        if (!fechaIngreso) return;
        fechaIngreso.setHours(0,0,0,0);

        if (fechaIngreso < inicioVentana || fechaIngreso > finVentana) return;
        if (desde && fechaIngreso < desde) return;
        if (hasta && fechaIngreso > hasta) return;

        const ingresoYMNum = _fechaIngresoToYMNum(fechaIngresoTxt);
        const periodosCumplidos = periodosBase.filter(periodo => {
          const { y, m } = _periodoToYM(periodo);
          return _ymToNum(y, m) >= ingresoYMNum;
        }).length;

        if (filtrarPeriodoCumplido && periodosCumplidos < 3) return;

        nuevos.push({
          alias,
          aliasKey,
          nombre: _getNombreMostrarNuevo(r),
          fechaIngresoTxt,
          supervisor: String(r.supervisor || '').trim(),
          periodosCumplidos
        });
      });

      nuevos.sort((a, b) => {
        const fa = _parseFechaFlexible(a.fechaIngresoTxt)?.getTime() || 0;
        const fb = _parseFechaFlexible(b.fechaIngresoTxt)?.getTime() || 0;
        return fb - fa;
      });

      let html = '<div class="contenedor-tabla-scroll"><table class="tabla-comparacion" id="tablaPeriodoPonderado">';
      html += '<thead><tr>';
      html += '<th class="sortable" data-sort="text">Asesor</th>';
      html += '<th class="sortable" data-sort="date">Fecha de Inicio</th>';
      periodos.forEach((p, idx) => {
        html += `<th class="sortable" data-sort="num">PERIODO ${idx + 1}<br><span style="font-weight:400; font-size:0.85em;">${p.replace('_',' ')}</span></th>`;
      });
      html += '<th class="sortable" data-sort="num">Total Recupero</th>';
      html += '<th class="sortable" data-sort="num">Total Meta</th>';
      html += '<th class="sortable" data-sort="num">% Calculado</th>';
      html += '<th class="sortable" data-sort="text">Estado</th>';
      html += '<th class="sortable" data-sort="num">Falta Recuperar</th>';
      html += '</tr></thead><tbody>';

      let sumaRecuperoGeneral = 0;
      let sumaMetaGeneral = 0;

      nuevos.forEach(item => {
        let totalRecupero = 0;
        let totalMeta = 0;

        periodos.forEach(p => {
          const d = indexPorPeriodo[p]?.[item.aliasKey];
          if (d) {
            totalRecupero += Number(d.recupero) || 0;
            totalMeta += Number(d.meta) || 0;
          }
        });

        const pct = (totalMeta > 0) ? (totalRecupero / totalMeta) * 100 : 0;
        const estado = (pct >= porcentajeMinimo)
          ? '<span style="color:#27ae60; font-weight:700;">&#10003; Supera</span>'
          : '<span style="color:#e74c3c; font-weight:700;">&#10007; No supera</span>';

        const falta = (pct < porcentajeMinimo && totalMeta > 0)
          ? Math.max(0, (totalMeta * (porcentajeMinimo / 100)) - totalRecupero)
          : 0;
        const faltaHtml = `<strong style="color:${falta > 0 ? '#e74c3c' : '#27ae60'};">S/ ${formatoNumero(falta)}</strong>`;

        sumaRecuperoGeneral += totalRecupero;
        sumaMetaGeneral += totalMeta;

        html += `<tr>
          <td style="text-align:left; padding-left:15px;"><strong>${item.nombre}</strong><div style="font-size:0.85em; color:#666;">SUP: ${item.supervisor || '&mdash;'}</div></td>
          <td>${item.fechaIngresoTxt || '&mdash;'}</td>
          ${periodos.map(p => `<td>${_renderPeriodoInfo(p, item.alias)}</td>`).join('')}
          <td class="numero-grande"><strong style="color:#27ae60;">S/ ${formatoNumero(totalRecupero)}</strong></td>
          <td class="numero-grande"><strong style="color:#2c3e50;">S/ ${formatoNumero(totalMeta)}</strong></td>
          <td><strong style="color:#2980b9;">${pct.toFixed(2)}%</strong></td>
          <td>${estado}</td>
          <td class="numero-grande">${faltaHtml}</td>
        </tr>`;
      });

      if (!nuevos.length) {
        const colspan = 7 + periodos.length;
        html += `<tr><td colspan="${colspan}" style="padding:18px; text-align:center; color:#666;">No hay asesores nuevos para los filtros actuales.</td></tr>`;
      }

      html += '</tbody></table></div>';
      const pctGeneral = sumaMetaGeneral > 0 ? (sumaRecuperoGeneral / sumaMetaGeneral) * 100 : 0;
      html += `
        <div style="margin-top:12px; text-align:center; color:#2c3e50; font-weight:700;">
          Nuevos detectados: ${nuevos.length} &middot; Periodos evaluados: ${periodos.map(p => p.replace('_',' ')).join(', ')} &middot; Alcance ponderado general: ${pctGeneral.toFixed(2)}%
        </div>
      `;

      tablaDiv.innerHTML = html;
      resultadosDiv.style.display = 'block';
      activarOrdenamientoTablaPeriodoPonderado();
    }

    function toggleModoPromedioPeriodo() {
      modoPromedioPeriodo = !modoPromedioPeriodo;
    
      const btn = document.getElementById('btnModoPromedioPeriodo');
    
      if (btn) {
        btn.textContent = modoPromedioPeriodo
          ? '% Calculado (promedio)'
          : '% Calculado (ponderado)';
    
        btn.style.background = modoPromedioPeriodo ? '#d6eaf8' : '#ecf0f1';
      }
    
      calcularPeriodoPrueba();
    }
    
    // ========== NUEVA FUNCIÓN AUXILIAR ==========
    function segundosAHorasMinutosSegundos(segundosTotales) {
        // Convierte segundos totales a formato HH:MM:SS
        const horas = Math.floor(segundosTotales / 3600);
        const minutos = Math.floor((segundosTotales % 3600) / 60);
        const segundos = Math.floor(segundosTotales % 60);
        
        return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
    }
    
    // ========== FUNCIONES AUXILIARES EXISTENTES ==========
    
    function convertirFechaExcelAFechaKey(fechaExcel) {
        // Convierte formato DD/MM/YYYY a YYYY-MM-DD
        try {
            const [dia, mes, año] = fechaExcel.split('/');
            return `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        } catch {
            return fechaExcel;
        }
    }
    
    function formatearHora(valor) {
      if (valor === null || valor === undefined || valor === '') return '';
    
      // Si viene como Date
      if (valor instanceof Date && !isNaN(valor)) {
        const hh = String(valor.getHours()).padStart(2, '0');
        const mm = String(valor.getMinutes()).padStart(2, '0');
        const ss = String(valor.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      }
    
      const s = String(valor).trim();
    
      // Si ya viene como HH:MM o HH:MM:SS
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
        const parts = s.split(':');
        const hh = String(parseInt(parts[0], 10)).padStart(2, '0');
        const mm = String(parseInt(parts[1], 10)).padStart(2, '0');
        const ss = String(parseInt(parts[2] || '0', 10)).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      }
    
      // Si viene como decimal Excel (ej: 0.2917013889)
      const n = Number(s);
      if (Number.isFinite(n)) {
        const totalSeg = Math.round(n * 24 * 60 * 60);
        const hh = String(Math.floor(totalSeg / 3600)).padStart(2, '0');
        const mm = String(Math.floor((totalSeg % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSeg % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      }
    
      return '';
    }
    
    function convertirHoraASegundos(horaStr) {
        // Convierte HH:MM:SS a segundos totales
        try {
            const [horas, minutos, segundos] = horaStr.split(':').map(Number);
            return horas * 3600 + minutos * 60 + segundos;
        } catch {
            return 0;
        }
    }
    
    // ========== INICIALIZACIÓN SIMPLIFICADA ==========
    alCargarDOM(function() {
        
        // 1. INICIALIZAR FILTROS GLOBALES UNA VEZ
        const mesSeleccionado = document.getElementById('selectorMes').value;
        const añoSeleccionado = document.getElementById('selectorAño').value;
        const periodoCompleto = `${mesSeleccionado}_${añoSeleccionado}`;
        
        if (datosMeses[periodoCompleto]) {
            actualizarFiltrosGlobales();
        }
        
        // Los selectores del periodo se conectan una sola vez en la inicialización principal.

    });

    // ========== INICIALIZACIÓN ==========
    alCargarDOM(function() {
        // Inicializar la sección de ranking por defecto
        const mesSeleccionado = document.getElementById('selectorMes').value;
        const añoSeleccionado = document.getElementById('selectorAño').value;
        actualizarPeriodo();
        actualizarSelectorMesSegunAñoHeader();
    
        // actualizarPeriodo() ya actualizó filtros, ranking y supervisor activo.
        // Permitir agregar asesor con Enter
        const inputBusqueda = document.getElementById('inputBusqueda');
        if (inputBusqueda) {
            inputBusqueda.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    agregarAsesor();
                }
            });
        }
        
        // Permitir agregar supervisor con Enter
        const inputBusquedaSupervisor = document.getElementById('inputBusquedaSupervisor');
        if (inputBusquedaSupervisor) {
            inputBusquedaSupervisor.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    agregarSupervisor();
                }
            });
        }
        
        // Permitir agregar asesor periodo con Enter
        const inputBusquedaPeriodo = document.getElementById('inputBusquedaPeriodo');
        if (inputBusquedaPeriodo) {
            inputBusquedaPeriodo.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    agregarAsesorPeriodo();
                }
            });
        }
    
        // Los selectores ejecutan actualizarPeriodo directamente mediante onchange.
        });

        function calcularNecesarioParaObjetivoEval(objetivoDecimal, det, alias) {
          const resultado = {
            textoMonto: '—',
            textoDetalle: 'Sin datos del mes objetivo'
          };
        
            const chkIncluirMes = document.getElementById('chkIncluirMesSeleccionadoEval');
            const incluirMesSeleccionado = !!chkIncluirMes?.checked;
            
            const head = _getPeriodoHeader ? _getPeriodoHeader() : null;
            const periodoHeader = head?.periodo || '';
            
            const ordenMesesEval = {
              ENERO: 1,
              FEBRERO: 2,
              MARZO: 3,
              ABRIL: 4,
              MAYO: 5,
              JUNIO: 6,
              JULIO: 7,
              AGOSTO: 8,
              SETIEMBRE: 9,
              SEPTIEMBRE: 9,
              OCTUBRE: 10,
              NOVIEMBRE: 11,
              DICIEMBRE: 12
            };
            
            function periodoToNumeroEval(periodo) {
              const partes = String(periodo || '').split('_');
              const mes = String(partes[0] || '').toUpperCase();
              const anio = Number(partes[1]) || 0;
              const nroMes = ordenMesesEval[mes] || 0;
              return (anio * 100) + nroMes;
            }
            
            const filasConDatos = (det.filas || []).filter(r =>
              r.alcanceFrac != null &&
              r.periodo
            );
            
            const periodoAnteriorReal = filasConDatos
              .filter(r => periodoToNumeroEval(r.periodo) < periodoToNumeroEval(periodoHeader))
              .sort((a, b) => periodoToNumeroEval(b.periodo) - periodoToNumeroEval(a.periodo))[0]?.periodo || '';
            
            const periodoObjetivo = incluirMesSeleccionado
              ? periodoHeader
              : periodoAnteriorReal;
        
          const filasBase = (det.filas || []).filter(r =>
            r.incluido &&
            r.alcanceFrac != null &&
            r.periodo !== periodoObjetivo
          );
        
          if (!periodoObjetivo || !datosMeses?.[periodoObjetivo]) {
            return resultado;
          }
        
          const datosMesObjetivo = datosMeses[periodoObjetivo] || [];
        
          const asesorMesObjetivo = datosMesObjetivo.find(a => {
            const aliasA = String(a.alias_crr || '').trim();
            const nombreA = String(a.nombre || '').trim();
            const aliasBuscado = String(alias || '').trim();
        
            return aliasA === aliasBuscado || nombreA === aliasBuscado;
          });
        
          if (!asesorMesObjetivo) {
            return resultado;
          }
        
          const filaObjetivo = (det.filas || []).find(r => r.periodo === periodoObjetivo);
            
          const metaMesObjetivo = Number(filaObjetivo?.meta) || Number(asesorMesObjetivo.meta) || 0;
          const recuperoActualMesVisible = Number(filaObjetivo?.recupero) || Number(asesorMesObjetivo.recupero) || 0;
          const alcanceActualFinal = Number(filaObjetivo?.alcanceFrac);
          const recuperoActualMesParaCalculo = Number.isFinite(alcanceActualFinal)
            ? alcanceActualFinal * metaMesObjetivo
            : recuperoActualMesVisible;
        
          const sumaAlcancesPrevios = filasBase.reduce((acc, r) => {
            return acc + (Number(r.alcanceFrac) || 0);
          }, 0);
        
          const mesesParaPromedio = filasBase.length + 1;
        
          const alcanceFinalNecesarioMes = Math.max(
            0,
            (objetivoDecimal * mesesParaPromedio) - sumaAlcancesPrevios
          );
        
          const montoFinalNecesarioMes =
            alcanceFinalNecesarioMes * metaMesObjetivo;
        
          const montoFaltanteReal = Math.max(
            0,
            montoFinalNecesarioMes - recuperoActualMesParaCalculo
          );
        
          resultado.textoMonto =
            `S/ ${montoFaltanteReal.toLocaleString('es-PE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`;
        
          resultado.textoDetalle =
              `${(alcanceFinalNecesarioMes * 100).toFixed(2)}% requerido en ${periodoObjetivo.replace('_', ' ')} ` +
              `| Total requerido: S/ ${montoFinalNecesarioMes.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
          })}`;
        
          return resultado;
        }

        function _parseObjetivoNecesarioEval(valor, fallbackDecimal) {
          const limpio = String(valor ?? '').replace('%', '').replace(',', '.').trim();
          let n = Number(limpio);
          if (!isFinite(n)) return fallbackDecimal;
          if (n > 1) n = n / 100;
          if (n < 0) n = 0;
          return n;
        }

        function _fmtObjetivoNecesarioEval(decimal) {
          const n = Number(decimal);
          return `${(isFinite(n) ? n * 100 : 0).toFixed(2)}%`;
        }

        function _actualizarNecesarioObjetivoEval(config, det, alias) {
          const input = document.getElementById(config.inputId);
          const monto = document.getElementById(config.montoId);
          const detalle = document.getElementById(config.detalleId);
          const objetivo = _parseObjetivoNecesarioEval(input?.value, config.fallback);
          const calc = calcularNecesarioParaObjetivoEval(objetivo, det, alias);
          if (monto) monto.textContent = calc.textoMonto;
          if (detalle) detalle.textContent = calc.textoDetalle;
        }

        function _openModalEval(alias) {
          const modal = document.getElementById('modalEvalDetalle');
          if (!modal) return;
        
          const det = window.evalDetallePorAlias?.[alias];
          if (!det) return;
        
          const titulo = document.getElementById('modalEvalTitulo');
          const sub = document.getElementById('modalEvalSub');
          const reglas = document.getElementById('modalEvalReglas');
          const tbody = document.getElementById('modalEvalTbody');
          const tot = document.getElementById('modalEvalTotales');
        
          if (titulo) titulo.textContent = `Detalle de Evaluación · ${alias}`;
          if (sub) sub.textContent = `Inicio de Gestión: ${_fmtFechaIngresoUI(det.fechaIngreso)} · SUP: ${det.supervisor || '—'} · Meses usados: ${det.mesesUsados}/${det.nObjetivo}`;
        
          if (reglas) {
            reglas.innerHTML = `
              <div style="font-weight:800; margin-bottom:6px;">Reglas aplicadas</div>
              <ul style="margin:0; padding-left:18px;">
                <li>Solo se consideran meses con <b>ESTADO = CALL</b>.</li>
                <li>Se reconoce a partir de <b>fecha de Inicio</b> (meses anteriores: “No participó”).</li>
                <li>Para completar <b>${det.nObjetivo}</b> meses, se retrocede hasta encontrar meses efectivos.</li>
              </ul>
            `;
          }
        
          if (tbody) {
              const rows = det.filas || [];
              tbody.innerHTML = rows.map(r => {
                const inc = r.incluido
                  ? `<span class="tag-si">SI</span>`
                  : `<span class="tag-no">NO</span>`;
            
                const metaTxt =
                  (r.meta === null || r.meta === undefined)
                    ? '—'
                    : Number(r.meta).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      });
                
                const recTxt =
                  (r.recupero === null || r.recupero === undefined)
                    ? '—'
                    : Number(r.recupero).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      });
                const alcanceTexto = (r.alcanceFrac == null) ? '—' : `${(r.alcanceFrac * 100).toFixed(2)}%`;
                const alcTxt = r.excepcion_alcance
                  ? `<strong class="alcance-excepcion" title="Alcance final modificado por CSTC">${alcanceTexto}</strong>`
                  : alcanceTexto;
            
                const quintilHtml = _renderBarraQuintil(r.q_alc);
                const extraClase = window.evalQuintilesExtraAbiertos ? '' : 'oculta';
                const extras = r.q_extra || {};
            
                return `
                  <tr>
                    <td>${r.periodo}</td>
                    <td>${r.estado || '?'}</td>
                    <td style="text-align:right;">${metaTxt}</td>
                    <td style="text-align:right;">${recTxt}</td>
                    <td style="text-align:right;">${alcTxt}</td>
                    <td>${inc}</td>
                    <td>${quintilHtml}</td>
                    <td class="eval-quintil-extra-col ${extraClase}">${_renderBarraQuintilGris(extras.condonacion)}</td>
                    <td class="eval-quintil-extra-col ${extraClase}">${_renderBarraQuintilGris(extras.cierre)}</td>
                    <td class="eval-quintil-extra-col ${extraClase}">${_renderBarraQuintilGris(extras.calidad_pdp)}</td>
                    <td class="eval-quintil-extra-col ${extraClase}">${_renderBarraQuintilGris(extras.puntualidad)}</td>
                  </tr>
                `;
              }).join('') || `
                <tr>
                  <td colspan="11" style="padding:14px; text-align:center; color:#666;">—</td>
                </tr>
              `;
          }
        
            const pctTxt = (det.pct === null) ? 'No participó' : `${(det.pct * 100).toFixed(2)}%`;
            
            if (tot) {
              // opcional: promedio ponderado SOLO como referencia
              let metaSum = 0;
              let alcancePonderadoSum = 0;
              (det.filas || []).forEach(r => {
                if (r.incluido && (r.meta ?? 0) > 0 && r.alcanceFrac != null) {
                  const metaFila = Number(r.meta) || 0;
                  metaSum += metaFila;
                  alcancePonderadoSum += metaFila * (Number(r.alcanceFrac) || 0);
                }
              });
              const pctPond = (metaSum > 0) ? (alcancePonderadoSum / metaSum) : null;
              const pctPondTxt = (pctPond === null) ? '—' : `${(pctPond * 100).toFixed(2)}%`;

              const calc70 = calcularNecesarioParaObjetivoEval(0.70, det, alias);
              const calc90 = calcularNecesarioParaObjetivoEval(0.90, det, alias);
            
              tot.innerHTML = `
                <div style="padding:12px 14px; border:1px solid #eef2f7; border-radius:12px;">
                  <div style="font-size:0.85rem; color:#666; font-weight:700;">MESES EFECTIVOS</div>
                  <div style="font-size:1.25rem; font-weight:900; color:#2c3e50;">${det.mesesUsados} / ${det.nObjetivo}</div>
                </div>
            
                <div style="padding:12px 14px; border:1px solid #eef2f7; border-radius:12px;">
                  <div style="font-size:0.85rem; color:#666; font-weight:700;">PROMEDIO DE ALCANCES</div>
                  <div style="font-size:1.25rem; font-weight:900; color:#2c3e50;">${pctTxt}</div>
                </div>
            
                <div style="padding:12px 14px; border:1px solid #eef2f7; border-radius:12px;">
                  <div style="font-size:0.85rem; color:#666; font-weight:700;">ALCANCE PONDERADO (REF)</div>
                  <div style="font-size:1.25rem; font-weight:900; color:#2c3e50;">${pctPondTxt}</div>
                </div>

                <div style="padding:12px 14px; border:1px solid #fee2e2; border-radius:12px; background:#fff7f7;">
                  <div style="font-size:0.85rem; color:#b71c1c; font-weight:700; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span>NECESARIO PARA</span>
                    <input id="objetivoEval70" type="text" value="70%" aria-label="Objetivo necesario 1" style="width:62px; height:24px; border:1px solid #f3b6b6; border-radius:6px; padding:2px 6px; color:#b71c1c; font-weight:900; background:#fff; font-size:0.85rem;">
                  </div>
                
                  <div id="necesarioEvalMonto70" style="font-size:1.25rem; font-weight:900; color:#b71c1c;">
                    ${calc70.textoMonto}
                  </div>
                
                  <div id="necesarioEvalDetalle70" style="font-size:0.95rem; color:#7f8c8d; margin-top:3px;">
                    ${calc70.textoDetalle}
                  </div>
                </div>

                <div style="padding:12px 14px; border:1px solid #d6eaf8; border-radius:12px; background:#f4faff;">
                  <div style="font-size:0.85rem; color:#1565c0; font-weight:700; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span>NECESARIO PARA</span>
                    <input id="objetivoEval90" type="text" value="90%" aria-label="Objetivo necesario 2" style="width:62px; height:24px; border:1px solid #9fc9ee; border-radius:6px; padding:2px 6px; color:#1565c0; font-weight:900; background:#fff; font-size:0.85rem;">
                  </div>
                
                  <div id="necesarioEvalMonto90" style="font-size:1.25rem; font-weight:900; color:#1565c0;">
                    ${calc90.textoMonto}
                  </div>
                
                  <div id="necesarioEvalDetalle90" style="font-size:0.95rem; color:#7f8c8d; margin-top:3px;">
                    ${calc90.textoDetalle}
                  </div>
                </div>
              `;

              [
                { inputId: 'objetivoEval70', montoId: 'necesarioEvalMonto70', detalleId: 'necesarioEvalDetalle70', fallback: 0.70 },
                { inputId: 'objetivoEval90', montoId: 'necesarioEvalMonto90', detalleId: 'necesarioEvalDetalle90', fallback: 0.90 }
              ].forEach(config => {
                const input = document.getElementById(config.inputId);
                if (!input) return;
                const refrescar = () => _actualizarNecesarioObjetivoEval(config, det, alias);
                input.addEventListener('input', refrescar);
                input.addEventListener('change', refrescar);
                input.addEventListener('blur', () => {
                  input.value = _fmtObjetivoNecesarioEval(_parseObjetivoNecesarioEval(input.value, config.fallback));
                  refrescar();
                });
                refrescar();
              });
            }
            modal.style.display = 'block';
        }
        
        function _closeModalEval() {
          const modal = document.getElementById('modalEvalDetalle');
          if (modal) modal.style.display = 'none';
        }
        document.addEventListener('click', (e) => {
          const btn = e.target?.closest?.('.btn-eval-detalle');
          if (btn) {
            const alias = btn.getAttribute('data-alias') || '';
            if (alias) _openModalEval(alias);
            return;
          }
        
          const close = e.target?.closest?.('[data-close="1"]');
          if (close) {
            _closeModalEval();
          }
        });
        
        // Escape con ESC
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') _closeModalEval();
        });
