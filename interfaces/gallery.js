const copy = {
 ru: { title: 'Интерфейсы DPrice', intro: 'Каждый экран можно открыть отдельно. Кабинеты показывают фиксированные синтетические примеры: данные не сохраняются, расчёты не запускаются.', roles: 'Открыть кабинет в выбранной роли', footer: 'Кабинеты — интерфейс релиза v0.16.9. Калькулятор, сравнение квартир и игра — отдельные ранее опубликованные модели. Ранний интерфейс трёх рынков сохранён отдельно.' },
 en: { title: 'DPrice interfaces', intro: 'Open each interface independently. Account previews show fixed synthetic examples: nothing is saved and no calculations run.', roles: 'Open a workspace by role', footer: 'Account previews use release v0.16.9. The calculator, apartment comparison and game are separate previously published models. The earlier three-market interface is preserved separately.' },
};
const pages = [
 ['landing', '01 · PUBLIC', ['Лендинг', 'Landing'], ['Тексты, регионы и публичная навигация.', 'Copy, regions and public navigation.']],
 ['login', '02 · ACCESS', ['Вход и роли', 'Login and roles'], ['Выбор роли без ввода пароля.', 'Choose a role without entering credentials.']],
 ['product', '03 · WORKSPACE', ['Рабочий кабинет', 'Product workspace'], ['Два проекта, восемь вкладок, таблица и шахматка.', 'Two projects, eight tabs, inventory table and chessboard.']],
 ['demo', '04 · DEMO', ['Демо-кабинет', 'Demo workspace'], ['Те же примеры в контексте демонстрации.', 'The same examples in a demo entry context.']],
 ['admin', '05 · ADMIN', ['Администрирование', 'Administration'], ['Обратная связь и редактируемые планы без сохранения.', 'Feedback and editable plans without saving.']],
 ['prototype', '06 · EARLIER', ['Три рынка · ранний интерфейс', 'Three markets · earlier UI'], ['Девять экранов, пять проектов на каждый рынок.', 'Nine views, five projects per market.']],
 ['calculator', '07 · MODEL', ['ROI-калькулятор', 'ROI calculator'], ['Существующая самостоятельная модель сценариев.', 'The existing independent scenario model.']],
 ['apartments', '08 · MODEL', ['Сравнение квартир', 'Apartment comparison'], ['Существующие примеры по регионам с допущениями.', 'Existing regional examples with stated assumptions.']],
 ['game', '09 · GAME', ['Игра DPrice', 'DPrice game'], ['Существующая игра с локальными результатами.', 'The existing game with local scores.']],
];
const roles = [['manager',['Менеджер','Manager']],['director',['Руководитель','Director']],['analyst',['Аналитик','Analyst']],['data_steward',['Специалист по данным','Data specialist']],['loop_admin',['Администратор','Administrator']]];
let lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ru';
function paint() {
 const c=copy[lang], n=lang==='en'?1:0; document.documentElement.lang=lang;
 for(const key of ['title','intro','footer'])document.getElementById(key).textContent=c[key];
 document.getElementById('roles-title').textContent=c.roles;
 document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lang===lang));
 const cards=document.getElementById('cards');cards.replaceChildren();
 for(const [route,tag,title,description] of pages){const a=document.createElement('a');a.className='gallery-card';a.href=`../${route}/?lang=${lang}`;a.dataset.interface=route;const small=document.createElement('small');small.textContent=tag;const h=document.createElement('h2');h.textContent=title[n];const p=document.createElement('p');p.textContent=description[n];a.append(small,h,p);cards.append(a);}
 const list=document.getElementById('roles');list.replaceChildren();
 for(const [role,label] of roles){const a=document.createElement('a');a.href=`../product/?role=${role}&lang=${lang}`;a.textContent=label[n];a.dataset.role=role;list.append(a);}
 history.replaceState(null,'',`?lang=${lang}`);
}
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.lang;paint();}));paint();
