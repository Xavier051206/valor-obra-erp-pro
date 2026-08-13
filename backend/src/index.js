require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// 🔌 CONEXIÓN A POSTGRESQL
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

pool.connect()
    .then(async (client) => {
        console.log('✅ Conectado a la Base de Datos de ObraPro');
        try {
            await client.query('ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS tasa_oficial_dia DECIMAL(10,4) DEFAULT 1;');
            
            await client.query('ALTER TABLE objetivos_obra ADD COLUMN IF NOT EXISTS presupuesto_id INT REFERENCES presupuestos(id) ON DELETE CASCADE;');
            
            await client.query(`
                CREATE TABLE IF NOT EXISTS pagos_comision (
                    id SERIAL PRIMARY KEY,
                    proyecto_id INT REFERENCES proyectos(id) ON DELETE CASCADE,
                    monto_abonado_usd DECIMAL(15,2) NOT NULL,
                    moneda_usada VARCHAR(10) NOT NULL,
                    monto_original DECIMAL(15,2) NOT NULL,
                    tasa_cambio DECIMAL(10,4) NOT NULL,
                    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS usuarios (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(100) NOT NULL
                );
            `);

            await client.query(`
                INSERT INTO usuarios (username, password) 
                VALUES ('admin', '1234') 
                ON CONFLICT (username) DO NOTHING;
            `);

        } catch (e) {
            console.error("Nota: Verifica manualmente la migración de tablas", e.message);
        } finally {
            client.release();
        }
    })
    .catch(err => {
        console.error('❌ Error conectando a la Base de Datos', err);
    });

const actualizarTasasBCV = async () => {
    try {
        console.log('🔄 Consultando tasas oficiales del BCV...');
        
        const resDolar = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial');
        const resEuro = await axios.get('https://ve.dolarapi.com/v1/euros/oficial');

        const tasaDolar = resDolar.data.promedio;
        const tasaEuro = resEuro.data.promedio;

        if (tasaDolar) {
            if (tasaEuro) {
                await pool.query(`
                    INSERT INTO historial_tasas (tasa_bcv_usd, tasa_bcv_eur, fecha) 
                    VALUES ($1, $2, CURRENT_DATE)
                    ON CONFLICT (fecha) 
                    DO UPDATE SET tasa_bcv_usd = EXCLUDED.tasa_bcv_usd, tasa_bcv_eur = EXCLUDED.tasa_bcv_eur;
                `, [tasaDolar, tasaEuro]);
                
                console.log('✅ ¡Tasas Actualizadas correctamente!');
                console.log('✅ USD:', tasaDolar, 'Bs');
                console.log('✅ EUR:', tasaEuro, 'Bs');
            }
        }
    } catch (error) {
        console.error('❌ Error al consultar las tasas del BCV:', error.message);
    }
};

cron.schedule('0 8,12,16 * * *', () => {
    actualizarTasasBCV();
});

app.get('/api/tasas/actual', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM historial_tasas WHERE fecha = CURRENT_DATE');
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            await actualizarTasasBCV();
            const nuevoResult = await pool.query('SELECT * FROM historial_tasas WHERE fecha = CURRENT_DATE');
            
            if (nuevoResult.rows.length > 0) {
                res.json(nuevoResult.rows[0]);
            } else {
                res.json({ error: "No se pudo obtener la tasa en este momento" });
            }
        }
    } catch (error) {
        console.error("Error en la ruta de tasas:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE username = $1 AND password = $2', [username, password]);
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0].username });
        } else {
            res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🔥 RUTA ACTUALIZADA: RESUMEN GLOBAL INCLUYENDO HISTORIAL DE COMISIONES
app.get('/api/global-resumen', async (req, res) => {
    try {
        const txs = await pool.query('SELECT * FROM transacciones');
        let saldoBs = 0;
        let saldoUsd = 0;
        let diferencialGlobal = 0;
        let totalIngresosUSD = 0;
        let totalEgresosUSD = 0;

        txs.rows.forEach(tx => {
            const montoOriginal = parseFloat(tx.monto_moneda_original) || 0;
            const montoReal = tx.moneda_usada === 'BS' ? (montoOriginal / parseFloat(tx.tasa_oficial_dia)) : parseFloat(tx.monto_usd_real);
            
            if (tx.moneda_usada === 'BS') {
                if (tx.tipo === 'INGRESO') saldoBs += montoOriginal;
                else saldoBs -= montoOriginal;
            } else if (tx.moneda_usada === 'USD') {
                if (tx.tipo === 'INGRESO') saldoUsd += montoOriginal;
                else saldoUsd -= montoOriginal;
            }

            if (tx.tipo === 'INGRESO') totalIngresosUSD += montoReal;
            else totalEgresosUSD += montoReal;

            if (tx.moneda_usada === 'BS' && tx.tasa_oficial_dia && tx.tasa_bcv_momento) {
                const dolaresOficial = montoOriginal / parseFloat(tx.tasa_oficial_dia);
                const dolaresRecepcion = montoOriginal / parseFloat(tx.tasa_bcv_momento);
                if (tx.tipo === 'INGRESO') diferencialGlobal += (dolaresOficial - dolaresRecepcion);
                else diferencialGlobal += (dolaresRecepcion - dolaresOficial);
            }
        });

        // 💰 CONSULTA DE COMISIONES GENERALES
        const presRes = await pool.query('SELECT SUM(comision_usd) as total_comision FROM presupuestos');
        const pagosRes = await pool.query(`
            SELECT pc.*, p.nombre as proyecto_nombre 
            FROM pagos_comision pc 
            JOIN proyectos p ON pc.proyecto_id = p.id 
            ORDER BY pc.fecha DESC
        `);

        let totalComisionGlobal = parseFloat(presRes.rows[0]?.total_comision) || 0;
        let totalComisionPagadaGlobal = 0;
        
        pagosRes.rows.forEach(p => {
            totalComisionPagadaGlobal += parseFloat(p.monto_abonado_usd) || 0;
        });

        res.json({
            saldoBs: saldoBs,
            saldoUsd: saldoUsd,
            diferencialGlobal: diferencialGlobal,
            totalIngresosUSD: totalIngresosUSD,
            totalEgresosUSD: totalEgresosUSD,
            saldoCuentaUSD: totalIngresosUSD - totalEgresosUSD,
            // Datos de Comisiones:
            totalComisionGlobal: totalComisionGlobal,
            totalComisionPagadaGlobal: totalComisionPagadaGlobal,
            comisionPendienteGlobal: totalComisionGlobal - totalComisionPagadaGlobal,
            historialComisiones: pagosRes.rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('🏗️ API de ObraPro funcionando al 100%');
});

app.get('/api/proyectos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, 
                   COALESCE((SELECT COUNT(*) FROM objetivos_obra WHERE proyecto_id = p.id), 0) as total_hitos,
                   COALESCE((SELECT COUNT(*) FROM objetivos_obra WHERE proyecto_id = p.id AND completado = true), 0) as hitos_completados
            FROM proyectos p ORDER BY p.id DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("Error obteniendo proyectos:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/proyectos/:id/detalle', async (req, res) => {
    try {
        const id = req.params.id;
        const projRes = await pool.query('SELECT * FROM proyectos WHERE id = $1', [id]);
        
        if (projRes.rows.length === 0) {
            return res.status(404).json({ error: "Obra no encontrada" });
        }

        const presRes = await pool.query('SELECT * FROM presupuestos WHERE proyecto_id = $1 ORDER BY id ASC', [id]);
        const pagosRes = await pool.query('SELECT * FROM pagos_comision WHERE proyecto_id = $1 ORDER BY id DESC', [id]);
        
        res.json({
            proyecto: projRes.rows[0],
            presupuestos: presRes.rows || [],
            pagos_comision: pagosRes.rows || []
        });
    } catch (error) {
        console.error("Error obteniendo detalle de obra:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/proyectos-completo', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { 
            nombre, cliente, ubicacion, 
            costo_estimado_usd, tipo_ganancia, valor_ganancia, 
            porcentaje_comision, tasa_bcv_presupuesto, 
            objetivos 
        } = req.body;

        const costo = parseFloat(costo_estimado_usd) || 0;
        const valorG = parseFloat(valor_ganancia) || 0;
        const pComision = parseFloat(porcentaje_comision) || 15;
        const base_imponible_usd = costo;

        let ganancia_esperada_usd = 0;
        if (tipo_ganancia === 'PORCENTAJE') {
            ganancia_esperada_usd = (base_imponible_usd * valorG) / 100;
        } else {
            ganancia_esperada_usd = valorG;
        }

        const comision_usd = (base_imponible_usd * pComision) / 100;
        const iva_16_usd = base_imponible_usd * 0.16;
        const presupuesto_total_usd = base_imponible_usd + iva_16_usd;

        const projRes = await client.query(
            "INSERT INTO proyectos (nombre, cliente, ubicacion, estado) VALUES ($1, $2, $3, 'EN EJECUCIÓN') RETURNING *",
            [nombre, cliente, ubicacion]
        );
        const proyectoId = projRes.rows[0].id;

        const presRes = await client.query(
            `INSERT INTO presupuestos 
            (proyecto_id, tipo, descripcion, costo_estimado_usd, tipo_ganancia, valor_ganancia, ganancia_esperada_usd, base_imponible_usd, iva_16_usd, porcentaje_comision, comision_usd, presupuesto_total_usd, tasa_bcv_presupuesto) 
            VALUES ($1, 'BASE', 'Presupuesto Base Inicial', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                proyectoId, costo, tipo_ganancia, valorG, 
                ganancia_esperada_usd, base_imponible_usd, iva_16_usd, 
                pComision, comision_usd, presupuesto_total_usd, tasa_bcv_presupuesto || 1
            ]
        );
        const presupuestoId = presRes.rows[0].id;

        if (objetivos && objetivos.length > 0) {
            for (let objText of objetivos) {
                if (objText.trim() !== '') {
                    await client.query(
                        'INSERT INTO objetivos_obra (proyecto_id, presupuesto_id, descripcion, completado) VALUES ($1, $2, $3, false)',
                        [proyectoId, presupuestoId, objText.trim()]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, proyecto: projRes.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creando proyecto completo:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.post('/api/proyectos/:id/finalizar', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const id = req.params.id;

        await client.query("UPDATE proyectos SET estado = 'FINALIZADA' WHERE id = $1", [id]);
        await client.query("UPDATE objetivos_obra SET completado = true WHERE proyecto_id = $1", [id]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Obra finalizada con éxito y hitos al 100%" });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error finalizando obra:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.get('/api/objetivos/:proyecto_id', async (req, res) => {
    try {
        const proyecto_id = req.params.proyecto_id;
        const result = await pool.query('SELECT * FROM objetivos_obra WHERE proyecto_id = $1 ORDER BY id ASC', [proyecto_id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/objetivos', async (req, res) => {
    try {
        const { proyecto_id, descripcion, presupuesto_id } = req.body;
        
        let idToUse = presupuesto_id;
        
        if (!idToUse) {
            const presRes = await pool.query("SELECT id FROM presupuestos WHERE proyecto_id = $1 AND tipo = 'BASE' ORDER BY id ASC LIMIT 1", [proyecto_id]);
            idToUse = presRes.rows.length > 0 ? presRes.rows[0].id : null;
        }

        const result = await pool.query(
            'INSERT INTO objetivos_obra (proyecto_id, presupuesto_id, descripcion, completado) VALUES ($1, $2, $3, false) RETURNING *',
            [proyecto_id, idToUse, descripcion]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error al registrar hito:", error);
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/objetivos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const completado = req.body.completado;
        const result = await pool.query('UPDATE objetivos_obra SET completado = $1 WHERE id = $2 RETURNING *', [completado, id]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/proyectos/:id/presupuestos-extra', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const id = req.params.id;
        const { descripcion, costo_estimado_usd, tipo_ganancia, valor_ganancia, porcentaje_comision, tasa_bcv_presupuesto, objetivos } = req.body;

        const costo = parseFloat(costo_estimado_usd) || 0;
        const valorG = parseFloat(valor_ganancia) || 0;
        const pComision = parseFloat(porcentaje_comision) || 15;
        const base_imponible_usd = costo;

        let ganancia_esperada_usd = 0;
        if (tipo_ganancia === 'PORCENTAJE') {
            ganancia_esperada_usd = (base_imponible_usd * valorG) / 100;
        } else {
            ganancia_esperada_usd = valorG;
        }

        const comision_usd = (base_imponible_usd * pComision) / 100;
        const iva_16_usd = base_imponible_usd * 0.16;
        const presupuesto_total_usd = base_imponible_usd + iva_16_usd;

        const result = await client.query(
            `INSERT INTO presupuestos 
            (proyecto_id, tipo, descripcion, costo_estimado_usd, tipo_ganancia, valor_ganancia, ganancia_esperada_usd, base_imponible_usd, iva_16_usd, porcentaje_comision, comision_usd, presupuesto_total_usd, tasa_bcv_presupuesto) 
            VALUES ($1, 'EXTRA', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                id, descripcion || 'Trabajo Extra Adicional', costo, tipo_ganancia, valorG,
                ganancia_esperada_usd, base_imponible_usd, iva_16_usd,
                pComision, comision_usd, presupuesto_total_usd, tasa_bcv_presupuesto || 1
            ]
        );
        
        const presupuestoId = result.rows[0].id;

        if (objetivos && objetivos.length > 0) {
            for (let objText of objetivos) {
                if (objText.trim() !== '') {
                    await client.query(
                        'INSERT INTO objetivos_obra (proyecto_id, presupuesto_id, descripcion, completado) VALUES ($1, $2, $3, false)',
                        [id, presupuestoId, objText.trim()]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, presupuesto: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creando obra extra:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.get('/api/transacciones/:proyecto_id', async (req, res) => {
    try {
        const proyecto_id = req.params.proyecto_id;
        const result = await pool.query('SELECT * FROM transacciones WHERE proyecto_id = $1 ORDER BY id DESC', [proyecto_id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/transacciones', async (req, res) => {
    try {
        const { proyecto_id, tipo, categoria, concepto, moneda_usada, monto_moneda_original, tasa_bcv_momento, tasa_oficial_dia } = req.body;
        const montoOriginal = parseFloat(monto_moneda_original) || 0;
        const tasaRecepcion = parseFloat(tasa_bcv_momento) || 1;
        const tasaOficial = parseFloat(tasa_oficial_dia) || tasaRecepcion;

        let monto_usd_real = 0;
        if (moneda_usada === 'USD') {
            monto_usd_real = montoOriginal;
        } else {
            monto_usd_real = montoOriginal / tasaOficial; 
        }

        const result = await pool.query(
            `INSERT INTO transacciones 
            (proyecto_id, tipo, categoria, concepto, moneda_usada, monto_moneda_original, tasa_bcv_momento, tasa_oficial_dia, monto_usd_real) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [proyecto_id, tipo, categoria || 'GENERAL', concepto, moneda_usada, montoOriginal, tasaRecepcion, tasaOficial, monto_usd_real]
        );

        res.json({ success: true, transaccion: result.rows[0] });
    } catch (error) {
        console.error("Error registrando transacción:", error);
        res.status(500).json({ error: error.message });
    }
}); 

app.post('/api/comprar-dolares', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { proyecto_id, monto_usd, tasa_compra, tasa_oficial_dia } = req.body;
        
        const usd = parseFloat(monto_usd) || 0;
        const tasa = parseFloat(tasa_compra) || 1;
        const oficial = parseFloat(tasa_oficial_dia) || tasa;
        const bsGastados = usd * tasa;

        await client.query(
            `INSERT INTO transacciones (proyecto_id, tipo, categoria, concepto, moneda_usada, monto_moneda_original, tasa_bcv_momento, tasa_oficial_dia, monto_usd_real) 
            VALUES ($1, 'EGRESO', 'COMPRA_DOLARES', 'Intercambio de Bs a Divisas', 'BS', $2, $3, $4, $5)`,
            [proyecto_id, bsGastados, tasa, oficial, bsGastados / oficial]
        );

        await client.query(
            `INSERT INTO transacciones (proyecto_id, tipo, categoria, concepto, moneda_usada, monto_moneda_original, tasa_bcv_momento, tasa_oficial_dia, monto_usd_real) 
            VALUES ($1, 'INGRESO', 'COMPRA_DOLARES', 'Recepción de Divisas Compradas', 'USD', $2, 1, 1, $3)`,
            [proyecto_id, usd, usd]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error comprando dólares:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.post('/api/pagos-comision', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { proyecto_id, moneda_usada, monto_original, tasa_cambio, tasa_oficial } = req.body;
        const montoOriginal = parseFloat(monto_original) || 0;
        const tasaRecepcion = parseFloat(tasa_cambio) || 1;
        const tasaOficialDia = parseFloat(tasa_oficial) || tasaRecepcion;

        let montoAbonadoUSD = moneda_usada === 'USD' ? montoOriginal : (montoOriginal / tasaOficialDia);

        const pagoRes = await client.query(
            `INSERT INTO pagos_comision (proyecto_id, monto_abonado_usd, moneda_usada, monto_original, tasa_cambio) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [proyecto_id, montoAbonadoUSD, moneda_usada, montoOriginal, tasaRecepcion]
        );

        await client.query(
            `INSERT INTO transacciones (proyecto_id, tipo, categoria, concepto, moneda_usada, monto_moneda_original, tasa_bcv_momento, tasa_oficial_dia, monto_usd_real) 
            VALUES ($1, 'EGRESO', 'COMISION', 'Pago de Comisión (15%)', $2, $3, $4, $5, $6)`,
            [proyecto_id, moneda_usada, montoOriginal, tasaRecepcion, tasaOficialDia, montoAbonadoUSD]
        );

        await client.query('COMMIT');
        res.json({ success: true, pago: pagoRes.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error registrando pago de comisión:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.post('/api/proyectos', async (req, res) => {
    try {
        const { nombre, cliente, ubicacion } = req.body;
        const resInsert = await pool.query("INSERT INTO proyectos (nombre, cliente, ubicacion, estado) VALUES ($1, $2, $3, 'EN EJECUCIÓN') RETURNING *", [nombre, cliente, ubicacion]);
        res.json(resInsert.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    await actualizarTasasBCV(); 
});