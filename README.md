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
