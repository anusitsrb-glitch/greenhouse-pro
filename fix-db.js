const Database = require("better-sqlite3");

const db = new Database("D:/SmartWebApp/greenhouse-pro/server/data/greenhouse.db");

function run(sql){
  try {
    db.exec(sql);
    console.log("OK:", sql);
  } catch (e) {
    console.log("SKIP:", sql, "->", e.message);
  }
}

run("ALTER TABLE users ADD COLUMN full_name TEXT;");
run("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;");
run("UPDATE users SET must_change_password = 0 WHERE must_change_password IS NULL;");
run("UPDATE users SET must_change_password = 0 WHERE username = 'superadmin';"); // หรือใช้ email ก็ได้
console.log("COLUMNS:", db.prepare("PRAGMA table_info(users)").all().map(r => r.name));

db.close();
