const STORAGE_KEY_MORNING = 'orbit.questions.morning.recent';
const STORAGE_KEY_EVENING = 'orbit.questions.evening.recent';

export const MORNING_QUESTIONS: string[] = [
  'Was wäre das Beste, was du heute schaffen könntest?',
  'Worauf möchtest du dich heute konzentrieren?',
  'Was würde den heutigen Tag zu einem guten Tag machen?',
  'Welche eine Sache würdest du heute gerne abschließen?',
  'Was ist heute wirklich wichtig — nicht nur dringend?',
  'Wenn du heute nur eine Sache schaffst, welche soll es sein?',
  'Was würde dich heute Abend zufrieden auf den Tag zurückblicken lassen?',
  'Worauf freust du dich heute?',
  'Was brauchst du heute, um gut arbeiten zu können?',
  'Welches Thema verdient heute deine beste Energie?',
  'Was hast du gestern angefangen, das du heute weiterführen möchtest?',
  'Wie möchtest du dich heute Abend fühlen?',
  'Was steht heute an, das du am liebsten schnell hinter dich bringen würdest?',
  'Gibt es etwas, das du heute bewusst loslassen möchtest?',
  'Was wäre ein kleiner Gewinn, der deinen Tag besser machen würde?',
];

export const EVENING_QUESTIONS: string[] = [
  'Was hat heute gut geklappt?',
  'Worauf bist du heute stolz?',
  'Was hast du heute gelernt?',
  'Was hat dich heute überrascht?',
  'Was würdest du morgen anders machen?',
  'Wofür bist du heute dankbar?',
  'Was hat dir heute Energie gegeben?',
  'Was hat dich heute gebremst?',
  'Gab es einen Moment heute, der sich gut angefühlt hat?',
  'Was war heute leichter als erwartet?',
  'Hast du heute jemandem geholfen oder hat dir jemand geholfen?',
  'Was kannst du von heute mitnehmen?',
  'Was hättest du heute gebraucht, das dir gefehlt hat?',
  'Welchen Fortschritt hast du heute gemacht, auch wenn er klein war?',
  'Was möchtest du morgen als erstes angehen?',
];

export function pickQuestion(pool: string[], storageKey: string): string {
  let recent: number[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) recent = JSON.parse(raw);
  } catch {}

  const eligible = pool
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => !recent.includes(i));

  const pick = eligible.length > 0
    ? eligible[Math.floor(Math.random() * eligible.length)]
    : { q: pool[0], i: 0 };

  const updated = [pick.i, ...recent].slice(0, 5);
  localStorage.setItem(storageKey, JSON.stringify(updated));

  return pick.q;
}

export function pickMorningQuestion(): string {
  return pickQuestion(MORNING_QUESTIONS, STORAGE_KEY_MORNING);
}

export function pickEveningQuestion(): string {
  return pickQuestion(EVENING_QUESTIONS, STORAGE_KEY_EVENING);
}
