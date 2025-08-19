const bcrypt = require('bcrypt');

const plainPassword = '455454';

const newHash = bcrypt.hashSync(plainPassword, 10);
console.log('New Hash for password "455454":', newHash);
