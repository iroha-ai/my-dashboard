import { CONFIG } from './config.js?v=20260809-rain-radar';
import { clear, el, fetchJson, pad2, showMessage, weekdayLabel } from './util.js';

// 気象庁の警報・注意報コード。表にない番号が来ても落とさず、番号のまま出す。
const WARNING_NAMES = {
  '02': '暴風雪警報',
  '03': '大雨警報',
  '04': '洪水警報',
  '05': '暴風警報',
  '06': '大雪警報',
  '07': '波浪警報',
  '08': '高潮警報',
  '10': '大雨注意報',
  '12': '大雪注意報',
  '13': '風雪注意報',
  '14': '雷注意報',
  '15': '強風注意報',
  '16': '波浪注意報',
  '17': '融雪注意報',
  '18': '洪水注意報',
  '19': '高潮注意報',
  '20': '濃霧注意報',
  '21': '乾燥注意報',
  '22': 'なだれ注意報',
  '23': '低温注意報',
  '24': '霜注意報',
  '25': '着氷注意報',
  '26': '着雪注意報',
  '27': 'その他の注意報',
  '32': '暴風雪特別警報',
  '33': '大雨特別警報',
  '35': '暴風特別警報',
  '36': '大雪特別警報',
  '37': '波浪特別警報',
  '38': '高潮特別警報',
};

const JMA_FORECAST = 'https://www.jma.go.jp/bosai/forecast/data/forecast/';
const JMA_WARNING = 'https://www.jma.go.jp/bosai/warning/data/warning/';

function warningName(code) {
  return WARNING_NAMES[code] || `警報・注意報（${code}）`;
}

function isEmergency(code) {
  return Number(code) >= 30;
}

// 警報・注意報コードから、気温表示の色分けに使う重大度を判定する。
// 特別警報（30番台）・警報（02〜09）は「警報」扱いで赤、
// 注意報（10〜29）は「注意報」扱いで黄色。両方あれば警報（赤）を優先する。
function warningLevel(codes) {
  if (!codes?.length) return null;
  const hasWarning = codes.some((code) => {
    const num = Number(code);
    return num >= 30 || (num >= 2 && num <= 9);
  });
  if (hasWarning) return 'warning';
  const hasAdvisory = codes.some((code) => {
    const num = Number(code);
    return num >= 10 && num <= 29;
  });
  return hasAdvisory ? 'advisory' : null;
}

// 気象庁の天気文は全角スペースで区切られているので、表示用に詰める。
function tidyWeatherText(text) {
  return (text || '').replace(/\u3000/g, '').trim();
}

// Open-Meteo の WMO 天気コードを、短い日本語ラベルに変換する。
// （週間天気はアイコン表示なので、このラベルはtitle属性・代替テキストとしてのみ使う）
function wmoLabel(code) {
  if (code === 0) return '晴れ';
  if (code <= 3) return '晴れ時々くもり';
  if (code <= 48) return '霧';
  if (code <= 57) return '霧雨';
  if (code <= 67) return '雨';
  if (code <= 77) return '雪';
  if (code <= 82) return 'にわか雨';
  if (code <= 86) return 'にわか雪';
  if (code <= 99) return '雷雨';
  return '—';
}

// Open-Meteo の WMO 天気コードを、絵文字1文字のアイコンに変換する
// （週間天気は文字だと視認性が悪いため、2026-08-08にアイコン表示へ変更）。
// 区分の境界は wmoLabel と揃えている。
function wmoIcon(code) {
  if (code === null || code === undefined || code === '') return '—';
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '—';
}

// 気象庁の週間予報（entry[1]）から、予報区ごとの7日分を取り出す。
function parseJmaWeekly(data, forecastAreaCode) {
  const weekly = data?.[1];
  if (!weekly) return null;

  const weatherSeries = weekly.timeSeries?.[0];
  const areaWeather = weatherSeries?.areas?.find((a) => a.area.code === forecastAreaCode);
  if (!areaWeather) return null;

  const dates = weatherSeries.timeDefines || [];
  const codes = areaWeather.weatherCodes || [];
  const pops = areaWeather.pops || [];

  return dates.map((iso, i) => ({
    date: iso.slice(0, 10),
    weatherCode: codes[i] || '',
    pop: pops[i] !== undefined && pops[i] !== '' ? Number(pops[i]) : null,
  }));
}

async function fetchWeeklyOpenMeteo(city) {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    `&timezone=Asia%2FTokyo&forecast_days=${city.days}`;

  const data = await fetchJson(url);
  const daily = data?.daily;
  if (!daily?.time) return [];

  return daily.time.map((date, i) => ({
    date,
    max: daily.temperature_2m_max?.[i] ?? null,
    min: daily.temperature_2m_min?.[i] ?? null,
    weatherCode: daily.weather_code?.[i] ?? null,
    pop: daily.precipitation_probability_max?.[i] ?? null,
  }));
}

function renderWeeklyAlerts(node, warningCodes) {
  clear(node);
  if (!warningCodes?.length) return;

  for (const code of warningCodes) {
    node.appendChild(
      el(
        'span',
        `alert-chip${isEmergency(code) ? ' is-emergency' : ''}`,
        warningName(code)
      )
    );
  }
}

function renderWeeklyDay(day, isToday) {
  const d = new Date(`${day.date}T12:00:00`);
  const dow = d.getDay();
  const li = el('li', `weekly-day${isToday ? ' is-today' : ''}`);

  const dateLabel = el(
    'span',
    `weekly-date${dow === 6 ? ' is-sat' : ''}${dow === 0 ? ' is-sun' : ''}`,
    `${d.getMonth() + 1}/${d.getDate()}（${weekdayLabel(d)}）`
  );
  li.appendChild(dateLabel);

  // アイコン＋テキストの両方を残す（2026-08-08、Hideの要望でテキストを復活）。
  const labelWrap = el('span', 'weekly-label');
  const iconNode = el('span', 'weekly-icon', day.icon || '—');
  labelWrap.appendChild(iconNode);
  labelWrap.appendChild(el('span', 'weekly-label-text', day.label || '—'));
  li.appendChild(labelWrap);

  const temp = el('span', 'weekly-temp');
  if (day.max !== null && day.min !== null) {
    temp.appendChild(el('span', 'max', `${Math.round(day.max)}`));
    temp.appendChild(document.createTextNode('/'));
    temp.appendChild(el('span', 'min', `${Math.round(day.min)}`));
  } else {
    temp.textContent = '--';
  }
  li.appendChild(temp);

  const popText =
    day.pop !== null && day.pop !== undefined && !Number.isNaN(day.pop)
      ? `${Math.round(day.pop)}%`
      : '—';
  li.appendChild(el('span', 'weekly-pop', popText));

  return li;
}

async function updateWeeklyCity(city, onStatus) {
  const statusKey = `weekly-${city.domId}`;
  const list = document.getElementById(`${city.domId}-weekly-list`);
  const alertsNode = document.getElementById(`${city.domId}-alerts`);
  if (!list) return; // index.html 側に対応する要素が無ければ何もしない

  let days;
  try {
    days = await fetchWeeklyOpenMeteo(city);
  } catch (err) {
    console.error(`週間天気の取得に失敗（${city.name}）`, err);
    showMessage(list, '週間天気を取得できませんでした', true);
    onStatus?.(statusKey, `${city.name}の週間天気の取得に失敗`, true);
    return;
  }

  // 気象庁の週間予報で降水確率を補完できるときは、そちらを優先する。
  try {
    const jma = await fetchJson(`${JMA_FORECAST}${city.prefecture}.json`);
    const jmaDays = parseJmaWeekly(jma, city.forecastArea);
    if (jmaDays?.length) {
      const byDate = new Map(jmaDays.map((d) => [d.date, d]));
      days = days.map((day) => {
        const extra = byDate.get(day.date);
        if (!extra) return day;
        return {
          ...day,
          pop: extra.pop !== null ? extra.pop : day.pop,
        };
      });
    }
  } catch (err) {
    console.error(`気象庁週間予報の取得に失敗（${city.name}）`, err);
  }

  days = days.map((day) => ({
    ...day,
    label: wmoLabel(day.weatherCode),
    icon: wmoIcon(day.weatherCode),
  }));

  const warnings = await fetchWarnings([city]).catch(() => new Map());
  if (alertsNode) {
    renderWeeklyAlerts(alertsNode, warnings.get(`${city.prefecture}:${city.warningArea}`));
  }

  const todayKey = `${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}-${pad2(
    new Date().getDate()
  )}`;
  clear(list);
  for (const day of days) {
    list.appendChild(renderWeeklyDay(day, day.date === todayKey));
  }

  onStatus?.(statusKey, null, false);
}

async function fetchTemperatures(cities) {
  const lat = cities.map((c) => c.lat).join(',');
  const lon = cities.map((c) => c.lon).join(',');
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min' +
    '&timezone=Asia%2FTokyo&forecast_days=1';

  const data = await fetchJson(url);
  // 1地点だけを渡すとオブジェクトで返るため、配列に揃える。
  const list = Array.isArray(data) ? data : [data];
  return list.map((entry) => ({
    current: entry?.current?.temperature_2m ?? null,
    weatherCode: entry?.current?.weather_code ?? null,
    max: entry?.daily?.temperature_2m_max?.[0] ?? null,
    min: entry?.daily?.temperature_2m_min?.[0] ?? null,
  }));
}

async function fetchForecastTexts(cities) {
  const prefectures = [...new Set(cities.map((c) => c.prefecture))];
  const results = new Map();

  await Promise.all(
    prefectures.map(async (pref) => {
      try {
        const data = await fetchJson(`${JMA_FORECAST}${pref}.json`);
        const series = data?.[0]?.timeSeries?.[0];
        for (const area of series?.areas || []) {
          results.set(
            `${pref}:${area.area.code}`,
            tidyWeatherText(area.weathers?.[0])
          );
        }
      } catch (err) {
        console.error(`天気予報の取得に失敗 (${pref})`, err);
      }
    })
  );

  return results;
}

async function fetchWarnings(cities) {
  const prefectures = [...new Set(cities.map((c) => c.prefecture))];
  const results = new Map();

  await Promise.all(
    prefectures.map(async (pref) => {
      try {
        const data = await fetchJson(`${JMA_WARNING}${pref}.json`);
        for (const areaType of data?.areaTypes || []) {
          for (const area of areaType.areas || []) {
            const active = (area.warnings || [])
              .filter((w) => w.status !== '解除' && w.code)
              .map((w) => w.code);
            if (active.length) {
              results.set(`${pref}:${area.code}`, active);
            }
          }
        }
      } catch (err) {
        console.error(`警報・注意報の取得に失敗 (${pref})`, err);
      }
    })
  );

  return results;
}

function renderCard(city, temp, forecastText, warningCodes) {
  const card = el('div', 'weather-card');
  const cityLink = el('a', 'weather-city weather-city-link', city.name);
  cityLink.href = city.radarUrl;
  cityLink.target = '_blank';
  cityLink.rel = 'noopener';
  cityLink.title = `${city.name}の雨雲レーダーを開く（Yahoo!天気・災害）`;
  cityLink.setAttribute('aria-label', `${city.name}の雨雲レーダーをYahoo!天気・災害で開く`);
  card.appendChild(cityLink);

  // 今の天気をひと目で分かるように、大きめのアイコンを気温の横に置く
  // （2026-08-08追加。詳しい予報文はこれまで通り下に残す）。
  const iconNode = el('div', 'weather-icon', wmoIcon(temp?.weatherCode));
  card.appendChild(iconNode);

  const level = warningLevel(warningCodes);
  const tempClass = `weather-temp${level ? ` is-${level}` : ''}`;
  // 警報・注意報が出ているときだけ、気温部分を気象庁の詳細ページへのリンクにする
  // （クリックで何の警報・注意報かを確認できるようにするため）。何もなければ従来通り div のまま。
  let tempNode;
  if (level) {
    tempNode = el('a', tempClass);
    tempNode.href = `https://www.jma.go.jp/bosai/warning/#area_type=class20s&area_code=${city.warningArea}&lang=jp`;
    tempNode.target = '_blank';
    tempNode.rel = 'noopener';
    tempNode.title = `${city.name}の警報・注意報の詳細を気象庁で確認`;
    tempNode.setAttribute('aria-label', `${city.name}の警報・注意報の詳細を気象庁で確認`);
  } else {
    tempNode = el('div', tempClass);
  }
  if (temp?.current !== null && temp?.current !== undefined) {
    tempNode.appendChild(document.createTextNode(temp.current.toFixed(1)));
    tempNode.appendChild(el('span', 'unit', '℃'));
  } else {
    tempNode.textContent = '--';
  }
  card.appendChild(tempNode);

  const range = el('div', 'weather-range');
  if (temp?.max !== null && temp?.min !== null) {
    range.appendChild(el('span', 'max', `${Math.round(temp.max)}`));
    range.appendChild(document.createTextNode(' / '));
    range.appendChild(el('span', 'min', `${Math.round(temp.min)}`));
  }
  card.appendChild(range);

  card.appendChild(el('div', 'weather-desc', forecastText || '—'));

  const alerts = el('div', 'weather-alerts');
  if (warningCodes && warningCodes.length) {
    for (const code of warningCodes) {
      const chip = el(
        'span',
        `alert-chip${isEmergency(code) ? ' is-emergency' : ''}`,
        warningName(code)
      );
      alerts.appendChild(chip);
    }
  } else {
    alerts.appendChild(el('span', 'alert-none', '注意報なし'));
  }
  card.appendChild(alerts);

  return card;
}

export async function updateWeather(onStatus) {
  await Promise.all(
    CONFIG.weeklyWeatherCities.map((city) => updateWeeklyCity(city, onStatus))
  );

  const row = document.getElementById('weather-row');
  const cities = CONFIG.cities;

  let temps;
  try {
    temps = await fetchTemperatures(cities);
  } catch (err) {
    console.error('気温の取得に失敗', err);
    showMessage(row, '天気を取得できませんでした', true);
    onStatus?.('weather', '天気の取得に失敗', true);
    return;
  }

  const [forecasts, warnings] = await Promise.all([
    fetchForecastTexts(cities),
    fetchWarnings(cities),
  ]);

  clear(row);
  cities.forEach((city, i) => {
    row.appendChild(
      renderCard(
        city,
        temps[i],
        forecasts.get(`${city.prefecture}:${city.forecastArea}`),
        warnings.get(`${city.prefecture}:${city.warningArea}`)
      )
    );
  });

  // 予報文や注意報だけ落ちた場合も、黙って空にせず知らせる。
  if (!forecasts.size) {
    onStatus?.('weather', '天気予報の文面を取得できず', true);
  } else {
    onStatus?.('weather', null, false);
  }
}
