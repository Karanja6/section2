const mysql = require('mysql2');

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: 'localhost',    
    user: 'root',        
    password: '09222315037@Mw',        
    database: 'order_management',  // Ensure this is the correct database name
    connectionLimit: 10,  // Maximum number of connections in the pool
});

// Export the pool to be used in other parts of the application
module.exports = { pool };
