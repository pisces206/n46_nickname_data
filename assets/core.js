/* Pure record calculations are shared by every public view and by Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NicknameCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const sum = rows => rows.reduce((total, row) => total + row.count, 0);
  function normalize(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s/g, '')
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/﨑/g, '崎').replace(/[齋斉]/g, '斎').replace(/邉/g, '辺').replace(/邊/g, '辺')
      .replace(/澤/g, '沢').replace(/來/g, '来').replace(/髙/g, '高');
  }
  function memberScore(member, query) {
    const q = normalize(query);
    if (!q) return 0;
    const name = normalize(member.name), alternatives = [member.reading, ...(member.aliases || [])].map(normalize).filter(Boolean);
    if (name === q) return 0;
    if (alternatives.includes(q)) return 1;
    if ([name, ...alternatives].some(value => value.startsWith(q))) return 2;
    if ([name, ...alternatives].some(value => value.includes(q))) return 3;
    return Infinity;
  }
  function memberCompare(a, b) {
    const gen = member => Number(member.generation.match(/\d+/)?.[0] || 99);
    return gen(a) - gen(b) || (a.reading && b.reading ? normalize(a.reading).localeCompare(normalize(b.reading), 'ja') : a.order - b.order) || a.order - b.order;
  }
  function decode(data) {
    return data.rows.map(([caller, target, year, nickname, count]) => ({
      caller: data.members[caller].name, target: data.members[target].name,
      year: data.years[year], nickname: data.nicknames[nickname], count
    }));
  }
  function inPeriod(row, state) {
    if (state.year && state.year !== 'ALL' && row.year !== state.year) return false;
    if (state.from && row.year < state.from) return false;
    if (state.to && row.year > state.to) return false;
    return true;
  }
  function groupBy(rows, key) {
    const result = new Map();
    rows.forEach(row => {
      const name = key(row);
      if (!result.has(name)) result.set(name, []);
      result.get(name).push(row);
    });
    return result;
  }
  function diversity(values) {
    const total = values.reduce((a, b) => a + b, 0);
    return total ? (1 - values.reduce((a, b) => a + (b / total) ** 2, 0)) * 100 : null;
  }
  function summary(rows, mode = 'received', includeDiversity = false) {
    const total = sum(rows), nicks = groupBy(rows, row => row.nickname);
    const partners = groupBy(rows, row => mode === 'received' ? row.caller : row.target);
    const topCount = Math.max(0, ...[...nicks.values()].map(sum));
    const topNames = total ? [...nicks].filter(([, values]) => sum(values) === topCount).map(([name]) => name) : [];
    const partnerCount = Math.max(0, ...[...partners.values()].map(sum));
    const topPartners = total ? [...partners].filter(([, values]) => sum(values) === partnerCount).map(([name]) => name) : [];
    const partnerNicks = [...partners.values()].map(values => [...groupBy(values, row => row.nickname).values()].map(sum));
    const weightedD = includeDiversity && total ? partnerNicks.reduce((s, values) => s + values.reduce((a, b) => a + b, 0) * (diversity(values) || 0), 0) / total : null;
    return {
      count: total, partners: partners.size,
      types: mode === 'received' ? nicks.size : partnerNicks.reduce((s, values) => s + values.length, 0),
      topCount, topNames, topPartners, partnerCount,
      topShare: total ? topCount / total * 100 : null,
      partnerShare: total ? partnerCount / total * 100 : null,
      uniformity: total ? partnerNicks.reduce((s, values) => s + Math.max(...values), 0) / total * 100 : null,
      diversity: includeDiversity ? (mode === 'received' ? diversity([...nicks.values()].map(sum)) : weightedD) : null,
      latestYear: rows.length ? rows.map(row => row.year).sort().at(-1) : null,
      singleTypes: [...nicks.values()].filter(values => sum(values) === 1).length,
      singlePartnerTypes: [...nicks.values()].filter(values => [...groupBy(values, row => row.caller).values()].some(partner => sum(partner) === 1)).length,
      recordCount: rows.length
    };
  }
  function level(count, levels) {
    return [...levels].reverse().find(item => count >= item.minimum) || levels[0];
  }
  function detailRecords(records, member, mode, state, members) {
    const counterpart = mode === 'received' ? 'caller' : 'target';
    const owner = mode === 'received' ? 'target' : 'caller';
    const lookup = new Map(members.map(item => [item.name, item]));
    const q = normalize(state.q);
    let rows = records.filter(row => row[owner] === member && inPeriod(row, state));
    if (state.person) rows = rows.filter(row => row[counterpart] === state.person);
    if (q) rows = rows.filter(row => normalize(row.nickname).includes(q) ||
      memberScore(lookup.get(row[counterpart]) || {name: row[counterpart], aliases: []}, q) < Infinity);
    const tokenGroups = groupBy(rows, row => JSON.stringify([row[counterpart], row.nickname]));
    rows = [...tokenGroups.values()].filter(values => sum(values) >= Number(state.minPerson || 1)).flat();
    const aggregateGroups = groupBy(rows, row => mode === 'received' ? row.nickname : row.target);
    rows = [...aggregateGroups.values()].filter(values => sum(values) >= Number(state.minTotal || 1) &&
      (!state.hideSingle || sum(values) !== 1)).flat();
    return rows;
  }
  function rank(items, value, descending = true) {
    const sorted = [...items].sort((a, b) => (descending ? value(b) - value(a) : value(a) - value(b)) || memberCompare(a.member, b.member));
    let previous, position = 0;
    return sorted.map((item, index) => {
      const score = value(item);
      if (index === 0 || score !== previous) position = index + 1;
      previous = score;
      return {...item, rank: position};
    });
  }
  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function csv(rows, metadata) {
    const columns = ['caller', 'target', 'year', 'nickname', 'count', 'exportedAt', 'dataVersion', 'scope', 'filters'];
    return '\uFEFF' + [columns.map(csvCell).join(','),
      ...rows.map(row => columns.map(column => csvCell(row[column] ?? metadata[column])).join(','))].join('\r\n');
  }
  return {sum, normalize, memberScore, memberCompare, decode, inPeriod, groupBy, diversity, summary, level, detailRecords, rank, csv, csvCell};
});
