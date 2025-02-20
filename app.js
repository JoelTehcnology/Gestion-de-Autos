
const express = require("express");
const path = require("path");
const db = require("./database"); // Importa la base de datos SQLite
const multer = require("multer");
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');  // Usaremos bcrypt para encriptar la contraseña
const session = require('express-session');



// Configura el motor de vistas como EJS
app.set('view engine', 'ejs');

// Agrega esta línea para servir archivos estáticos desde la carpeta "uploads"
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configura el middleware para servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


require('dotenv').config(); // Esto carga las variables del archivo .env
console.log("SESSION_SECRET:", process.env.SESSION_SECRET);  // mostrar el valor en la consola

app.use(session({
    secret: process.env.SESSION_SECRET, // Usamos el valor de la variable de entorno
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 }
}));

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        return res.redirect('/TheCompasAutoImport'); // Redirige al login si no está autenticado
    }
}
app.get('/TheCompasAutoImportindex', isAuthenticated, (req, res) => {
    res.render('index', { user: req.session.user });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.json({ success: false, errorMessage: 'Por favor complete todos los campos' });
    }

    db.get('SELECT * FROM Users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.json({ success: false, errorMessage: 'Error al buscar el usuario' });
        }

        if (!user) {
            return res.json({ success: false, errorMessage: 'Usuario no encontrado' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.json({ success: false, errorMessage: 'Error al comparar las contraseñas' });
            }

            if (!isMatch) {
                return res.json({ success: false, errorMessage: 'Contraseña incorrecta' });
            }

            // Guardar el usuario en la sesión
            req.session.user = { id: user.id, username: user.username };
            return res.json({ success: true });
        });
    });
});


app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al cerrar la sesión:', err);
        }
        res.redirect('/login'); // Redirige al login después de cerrar sesión
    });
});


// Ruta para el formulario de registro
app.post('/register', (req, res) => {
    console.log(req.body);  // Verifica el contenido de req.body
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Por favor complete todos los campos');
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).send('Error al encriptar la contraseña');
        }

        // Insertar el nuevo usuario en la base de datos
        db.run('INSERT INTO Users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err) {
            if (err) {
                return res.status(500).send('Error al registrar el usuario');
            }

            res.status(200).send('Usuario registrado exitosamente');
        });
    });
});

app.get("/getTotalAssets", (req, res) => {
    const query = `
        SELECT 
            (SELECT SUM(Cars.purchasePrice) FROM Cars WHERE Cars.status = 'Disponible') AS totalPurchasePrice,
            COALESCE(SUM(Expenses.amount), 0) AS totalExpenses
        FROM Cars
        LEFT JOIN (
            SELECT carId, SUM(amount) AS amount FROM Expenses GROUP BY carId
        ) AS Expenses ON Cars.id = Expenses.carId
        WHERE Cars.status = 'Disponible'
    `;
    db.get(query, [], (err, row) => {
        if (err) {
            console.error("Error al calcular total de activos:", err);
            res.status(500).json({ error: "Error al calcular total de activos" });
        } else {
            const totalAssets = row.totalPurchasePrice + row.totalExpenses;
            res.json({ totalAssets });
        }
    });
});


 
// Configura multer para manejar el almacenamiento de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Carpeta donde se guardarán las imágenes
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Nombre único del archivo
    }
});
// Configura el límite de tamaño del archivo (50 MB = 50* 1024 * 1024 bytes)
const upload = multer({
    storage: storage,
    limits: { fileSize: 50* 1024 * 1024 } // 5 MB
});



// Rutas y lógica de la aplicación (ejemplos)

app.get("/TheCompasAutoImport", (req, res) => {
    res.render("login");
});

// Rutas y lógica de la aplicación (ejemplos)
app.get("/TheCompasAutoImportindex", (req, res) => {
    res.render("index");
});



// Ruta GET para obtener todos los autos de la base de datos.
app.get("/getCars", (req, res) => {
    const query = "SELECT * FROM Cars";
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Error al obtener autos:", err);
            res.status(500).json({ error: "Error al obtener autos" });
        } else {
            res.json(rows);
        }
    });
});

// Ruta DELETE para eliminar un auto en la base de datos
app.delete("/deleteCar/:id", (req, res) => {
    const carId = req.params.id;
    const query = `DELETE FROM Cars WHERE id = ?`;
    db.run(query, [carId], function (err) {
        if (err) {
            console.error("Error al eliminar auto:", err);
            res.status(500).json({ error: "Error al eliminar auto" });
        } else {
            res.json({ message: "Auto eliminado exitosamente" });
        }
    });
});

// Ruta PUT para actualizar un auto en la base de datos
app.put("/updateCar/:id", upload.single('photo'), (req, res) => {
    const carId = req.params.id;
    const { brand, model, year, miles, purchasePrice, description, status } = req.body;
    const photo = req.file ? req.file.path : null; // Guardar la ruta del archivo, si se proporciona

    // Construir la consulta dinámica dependiendo de si la foto está presente o no
    let query = `
        UPDATE Cars
        SET brand = ?, model = ?, year = ?, miles = ?, purchasePrice = ?, description = ?, status = ?
    `;
    
    let params = [brand, model, year, miles, purchasePrice, description, status];

    // Solo agregar la foto a la consulta si se subió una nueva
    if (photo) {
        query += `, photo = ?`;
        params.push(photo);
    }

    query += ` WHERE id = ?`;
    params.push(carId);

    db.run(query, params, function (err) {
        if (err) {
            console.error("Error al actualizar auto:", err);
            res.status(500).json({ error: "Error al actualizar auto" });
        } else {
            res.json({ message: "Auto actualizado exitosamente" });
        }
    });
});
// Ruta POST para vender un auto
app.post("/sellCar", (req, res) => {
    const { carId, salePrice, saleDate } = req.body;
    const query = `
        INSERT INTO Sales (carId, salePrice, saleDate)
        VALUES (?, ?, ?)
    `;
    db.run(query, [carId, salePrice, saleDate], function (err) {
        if (err) {
            console.error("Error al registrar la venta:", err);
            res.status(500).json({ error: "Error al registrar la venta" });
        } else {
            // Actualizar el estado del auto
            const updateQuery = `UPDATE Cars SET status = 'Vendido' WHERE id = ?`;
            db.run(updateQuery, [carId], function (updateErr) {
                if (updateErr) {
                    console.error("Error al actualizar el estado del auto:", updateErr);
                    res.status(500).json({ error: "Error al actualizar el estado del auto" });
                } else {
                    res.json({ message: "Venta registrada exitosamente" });
                }
            });
        }
    });
});

// Ruta GET para obtener todos los autos vendidos
// Ruta GET para obtener todos los autos vendidos
app.get("/soldCars", (req, res) => {
    const query = `
        SELECT Sales.id AS saleId,
               Cars.id AS carId,
               Cars.brand,
               Cars.model,
               Cars.year,
               Cars.purchasePrice,
               Sales.salePrice,
               Sales.saleDate, 
               (Cars.purchasePrice + COALESCE((SELECT SUM(amount) FROM Expenses WHERE carId = Cars.id), 0)) AS totalCost,
               (Sales.salePrice - (Cars.purchasePrice + COALESCE((SELECT SUM(amount) FROM Expenses WHERE carId = Cars.id), 0))) AS profitOrLoss
        FROM Sales
        JOIN Cars ON Sales.carId = Cars.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Error al obtener autos vendidos:", err);
            res.status(500).json({ error: "Error al obtener autos vendidos" });
        } else {
            // Formatear los resultados para la salida
            const formattedRows = rows.map(row => ({
                saleId: row.saleId,
                brand: row.brand,
                model: row.model,
                year: row.year,
                purchasePrice: formatCurrency(row.purchasePrice),
                salePrice: formatCurrency(row.salePrice),
                saleDate: row.saleDate,  // Incluimos la fecha de la venta
                totalCost: formatCurrency(row.totalCost),
                profitOrLoss: formatCurrency(row.profitOrLoss)
            }));
            res.json(formattedRows);
        }
    });
});


// Función para formatear la moneda en USD
function formatCurrency(value) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}


// Ruta POST para agregar un nuevo auto a la base de datos.
app.post("/addCar", upload.single('photo'), (req, res) => {
    const { brand, model, year, miles, purchasePrice, description, status, saleDateAdd } = req.body;
    const photo = req.file ? req.file.path : ''; // Guardar la ruta de la foto

    const query = `
        INSERT INTO Cars (brand, model, year, miles, purchasePrice, description, photo, status, saleDateAdd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [brand, model, year, miles, purchasePrice, description, photo, status, saleDateAdd], function (err) {
        if (err) {
            console.error("Error al agregar auto:", err);
            res.status(500).json({ error: "Error al agregar auto" });
        } else {
            res.json({ 
                message: "Auto agregado exitosamente", 
                car: { brand, model, year, miles, purchasePrice, description, photo, status, saleDateAdd }, 
                id: this.lastID 
            });
        }
    });
});

// Ruta POST para agregar un gasto a un vehículo
app.post("/addExpense", (req, res) => {
    const { carId, description, amount } = req.body;
    const query = `
        INSERT INTO Expenses (carId, description, amount)
        VALUES (?, ?, ?)
    `;
    db.run(query, [carId, description, amount], function (err) {
        if (err) {
            console.error("Error al agregar gasto:", err);
            res.status(500).json({ error: "Error al agregar gasto" });
        } else {
            res.json({ message: "Gasto agregado exitosamente", id: this.lastID });
        }
    });
});


// Ruta GET para obtener los gastos de un auto específico
app.get("/getExpenses", (req, res) => {
    const { carId } = req.query;
    const query = `SELECT * FROM Expenses WHERE carId = ?`;
    db.all(query, [carId], (err, rows) => {
        if (err) {
            console.error("Error al obtener gastos:", err);
            res.status(500).json({ error: "Error al obtener gastos" });
        } else {
            res.json(rows);
        }
    });
});


//FUNCION PARA ELIMINAR UN GASTO!
app.delete('/deleteExpense', (req, res) => {
    const { expenseId } = req.query;

    if (!expenseId) {
        return res.status(400).json({ error: "No se proporcionó un ID de gasto." });
    }

    const sqlDelete = 'DELETE FROM Expenses WHERE id = ?';
    db.run(sqlDelete, [expenseId], function (err) {
        if (err) {
            console.error("Error al eliminar el gasto:", err.message);
            return res.status(500).json({ error: "Error interno del servidor." });
        }

        if (this.changes === 0) {
            console.log("Gasto no encontrado para eliminar.");
            return res.status(404).json({ error: "Gasto no encontrado." });
        }

        console.log("Gasto eliminado correctamente.");
        res.json({ success: true });
    });
});



app.listen(3000, () => {
    console.log("Corriendo en el puerto 3000");
});