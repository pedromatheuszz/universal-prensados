// Limpeza de texto digitado por clientes (nome, endereço, observações).
// Tira caracteres de controle e as marcas de direção do Unicode, que podem disfarçar o que
// aparece na tela do app, na comanda impressa e na mensagem do WhatsApp, e normaliza acentos.
// eslint-disable-next-line no-control-regex -- o objetivo é justamente achar caracteres de controle
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const BIDI = /[‪-‮⁦-⁩]/g;

export function cleanText(value, max, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  let s = value.normalize('NFC').replace(CONTROL, '').replace(BIDI, '');
  s = multiline
    ? s.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/\n{3,}/g, '\n\n')
    : s.replace(/[\t\r\n]+/g, ' ');
  return s.trim().slice(0, max);
}
