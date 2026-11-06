// Horário de funcionamento (horário de Brasília). Usado pelo site, pela API e pelo app de gestão.
// hours: array de 7 posições (0 = domingo) com { open: 'HH:MM', close: 'HH:MM' } ou null (fechado).

export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const day = { open: '19:00', close: '23:30' };
export const DEFAULT_HOURS = [null, day, day, day, day, day, day];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Valida e normaliza a grade de horários. Lança Error com mensagem amigável. */
export function normalizeHours(hours) {
  if (!Array.isArray(hours) || hours.length !== 7) throw new Error('Informe o horário dos 7 dias da semana');
  return hours.map((h, i) => {
    if (!h) return null;
    if (!TIME_RE.test(h.open || '') || !TIME_RE.test(h.close || '')) throw new Error(`Horário inválido na ${WEEKDAYS[i]}`);
    if (toMin(h.close) <= toMin(h.open)) throw new Error(`Na ${WEEKDAYS[i]}, o fechamento precisa ser depois da abertura`);
    return { open: h.open, close: h.close };
  });
}

function saoPauloParts(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(date).map(p => [p.type, p.value])
  );
  const d = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { day: d, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/**
 * Situação da loja num instante. `paused` (pausa manual pelo app) fecha a loja mesmo
 * dentro do horário; `pauseMessage` substitui o texto padrão.
 */
export function getStoreStatus(date, { hours = DEFAULT_HOURS, paused = false, pauseMessage = '' } = {}) {
  const { day: today, minutes } = saoPauloParts(date);
  const h = hours[today];

  if (paused) {
    return { open: false, paused: true, label: pauseMessage ? `Pausado • ${pauseMessage}` : 'Pausado • Não estamos recebendo pedidos agora' };
  }
  if (h && minutes >= toMin(h.open) && minutes < toMin(h.close)) {
    return { open: true, label: `Aberto agora • Pedidos até ${h.close}` };
  }
  if (h && minutes < toMin(h.open)) {
    return { open: false, label: `Fechado • Abrimos hoje às ${h.open}` };
  }
  for (let i = 1; i <= 7; i++) {
    const next = (today + i) % 7;
    if (hours[next]) {
      const when = i === 1 ? 'amanhã' : WEEKDAYS[next];
      return { open: false, label: `Fechado • Abrimos ${when} às ${hours[next].open}` };
    }
  }
  return { open: false, label: 'Fechado no momento' };
}
