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

// ============================================================
// MODELOS
// ============================================================
const clienteSchema = new mongoose.Schema({}, { strict: false });
const Cliente = mongoose.model('Cliente', clienteSchema);

const inventarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    costo: { type: Number, required: true },
    precioVenta: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    proveedor: { type: String, default: '' },
    fechaCreacion: { type: Date, default: Date.now }
});
const Inventario = mongoose.model('Inventario', inventarioSchema);

const vehiculoSchema = new mongoose.Schema({
    marca: { type: String, required: true },
    modelo: { type: String, required: true },
    año: { type: Number },
    color: { type: String },
    patente: { type: String, unique: true, sparse: true },
    kilometraje: { type: Number, default: 0 },
    fechaCompra: { type: Date, default: Date.now },
    costoCompra: { type: Number, required: true },
    proveedor: { type: String, default: '' },
    comprador: { type: String, default: '' },
    reparaciones: [{
        descripcion: { type: String },
        costo: { type: Number, default: 0 },
        fecha: { type: Date, default: Date.now },
        proveedor: { type: String, default: '' }
    }],
    costoTotalReparaciones: { type: Number, default: 0 },
    costoTotal: { type: Number, default: 0 },
    fechaVenta: { type: Date },
    precioVenta: { type: Number, default: 0 },
    compradorFinal: { type: String, default: '' },
    ganancia: { type: Number, default: 0 },
    estado: { 
        type: String, 
        enum: ['disponible', 'en_reparacion', 'vendido'],
        default: 'disponible'
    },
    observaciones: { type: String, default: '' },
    fechaCreacion: { type: Date, default: Date.now },
    fechaActualizacion: { type: Date, default: Date.now }
});
const Vehiculo = mongoose.model('Vehiculo', vehiculoSchema);

// ============================================================
// SERVIDOR
// ============================================================
const servidor = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ============================================================
    // 🔥 PRIMERO: RUTAS DE API (ANTES DE ARCHIVOS ESTÁTICOS)
    // ============================================================

    // === RUTAS DE VEHÍCULOS ===
    if (req.method === 'GET' && req.url === '/obtener-vehiculos') {
        try {
            const vehiculos = await Vehiculo.find({}).sort({ fechaCreacion: -1 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(vehiculos));
            return;
        } catch (error) {
            console.error("Error obteniendo vehículos:", error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Error al obtener vehículos" }));
            return;
        }
    }

    if (req.method === 'GET' && req.url.startsWith('/obtener-vehiculo/')) {
        try {
            const id = req.url.split('/')[2];
            const vehiculo = await Vehiculo.findById(id);
            
            if (!vehiculo) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: "Vehículo no encontrado" }));
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(vehiculo));
            return;
        } catch (error) {
            console.error("Error obteniendo vehículo:", error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Error al obtener vehículo" }));
            return;
        }
    }

    if (req.method === 'POST' && req.url === '/guardar-vehiculo') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const datos = JSON.parse(cuerpo);
                
                if (!datos.marca || !datos.modelo || !datos.costoCompra) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ 
                        error: "Faltan campos obligatorios: marca, modelo y costoCompra" 
                    }));
                    return;
                }

                const costoTotal = (datos.costoCompra || 0) + (datos.costoTotalReparaciones || 0);
                
                const nuevoVehiculo = new Vehiculo({
                    marca: datos.marca,
                    modelo: datos.modelo,
                    año: datos.año,
                    color: datos.color,
                    patente: datos.patente,
                    kilometraje: datos.kilometraje || 0,
                    fechaCompra: datos.fechaCompra || new Date(),
                    costoCompra: datos.costoCompra,
                    proveedor: datos.proveedor || '',
                    comprador: datos.comprador || '',
                    reparaciones: datos.reparaciones || [],
                    costoTotalReparaciones: datos.costoTotalReparaciones || 0,
                    costoTotal: costoTotal,
                    estado: datos.estado || 'disponible',
                    observaciones: datos.observaciones || ''
                });

                await nuevoVehiculo.save();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    mensaje: "Vehículo guardado correctamente",
                    id: nuevoVehiculo._id 
                }));
            } catch (error) {
                console.error("Error guardando vehículo:", error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al guardar vehículo" }));
            }
        });
        return;
    }

    if (req.method === 'PUT' && req.url.startsWith('/actualizar-vehiculo/')) {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const id = req.url.split('/')[2];
                const datos = JSON.parse(cuerpo);
                
                const vehiculo = await Vehiculo.findById(id);
                if (!vehiculo) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: "Vehículo no encontrado" }));
                    return;
                }

                if (datos.marca) vehiculo.marca = datos.marca;
                if (datos.modelo) vehiculo.modelo = datos.modelo;
                if (datos.año) vehiculo.año = datos.año;
                if (datos.color) vehiculo.color = datos.color;
                if (datos.patente) vehiculo.patente = datos.patente;
                if (datos.kilometraje) vehiculo.kilometraje = datos.kilometraje;
                if (datos.costoCompra) vehiculo.costoCompra = datos.costoCompra;
                if (datos.proveedor) vehiculo.proveedor = datos.proveedor;
                if (datos.comprador) vehiculo.comprador = datos.comprador;
                if (datos.observaciones) vehiculo.observaciones = datos.observaciones;
                
                if (datos.reparaciones) {
                    vehiculo.reparaciones = datos.reparaciones;
                    vehiculo.costoTotalReparaciones = datos.reparaciones.reduce((sum, r) => sum + (r.costo || 0), 0);
                }
                
                if (datos.estado === 'vendido' && datos.precioVenta) {
                    vehiculo.estado = 'vendido';
                    vehiculo.precioVenta = datos.precioVenta;
                    vehiculo.compradorFinal = datos.compradorFinal || '';
                    vehiculo.fechaVenta = new Date();
                    vehiculo.costoTotal = (vehiculo.costoCompra || 0) + (vehiculo.costoTotalReparaciones || 0);
                    vehiculo.ganancia = (datos.precioVenta || 0) - (vehiculo.costoTotal || 0);
                }
                
                if (datos.estado && datos.estado !== 'vendido') {
                    vehiculo.estado = datos.estado;
                }
                
                if (!datos.estado || datos.estado !== 'vendido') {
                    vehiculo.costoTotal = (vehiculo.costoCompra || 0) + (vehiculo.costoTotalReparaciones || 0);
                }
                
                vehiculo.fechaActualizacion = new Date();
                await vehiculo.save();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    mensaje: "Vehículo actualizado correctamente",
                    vehiculo: vehiculo
                }));
            } catch (error) {
                console.error("Error actualizando vehículo:", error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al actualizar vehículo" }));
            }
        });
        return;
    }

    if (req.method === 'DELETE' && req.url.startsWith('/eliminar-vehiculo/')) {
        try {
            const id = req.url.split('/')[2];
            const resultado = await Vehiculo.deleteOne({ _id: id });
            
            if (resultado.deletedCount === 0) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: "Vehículo no encontrado" }));
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ mensaje: "Vehículo eliminado correctamente" }));
        } catch (error) {
            console.error("Error eliminando vehículo:", error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Error al eliminar vehículo" }));
        }
        return;
    }

    // === RUTAS DE CLIENTES ===
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
        return;
    }

    if (req.method === 'POST' && req.url === '/guardar-cliente') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const nuevoRegistro = JSON.parse(cuerpo);
                
                if (nuevoRegistro.cedulaRuc) {
                    nuevoRegistro.cedulaRuc = nuevoRegistro.cedulaRuc.toString().trim();
                }

                if (!nuevoRegistro.pinCliente || nuevoRegistro.pinCliente.toString().trim() === "") {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "El PIN es obligatorio." }));
                    return;
                }

                nuevoRegistro.pinCliente = nuevoRegistro.pinCliente.toString().trim();

                if (nuevoRegistro.repuestos && nuevoRegistro.repuestos.length > 0) {
                    for (const repuesto of nuevoRegistro.repuestos) {
                        if (!repuesto.noDescontar && repuesto.descripcion && repuesto.descripcion.trim() !== "") {
                            const producto = await Inventario.findOne({ 
                                nombre: repuesto.descripcion.trim()
                            });
                            
                            if (producto) {
                                if (producto.stock > 0) {
                                    await Inventario.updateOne(
                                        { _id: producto._id },
                                        { $inc: { stock: -1 } }
                                    );
                                    console.log(`📦 Stock descontado: ${producto.nombre}`);
                                }
                            }
                        }
                    }
                }

                const nuevoDoc = new Cliente(nuevoRegistro);
                await nuevoDoc.save();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    mensaje: "Cliente guardado correctamente", 
                    pin: nuevoRegistro.pinCliente 
                }));
            } catch (e) {
                console.error("❌ Error en /guardar-cliente:", e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al guardar en el servidor" }));
            }
        });
        return;
    }

    // === RUTAS DE INVENTARIO ===
    if (req.method === 'GET' && req.url === '/obtener-inventario') {
        try {
            const productos = await Inventario.find({});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(productos));
        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Error al obtener inventario" }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/guardar-producto') {
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
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al guardar producto" }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/actualizar-producto') {
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
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al actualizar producto" }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/eliminar-producto') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const { _id } = JSON.parse(cuerpo);
                await Inventario.deleteOne({ _id: _id });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ mensaje: "Producto eliminado correctamente" }));
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Error al eliminar producto" }));
            }
        });
        return;
    }

    // === RUTAS DE CLIENTES (continuación) ===
    if (req.method === 'POST' && req.url === '/validar-pin') {
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
        return;
    }

    if (req.method === 'POST' && req.url === '/eliminar-registro') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const { pinCliente, fechaIngreso } = JSON.parse(cuerpo);
                const resultado = await Cliente.deleteMany({ pinCliente: pinCliente, fechaIngreso: fechaIngreso });
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
        return;
    }

    if (req.method === 'POST' && req.url === '/eliminar-cliente') {
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
        return;
    }

    if (req.method === 'POST' && req.url === '/actualizar-pin-masivo') {
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
        return;
    }

    if (req.method === 'GET' && req.url.startsWith('/obtener-clientes')) {
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
        return;
    }

    if (req.method === 'POST' && req.url === '/eliminar-por-id') {
        let cuerpo = '';
        req.on('data', pedacito => { cuerpo += pedacito; });
        req.on('end', async () => {
            try {
                const { id } = JSON.parse(cuerpo);
                const resultado = await Cliente.deleteOne({ _id: id });
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
        return;
    }

    // ============================================================
    // 📁 ARCHIVOS ESTÁTICOS (SOLO DESPUÉS DE TODAS LAS RUTAS DE API)
    // ============================================================
    if (req.method === 'GET') {
        let urlPublica = req.url === '/' ? 'index.html' : req.url.split('?')[0];
        let rutaArchivo = path.join(__dirname, urlPublica);

        if (!rutaArchivo.startsWith(__dirname)) {
            res.writeHead(403);
            res.end('Acceso denegado');
            return;
        }

        let extension = path.extname(rutaArchivo);
        let contentType = 'text/html';
        const tiposMime = { 
            '.css': 'text/css', 
            '.js': 'text/javascript', 
            '.png': 'image/png', 
            '.jpg': 'image/jpeg',
            '.json': 'application/json'
        };
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

// ============================================================
// INICIAR SERVIDOR
// ============================================================
servidor.listen(PUERTO, '0.0.0.0', () => {
    console.log(`\n🚀 Servidor funcionando con rutas de vehículos`);
    console.log(`📌 Puerto: ${PUERTO}`);
    console.log(`📌 Modelos: Cliente, Inventario, Vehiculo`);
    console.log(`📌 Rutas de vehículos disponibles:`);
    console.log(`   GET    /obtener-vehiculos`);
    console.log(`   GET    /obtener-vehiculo/:id`);
    console.log(`   POST   /guardar-vehiculo`);
    console.log(`   PUT    /actualizar-vehiculo/:id`);
    console.log(`   DELETE /eliminar-vehiculo/:id`);
});