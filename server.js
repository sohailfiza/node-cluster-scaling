import cluster from 'node:cluster';
import os from 'os';
import express from 'express';

const availableCPU = os.cpus().length;
const PORT = 3000;

if (cluster.isPrimary) {
    console.log(`[${new Date().toISOString()}] Primary ${process.pid} is running`);

    // Fork workers
    for (let i = 0; i < availableCPU; i++) {
        cluster.fork();
    }

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
        console.log(`[${new Date().toISOString()}] Worker ${worker.process.pid} died. Forking a new worker...`);
        cluster.fork();
    });
} else {
    const app = express();

    // Root endpoint
    app.get('/', (req, res) => {
        return res.json({ message: `Server running, PID: ${process.pid}` });
    });

    // Status endpoint
    app.get('/status', (req, res) => {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        const loadAverage = os.loadavg();

        const status = {
            pid: process.pid,
            memoryUsage,
            uptime,
            loadAverage,
            cpuCount: availableCPU,
        };

        return res.json(status);
    });

    // Start the server
    const server = app.listen(PORT, () => {
        console.log(`[${new Date().toISOString()}] Server started at port: ${PORT}, PID: ${process.pid}`);
    });

    // Handle server shutdown
    const shutdown = () => {
        console.log(`[${new Date().toISOString()}] Worker ${process.pid} shutting down...`);
        server.close(() => {
            console.log(`[${new Date().toISOString()}] Server on port ${PORT} (PID: ${process.pid}) closed`);
            process.exit();
        });

        // Force close server after 5 seconds
        setTimeout(() => {
            console.error(`[${new Date().toISOString()}] Forcing server on port ${PORT} (PID: ${process.pid}) to shut down...`);
            process.exit(1);
        }, 5000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error(`[${new Date().toISOString()}] Uncaught Exception:`, err);
        shutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error(`[${new Date().toISOString()}] Unhandled Rejection:`, reason);
        shutdown();
    });
}