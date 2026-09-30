const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let djangoProcess;

function iniciarDjango() {
    const rutaServidor = path.join(
        process.resourcesPath,
        'backend',
        'servidor.exe'
    );

    djangoProcess = spawn(
        rutaServidor,
        [],
        {
            cwd: path.dirname(rutaServidor),
            windowsHide: true
        }
    );

    djangoProcess.stdout.on('data', (data) => {
        console.log(`Django: ${data}`);
    });

    djangoProcess.stderr.on('data', (data) => {
        console.error(`Django: ${data}`);
    });
}

function iniciarReact() {
    require('./server.cjs');
}

function createWindow() {
    const ventana = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    ventana.loadURL('http://localhost:4173');

    ventana.webContents.openDevTools();
}

app.whenReady().then(() => {
    iniciarDjango();
    iniciarReact();

    setTimeout(() => {
        createWindow();
    }, 3000);
});

app.on('window-all-closed', () => {

    if (djangoProcess) {
        djangoProcess.kill();
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});