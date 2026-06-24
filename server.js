const http = require('http');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

const PUERTO = process.env.PORT || 3000;
const PINES_ADMIN = ["0000", "1234"];

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

// MODELO
const clienteSchema = new mongoose.Schema({}, { strict: false });
const Cliente = mongoose.model('Cliente', clienteSchema);

const servidor = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // -------------------------------------------------------------
    // RUTA: VERIFICAR SI PIN YA EXISTE
    // -------------------------------------------------------------
    if (req.method === 'GET' && req.url.startsWith('/verificar-pin')) {
        try {
            const urlParams = new URL(req.url, `http://${req.headers.host}`);
            const pin = urlParams.searchParams.get('pin');
            
            if (!pin) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ existe: false }));
                return;
            }
            
            const existe = await Cliente.findOne({ pinCliente: pin });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ existe: !!existe }));
        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Error al verificar PIN" }));
        }
    }

    // -------------------------------------------------------------
    // RUTA: GUARDAR CLIENTE (NO GENERA PIN NUEVO)
    // -------------------------------------------------------------
    else if (req.method === 'POST' && req.url === '/guardar-cliente') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const nuevoRegistro = JSON.parse(cuerpo);
                
                // Normalizar cédula
                if (nuevoRegistro.cedulaRuc) {
                    nuevoRegistro.cedulaRuc = nuevoRegistro.cedulaRuc.toString().trim();
                }

                // VALIDAR que el PIN venga del frontend (NO lo generamos aquí)
                if (!nuevoRegistro.pinCliente || nuevoRegistro.pinCliente.toString().trim() === "") {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "El PIN es obligatorio. Debe generarse en el formulario." }));
                    return;
                }

                nuevoRegistro.pinCliente = nuevoRegistro.pinCliente.toString().trim();

                // Guardar en MongoDB
                const nuevoDoc = new Cliente(nuevoRegistro);
                await nuevoDoc.save();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    mensaje: "Cliente guardado correctamente", 
                    pin: nuevoRegistro.pinCliente 
                }));
            } catch (e) {
                console.error(e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al guardar en el servidor" }));
            }
        });
    }

    // ============================================================
    // RUTAS PARA INVENTARIO
    // ============================================================

    // Obtener todos los productos del inventario
    else if (req.method === 'GET' && req.url === '/obtener-inventario') {
        try {
            const productos = await Inventario.find({});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(productos));
        } catch (error) {
            console.error("Error obteniendo inventario:", error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Error al obtener inventario" }));
        }
    }

    // Guardar nuevo producto
    else if (req.method === 'POST' && req.url === '/guardar-producto') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const datos = JSON.parse(cuerpo);
                const nuevoProducto = new Inventario({
                    nombre: datos.nombre,
                    costo: datos.costo,
                    precioVenta: datos.precioVenta,
                    stock: datos.stock,
                    proveedor: datos.proveedor || ''
                });
                await nuevoProducto.save();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ mensaje: "Producto guardado correctamente" }));
            } catch (error) {
                console.error("Error guardando producto:", error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al guardar producto" }));
            }
        });
    }

    // Actualizar producto existente
    else if (req.method === 'POST' && req.url === '/actualizar-producto') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const datos = JSON.parse(cuerpo);
                await Inventario.updateOne(
                    { _id: datos._id },
                    {
                        $set: {
                            nombre: datos.nombre,
                            costo: datos.costo,
                            precioVenta: datos.precioVenta,
                            stock: datos.stock,
                            proveedor: datos.proveedor || ''
                        }
                    }
                );
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ mensaje: "Producto actualizado correctamente" }));
            } catch (error) {
                console.error("Error actualizando producto:", error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al actualizar producto" }));
            }
        });
    }

    // Eliminar producto
    else if (req.method === 'POST' && req.url === '/eliminar-producto') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const { _id } = JSON.parse(cuerpo);
                await Inventario.deleteOne({ _id: _id });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ mensaje: "Producto eliminado correctamente" }));
            } catch (error) {
                console.error("Error eliminando producto:", error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al eliminar producto" }));
            }
        });
    }

    // -------------------------------------------------------------
    // RUTA: VALIDACIÓN DE PIN
    // -------------------------------------------------------------
    else if (req.method === 'POST' && req.url === '/validar-pin') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const { pin } = JSON.parse(cuerpo);
                
                if (PINES_ADMIN.includes(pin)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ valido: true, rol: 'admin' }));
                    return;
                }

                const coincidencia = await Cliente.findOne({ pinCliente: pin });

                if (coincidencia) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ valido: true, rol: 'cliente', cliente: coincidencia.cliente }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ valido: false }));
                }
            } catch (e) {
                console.error(e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error en servidor" }));
            }
        });
    }

    // -------------------------------------------------------------
    // RUTA: ELIMINAR REGISTRO ESPECÍFICO (TRABAJO COMPLETO)
    // -------------------------------------------------------------
    else if (req.method === 'POST' && req.url === '/eliminar-registro') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const { pinCliente, fechaIngreso } = JSON.parse(cuerpo);
                console.log("📌 Servidor recibió - PIN:", pinCliente, "Fecha:", fechaIngreso);
                
                const resultado = await Cliente.deleteMany({ pinCliente: pinCliente, fechaIngreso: fechaIngreso });
                console.log("📊 Registros eliminados:", resultado.deletedCount);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    mensaje: "Registro eliminado exitosamente",
                    eliminados: resultado.deletedCount 
                }));
            } catch (e) {
                console.error("❌ Error:", e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al eliminar" }));
            }
        });
    }

    // -------------------------------------------------------------
    // RUTA: ELIMINAR CLIENTE COMPLETO
    // -------------------------------------------------------------
    else if (req.method === 'POST' && req.url === '/eliminar-cliente') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const { cedulaRuc } = JSON.parse(cuerpo);
                await Cliente.deleteMany({ cedulaRuc: cedulaRuc });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ mensaje: "Cliente eliminado correctamente" }));
            } catch (e) {
                console.error(e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al eliminar" }));
            }
        });
    }

    // -------------------------------------------------------------
    // RUTA: ACTUALIZAR PIN MASIVO
    // -------------------------------------------------------------
    else if (req.method === 'POST' && req.url === '/actualizar-pin-masivo') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const { cedulaRuc, nuevoPin } = JSON.parse(cuerpo);
                
                await Cliente.updateMany(
                    { cedulaRuc: cedulaRuc },
                    { $set: { pinCliente: nuevoPin } }
                );
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ mensaje: "PIN actualizado en todos los registros." }));
            } catch (e) {
                console.error(e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al actualizar" }));
            }
        });
    }

    // -------------------------------------------------------------
    // RUTA: OBTENER CLIENTES
    // -------------------------------------------------------------
    else if (req.method === 'GET' && req.url.startsWith('/obtener-clientes')) {
        try {
            const urlParams = new URL(req.url, `http://${req.headers.host}`);
            const pinCliente = urlParams.searchParams.get('pin');

            if (!pinCliente) {
                const todosLosDocs = await Cliente.find({});
                const todosLosClientes = todosLosDocs.map(doc => doc.toObject());
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(todosLosClientes));
                return;
            }

            if (PINES_ADMIN.includes(pinCliente)) {
                const todoElHistorialDocs = await Cliente.find({});
                const todoElHistorial = todoElHistorialDocs.map(doc => doc.toObject());
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(todoElHistorial));
                return;
            }
            
            const registroCliente = await Cliente.findOne({ pinCliente: pinCliente });
            if (registroCliente) {
                const documentosFiltrados = await Cliente.find({ cliente: registroCliente.cliente });
                const datosFiltrados = documentosFiltrados.map(doc => {
                    let clon = doc.toObject();
                    if (clon.repuestos && Array.isArray(clon.repuestos)) {
                        clon.repuestos = clon.repuestos.map(rep => {
                            if (rep.descuento) delete rep.descuento;
                            return rep;
                        });
                    }
                    return clon;
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(datosFiltrados));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "El PIN ingresado no es válido." }));
            }
        } catch (e) {
            console.error(e);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Error al obtener clientes" }));
        }
    }

    // -------------------------------------------------------------
    // RUTA: ELIMINAR POR ID (ÚNICO)
    // -------------------------------------------------------------
    else if (req.method === 'POST' && req.url === '/eliminar-por-id') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const { id } = JSON.parse(cuerpo);
                console.log("📌 Eliminando por ID:", id);
                
                const resultado = await Cliente.deleteOne({ _id: id });
                console.log("📊 Eliminados:", resultado.deletedCount);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    mensaje: "Registro eliminado exitosamente",
                    eliminados: resultado.deletedCount 
                }));
            } catch (e) {
                console.error("❌ Error:", e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al eliminar" }));
            }
        });
    }

    // -------------------------------------------------------------
    // RUTA: ARCHIVOS ESTÁTICOS
    // -------------------------------------------------------------
    else if (req.method === 'GET') {
        let urlPublica = req.url === '/' ? 'index.html' : req.url.split('?')[0];
        let rutaArchivo = path.join(__dirname, urlPublica);

        if (!rutaArchivo.startsWith(__dirname)) {
            res.writeHead(403);
            res.end('Acceso denegado');
            return;
        }

        let extension = path.extname(rutaArchivo);
        let contentType = 'text/html';
        const tiposMime = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
        contentType = tiposMime[extension] || 'text/html';

        fs.readFile(rutaArchivo, (err, contenido) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Archivo no encontrado');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(contenido, 'utf-8');
            }
        });
    }
});

servidor.listen(PUERTO, '0.0.0.0', () => {
    console.log(`\n🚀 Servidor corregido y funcionando`);
    console.log(`📌 Puerto: ${PUERTO}`);
    console.log(`📌 Los PINs se generan en el frontend (6 dígitos)`);
    console.log(`📌 El servidor NO genera PINs automáticamente`);
});