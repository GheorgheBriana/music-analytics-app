-- Rulează în DBeaver DUPĂ ce aplicația a pornit prima dată
-- (după ce Hibernate a creat coloana role în tabela oltp.app_users)

-- Promovează utilizatorul curent la rolul ADMIN
UPDATE oltp.app_users
SET role = 'ADMIN'
WHERE email = 'admin@gmail.com';

-- Verificare
SELECT id, username, email, role FROM oltp.app_users WHERE role = 'ADMIN';
