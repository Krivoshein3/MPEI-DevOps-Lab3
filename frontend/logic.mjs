export function rankAlternatives(events, selected) {
  return events.filter(event => event.id !== selected.id && event.genre_code === selected.genre_code && event.status === 'published')
    .sort((a, b) => Math.abs(a.price_rub - selected.price_rub) - Math.abs(b.price_rub - selected.price_rub)
      || Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id));
}
export async function fetchAllPages(fetchPage) {
  const events = [];
  for (let page = 1; ; page++) {
    const response = await fetchPage(page);
    if (!Array.isArray(response.data) || !Number.isInteger(response.meta?.total)) throw new Error('Некорректный ответ API');
    events.push(...response.data);
    if (events.length >= response.meta.total) return events;
    if (!response.data.length) throw new Error('Каталог изменился во время загрузки. Повторите поиск.');
  }
}
