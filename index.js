const fs = require('fs');
const { Telegraf } = require('telegraf');
const schedule = require('node-schedule');

const bot = new Telegraf('');

// JSON-файл для хранения задач и состояния
const tasksFile = './tasks.json';

// ID группы
const groupId = '-1002398088687';

// Список ID пользователей, которым доступна админ-панель
const adminIds = []; // Замените на ваши ID

// Функция для проверки, является ли пользователь администратором
function isAdmin(ctx) {
  return adminIds.includes(ctx.from.id);
}

// Функция для загрузки задач из файла
function loadTasks() {
  try {
    if (!fs.existsSync(tasksFile)) {
      return { currentMode: null, paused: false, modes: {} };
    }
    return JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
  } catch (error) {
    console.error('Ошибка загрузки задач:', error);
    return { currentMode: null, paused: false, modes: {} };
  }
}

// Функция для сохранения задач в файл
function saveTasks(data) {
  try {
    fs.writeFileSync(tasksFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка сохранения задач:', error);
  }
}

// Функция для получения текущей даты в формате YYYY-MM-DD
function getCurrentDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Функция для проверки, является ли сегодня воскресенье
function isSunday() {
  return new Date().getDay() === 0; // Воскресенье имеет индекс 0
}

// Начальное состояние
let tasksData = loadTasks();

// Команда /pause для приостановки напоминаний
bot.command('pause', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Sizda ushbu amalni bajarish uchun ruxsat yo‘q.');

  tasksData.paused = true;
  saveTasks(tasksData);
  ctx.reply('Bot muvaffaqiyatli to‘xtatildi. Vazifalar yuborilmaydi.');
});

// Команда /resume для возобновления напоминаний
bot.command('resume', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Sizda ushbu amalni bajarish uchun ruxsat yo‘q.');

  tasksData.paused = false;
  saveTasks(tasksData);
  ctx.reply('Bot davom ettirildi. Vazifalar yana yuboriladi.');
});

// Автоматическое напоминание о задачах с проверкой на воскресенье
schedule.scheduleJob('*/3 * * * *', () => { // Запуск каждые 3 минуты
  if (tasksData.paused || isSunday()) return;

  const mode = tasksData.currentMode;
  if (!mode) return;

  const tasks = tasksData.modes[mode]?.tasks || [];
  const today = getCurrentDate();
  const todayTasks = tasks.filter((task) => task.date === today);

  if (todayTasks.length === 0) {
    bot.telegram.sendMessage(groupId, 'Bugun uchun hech qanday vazifa mavjud emas.');
    return;
  }

  const response = todayTasks.map((task) => `${task.name} - ${task.date}`).join('\n');
  bot.telegram.sendMessage(groupId, `Eslatma! Bugungi vazifalar:\n\n${response}`);
});


// Остальной код (без изменений)

// Команда /start для выбора режима
bot.start(async (ctx) => {
  await ctx.reply(
    'Qaysi rejimni yoqmoqchisiz?\n/startnaming - Naming\n/startbrending - Brending\n/startmarketing - Marketing\n/startpackaging - Packaging'
  );
});

// Команды для выбора режима
['naming', 'brending', 'marketing', 'packaging'].forEach((mode) => {
  bot.command(`start${mode}`, (ctx) => {
    tasksData.currentMode = mode;
    tasksData.modes[mode] = tasksData.modes[mode] || { currentTask: 0, tasks: [] };
    saveTasks(tasksData);
    ctx.reply(`${mode.charAt(0).toUpperCase() + mode.slice(1)} rejimi yoqildi!`);
  });
});

// Команда /tasks для отображения всех задач текущего режима
bot.command('tasks', (ctx) => {
  const mode = tasksData.currentMode;
  if (!mode) {
    return ctx.reply('Hech qanday rejim tanlanmagan!');
  }

  const tasks = tasksData.modes[mode]?.tasks || [];
  if (tasks.length === 0) {
    return ctx.reply('Bu rejimda hali vazifa yo‘q.');
  }

  const response = tasks.map((task, index) => `${index + 1}. ${task.name} - ${task.date}`).join('\n');
  ctx.reply(`Hozirgi rejimdagi barcha vazifalar:\n\n${response}`);
});

// Команда /remind для отображения сегодняшних задач
bot.command('remind', (ctx) => {
  const mode = tasksData.currentMode;
  if (!mode) {
    return ctx.reply('Hech qanday rejim tanlanmagan!');
  }

  const tasks = tasksData.modes[mode]?.tasks || [];
  const today = getCurrentDate();
  const todayTasks = tasks.filter((task) => task.date === today);

  if (todayTasks.length === 0) {
    return ctx.reply('Bugungi kun uchun vazifa yo‘q.');
  }

  const response = todayTasks.map((task, index) => `${index + 1}. ${task.name}`).join('\n');
  ctx.reply(`Bugungi vazifalar:\n\n${response}`);
});

// Команда /addtask для добавления задач с датой
bot.command('addtask', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Sizda ushbu amalni bajarish uchun ruxsat yo‘q.');

  const args = ctx.message.text.split(' ').slice(1);
  const mode = args[0];
  const taskName = args.slice(1, -1).join(' ');
  const date = args[args.length - 1];

  if (!mode || !taskName || !date) {
    return ctx.reply(
      'Vazifa qo\'shish uchun to\'liq ma\'lumot kiriting:\n/addtask [mode] [task_name] [YYYY-MM-DD]'
    );
  }

  if (!tasksData.modes[mode]) {
    return ctx.reply(`Rejim topilmadi: ${mode}`);
  }

  tasksData.modes[mode].tasks.push({ name: taskName, date });
  tasksData.modes[mode].tasks = tasksData.modes[mode].tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
  saveTasks(tasksData);
  ctx.reply(`Yangi vazifa qo'shildi rejimga ${mode}: ${taskName} - ${date}`);
});

bot.launch();
