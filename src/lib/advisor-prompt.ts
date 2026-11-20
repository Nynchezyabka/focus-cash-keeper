/** Which detailed fact blocks a question needs. Unsure → include everything (dearer beats wrong). */
export type FactNeeds = {
  spending: boolean;
  forecast: boolean;
  goals: boolean;
  family: boolean;
  debts: boolean;
};
export const ALL_FACTS: FactNeeds = { spending: true, forecast: true, goals: true, family: true, debts: true };
const R = {
  spending: /потрат|трат|расход|категор|куда ушл|операци|покупал|еда|еду|продукт|кафе|такси|заложить|в среднем|средн|будн|выходн|как часто|закуп|кофе|чек|запис/i,
  forecast: /что если|а если|хватит|до конца|следующ|будущ|прогноз|план|месяц|недел|декабр|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декрет|отпуск|потом|через|когда|перенес|сдвин|обзор|итог/i,
  goals: /цел[ьиея]|накоп|копил|отлож|подушк|сбереж/i,
  family: /семь|семей|муж|жен[аы]|партн[её]р|вместе|общ/i,
  debts: /долг|кредит|займ|рассроч|процент|график|ипотек|плата по|верну|вернуть/i,
};
/** Simple everyday questions that the base facts and the app calculation fully answer. */
const SIMPLE =
  /(можно|могу|стоит|получится).{0,40}(купить|потратить|позволить|взять)|купить .{0,30}за\s*\d|свободно|сколько (у меня )?(осталось|есть|можно)|остат|баланс|на карте|наличн|сегодня|доход приш|следующий шаг|что делать дальше/i;

export function factNeeds(q: string, hasImage = false): FactNeeds {
  if (hasImage || !q.trim()) return ALL_FACTS;
  const n: FactNeeds = {
    spending: R.spending.test(q),
    forecast: R.forecast.test(q),
    goals: R.goals.test(q),
    family: R.family.test(q),
    debts: R.debts.test(q),
  };
  const any = Object.values(n).some(Boolean);
  return any || SIMPLE.test(q) ? n : ALL_FACTS;
}

/** Split system prompt: the stable part holds nothing that changes between questions. */
export function systemParts(stable: string, dynamic: string[]) {
  return { stable, dynamic: dynamic.filter(Boolean).join("\n\n") };
}
