import {rankAlternatives, fetchAllPages} from './logic.mjs';
const $ = id => document.getElementById(id);
const money = value => value === 0 ? 'Бесплатно' : new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
const date = value => new Intl.DateTimeFormat('ru-RU', {day:'numeric', month:'long', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Moscow'}).format(new Date(value));
let genres = new Map(), page = 1, catalogCount = 0, selected = null, alternatives = [], visible = 12;
let catalogController, alternativesController, catalogQuery = {};
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function status(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
async function api(path, params, signal) {
  const response = await fetch('/api/v1/' + path + '?' + new URLSearchParams(params), {signal: AbortSignal.any([signal, AbortSignal.timeout(30000)])});
  if (!response.ok) throw new Error(response.status === 503 ? 'Сервер ещё готовит базу данных. Попробуйте чуть позже.' : `Не удалось получить данные (HTTP ${response.status}).`);
  return response.json();
}
function failure(error) { return error.name === 'TimeoutError' ? 'Сервер не ответил за 30 секунд. Повторите загрузку.' : error instanceof TypeError ? 'Нет соединения с сервером. Проверьте запуск приложения.' : error.message; }
function details(event) {
  const fragment = document.createDocumentFragment();
  fragment.append(node('p', date(event.starts_at) + ' · ' + event.age_rating + '+', 'meta'));
  if (event.venue) fragment.append(node('p', [event.venue.name, event.venue.formatted_address].filter(Boolean).join(' · '), 'meta'));
  return fragment;
}
function eventButton(event) {
  const button = node('button', undefined, 'event-choice'); button.type = 'button'; button.dataset.id = event.id; button.setAttribute('aria-pressed', String(selected?.id === event.id));
  button.append(node('span', genres.get(event.genre_code) || event.genre_code, 'tag'), node('h3', event.title), details(event), node('span', money(event.price_rub), 'price'));
  button.addEventListener('click', () => select(event)); return button;
}
async function loadCatalog(reset = true) {
  catalogController?.abort(); const controller = catalogController = new AbortController();
  if (reset) { page = 1; catalogCount = 0; $('events').replaceChildren(); catalogQuery = {q:$('search').value.trim(), genre_code:$('genre').value}; }
  $('more').hidden = true; status('catalog-status', 'Загружаем события…');
  try {
    if (!genres.size) {
      const result = await api('meta/genres', {}, controller.signal); genres = new Map(result.data.map(item => [item.code, item.name]));
      $('genre').replaceChildren(new Option('Все жанры', ''), ...result.data.map(item => new Option(item.name, item.code)));
      $('genre').value = catalogQuery.genre_code;
    }
    const params = {page, page_size:12, sort:'starts_at', status:'published', include:'venue,artist'};
    if (catalogQuery.q) params.q = catalogQuery.q;
    if (catalogQuery.genre_code) params.genre_code = catalogQuery.genre_code;
    const result = await api('events', params, controller.signal);
    if (controller.signal.aborted) return;
    $('events').append(...result.data.map(eventButton)); catalogCount += result.data.length;
    status('catalog-status', result.meta.total ? `Показано ${catalogCount} из ${result.meta.total}` : 'Событий не найдено. Попробуйте другой запрос или жанр.');
    $('more').hidden = catalogCount >= result.meta.total; page++;
  } catch(error) { if (!controller.signal.aborted) { status('catalog-status', failure(error), true); $('more').hidden = reset; } }
}
async function select(event) {
  selected = event; alternativesController?.abort(); const controller = alternativesController = new AbortController();
  document.querySelectorAll('.event-choice').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.id === event.id)));
  const card = node('article', undefined, 'selected');
  card.append(node('p', 'ВЫ СРАВНИВАЕТЕ С', 'eyebrow'), node('span', genres.get(event.genre_code) || event.genre_code, 'tag'), node('h3', event.title), details(event), node('div', money(event.price_rub), 'price'));
  $('selected').replaceChildren(card); $('alternatives').replaceChildren(); $('retry').hidden = true; $('more-alternatives').hidden = true;
  status('results-status', 'Ищем все события этого жанра и сравниваем цены…');
  try {
    const events = await fetchAllPages(page => api('events', {genre_code:event.genre_code, status:'published', include:'venue,artist', page_size:100, page, sort:'starts_at'}, controller.signal));
    if (controller.signal.aborted) return;
    alternatives = rankAlternatives(events, event); visible = 12; renderAlternatives();
  } catch(error) { if (!controller.signal.aborted) { status('results-status', failure(error), true); $('retry').hidden = false; } }
}
function renderAlternatives() {
  status('results-status', alternatives.length ? `Найдено: ${alternatives.length}. Сначала минимальная разница в цене; при равенстве — ближайшая дата.` : 'Других опубликованных событий этого жанра пока нет. Выберите другое событие.');
  $('alternatives').replaceChildren(...alternatives.slice(0, visible).map(event => {
    const card = node('article', undefined, 'alternative'); const top = node('div', undefined, 'card-top');
    const difference = event.price_rub - selected.price_rub;
    top.append(node('span', genres.get(event.genre_code) || event.genre_code, 'tag'), node('span', difference === 0 ? 'Та же цена' : `${difference < 0 ? 'Дешевле' : 'Дороже'} на ${money(Math.abs(difference))}`, 'difference'));
    card.append(top, node('h3', event.title), details(event));
    if (event.description) card.append(node('p', event.description, 'description'));
    if (event.available_tickets === 0) card.append(node('p', 'Свободных билетов нет', 'meta'));
    const bottom = node('div', undefined, 'card-bottom'); const button = node('button', 'Сравнить с этим'); button.type = 'button'; button.addEventListener('click', () => select(event));
    bottom.append(node('span', money(event.price_rub), 'price'), button); card.append(bottom); return card;
  }));
  $('more-alternatives').hidden = visible >= alternatives.length;
}
$('search-form').addEventListener('submit', event => { event.preventDefault(); loadCatalog(); });
$('genre').addEventListener('change', () => loadCatalog());
$('reload').addEventListener('click', () => { loadCatalog(); if (selected) select(selected); });
$('more').addEventListener('click', () => loadCatalog(false));
$('retry').addEventListener('click', () => { if (selected) select(selected); });
$('more-alternatives').addEventListener('click', () => { visible += 12; renderAlternatives(); });
loadCatalog();
