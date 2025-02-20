const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Crear una nueva base de datos en el archivo "cars.db"
const dbPath = path.resolve(__dirname, 'cars.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err);
    } else {
        console.log('Conexión a la base de datos SQLite exitosa');
    }
});

// Crear las tablas si no existen
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS Cars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            year TEXT NOT NULL,
            miles INTEGER NOT NULL,
            purchasePrice INTEGER NOT NULL,
            description TEXT,
            photo TEXT,
            status TEXT DEFAULT 'Disponible'
        )
    `);
    db.run(`
        ALTER TABLE Cars
        ADD COLUMN saleDateAdd TEXT
    `, (err) => {
        if (err) {
            if (err.code === 'SQLITE_ERROR' && err.message.includes('duplicate column name')) {
                console.log('La columna saleDateAdd ya existe');
            } else {
                console.error('Error al agregar la columna:', err);
            }
        } else {
            console.log('Columna saleDateAdd agregada correctamente');
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS Expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            carId INTEGER,
            description TEXT NOT NULL,
            amount INTEGER NOT NULL,
            FOREIGN KEY (carId) REFERENCES Cars(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            carId INTEGER,
            salePrice INTEGER NOT NULL,
            saleDate TEXT NOT NULL,
            FOREIGN KEY (carId) REFERENCES Cars(id)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    `);
    
});

module.exports = db;


//xxxx