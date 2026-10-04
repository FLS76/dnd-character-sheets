import type { FieldGroup, Language, LocalizedText, Ruleset, SheetField, SheetTemplate } from './types'

const local = (ru: string, en: string): LocalizedText => ({ ru, en })

const field = (
  id: string,
  group: FieldGroup,
  label: LocalizedText,
  description: LocalizedText,
  type: SheetField['type'] = 'text',
  options: { placeholder?: LocalizedText; rows?: number; fullWidth?: boolean } = {},
): SheetField => ({ id, group, label, description, type, ...options })

const abilityFields: SheetField[] = [
  field('strength', 'abilities', local('Сила', 'Strength'), local('Сила отвечает за физическую мощь, переносимый вес и часть физических действий. Введите значение вручную.', 'Strength covers physical power, carrying capacity and many physical actions. Enter the value manually.'), 'number', { placeholder: local('10', '10') }),
  field('strengthModifier', 'abilities', local('Модификатор силы', 'Strength modifier'), local('Модификатор обычно вычисляется из значения силы, но его можно ввести вручную.', 'The modifier is usually derived from Strength, but you can enter it manually.'), 'number', { placeholder: local('+0', '+0') }),
  field('dexterity', 'abilities', local('Ловкость', 'Dexterity'), local('Ловкость влияет на инициативу, скрытность, точность и часть технических действий.', 'Dexterity affects initiative, stealth, precision and many technical actions.'), 'number', { placeholder: local('10', '10') }),
  field('dexterityModifier', 'abilities', local('Модификатор ловкости', 'Dexterity modifier'), local('Модификатор обычно вычисляется из значения ловкости, но его можно ввести вручную.', 'The modifier is usually derived from Dexterity, but you can enter it manually.'), 'number', { placeholder: local('+0', '+0') }),
  field('constitution', 'abilities', local('Телосложение', 'Constitution'), local('Телосложение определяет выносливость, здоровье и сопротивление вредным воздействиям.', 'Constitution determines stamina, hit points and resistance to harmful effects.'), 'number', { placeholder: local('10', '10') }),
  field('constitutionModifier', 'abilities', local('Модификатор телосложения', 'Constitution modifier'), local('Модификатор обычно вычисляется из значения телосложения, но его можно ввести вручную.', 'The modifier is usually derived from Constitution, but you can enter it manually.'), 'number', { placeholder: local('+0', '+0') }),
  field('intelligence', 'abilities', local('Интеллект', 'Intelligence'), local('Интеллект помогает в рассуждениях, магии, знаниях и решении сложных задач.', 'Intelligence helps with reasoning, magic, knowledge and complex problem solving.'), 'number', { placeholder: local('10', '10') }),
  field('intelligenceModifier', 'abilities', local('Модификатор интеллекта', 'Intelligence modifier'), local('Модификатор обычно вычисляется из значения интеллекта, но его можно ввести вручную.', 'The modifier is usually derived from Intelligence, but you can enter it manually.'), 'number', { placeholder: local('+0', '+0') }),
  field('wisdom', 'abilities', local('Мудрость', 'Wisdom'), local('Мудрость отвечает за восприятие, интуицию, выживание и понимание людей.', 'Wisdom covers perception, intuition, survival and understanding people.'), 'number', { placeholder: local('10', '10') }),
  field('wisdomModifier', 'abilities', local('Модификатор мудрости', 'Wisdom modifier'), local('Модификатор обычно вычисляется из значения мудрости, но его можно ввести вручную.', 'The modifier is usually derived from Wisdom, but you can enter it manually.'), 'number', { placeholder: local('+0', '+0') }),
  field('charisma', 'abilities', local('Харизма', 'Charisma'), local('Харизма влияет на влияние, убеждение, торговлю и взаимодействие с другими людьми.', 'Charisma influences presence, persuasion, trade and interaction with others.'), 'number', { placeholder: local('10', '10') }),
  field('charismaModifier', 'abilities', local('Модификатор харизмы', 'Charisma modifier'), local('Модификатор обычно вычисляется из значения харизмы, но его можно ввести вручную.', 'The modifier is usually derived from Charisma, but you can enter it manually.'), 'number', { placeholder: local('+0', '+0') }),
]

const identityFields: SheetField[] = [
  field('characterName', 'identity', local('Имя персонажа', 'Character name'), local('Введите имя, которое игрок использует для этого персонажа.', 'Enter the name the player uses for this character.'), 'text', { placeholder: local('Например, Торин', 'For example, Torin') }),
  field('playerName', 'identity', local('Имя игрока', 'Player name'), local('Укажите имя игрока, который управляет персонажем.', 'Enter the name of the player controlling the character.'), 'text', { placeholder: local('Необязательно', 'Optional') }),
  field('classLevel', 'identity', local('Класс и уровень', 'Class & level'), local('Укажите класс персонажа и его текущий уровень.', 'Enter the character class and current level.'), 'text', { placeholder: local('Воин, 3', 'Fighter, 3') }),
  field('race', 'identity', local('Раса или вид', 'Species / race'), local('Введите выбранную расу или вид на правила вашей сессии.', 'Enter the species or race selected for your session rules.'), 'text', { placeholder: local('Человек', 'Human') }),
  field('background', 'identity', local('Предыстория', 'Background'), local('Кратко укажите предысторию, которая объясняет прошлые навыки и особенности.', 'Briefly note the background behind the character’s past skills and features.'), 'text', { placeholder: local('Солдат', 'Soldier') }),
  field('alignment', 'identity', local('Мировоззрение', 'Alignment'), local('Укажите мировоззрение персонажа, если оно используется в вашей кампании.', 'Record the character alignment if your campaign uses it.'), 'text', { placeholder: local('Нейтрально-добрый', 'Neutral good') }),
  field('experiencePoints', 'identity', local('Опыт', 'Experience points'), local('Введите количество опыта, если вы ведёте его вручную.', 'Enter the amount of experience if you track it manually.'), 'number', { placeholder: local('0', '0') }),
]

const combatFields: SheetField[] = [
  field('armorClass', 'combat', local('Класс доспеха', 'Armor class'), local('Класс доспеха — это число, определяющее, насколько сложно попасть по персонажу. Введите итоговое значение.', 'Armor class is the number that describes how difficult it is to hit the character. Enter the final value.'), 'number', { placeholder: local('10', '10') }),
  field('initiative', 'combat', local('Инициатива', 'Initiative'), local('Введите бонус инициативы или итоговое значение, которое используете за столом.', 'Enter your initiative bonus or the final value you use at the table.'), 'text', { placeholder: local('+0', '+0') }),
  field('speed', 'combat', local('Скорость', 'Speed'), local('Укажите обычную скорость передвижения персонажа.', 'Enter the character’s normal movement speed.'), 'text', { placeholder: local('30 фт.', '30 ft.') }),
  field('proficiencyBonus', 'combat', local('Бонус мастерства', 'Proficiency bonus'), local('Бонус мастерства обычно зависит от уровня. Здесь можно ввести значение вручную.', 'The proficiency bonus usually depends on level. Enter the value manually here.'), 'text', { placeholder: local('+2', '+2') }),
  field('maxHitPoints', 'combat', local('Максимум здоровья', 'Maximum hit points'), local('Укажите максимальное количество хитов персонажа.', 'Enter the character’s maximum hit points.'), 'number', { placeholder: local('20', '20') }),
  field('currentHitPoints', 'combat', local('Текущее здоровье', 'Current hit points'), local('Укажите количество хитов, которое осталось сейчас.', 'Enter how many hit points remain right now.'), 'number', { placeholder: local('20', '20') }),
  field('temporaryHitPoints', 'combat', local('Временные хиты', 'Temporary hit points'), local('Временные хиты поглощают урон сверх обычного здоровья.', 'Temporary hit points absorb damage before ordinary hit points.'), 'number', { placeholder: local('0', '0') }),
  field('inspiration', 'combat', local('Вдохновение', 'Inspiration'), local('Отметьте, получает ли персонаж преимущество за вдохновение в текущем бою.', 'Mark whether the character has inspiration during the current combat.'), 'text', { placeholder: local('Да / Нет', 'Yes / No') }),
  field('passivePerception', 'combat', local('Пассивное восприятие', 'Passive perception'), local('Введите значение пассивного восприятия, которое вы используете без проверки навыка.', 'Enter the passive perception value used without a skill check.'), 'number', { placeholder: local('10', '10') }),
  field('senses', 'combat', local('Чувства', 'Senses'), local('Перечислите обычные или необычные чувства, доступные персонажу.', 'List the senses and special senses available to the character.'), 'text', { placeholder: local('Зрение 12, слух 10', 'Vision 12, hearing 10') }),
  field('hitDice', 'combat', local('Кубики хитов', 'Hit dice'), local('Укажите тип и количество кубиков хитов, если вы отслеживаете их вручную.', 'Record the hit die type and count if you track them manually.'), 'text', { placeholder: local('d8, 5', 'd8, 5') }),
  field('deathSaves', 'combat', local('Спасброски от смерти', 'Death saves'), local('Запишите успешные и неуспешные спасброски от смерти.', 'Track successful and failed death saves.'), 'text', { placeholder: local('2 / 0', '2 / 0') }),
]

const saveFields: SheetField[] = [
  field('saveStrength', 'saves', local('Спасбросок: сила', 'Saving throw: Strength'), local('Введите значение спасброска за силу и владение, если оно есть.', 'Enter the Strength saving throw including proficiency when applicable.'), 'text', { placeholder: local('+0', '+0') }),
  field('saveDexterity', 'saves', local('Спасбросок: ловкость', 'Saving throw: Dexterity'), local('Введите значение спасброска за ловкость и владение, если оно есть.', 'Enter the Dexterity saving throw including proficiency when applicable.'), 'text', { placeholder: local('+0', '+0') }),
  field('saveConstitution', 'saves', local('Спасбросок: телосложение', 'Saving throw: Constitution'), local('Введите значение спасброска за телосложение и владение, если оно есть.', 'Enter the Constitution saving throw including proficiency when applicable.'), 'text', { placeholder: local('+0', '+0') }),
  field('saveIntelligence', 'saves', local('Спасбросок: интеллект', 'Saving throw: Intelligence'), local('Введите значение спасброска за интеллект и владение, если оно есть.', 'Enter the Intelligence saving throw including proficiency when applicable.'), 'text', { placeholder: local('+0', '+0') }),
  field('saveWisdom', 'saves', local('Спасбросок: мудрость', 'Saving throw: Wisdom'), local('Введите значение спасброска за мудрость и владение, если оно есть.', 'Enter the Wisdom saving throw including proficiency when applicable.'), 'text', { placeholder: local('+0', '+0') }),
  field('saveCharisma', 'saves', local('Спасбросок: харизма', 'Saving throw: Charisma'), local('Введите значение спасброска за харизму и владение, если оно есть.', 'Enter the Charisma saving throw including proficiency when applicable.'), 'text', { placeholder: local('+0', '+0') }),
]

const skillDefinitions: Array<[string, string, string]> = [
  ['acrobatics', 'Акробатика', 'Acrobatics'],
  ['animalHandling', 'Обращение с животными', 'Animal Handling'],
  ['arcana', 'Аркана', 'Arcana'],
  ['athletics', 'Атлетика', 'Athletics'],
  ['deception', 'Обман', 'Deception'],
  ['history', 'История', 'History'],
  ['insight', 'Проницательность', 'Insight'],
  ['intimidation', 'Запугивание', 'Intimidation'],
  ['investigation', 'Расследование', 'Investigation'],
  ['medicine', 'Медицина', 'Medicine'],
  ['nature', 'Природа', 'Nature'],
  ['perception', 'Восприятие', 'Perception'],
  ['performance', 'Выступление', 'Performance'],
  ['persuasion', 'Убеждение', 'Persuasion'],
  ['religion', 'Религия', 'Religion'],
  ['sleightOfHand', 'Ловкость рук', 'Sleight of Hand'],
  ['stealth', 'Скрытность', 'Stealth'],
  ['survival', 'Выживание', 'Survival'],
]

const skillFields = (compact = false): SheetField[] => {
  const definitions = compact ? skillDefinitions.filter(([id]) => ['acrobatics', 'athletics', 'insight', 'investigation', 'perception', 'stealth'].includes(id)) : skillDefinitions
  return definitions.map(([id, ru, en]) => field(`skill-${id}`, 'skills', local(ru, en), local('Введите бонус навыка с учётом характеристики и владения, если оно есть.', 'Enter the skill bonus including the ability modifier and proficiency when applicable.'), 'text', { placeholder: local('+0', '+0') }))
}

const equipmentFields: SheetField[] = [
  field('equipment', 'equipment', local('Снаряжение', 'Equipment'), local('Запишите предметы, которые персонаж носит с собой или хранит.', 'List the items the character carries or keeps nearby.'), 'textarea', { rows: 4, fullWidth: true, placeholder: local('Меч, рюкзак, зелья…', 'Sword, backpack, potions…') }),
  field('gold', 'equipment', local('Золото и ценности', 'Gold & valuables'), local('Укажите монеты или другие ценности, если вы их отслеживаете.', 'Track coins or other valuables here if you use them.'), 'text', { placeholder: local('100 зм', '100 gp') }),
  field('proficiencies', 'equipment', local('Владения и умения', 'Proficiencies & languages'), local('Перечислите владения оружием, доспехами, инструментами и языками.', 'List proficiencies with weapons, armor, tools and languages.'), 'textarea', { rows: 3, fullWidth: true, placeholder: local('Длинный меч, лёгкая броня, кузнечное дело…', 'Longsword, light armor, smith’s tools…') }),
  field('conditions', 'equipment', local('Сопротивления и состояния', 'Resistances & conditions'), local('Отметьте сопротивления, иммунитеты и особые состояния персонажа.', 'Record resistances, immunities and notable conditions.'), 'textarea', { rows: 3, fullWidth: true }),
]

const featureFields: SheetField[] = [
  field('features', 'features', local('Особенности и умения', 'Features & traits'), local('Запишите способности, благословения, черты и другие постоянные особенности.', 'Record abilities, blessings, traits and other persistent features.'), 'textarea', { rows: 5, fullWidth: true, placeholder: local('Второе дыхание, тёмное зрение…', 'Second Wind, Darkvision…') }),
  field('attacks', 'features', local('Атаки', 'Attacks'), local('Перечислите основные атаки, их тип, бонус атаки и урон.', 'List your main attacks, their type, attack bonus and damage.'), 'textarea', { rows: 4, fullWidth: true, placeholder: local('Меч +7, 1d8+3 рубящий…', 'Sword +7, 1d8+3 slashing…') }),
  field('classFeatures', 'features', local('Особенности класса', 'Class features'), local('Запишите умения, полученные от класса и его уровней.', 'Record features gained from the character class and levels.'), 'textarea', { rows: 4, fullWidth: true }),
  field('feats', 'features', local('Черты и достижения', 'Feats & accomplishments'), local('Перечислите черты, достижения и другие постоянные бонусы.', 'List feats, accomplishments and other permanent bonuses.'), 'textarea', { rows: 3, fullWidth: true }),
]

const spellFields: SheetField[] = [
  field('spells', 'spells', local('Заклинания и подготовленные способности', 'Spells & prepared abilities'), local('Перечислите подготовленные заклинания, их уровни и краткое описание эффекта.', 'List prepared spells, their levels and a short effect description.'), 'textarea', { rows: 5, fullWidth: true, placeholder: local('Огненный шар · 3 круг…', 'Fireball · 3rd level…') }),
]

const characterFields: SheetField[] = [
  field('personality', 'character', local('Характер', 'Personality'), local('Опишите манеру поведения, привычки и особенности характера.', 'Describe mannerisms, habits and personality quirks.'), 'textarea', { rows: 3, fullWidth: true }),
  field('ideals', 'character', local('Идеалы', 'Ideals'), local('Опишите принципы и идеалы, которые важны для персонажа.', 'Describe the principles and ideals that matter to the character.'), 'textarea', { rows: 3, fullWidth: true }),
  field('bonds', 'character', local('Привязанности', 'Bonds'), local('Опишите людей, места или вещи, к которым персонаж привязан.', 'Describe the people, places or things the character is bonded to.'), 'textarea', { rows: 3, fullWidth: true }),
  field('flaws', 'character', local('Слабости', 'Flaws'), local('Укажите слабости, страхи или недостатки персонажа.', 'Record the character’s flaws, fears or shortcomings.'), 'textarea', { rows: 3, fullWidth: true }),
]

const noteFields: SheetField[] = [
  field('notes', 'notes', local('Заметки', 'Notes'), local('Используйте это поле для любых заметок, которые не поместились в другие разделы.', 'Use this field for notes that do not fit into another section.'), 'textarea', { rows: 6, fullWidth: true, placeholder: local('Сюда можно добавить цели, квесты или важные детали…', 'Goals, quests or important details…') }),
]

export function getFields(template: SheetTemplate, ruleset: Ruleset, language?: Language): SheetField[] {
  let fields: SheetField[] = [...identityFields, ...abilityFields, ...combatFields, ...saveFields, ...skillFields(template === 'compact'), ...equipmentFields, ...featureFields, ...spellFields, ...characterFields, ...noteFields]

  // The 2024 rules use a revised character sheet vocabulary. The layout stays
  // familiar, while the field descriptions can evolve independently later.
  // This runs before the compact filter: both changes must apply to a compact
  // 2024 sheet, and an early return would silently skip these labels.
  if (ruleset === '2024' && language === 'ru') {
    fields = fields.map((item) => {
      if (item.id === 'classLevel') return { ...item, label: local('Класс и уровень · 2024', 'Class & level · 2024') }
      if (item.id === 'race') return { ...item, label: local('Вид / происхождение', 'Species / origin') }
      return item
    })
  }

  if (template === 'compact') {
    return fields.filter((item) => !['background', 'alignment', 'experiencePoints', 'inspiration', 'gold', 'passivePerception', 'senses', 'hitDice', 'deathSaves', 'proficiencies', 'conditions', 'classFeatures', 'feats', 'personality', 'ideals', 'bonds', 'flaws'].includes(item.id))
  }

  return fields
}
