# Beach Event Checklist

דף HTML אינטרקטיבי בעברית (RTL) לערב בים: צ'קליסטים, חלוקת ציוד, רשימת קניות ומידע חיוני.

## Run Locally

פותחים את `index.html` בדפדפן.

## Deploy to GitHub Pages

1. יוצרים ריפו חדש ב-GitHub (למשל `beach-event-site`).
2. מעלים את הקבצים של הפרויקט ל-branch `main`.
3. ב-GitHub נכנסים ל-Settings -> Pages.
4. בוחרים Source: `Deploy from a branch`.
5. בוחרים Branch: `main` ו-Folder: `/ (root)`.
6. שומרים וממתינים ליצירת הלינק.

הלינק ייראה כך:

`https://<username>.github.io/<repo>/`

## Notes

- מצב צ'קליסטים נשמר ב-Supabase בזמן אמת (עם fallback ל-`localStorage` אם אין חיבור).
- הקובץ `.nojekyll` נוסף כדי למנוע עיבוד Jekyll לא נחוץ.
- כניסה לאתר מזוהה לפי שם חופשי (נשמר ב-`localStorage` במכשיר). אפשר להחליף שם דרך כפתור "החלף שם" ליד תאריך האירוע.
- סעיף "ציוד אישי" נמצא בתחתית הדף ונשאר פרטי למכשיר (לא מסתנכרן).
- ברשימות המשותפות (זוגות + קניות), סימון פריט מתעד בקטן מי סימן אותו ("סומן ע"י &lt;שם&gt;"); ביטול הסימון מסיר את התיעוד.

## עדכון סכימת Supabase קיימת

אם כבר יש לכם פרויקט Supabase פעיל מלפני העדכון הזה, צריך להריץ פעם אחת ב-SQL Editor (כדי להוסיף את עמודת `checked_by`):

```sql
alter table public.event_state
  add column if not exists checked_by jsonb not null default '{}'::jsonb;
```

(גם ריצה מלאה מחדש של `supabase.sql` תעבוד, כי כל הפקודות שם אידמפוטנטיות.)

## Supabase Setup

1. יוצרים פרויקט ב-Supabase.
2. מריצים ב-SQL Editor את התוכן של `supabase.sql`.
3. מעתיקים `Project URL` ו-`anon public key` מתוך Settings -> API.
4. יוצרים קובץ `app-config.js` על בסיס `app-config.example.js` ומעדכנים בו:
   - `supabaseUrl`
   - `supabaseAnonKey`
   - `eventId` (אפשר להשאיר ערך קיים לאירוע יחיד)
5. `app-config.js` מוגדר ב-`.gitignore`, כך שהמפתחות האמיתיים נשארים לוקאליים ולא עולים לריפו.
6. פותחים את האתר בשני חלונות/מכשירים ובודקים שהסימונים והפריטים החדשים מסתנכרנים.
