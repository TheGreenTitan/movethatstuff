ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';

UPDATE users SET role = 'admin' WHERE username = 'admin';